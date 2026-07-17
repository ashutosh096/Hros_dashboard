/**
 * @fileoverview Express router endpoints for calendar events.
 * Implements CRUD actions for scheduling internal meetings.
 */

import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, meetingsTable } from "@workspace/db";
import {
  ListMeetingsResponse,
  ListMeetingsQueryParams,
  GetMeetingParams,
  GetMeetingResponse,
  CreateMeetingBody,
  UpdateMeetingParams,
  UpdateMeetingBody,
  UpdateMeetingResponse,
  DeleteMeetingParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticateSession } from "../middlewares/auth";
import { logAuditEvent } from "../lib/audit";

const router: IRouter = Router();
const TOKENS_FILE = path.resolve(import.meta.dirname, "../../../google-tokens.json");

function generateMockMeetLink(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `https://meet.google.com/${part1}-${part2}-${part3}`;
}

router.get("/meetings", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const qp = ListMeetingsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }
  const nowIso = new Date().toISOString();
  let rows = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.organizationId, orgId))
    .orderBy(meetingsTable.startTime);
  if (qp.data.upcoming === "true") {
    rows = rows.filter(r => r.startTime >= nowIso);
  }
  res.json(ListMeetingsResponse.parse(serializeDates(rows)));
});

router.post("/meetings", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  
  const { addToGoogleCalendar, ...insertData } = parsed.data;
  let meetLink = parsed.data.meetLink;
  let googleEventId = null;
  let source = "LOCAL";
  const organizerEmail = parsed.data.organizer.toLowerCase();

  // Generate Meet link or sync with Google Calendar
  if (addToGoogleCalendar === true) {
    let tokens: Record<string, any> = {};
    try {
      const tokensData = await fs.readFile(TOKENS_FILE, "utf-8");
      tokens = JSON.parse(tokensData);
    } catch {}

    const userToken = tokens[organizerEmail];
    if (userToken) {
      let accessToken = userToken.accessToken;
      
      // Refresh expired tokens
      if (Date.now() > userToken.expiry && userToken.refreshToken) {
        try {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: userToken.refreshToken,
              grant_type: "refresh_token",
            }),
          });
          if (refreshRes.ok) {
            const refreshData: any = await refreshRes.json();
            accessToken = refreshData.access_token;
            userToken.accessToken = accessToken;
            userToken.expiry = Date.now() + (refreshData.expires_in * 1000);
            tokens[organizerEmail] = userToken;
            await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
          }
        } catch (e) {
          console.error("Failed to refresh token:", e);
        }
      }

      // Create event on Google Calendar
      try {
        const body: any = {
          summary: parsed.data.title,
          description: parsed.data.description || "",
          start: { dateTime: parsed.data.startTime },
          end: { dateTime: parsed.data.endTime },
          attendees: (parsed.data.attendees || []).map((email) => ({ email })),
        };

        if (parsed.data.location) {
          body.location = parsed.data.location;
        } else if (meetLink) {
          body.location = meetLink;
        }

        // Only request conference generation if they didn't provide a manual link
        if (!meetLink) {
          body.conferenceData = {
            createRequest: {
              requestId: Math.random().toString(36).substring(2),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          };
        }

        const eventRes = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (eventRes.ok) {
          const eventData: any = await eventRes.json();
          let resolvedMeetLink = eventData.hangoutLink;
          if (!resolvedMeetLink && eventData.conferenceData?.entryPoints) {
            const videoEntryPoint = eventData.conferenceData.entryPoints.find(
              (ep: any) => ep.entryPointType === "video"
            );
            if (videoEntryPoint) {
              resolvedMeetLink = videoEntryPoint.uri;
            }
          }
          if (resolvedMeetLink) {
            meetLink = resolvedMeetLink;
          }
          googleEventId = eventData.id;
          source = "GOOGLE_CALENDAR";
        } else {
          const errText = await eventRes.text();
          console.warn("Google event creation response not OK:", eventRes.status, errText);
        }
      } catch (e) {
        console.error("Google Calendar event creation failed:", e);
      }
    } else {
      // Simulated/Mock calendar creation
      if (!meetLink) {
        meetLink = generateMockMeetLink();
      }
      googleEventId = `mock-gmeet-created-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      source = "GOOGLE_CALENDAR";
    }
  } else {
    // Local meeting only (no Google Calendar integration requested)
    if (!meetLink) {
      meetLink = generateMockMeetLink();
    }
  }

  // Insert meeting
  const [meeting] = await db
    .insert(meetingsTable)
    .values({
      ...insertData,
      organizationId: orgId,
      meetLink,
      googleEventId,
      source,
    })
    .returning();

  await logAuditEvent(orgId, actorId, "CREATE_MEETING", "MEETING", meeting.id, null, meeting);

  res.status(201).json(GetMeetingResponse.parse(serializeDates(meeting)));
});

router.get("/meetings/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const params = GetMeetingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [meeting] = await db
    .select()
    .from(meetingsTable)
    .where(and(eq(meetingsTable.id, params.data.id), eq(meetingsTable.organizationId, orgId)));
  if (!meeting) { res.status(404).json({ error: "Meeting not found" }); return; }
  res.json(GetMeetingResponse.parse(serializeDates(meeting)));
});

router.patch("/meetings/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = UpdateMeetingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db
    .select()
    .from(meetingsTable)
    .where(and(eq(meetingsTable.id, params.data.id), eq(meetingsTable.organizationId, orgId)));

  if (!before) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const [meeting] = await db
    .update(meetingsTable)
    .set(parsed.data)
    .where(and(eq(meetingsTable.id, params.data.id), eq(meetingsTable.organizationId, orgId)))
    .returning();

  await logAuditEvent(orgId, actorId, "UPDATE_MEETING", "MEETING", meeting.id, before, meeting);

  res.json(UpdateMeetingResponse.parse(serializeDates(meeting)));
});

router.delete("/meetings/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  
  const [meeting] = await db
    .select()
    .from(meetingsTable)
    .where(and(eq(meetingsTable.id, params.data.id), eq(meetingsTable.organizationId, orgId)));
  if (!meeting) { res.status(404).json({ error: "Meeting not found" }); return; }

  // Delete from Google Calendar if it's a synced Google event
  if (meeting.source === "GOOGLE_CALENDAR" && meeting.googleEventId) {
    const organizerEmail = meeting.organizer.toLowerCase();
    let tokens: Record<string, any> = {};
    try {
      const tokensData = await fs.readFile(TOKENS_FILE, "utf-8");
      tokens = JSON.parse(tokensData);
    } catch {}

    const userToken = tokens[organizerEmail];
    if (userToken) {
      let accessToken = userToken.accessToken;
      if (Date.now() > userToken.expiry && userToken.refreshToken) {
        try {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: userToken.refreshToken,
              grant_type: "refresh_token",
            }),
          });
          if (refreshRes.ok) {
            const refreshData: any = await refreshRes.json();
            accessToken = refreshData.access_token;
            userToken.accessToken = accessToken;
            userToken.expiry = Date.now() + (refreshData.expires_in * 1000);
            tokens[organizerEmail] = userToken;
            await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
          }
        } catch {}
      }

      try {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.googleEventId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      } catch (e) {
        console.error("Failed to delete event from Google Calendar:", e);
      }
    }
  }

  await db
    .delete(meetingsTable)
    .where(and(eq(meetingsTable.id, params.data.id), eq(meetingsTable.organizationId, orgId)));

  await logAuditEvent(orgId, actorId, "DELETE_MEETING", "MEETING", params.data.id, meeting, null);

  res.sendStatus(204);
});

export default router;
