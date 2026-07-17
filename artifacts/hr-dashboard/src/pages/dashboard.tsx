/**
 * @fileoverview Primary dashboard homepage view.
 * Displays aggregate summary graphs and quick shortcut widgets.
 */

import { useState, useEffect } from "react";
import {
  getListAttendanceQueryKey,
  useCreateAttendance,
  useGetAttendanceChart,
  useGetDashboardStats,
  useGetDashboardUpcomingMeetings,
  useGetTodayAttendance,
  useListAttendance,
  useListEmployees,
  useUpdateAttendance,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Users, CheckCircle, AlertTriangle, Video, CheckSquare, Clock, X, Calendar } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

function StatCard({
  title,
  value,
  icon,
  color,
  surface,
  loading,
}: {
  title: string;
  value?: number | string | null;
  icon: React.ReactNode;
  color: string;
  surface: string;
  loading: boolean;
}) {
  return (
    <div className={`rounded-lg p-5 border border-white/70 shadow-sm overflow-hidden relative ${surface}`}>
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-white/35" />
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 shadow-sm ${color}`}>
        {icon}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <div className="text-3xl font-bold text-slate-950">{value ?? "-"}</div>
      )}
      <div className="text-xs font-semibold text-slate-600 uppercase mt-1">{title}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: attendance, isLoading: attendanceLoading } = useGetTodayAttendance();
  const { data: meetings } = useGetDashboardUpcomingMeetings();
  const { data: chartData, isLoading: chartLoading } = useGetAttendanceChart();

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [hasGoogleConfig, setHasGoogleConfig] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem(`gcal_consent_dismissed_${user.email}`) === "true";
    if (dismissed) return;

    fetch(`/api/auth/google/config?email=${encodeURIComponent(user.email)}`)
      .then((r) => r.json())
      .then((data) => {
        const connected = data.connected || localStorage.getItem(`gcal_connected_${user.email}`) === "true";
        setHasGoogleConfig(data.hasConfig);
        if (!connected) {
          setShowConsentModal(true);
        }
      })
      .catch(() => {});
  }, [user?.email]);

  const handleConsentConnect = async () => {
    if (!user?.email) return;
    setShowConsentModal(false);
    if (hasGoogleConfig) {
      window.location.href = `/api/auth/google?email=${encodeURIComponent(user.email)}`;
    } else {
      // Connect simulated immediately
      localStorage.setItem(`gcal_connected_${user.email}`, "true");
      try {
        await fetch("/api/meetings/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            simulated: true,
          }),
        });
        window.location.reload();
      } catch (e) {
        console.error("Sync failed:", e);
      }
    }
  };

  const handleConsentDismiss = () => {
    if (user?.email) {
      sessionStorage.setItem(`gcal_consent_dismissed_${user.email}`, "true");
    }
    setShowConsentModal(false);
  };

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  // Build weekly chart (group by week)
  const weeklyData = chartData
    ? (() => {
        const weeks: { week: string; present: number; absent: number }[] = [];
        const chunkSize = Math.ceil(chartData.length / 4);
        for (let i = 0; i < 4; i++) {
          const chunk = chartData.slice(i * chunkSize, (i + 1) * chunkSize);
          const present = chunk.reduce((s, d) => s + d.present, 0);
          const absent = chunk.reduce((s, d) => s + d.absent, 0);
          weeks.push({ week: `Week ${i + 1}`, present, absent });
        }
        return weeks;
      })()
    : [];

  const todayPresent = attendance?.filter((r) => r.status === "PRESENT" || r.status === "LATE").length ?? 0;
  const todayAbsent = attendance?.filter((r) => r.status === "ABSENT").length ?? 0;
  const pieData = [
    { name: "Present", value: todayPresent },
    { name: "Away", value: todayAbsent },
  ];
  const PIE_COLORS = ["hsl(var(--primary))", "#f59e0b"];

  const dashboardContent = isAdmin ? (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Admin Overview</h1>
        <p className="text-sm text-slate-600 mt-0.5">{today}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Employees"
          value={stats?.totalEmployees}
          icon={<Users className="h-5 w-5 text-white" />}
          color="bg-blue-600"
          surface="bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)]"
          loading={statsLoading}
        />
        <StatCard
          title="Present Today"
          value={stats?.presentToday}
          icon={<CheckCircle className="h-5 w-5 text-white" />}
          color="bg-emerald-600"
          surface="bg-[linear-gradient(135deg,#ecfdf5_0%,#ccfbf1_100%)]"
          loading={statsLoading}
        />
        <StatCard
          title="Absent / Leave"
          value={(stats?.totalEmployees ?? 0) - (stats?.presentToday ?? 0)}
          icon={<AlertTriangle className="h-5 w-5 text-white" />}
          color="bg-amber-500"
          surface="bg-[linear-gradient(135deg,#fff7ed_0%,#fef3c7_100%)]"
          loading={statsLoading}
        />
        <StatCard
          title="Active Meetings"
          value={stats?.meetingsToday}
          icon={<Video className="h-5 w-5 text-white" />}
          color="bg-rose-500"
          surface="bg-[linear-gradient(135deg,#fff1f2_0%,#ffe4e6_100%)]"
          loading={statsLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance Trends bar chart */}
        <div className="lg:col-span-2 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] rounded-lg p-6 border border-white/80 shadow-sm">
          <h3 className="font-semibold text-slate-950 mb-1">Attendance Trends</h3>
          <p className="text-xs text-slate-600 mb-5">Weekly attendance percentages</p>
          <div className="h-52">
            {chartLoading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbeafe" />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="present" name="Present %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Today's Status donut */}
        <div className="bg-[linear-gradient(135deg,#f5f3ff_0%,#eef2ff_100%)] rounded-2xl p-6 border border-white/85 shadow-sm">
          <h3 className="font-semibold text-slate-950 mb-1">Today's Status</h3>
          <p className="text-xs text-slate-600 mb-4">Real-time workforce distribution</p>
          {attendanceLoading ? (
            <Skeleton className="w-full h-40 rounded-lg" />
          ) : todayPresent + todayAbsent === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-600">No data for today</div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-40">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-3 mt-4">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 px-3 py-1.5 bg-white/70 backdrop-blur-md border border-white/75 rounded-full text-xs font-semibold shadow-2xs">
                    <div className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-700">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_100%)] rounded-lg p-6 border border-white/80 shadow-sm">
        <h3 className="font-semibold text-slate-950 mb-1">Recent Activity</h3>
        <p className="text-xs text-slate-600 mb-4">Latest actions across the platform</p>
        {attendanceLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : attendance?.filter((r) => r.checkIn).length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-6">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {attendance?.filter((r) => r.checkIn).slice(0, 5).map((r) => (
              <div key={r.employeeId} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#4f46e5,#0ea5e9)] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {r.employeeName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-800">{r.employeeName}</span>
                  <span className="text-sm text-slate-600"> checked in at </span>
                  <span className="text-sm font-medium text-slate-800">{r.checkIn}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.status === "PRESENT" ? "bg-emerald-50 text-emerald-700" :
                  r.status === "LATE" ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-500"
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : (
    <EmployeeDashboard user={user} stats={stats} statsLoading={statsLoading} meetings={meetings} today={today} />
  );

  return (
    <>
      {dashboardContent}
      {showConsentModal && (
        <GoogleConsentModal
          onConnect={handleConsentConnect}
          onClose={handleConsentDismiss}
        />
      )}
    </>
  );
}

function EmployeeDashboard({ user, stats, statsLoading, meetings, today }: any) {
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const { data: employees } = useListEmployees();
  const currentEmployee = resolveCurrentEmployee(employees ?? [], user);
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const attendanceParams = currentEmployee ? { employeeId: currentEmployee.id, date: todayKey } : undefined;
  const { data: todayAttendance } = useListAttendance(attendanceParams, { query: { enabled: !!currentEmployee } as any });
  const todayRecord = todayAttendance?.[0];
  const isLocked = todayRecord?.notes?.includes("Updated once");
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{greeting}, {user?.name?.split(" ")[0]}</h1>
          <p className="text-sm text-slate-600 mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => setShowAttendanceModal(true)}
          disabled={!!isLocked}
          className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-opacity shadow-sm ${
            isLocked
              ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-75"
              : "bg-[linear-gradient(135deg,#4f46e5,#0ea5e9)] hover:opacity-95"
          }`}
        >
          {isLocked ? "Attendance Locked" : todayRecord ? "Update Attendance" : "Mark Attendance"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Today's Status" value={todayRecord?.status?.replace("_", " ") ?? "Not Marked"} icon={<Clock className="h-5 w-5 text-white" />} color="bg-blue-600" surface="bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)]" loading={false} />
        <StatCard title="Pending Tasks" value={stats?.pendingTasks} icon={<CheckSquare className="h-5 w-5 text-white" />} color="bg-emerald-600" surface="bg-[linear-gradient(135deg,#ecfdf5_0%,#ccfbf1_100%)]" loading={statsLoading} />
        <StatCard title="Meetings Today" value={stats?.meetingsToday} icon={<Video className="h-5 w-5 text-white" />} color="bg-violet-600" surface="bg-[linear-gradient(135deg,#f5f3ff_0%,#ede9fe_100%)]" loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] rounded-lg p-6 border border-white/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-950">Today's Schedule</h3>
              <p className="text-xs text-slate-600">Your upcoming meetings</p>
            </div>
            <a href="/meetings" className="text-xs text-primary hover:underline font-medium">View All</a>
          </div>
          {meetings?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Video className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">No meetings scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings?.slice(0, 4).map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-white/70 rounded-lg border border-white/80">
                  <div className="w-9 h-9 bg-[linear-gradient(135deg,#4f46e5,#0ea5e9)] rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">{format(parseISO(m.startTime), "d")}</span>
                    <span className="text-[9px] text-white/80">{format(parseISO(m.startTime), "MMM")}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 truncate">{m.title}</p>
                    <p className="text-xs text-slate-600">{format(parseISO(m.startTime), "h:mm a")} - {format(parseISO(m.endTime), "h:mm a")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[linear-gradient(135deg,#f5f3ff_0%,#e0e7ff_100%)] rounded-2xl p-6 border border-white/85 shadow-sm">
          <h3 className="font-semibold text-slate-950 mb-1">Recent Activity</h3>
          <p className="text-xs text-slate-600 mb-4">Your latest notifications</p>
          <div className="space-y-3">
            {[
              { text: `Your salary for ${format(new Date(), "M/yyyy")} has been processed`, type: "salary", color: "bg-emerald-500" },
              { text: "You have been assigned a new task", type: "task", color: "bg-indigo-500" },
              { text: "New company announcement posted", type: "announcement", color: "bg-amber-500" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 bg-white/70 backdrop-blur-md border border-white/70 rounded-xl shadow-2xs hover:shadow-xs transition-all hover:bg-white/85">
                <div className={`w-2.5 h-2.5 rounded-full ${item.color} flex-shrink-0 shadow-xs`} />
                <p className="text-sm font-semibold text-slate-800">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAttendanceModal && currentEmployee && (
        <AttendanceModal
          employeeId={currentEmployee.id}
          existingRecord={todayRecord}
          onClose={() => setShowAttendanceModal(false)}
        />
      )}
    </div>
  );
}

function resolveCurrentEmployee(employees: any[], user: any) {
  if (!user) return null;
  const normalizedUserEmail = String(user.email ?? "").toLowerCase();
  const normalizedName = String(user.name ?? "").toLowerCase();
  return (
    employees.find((emp) => String(emp.email).toLowerCase() === normalizedUserEmail) ??
    employees.find((emp) => String(emp.name).toLowerCase() === normalizedName) ??
    employees.find((emp) => String(emp.name).split(" ").map((part) => part[0]).join("").toUpperCase() === user.initials) ??
    employees.find((emp) => emp.role === "EMPLOYEE") ??
    null
  );
}

function AttendanceModal({ employeeId, existingRecord, onClose }: { employeeId: number; existingRecord?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { mutate: createAttendance, isPending: isCreating } = useCreateAttendance();
  const { mutate: updateAttendance, isPending: isUpdating } = useUpdateAttendance();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const nowTime = format(new Date(), "HH:mm");
  const isSaving = isCreating || isUpdating;

  const saveStatus = (status: "PRESENT" | "ABSENT" | "HALF_DAY") => {
    const data = {
      employeeId,
      date: todayKey,
      status,
      checkIn: status === "ABSENT" ? undefined : existingRecord?.checkIn ?? nowTime,
      checkOut: existingRecord?.checkOut ?? undefined,
      hoursWorked: status === "HALF_DAY" ? 4 : undefined,
      notes: existingRecord?.id 
        ? `Marked by employee on ${todayKey}. Updated once.`
        : `Marked by employee on ${todayKey}`,
    };
    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: getListAttendanceQueryKey({ employeeId, date: todayKey }) });
      qc.invalidateQueries({ queryKey: getListAttendanceQueryKey({}) });
      onClose();
    };
    if (existingRecord?.id) {
      const confirmChange = window.confirm("Are you sure to change for a last time?");
      if (!confirmChange) return;
      updateAttendance({ id: existingRecord.id, data }, { onSuccess });
    } else {
      createAttendance({ data }, { onSuccess });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Today Attendance</h2>
            <p className="text-xs text-slate-500">{todayKey}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {[
            { status: "PRESENT", label: "Present", style: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
            { status: "HALF_DAY", label: "Half Day", style: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
            { status: "ABSENT", label: "Absent", style: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
          ].map((item) => (
            <button
              key={item.status}
              disabled={isSaving}
              onClick={() => saveStatus(item.status as "PRESENT" | "ABSENT" | "HALF_DAY")}
              className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${item.style}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoogleConsentModal({
  onConnect,
  onClose,
}: {
  onConnect: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-8 duration-300">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary animate-bounce" />
            <h2 className="text-lg font-bold text-slate-900">Connect Google Calendar</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Would you like to connect your Google Calendar and Meet to this dashboard? 
            This will sync all your scheduled meetings and allow you to easily join or create Google Meet links.
          </p>
          <div className="text-xs text-blue-800 bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <span>It takes less than a minute and keeps your schedule automatically updated.</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50/50 border-t border-slate-100 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Maybe Later
          </button>
          <button
            type="button"
            onClick={onConnect}
            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-2xs"
          >
            Connect Calendar
          </button>
        </div>
      </div>
    </div>
  );
}
