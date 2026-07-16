import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable, employeesTable } from "@workspace/db";
import {
  ListTasksResponse,
  ListTasksQueryParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { authenticateSession } from "../middlewares/auth";
import { logAuditEvent } from "../lib/audit";

const router: IRouter = Router();

async function enrichTask(task: typeof tasksTable.$inferSelect, orgId: number) {
  let assignee = null;
  if (task.assigneeId) {
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.id, task.assigneeId), eq(employeesTable.organizationId, orgId)));
    if (emp) assignee = { ...emp, salary: emp.salary ? Number(emp.salary) : null };
  }
  return serializeDates({ ...task, assignee });
}

router.get("/tasks", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const qp = ListTasksQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }
  let rows = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.organizationId, orgId))
    .orderBy(tasksTable.createdAt);
  if (qp.data.assigneeId) rows = rows.filter(t => t.assigneeId === qp.data.assigneeId);
  if (qp.data.status) rows = rows.filter(t => t.status === qp.data.status);
  const enriched = await Promise.all(rows.map(row => enrichTask(row, orgId)));
  res.json(ListTasksResponse.parse(enriched));
});

router.post("/tasks", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Check if assignee is in the organization
  if (parsed.data.assigneeId) {
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.id, parsed.data.assigneeId), eq(employeesTable.organizationId, orgId)));
    if (!emp) {
      res.status(400).json({ error: "Assignee employee does not exist in this organization" });
      return;
    }
  }

  const [task] = await db.insert(tasksTable).values({
    ...parsed.data,
    organizationId: orgId,
  }).returning();

  await logAuditEvent(orgId, actorId, "CREATE_TASK", "TASK", task.id, null, task);

  const enriched = await enrichTask(task, orgId);
  res.status(201).json(enriched);
});

router.patch("/tasks/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.organizationId, orgId)));

  if (!before) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Check if assignee is in the organization
  if (parsed.data.assigneeId) {
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.id, parsed.data.assigneeId), eq(employeesTable.organizationId, orgId)));
    if (!emp) {
      res.status(400).json({ error: "Assignee employee does not exist in this organization" });
      return;
    }
  }

  const [task] = await db
    .update(tasksTable)
    .set(parsed.data)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.organizationId, orgId)))
    .returning();

  await logAuditEvent(orgId, actorId, "UPDATE_TASK", "TASK", task.id, before, task);

  const enriched = await enrichTask(task, orgId);
  res.json(UpdateTaskResponse.parse(enriched));
});

router.delete("/tasks/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [before] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.organizationId, orgId)));

  if (!before) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.organizationId, orgId)));

  await logAuditEvent(orgId, actorId, "DELETE_TASK", "TASK", params.data.id, before, null);

  res.sendStatus(204);
});

export default router;
