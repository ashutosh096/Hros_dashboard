import { Router } from "express";
import { db, employeesTable, attendanceTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { authenticateSession } from "../middlewares/auth";

const router = Router();

/**
 * Calculates the number of official working days (excluding Saturdays and Sundays)
 * in a given month and year.
 * 
 * @param year - The year (e.g. 2026)
 * @param month - The month index (1-12)
 * @returns The count of weekdays in that month
 */
function getWorkingDays(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * GET /salary
 * Computes and returns salary slips for all active employees (admins) or a specific employee.
 * Calculates daily rate, deductions for absences, and net payable salary based on attendance.
 */
router.get("/salary", authenticateSession, async (req, res): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const userRole = req.user!.role;
    const userEmail = req.user!.email;

    const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const [year, month] = monthParam.split("-").map(Number);

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    // Get active employees based on role
    let allEmployees;
    if (userRole === "ADMIN") {
      allEmployees = await db
        .select()
        .from(employeesTable)
        .where(and(eq(employeesTable.status, "ACTIVE"), eq(employeesTable.organizationId, orgId)));
    } else {
      // Non-admin (EMPLOYEE) is restricted to their own record matching email
      allEmployees = await db
        .select()
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.status, "ACTIVE"),
            eq(employeesTable.organizationId, orgId),
            eq(employeesTable.email, userEmail)
          )
        );
    }

    const monthAttendance = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          gte(attendanceTable.date, startDate),
          lte(attendanceTable.date, endDate),
          eq(attendanceTable.organizationId, orgId)
        )
      );

    const workingDays = getWorkingDays(year, month);
    const now = new Date();
    const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

    const slips = allEmployees.map((emp) => {
      const empAttendance = monthAttendance.filter((a) => a.employeeId === emp.id);
      const presentDays = empAttendance.filter((a) => a.status === "PRESENT").length;
      const halfDays = empAttendance.filter((a) => a.status === "HALF_DAY").length;
      const leaveDays = empAttendance.filter((a) => a.status === "ON_LEAVE").length;
      const absentDays = Math.max(0, workingDays - presentDays - halfDays - leaveDays);

      const baseSalary = Number(emp.salary ?? 0);
      const dailyRate = baseSalary / workingDays;
      const deductions = absentDays * dailyRate;
      const netPayable = Math.round(baseSalary - deductions);

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        baseSalary,
        month: monthParam,
        workingDays,
        presentDays,
        halfDays,
        absentDays,
        deductions: Math.round(deductions),
        netPayable,
        status: isPastMonth ? "PAID" : "PENDING",
      };
    });

    res.json(slips);
  } catch (err) {
    req.log.error(err, "salary route error");
    res.status(500).json({ error: "Failed to compute salary data" });
  }
});

export default router;
