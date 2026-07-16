import { useState } from "react";
import { useListAttendance, useListEmployees } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, Clock, Plane } from "lucide-react";

/**
 * CSS style class mapping for attendance record status levels.
 */
const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  ABSENT: "bg-red-50 text-red-600 border border-red-200",
  LATE: "bg-amber-50 text-amber-700 border border-amber-200",
  HALF_DAY: "bg-blue-50 text-blue-700 border border-blue-200",
  ON_LEAVE: "bg-purple-50 text-purple-700 border border-purple-200",
};

/**
 * CSS background dot class mapping for visual attendance status indicators.
 */
const STATUS_DOT: Record<string, string> = {
  PRESENT: "bg-emerald-500",
  ABSENT: "bg-red-400",
  LATE: "bg-amber-500",
  HALF_DAY: "bg-blue-400",
  ON_LEAVE: "bg-purple-400",
};

/**
 * AttendancePage Component
 * Renders the attendance logs, metrics (Present/Absent/Half Day/Leave counters),
 * and handles admin summary tables as well as individual employee calendar views.
 */
export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const { data: attendance, isLoading } = useListAttendance({ month: selectedMonth });
  const { data: employees } = useListEmployees();

  const monthLabel = format(parseISO(selectedMonth + "-01"), "MMMM yyyy");

  const presentCount = attendance?.filter((r) => r.status === "PRESENT").length ?? 0;
  const absentCount = attendance?.filter((r) => r.status === "ABSENT").length ?? 0;
  const halfDayCount = attendance?.filter((r) => r.status === "HALF_DAY").length ?? 0;
  const leaveCount = attendance?.filter((r) => r.status === "ON_LEAVE").length ?? 0;

  // Compute monthly presence summary per employee
  const employeeSummaries = (employees ?? []).map((emp) => {
    const empRecords = (attendance ?? []).filter((r) => r.employeeId === emp.id);
    const present = empRecords.filter((r) => r.status === "PRESENT").length;
    const late = empRecords.filter((r) => r.status === "LATE").length;
    const halfDay = empRecords.filter((r) => r.status === "HALF_DAY").length;
    const absent = empRecords.filter((r) => r.status === "ABSENT").length;
    const leave = empRecords.filter((r) => r.status === "ON_LEAVE").length;

    // PRESENT + LATE counts as full day, HALF_DAY counts as 0.5 day
    const totalPresent = present + late + (halfDay * 0.5);
    const totalWorkingDays = empRecords.length;
    const rate = totalWorkingDays > 0 ? Math.round((totalPresent / totalWorkingDays) * 100) : 0;

    return {
      employee: emp,
      present,
      late,
      halfDay,
      absent,
      leave,
      totalPresent,
      totalWorkingDays,
      rate,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{monthLabel}</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Present", value: presentCount, icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, gradient: "bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] border-emerald-100 text-emerald-950" },
          { label: "Absent", value: absentCount, icon: <XCircle className="h-5 w-5 text-red-500" />, gradient: "bg-[linear-gradient(135deg,#fff5f5_0%,#ffe3e3_100%)] border-red-100 text-red-950" },
          { label: "Half Day", value: halfDayCount, icon: <Clock className="h-5 w-5 text-blue-500" />, gradient: "bg-[linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_100%)] border-sky-100 text-sky-950" },
          { label: "Leave", value: leaveCount, icon: <Plane className="h-5 w-5 text-purple-500" />, gradient: "bg-[linear-gradient(135deg,#fdf4ff_0%,#f3e8ff_100%)] border-purple-100 text-purple-950" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl p-5 border shadow-sm flex items-center gap-4 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 ${s.gradient}`}>
            <div className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-md flex items-center justify-center shadow-2xs border border-white/50">{s.icon}</div>
            <div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-semibold opacity-75 uppercase tracking-wider">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {isAdmin ? (
        <div className="space-y-6">
          {/* Monthly Presence Summary Table */}
          <div className="bg-white/85 backdrop-blur-sm rounded-2xl border border-white/80 shadow-sm overflow-hidden animate-fade-in">
            <div className="px-6 py-5 border-b border-black/5 bg-white/40">
              <h3 className="font-bold text-slate-900">Monthly Presence Summary — {monthLabel}</h3>
              <p className="text-xs text-slate-650 mt-0.5">Total working days each employee was present</p>
            </div>
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 bg-slate-50/50">
                      <th className="text-left py-3.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Days Present</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Breakdown</th>
                      <th className="text-left py-3.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Presence Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted-foreground py-12">No employee records found.</td>
                      </tr>
                    ) : (
                      employeeSummaries.map((summary) => {
                        const totalPresentFormatted = summary.totalPresent % 1 === 0 
                          ? summary.totalPresent 
                          : summary.totalPresent.toFixed(1);
                        
                        return (
                          <tr key={summary.employee.id} className="border-b border-black/5 hover:bg-white/60 transition-colors">
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                                    {summary.employee.name?.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-gray-800">{summary.employee.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{summary.employee.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                                {totalPresentFormatted} {summary.totalPresent === 1 ? "day" : "days"} Present
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-650">
                              <div className="flex flex-wrap gap-1.5 font-medium">
                                <span className="text-emerald-750">{summary.present} Present</span>
                                {summary.late > 0 && <span className="text-amber-700">• {summary.late} Late</span>}
                                {summary.halfDay > 0 && <span className="text-blue-700">• {summary.halfDay} Half Day</span>}
                                {summary.absent > 0 && <span className="text-red-600">• {summary.absent} Absent</span>}
                                {summary.leave > 0 && <span className="text-purple-700">• {summary.leave} Leave</span>}
                              </div>
                            </td>
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 w-9 text-right">{summary.rate}%</span>
                                <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden border border-black/5">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      summary.rate >= 80 ? "bg-emerald-500" : summary.rate >= 60 ? "bg-amber-500" : "bg-rose-500"
                                    }`}
                                    style={{ width: `${summary.rate}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed Logs Section */}
          <div className="bg-white/85 backdrop-blur-sm rounded-2xl border border-white/80 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-black/5 bg-white/40">
              <h3 className="font-bold text-slate-900">Attendance Log — {monthLabel}</h3>
              <p className="text-xs text-slate-600 mt-0.5">Live records updated by each employee</p>
            </div>
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 bg-slate-50/50">
                      <th className="text-left py-3.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted-foreground py-12">No records for this month.</td>
                      </tr>
                    ) : (
                      attendance?.slice().reverse().map((record) => (
                        <tr key={record.id} className="border-b border-black/5 hover:bg-white/60 transition-colors">
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                                  {record.employee?.name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-gray-800">{record.employee?.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {format(parseISO(record.date), "EEE, MMM d")}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[record.status] ?? "bg-gray-50 text-gray-600"}`}>
                              {record.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">—</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Employee: Calendar view */
        <EmployeeCalendar month={selectedMonth} attendance={attendance ?? []} isLoading={isLoading} />
      )}
    </div>
  );
}

