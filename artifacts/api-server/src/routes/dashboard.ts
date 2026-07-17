/**
 * @fileoverview Express router endpoints for dashboard statistics.
 * Returns aggregated metrics for tasks, announcements, and attendance summary.
 */

import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, employeesTable, attendanceTable, meetingsTable, tasksTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetTodayAttendanceResponse,
  GetDashboardUpcomingMeetingsResponse,
  GetAttendanceChartResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { authenticateSession } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const today = new Date().toISOString().split("T")[0];

  const [employees, allAttendance, allMeetings, allTasks] = await Promise.all([
    db.select().from(employeesTable).where(eq(employeesTable.organizationId, orgId)),
    db.select().from(attendanceTable).where(eq(attendanceTable.organizationId, orgId)),
    db.select().from(meetingsTable).where(eq(meetingsTable.organizationId, orgId)),
    db.select().from(tasksTable).where(eq(tasksTable.organizationId, orgId)),
  ]);

  const todayAttendance = allAttendance.filter(r => r.date === today);
  const todayMeetings = allMeetings.filter(r => r.startTime.startsWith(today));
  const pendingTasks = allTasks.filter(t => t.status !== "DONE");

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === "ACTIVE").length;
  const presentToday = todayAttendance.filter(r => r.status === "PRESENT" || r.status === "LATE").length;
  const onLeaveToday = todayAttendance.filter(r => r.status === "ON_LEAVE").length;
  const meetingsToday = todayMeetings.length;
  const pendingTasksCount = pendingTasks.length;
  const totalRecordsToday = todayAttendance.length;
  const attendanceRate = totalRecordsToday > 0 ? Math.round((presentToday / totalRecordsToday) * 100) : 0;

  res.json(GetDashboardStatsResponse.parse({
    totalEmployees,
    presentToday,
    meetingsToday,
    pendingTasks: pendingTasksCount,
    attendanceRate,
    activeEmployees,
    onLeaveToday,
  }));
});

router.get("/dashboard/today-attendance", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const today = new Date().toISOString().split("T")[0];
  
  const employees = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.organizationId, orgId));
    
  const todayRecords = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.date, today), eq(attendanceTable.organizationId, orgId)));

  const rows = employees.map(emp => {
    const rec = todayRecords.find(r => r.employeeId === emp.id);
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      avatarUrl: emp.avatarUrl ?? null,
      checkIn: rec?.checkIn ?? null,
      checkOut: rec?.checkOut ?? null,
      status: rec?.status ?? "ABSENT",
    };
  });

  res.json(GetTodayAttendanceResponse.parse(rows));
});

router.get("/dashboard/upcoming-meetings", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const nowIso = new Date().toISOString();
  const allMeetings = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.organizationId, orgId));
    
  const meetings = allMeetings
    .filter(m => m.startTime >= nowIso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 5);
  res.json(GetDashboardUpcomingMeetingsResponse.parse(serializeDates(meetings)));
});

router.get("/dashboard/attendance-chart", authenticateSession, async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const allRecords = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.organizationId, orgId));

  const points = days.map(date => {
    const dayRecords = allRecords.filter(r => r.date === date);
    return {
      date,
      present: dayRecords.filter(r => r.status === "PRESENT").length,
      absent: dayRecords.filter(r => r.status === "ABSENT").length,
      late: dayRecords.filter(r => r.status === "LATE").length,
    };
  });

  res.json(GetAttendanceChartResponse.parse(points));
});

export default router;
