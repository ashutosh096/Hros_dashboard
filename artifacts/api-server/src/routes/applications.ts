import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, applicationsTable } from "@workspace/db";
import {
  ListApplicationsResponse,
  CreateApplicationBody,
  UpdateApplicationParams,
  UpdateApplicationBody,
  UpdateApplicationResponse,
  DeleteApplicationParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { authenticateSession } from "../middlewares/auth";
import { logAuditEvent } from "../lib/audit";

const router: IRouter = Router();

/**
 * GET /applications
 * Retrieves a list of all job/leave applications within the organization, ordered by ID.
 */
router.get("/applications", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const rows = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.organizationId, orgId))
    .orderBy(applicationsTable.id);

  res.json(ListApplicationsResponse.parse(serializeDates(rows)));
});

/**
 * POST /applications
 * Creates a new application within the organization, validating request body and auditing the event.
 */
router.post("/applications", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [application] = await db
    .insert(applicationsTable)
    .values({
      ...parsed.data,
      organizationId: orgId,
    })
    .returning();

  await logAuditEvent(
    orgId,
    actorId,
    "CREATE_APPLICATION",
    "APPLICATION",
    application.id,
    null,
    application
  );

  res.status(201).json(serializeDates(application));
});

// PATCH /applications/:id
router.patch("/applications/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = UpdateApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [before] = await db
    .select()
    .from(applicationsTable)
    .where(
      and(
        eq(applicationsTable.id, params.data.id),
        eq(applicationsTable.organizationId, orgId)
      )
    );

  if (!before) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [application] = await db
    .update(applicationsTable)
    .set(parsed.data)
    .where(
      and(
        eq(applicationsTable.id, params.data.id),
        eq(applicationsTable.organizationId, orgId)
      )
    )
    .returning();

  await logAuditEvent(
    orgId,
    actorId,
    "UPDATE_APPLICATION",
    "APPLICATION",
    application.id,
    before,
    application
  );

  res.json(UpdateApplicationResponse.parse(serializeDates(application)));
});

// DELETE /applications/:id
router.delete("/applications/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = DeleteApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [application] = await db
    .select()
    .from(applicationsTable)
    .where(
      and(
        eq(applicationsTable.id, params.data.id),
        eq(applicationsTable.organizationId, orgId)
      )
    );
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  await db
    .delete(applicationsTable)
    .where(
      and(
        eq(applicationsTable.id, params.data.id),
        eq(applicationsTable.organizationId, orgId)
      )
    );

  await logAuditEvent(
    orgId,
    actorId,
    "DELETE_APPLICATION",
    "APPLICATION",
    params.data.id,
    application,
    null
  );

  res.sendStatus(204);
});

export default router;