const CELL_THEMES: Record<string, { bg: string; text: string; border: string; pillBg: string; pillText: string; label: string }> = {
  PRESENT: {
    bg: "bg-emerald-50/60 hover:bg-emerald-100/60",
    text: "text-emerald-950 font-bold",
    border: "border-emerald-200/50 shadow-xs",
    pillBg: "bg-emerald-500/10",
    pillText: "text-emerald-700",
    label: "Present",
  },
  ABSENT: {
    bg: "bg-rose-50/60 hover:bg-rose-100/60",
    text: "text-rose-950 font-bold",
    border: "border-rose-200/50 shadow-xs",
    pillBg: "bg-rose-500/10",
    pillText: "text-rose-600",
    label: "Absent",
  },
  LATE: {
    bg: "bg-amber-50/60 hover:bg-amber-100/60",
    text: "text-amber-950 font-bold",
    border: "border-amber-200/50 shadow-xs",
    pillBg: "bg-amber-500/10",
    pillText: "text-amber-700",
    label: "Late",
  },
  HALF_DAY: {
    bg: "bg-blue-50/60 hover:bg-blue-100/60",
    text: "text-blue-950 font-bold",
    border: "border-blue-200/50 shadow-xs",
    pillBg: "bg-blue-500/10",
    pillText: "text-blue-700",
    label: "Half Day",
  },
  ON_LEAVE: {
    bg: "bg-purple-50/60 hover:bg-purple-100/60",
    text: "text-purple-950 font-bold",
    border: "border-purple-200/50 shadow-xs",
    pillBg: "bg-purple-500/10",
    pillText: "text-purple-700",
    label: "Leave",
  },
};

