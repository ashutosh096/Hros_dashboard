/**
 * @fileoverview Express router endpoints for employee management.
 * Manages listing, creating, and updating employee profiles.
 */

import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, employeesTable } from "@workspace/db";
import {
  ListEmployeesResponse,
  GetEmployeeParams,
  GetEmployeeResponse,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  UpdateEmployeeResponse,
  DeleteEmployeeParams,
  CreateEmployeeBody,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { authenticateSession } from "../middlewares/auth";
import { logAuditEvent } from "../lib/audit";

const router: IRouter = Router();

function serializeEmployee(e: typeof employeesTable.$inferSelect) {
  return serializeDates({ ...e, salary: e.salary ? Number(e.salary) : null });
}

router.get("/employees", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const employees = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.organizationId, orgId))
    .orderBy(employeesTable.name);
  res.json(ListEmployeesResponse.parse(employees.map(serializeEmployee)));
});

router.post("/employees", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { salary, ...rest } = parsed.data;
  const [emp] = await db.insert(employeesTable).values({
    ...rest,
    organizationId: orgId,
    salary: salary != null ? String(salary) : undefined,
  }).returning();

  await logAuditEvent(orgId, actorId, "CREATE_EMPLOYEE", "EMPLOYEE", emp.id, null, emp);

  res.status(201).json(GetEmployeeResponse.parse(serializeEmployee(emp)));
});

router.get("/employees/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [emp] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.organizationId, orgId)));
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(GetEmployeeResponse.parse(serializeEmployee(emp)));
});

router.patch("/employees/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.organizationId, orgId)));
  if (!before) { res.status(404).json({ error: "Employee not found" }); return; }

  const { salary, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (salary !== undefined) updateData.salary = salary != null ? String(salary) : null;
  const [emp] = await db
    .update(employeesTable)
    .set(updateData)
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.organizationId, orgId)))
    .returning();

  await logAuditEvent(orgId, actorId, "UPDATE_EMPLOYEE", "EMPLOYEE", emp.id, before, emp);

  res.json(UpdateEmployeeResponse.parse(serializeEmployee(emp)));
});

router.delete("/employees/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [before] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.organizationId, orgId)));
  if (!before) { res.status(404).json({ error: "Employee not found" }); return; }

  await db
    .delete(employeesTable)
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.organizationId, orgId)));

  await logAuditEvent(orgId, actorId, "DELETE_EMPLOYEE", "EMPLOYEE", params.data.id, before, null);

  res.sendStatus(204);
});

export default router;
