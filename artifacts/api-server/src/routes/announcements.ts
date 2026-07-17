/**
 * @fileoverview Express router endpoints for announcement management.
 * Exposes CRUD endpoints protected by authentication/tenant scopes.
 */

import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, announcementsTable } from "@workspace/db";
import {
  ListAnnouncementsResponse,
  CreateAnnouncementBody,
  DeleteAnnouncementParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { authenticateSession } from "../middlewares/auth";
import { logAuditEvent } from "../lib/audit";

const router: IRouter = Router();

router.get("/announcements", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(eq(announcementsTable.organizationId, orgId))
    .orderBy(announcementsTable.pinned, desc(announcementsTable.createdAt));
  res.json(ListAnnouncementsResponse.parse(serializeDates(rows)));
});

router.post("/announcements", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [ann] = await db.insert(announcementsTable).values({
    ...parsed.data,
    organizationId: orgId,
  }).returning();

  await logAuditEvent(orgId, actorId, "CREATE_ANNOUNCEMENT", "ANNOUNCEMENT", ann.id, null, ann);

  res.status(201).json(serializeDates(ann));
});

router.delete("/announcements/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = DeleteAnnouncementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [before] = await db
    .select()
    .from(announcementsTable)
    .where(and(eq(announcementsTable.id, params.data.id), eq(announcementsTable.organizationId, orgId)));

  if (!before) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }

  await db
    .delete(announcementsTable)
    .where(and(eq(announcementsTable.id, params.data.id), eq(announcementsTable.organizationId, orgId)));

  await logAuditEvent(orgId, actorId, "DELETE_ANNOUNCEMENT", "ANNOUNCEMENT", params.data.id, before, null);

  res.sendStatus(204);
});

export default router;