const DEFAULT_THEME = {
  bg: "bg-slate-50/30 hover:bg-slate-50/80",
  text: "text-slate-700",
  border: "border-slate-100/80",
  pillBg: "",
  pillText: "",
  label: "",
};

function EmployeeCalendar({ month, attendance, isLoading }: { month: string; attendance: any[]; isLoading: boolean }) {
  const monthStart = startOfMonth(parseISO(month + "-01"));
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const attendanceByDate: Record<string, string> = {};
  attendance.forEach((r) => { attendanceByDate[r.date] = r.status; });

  const summary = {
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    HALF_DAY: 0,
    ON_LEAVE: 0,
  };
  
  attendance.forEach((r) => {
    if (r.date.startsWith(month) && summary[r.status as keyof typeof summary] !== undefined) {
      summary[r.status as keyof typeof summary]++;
    }
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  return (
    <div className="bg-white/85 backdrop-blur-sm rounded-2xl border border-white/80 shadow-sm p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-black/5 pb-4 gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">My Attendance Calendar</h3>
          <p className="text-xs text-slate-650 mt-0.5">Your attendance record for {format(monthStart, "MMMM yyyy")}</p>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Present", value: summary.PRESENT, color: "bg-emerald-50/60 text-emerald-800 border-emerald-100/80" },
          { label: "Half Day", value: summary.HALF_DAY, color: "bg-blue-50/60 text-blue-800 border-blue-100/80" },
          { label: "Absent", value: summary.ABSENT, color: "bg-red-50/60 text-red-800 border-red-100/80" },
          { label: "Leave", value: summary.ON_LEAVE, color: "bg-purple-50/60 text-purple-800 border-purple-100/80" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3 border flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow ${s.color}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{s.label}</span>
            <span className="text-xl font-black mt-1.5">{s.value} <span className="text-xs font-semibold opacity-70">days</span></span>
          </div>
        ))}
      </div>

      <div>
        <div className="grid grid-cols-7 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {allDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const status = attendanceByDate[dayKey];
            const inMonth = isSameMonth(day, monthStart);
            
            let cellStyle = "bg-transparent text-slate-300 border-transparent opacity-25 pointer-events-none";
            let todayClass = isToday(day) ? "ring-2 ring-primary ring-offset-1" : "";
            let theme = DEFAULT_THEME;
            
            if (inMonth) {
              theme = CELL_THEMES[status] || DEFAULT_THEME;
              cellStyle = `border ${theme.border} ${theme.bg} ${theme.text}`;
            }

            return (
              <div
                key={dayKey}
                className={`aspect-square flex flex-col justify-between p-2 rounded-xl transition-all duration-250 hover:-translate-y-0.5 hover:shadow-xs ${cellStyle} ${todayClass}`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className={`text-xs lg:text-sm font-semibold ${isToday(day) ? "text-primary font-black" : "opacity-80"}`}>
                    {format(day, "d")}
                  </span>
                  {status && inMonth && (
                    <div className={`w-2.5 h-2.5 rounded-full sm:hidden ${STATUS_DOT[status]}`} />
                  )}
                </div>
                
                {status && inMonth && (
                  <div className={`hidden sm:block text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-center ${theme.pillBg} ${theme.pillText}`}>
                    {theme.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t border-black/5 flex-wrap">
        {Object.entries(STATUS_DOT).filter(([s]) => s !== "LATE").map(([s, dot]) => (
          <div key={s} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            <span>{s.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
