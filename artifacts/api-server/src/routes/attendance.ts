import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, attendanceTable, employeesTable } from "@workspace/db";
import {
  ListAttendanceResponse,
  ListAttendanceQueryParams,
  CreateAttendanceBody,
  UpdateAttendanceParams,
  UpdateAttendanceBody,
  UpdateAttendanceResponse,
  GetAttendanceSummaryQueryParams,
  GetAttendanceSummaryResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { authenticateSession } from "../middlewares/auth";
import { logAuditEvent } from "../lib/audit";

const router: IRouter = Router();

async function enrichAttendance(row: typeof attendanceTable.$inferSelect, orgId: number) {
  const [emp] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, row.employeeId), eq(employeesTable.organizationId, orgId)));
  return serializeDates({
    ...row,
    hoursWorked: row.hoursWorked ? Number(row.hoursWorked) : null,
    employee: emp ? { ...emp, salary: emp.salary ? Number(emp.salary) : null } : undefined,
  });
}

router.get("/attendance/summary", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const qp = GetAttendanceSummaryQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  let rows = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.organizationId, orgId));

  if (qp.data.month) {
    rows = rows.filter(r => r.date.startsWith(qp.data.month!));
  }

  const totalDays = rows.length;
  const presentDays = rows.filter(r => r.status === "PRESENT").length;
  const absentDays = rows.filter(r => r.status === "ABSENT").length;
  const lateDays = rows.filter(r => r.status === "LATE").length;
  const halfDays = rows.filter(r => r.status === "HALF_DAY").length;
  const leaveDays = rows.filter(r => r.status === "ON_LEAVE").length;
  const attendanceRate = totalDays > 0 ? Math.round(((presentDays + lateDays + halfDays) / totalDays) * 100) : 0;

  res.json(GetAttendanceSummaryResponse.parse({ totalDays, presentDays, absentDays, lateDays, halfDays, leaveDays, attendanceRate }));
});

router.get("/attendance", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const qp = ListAttendanceQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  let rows = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.organizationId, orgId))
    .orderBy(attendanceTable.date);

  if (qp.data.employeeId) rows = rows.filter(r => r.employeeId === qp.data.employeeId);
  if (qp.data.date) rows = rows.filter(r => r.date === qp.data.date);
  if (qp.data.month) rows = rows.filter(r => r.date.startsWith(qp.data.month!));

  const enriched = await Promise.all(rows.map(row => enrichAttendance(row, orgId)));
  res.json(ListAttendanceResponse.parse(enriched));
});

router.post("/attendance", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const parsed = CreateAttendanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Verify employee is in the same organization
  const [emp] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, parsed.data.employeeId), eq(employeesTable.organizationId, orgId)));
  
  if (!emp) {
    res.status(400).json({ error: "Employee does not exist in this organization" });
    return;
  }

  const { hoursWorked, ...rest } = parsed.data;
  const [row] = await db.insert(attendanceTable).values({
    ...rest,
    organizationId: orgId,
    hoursWorked: hoursWorked != null ? String(hoursWorked) : undefined,
  }).returning();

  await logAuditEvent(orgId, actorId, "CREATE_ATTENDANCE", "ATTENDANCE", row.id, null, row);

  const enriched = await enrichAttendance(row, orgId);
  res.status(201).json(enriched);
});

router.patch("/attendance/:id", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const actorId = req.user!.userId;
  const params = UpdateAttendanceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateAttendanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.id, params.data.id), eq(attendanceTable.organizationId, orgId)));

  if (!before) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  const { hoursWorked, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (hoursWorked !== undefined) updateData.hoursWorked = hoursWorked != null ? String(hoursWorked) : null;
  const [row] = await db
    .update(attendanceTable)
    .set(updateData)
    .where(and(eq(attendanceTable.id, params.data.id), eq(attendanceTable.organizationId, orgId)))
    .returning();

  await logAuditEvent(orgId, actorId, "UPDATE_ATTENDANCE", "ATTENDANCE", row.id, before, row);

  const enriched = await enrichAttendance(row, orgId);
  res.json(UpdateAttendanceResponse.parse(enriched));
});

export default router;
