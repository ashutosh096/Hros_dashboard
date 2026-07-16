import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, meetingsTable, usersTable } from "@workspace/db";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticateSession } from "../middlewares/auth";

const router: IRouter = Router();
const TOKENS_FILE = path.resolve(import.meta.dirname, "../../../google-tokens.json");

// Helper to load tokens
async function loadTokens(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(TOKENS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Helper to save tokens
async function saveTokens(tokens: Record<string, any>) {
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

// Get config and status
router.get("/auth/google/config", authenticateSession, async (req, res): Promise<void> => {
  const email = req.user!.email;
  const hasConfig = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  
  if (!email) {
    res.json({ hasConfig, connected: false });
    return;
  }

  const tokens = await loadTokens();
  const userToken = tokens[email.toLowerCase()];
  res.json({
    hasConfig,
    connected: !!userToken,
    email: userToken?.email || null,
  });
});

// Start OAuth flow
router.get("/auth/google", authenticateSession, async (req, res): Promise<void> => {
  const email = req.user!.email;
  if (!email) {
    res.status(400).send("Email parameter is required");
    return;
  }

  const clientID = process.env.GOOGLE_CLIENT_ID;
  if (!clientID) {
    res.status(500).send("Google OAuth is not configured on this server");
    return;
  }

  const redirectUri = `http://localhost:${process.env.PORT || 8080}/api/auth/google/callback`;
  const scope = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";
  const state = encodeURIComponent(JSON.stringify({ email: email.toLowerCase() }));

  const url = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${encodeURIComponent(clientID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${state}`;

  res.redirect(url);
});

// OAuth Callback
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const code = req.query.code as string;
  const stateStr = req.query.state as string;

  if (!code || !stateStr) {
    res.status(400).send("Invalid callback request");
    return;
  }

  try {
    const { email } = JSON.parse(decodeURIComponent(stateStr));
    
    // Exchange auth code for tokens
    const redirectUri = `http://localhost:${process.env.PORT || 8080}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      res.status(500).send(`Failed to exchange code: ${errText}`);
      return;
    }

    const tokenData: any = await tokenRes.json();
    
    // Save tokens
    const tokens = await loadTokens();
    tokens[email] = {
      email,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || tokens[email]?.refreshToken,
      expiry: Date.now() + (tokenData.expires_in * 1000),
    };
    await saveTokens(tokens);

    // Redirect to frontend meetings page
    res.redirect("http://localhost:5173/meetings?sync=success");
  } catch (err: any) {
    res.status(500).send(`Error processing callback: ${err.message}`);
  }
});

// Disconnect Google Calendar
router.post("/auth/google/disconnect", authenticateSession, async (req, res): Promise<void> => {
  const email = req.user!.email;
  const orgId = req.user!.organizationId;

  const tokens = await loadTokens();
  delete tokens[email.toLowerCase()];
  await saveTokens(tokens);

  // Clean up synced events from this user in the DB
  await db.delete(meetingsTable).where(
    and(
      eq(meetingsTable.source, "GOOGLE_CALENDAR"),
      eq(meetingsTable.organizer, email.toLowerCase()),
      eq(meetingsTable.organizationId, orgId)
    )
  );

  res.json({ success: true });
});

// Sync Meetings Endpoint
router.post("/meetings/sync", authenticateSession, async (req, res): Promise<void> => {
  const email = req.user!.email;
  const orgId = req.user!.organizationId;
  const { simulated } = req.body;

  const normalizedEmail = email.toLowerCase();
  
  if (simulated) {
    // Simulated mode: insert mock Google Meet invites
    const mockEvents = [
      {
        googleEventId: `mock-gmeet-1-${normalizedEmail}`,
        title: "📋 Product Design Sync",
        description: "Reviewing the user interface designs for the new dashboard widgets.",
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        meetLink: "https://meet.google.com/qwe-rtyu-iop",
        location: "Google Meet",
        organizer: "lead.designer@google.com",
        attendees: [normalizedEmail, "lead.designer@google.com", "frontend.dev@company.com"],
      },
      {
        googleEventId: `mock-gmeet-2-${normalizedEmail}`,
        title: "🤝 Candidate Interview: Lead Architect",
        description: "Technical screen and system design discussion.",
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        meetLink: "https://meet.google.com/zxc-vbnm-asd",
        location: "Google Meet",
        organizer: "recruiter@hr-partners.org",
        attendees: [normalizedEmail, "recruiter@hr-partners.org", "candidate@gmail.com"],
      },
    ];

    const syncedMeetings = [];
    for (const event of mockEvents) {
      // Check if event exists
      const [existing] = await db
        .select()
        .from(meetingsTable)
        .where(
          and(
            eq(meetingsTable.googleEventId, event.googleEventId),
            eq(meetingsTable.organizationId, orgId)
          )
        );

      if (existing) {
        // Update it
        const [updated] = await db
          .update(meetingsTable)
          .set({
            title: event.title,
            description: event.description,
            startTime: event.startTime,
            endTime: event.endTime,
            meetLink: event.meetLink,
            location: event.location,
            attendees: event.attendees,
          })
          .where(eq(meetingsTable.id, existing.id))
          .returning();
        syncedMeetings.push(updated);
      } else {
        // Insert new
        const [inserted] = await db
          .insert(meetingsTable)
          .values({
            organizationId: orgId,
            title: event.title,
            description: event.description,
            startTime: event.startTime,
            endTime: event.endTime,
            meetLink: event.meetLink,
            location: event.location,
            organizer: event.organizer,
            attendees: event.attendees,
            source: "GOOGLE_CALENDAR",
            googleEventId: event.googleEventId,
            status: "SCHEDULED",
          })
          .returning();
        syncedMeetings.push(inserted);
      }
    }

    res.json({ success: true, count: syncedMeetings.length });
    return;
  }

  // Real Google Calendar Sync Mode
  const tokens = await loadTokens();
  const userToken = tokens[normalizedEmail];
  if (!userToken) {
    res.status(401).json({ error: "Google Calendar not connected for this email." });
    return;
  }

  let accessToken = userToken.accessToken;

  // Refresh access token if expired
  if (Date.now() > userToken.expiry) {
    if (!userToken.refreshToken) {
      res.status(401).json({ error: "Token expired, please reconnect." });
      return;
    }

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

      if (!refreshRes.ok) {
        throw new Error("Failed to refresh token");
      }

      const refreshData: any = await refreshRes.json();
      accessToken = refreshData.access_token;
      
      userToken.accessToken = accessToken;
      userToken.expiry = Date.now() + (refreshData.expires_in * 1000);
      tokens[normalizedEmail] = userToken;
      await saveTokens(tokens);
    } catch {
      res.status(401).json({ error: "Failed to refresh Google auth session." });
      return;
    }
  }

  try {
    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // 1. Fetch the user's calendars list to include secondary calendars
    const calendarListRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    let calendarIds = ["primary"];
    if (calendarListRes.ok) {
      const calendarListData = await calendarListRes.json();
      const writableCalendars = (calendarListData.items || []).filter(
        (cal: any) => cal.accessRole === "owner" || cal.accessRole === "writer"
      );
      if (writableCalendars.length > 0) {
        calendarIds = writableCalendars.map((cal: any) => cal.id);
      }
    }

    const activeGoogleEventIds = new Set<string>();
    let totalSynced = 0;

    for (const calendarId of calendarIds) {
      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&orderBy=startTime&maxResults=150&timeMin=${encodeURIComponent(timeMin)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!eventsRes.ok) {
        console.warn(`Failed to fetch events for calendar: ${calendarId}`);
        continue;
      }

      const eventList: any = await eventsRes.json();
      const googleEvents = eventList.items || [];
      totalSynced += googleEvents.length;

      for (const event of googleEvents) {
        const googleEventId = event.id;
        activeGoogleEventIds.add(googleEventId);

        const title = event.summary || "Google Calendar Event";
        const description = event.description || "";
        const startTime = event.start?.dateTime || event.start?.date + "T09:00:00Z";
        const endTime = event.end?.dateTime || event.end?.date + "T10:00:00Z";
        
        let meetLink = event.hangoutLink || "";
        if (!meetLink && event.conferenceData?.entryPoints) {
          const videoEntryPoint = event.conferenceData.entryPoints.find(
            (ep: any) => ep.entryPointType === "video"
          );
          if (videoEntryPoint) {
            meetLink = videoEntryPoint.uri;
          }
        }
        if (!meetLink && event.location && (event.location.startsWith("http://") || event.location.startsWith("https://"))) {
          meetLink = event.location;
        }
        if (!meetLink) {
          meetLink = "";
        }
        const organizer = event.organizer?.email || normalizedEmail;
        
        const attendees = (event.attendees || []).map((a: any) => a.email).filter(Boolean);
        if (!attendees.includes(normalizedEmail)) {
          attendees.push(normalizedEmail);
        }

        const [existing] = await db
          .select()
          .from(meetingsTable)
          .where(
            and(
              eq(meetingsTable.googleEventId, googleEventId),
              eq(meetingsTable.organizationId, orgId)
            )
          );

        if (existing) {
          await db
            .update(meetingsTable)
            .set({
              title,
              description,
              startTime,
              endTime,
              meetLink,
              location: event.location || "Google Meet",
              attendees,
              organizer,
            })
            .where(eq(meetingsTable.id, existing.id));
        } else {
          await db.insert(meetingsTable).values({
            organizationId: orgId,
            title,
            description,
            startTime,
            endTime,
            meetLink,
            location: event.location || "Google Meet",
            organizer,
            status: "SCHEDULED",
            attendees,
            source: "GOOGLE_CALENDAR",
            googleEventId,
          });
        }
      }
    }

    // Delete any GOOGLE_CALENDAR meetings that are no longer present in Google Calendar
    const allDbSynced = await db
      .select()
      .from(meetingsTable)
      .where(
        and(
          eq(meetingsTable.source, "GOOGLE_CALENDAR"),
          eq(meetingsTable.organizationId, orgId)
        )
      );

    for (const meeting of allDbSynced) {
      if (meeting.googleEventId && !activeGoogleEventIds.has(meeting.googleEventId)) {
        if (meeting.attendees?.some((email: string) => email.toLowerCase() === normalizedEmail)) {
          await db.delete(meetingsTable).where(eq(meetingsTable.id, meeting.id));
        }
      }
    }

    res.json({ success: true, count: totalSynced });
  } catch (err: any) {
    res.status(500).json({ error: `Sync error: ${err.message}` });
  }
});

export default router;
