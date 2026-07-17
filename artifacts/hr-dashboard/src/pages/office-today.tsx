/**
 * @fileoverview Office status registry page view.
 * Displays who is in the office, remote, or out on leave today.
 */

import { useGetTodayAttendance, useGetDashboardUpcomingMeetings, useListTasks, useListEmployees, useListMeetings } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { MonitorPlay, Users, Video, CheckSquare, Clock, Calendar } from "lucide-react";

export default function OfficeTodayPage() {
  const { data: attendance, isLoading: attLoading } = useGetTodayAttendance();
  const { data: meetings, isLoading: meetLoading } = useGetDashboardUpcomingMeetings();
  const { data: tasks, isLoading: tasksLoading } = useListTasks({});
  const { data: employees, isLoading: empLoading } = useListEmployees();
  const { data: allMeetings } = useListMeetings({});

  const presentNow = attendance?.filter((r) => r.status === "PRESENT" || r.status === "LATE") ?? [];
  const outToday = attendance?.filter((r) => r.status === "ABSENT" || r.status === "ON_LEAVE") ?? [];
  const inProgressTasks = tasks?.filter((t) => t.status === "IN_PROGRESS") ?? [];

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  const getEmployeeAvailability = (email: string | undefined) => {
    if (!email || !allMeetings) {
      return { label: "Free", color: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-250/30", bg: "bg-emerald-50/70", detail: "Free all day" };
    }
    
    const now = new Date();
    const normalizedEmail = email.toLowerCase();
    
    // Get today's start and end timestamps in user local time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const employeeMeetings = allMeetings.filter((m) => {
      const isAttendee = m.attendees?.some((a: string) => a.toLowerCase() === normalizedEmail);
      const isOrganizer = m.organizer?.toLowerCase() === normalizedEmail;
      if (!isAttendee && !isOrganizer) return false;
      
      const mStart = new Date(m.startTime);
      return mStart >= todayStart && mStart <= todayEnd;
    });
    
    if (employeeMeetings.length === 0) {
      return { label: "Free", color: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-250/30", bg: "bg-emerald-50/70", detail: "Free all day" };
    }
    
    const sortedMeetings = [...employeeMeetings].sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    // Check if in live meeting right now
    const currentMeeting = sortedMeetings.find((m) => {
      const start = new Date(m.startTime);
      const end = new Date(m.endTime);
      return now >= start && now <= end;
    });
    
    if (currentMeeting) {
      const end = new Date(currentMeeting.endTime);
      return {
        label: "In live meeting",
        color: "bg-rose-500 animate-pulse",
        text: "text-rose-700",
        border: "border-rose-250/30",
        bg: "bg-rose-50/70",
        detail: `Until ${format(end, "h:mm a")}`,
        meetingTitle: currentMeeting.title
      };
    }
    
    // Check if there is an upcoming meeting starting soon
    const nextMeeting = sortedMeetings.find((m) => {
      const start = new Date(m.startTime);
      return start > now;
    });
    
    if (nextMeeting) {
      const start = new Date(nextMeeting.startTime);
      const timeDiffMs = start.getTime() - now.getTime();
      const timeDiffMins = Math.round(timeDiffMs / (60 * 1000));
      
      if (timeDiffMins <= 60) {
        return {
          label: "Busy: meeting soon",
          color: "bg-amber-500 animate-pulse",
          text: "text-amber-700",
          border: "border-amber-250/30",
          bg: "bg-amber-50/70",
          detail: `Starts in ${timeDiffMins} min`,
          meetingTitle: nextMeeting.title
        };
      } else {
        return {
          label: "Free",
          color: "bg-emerald-500",
          text: "text-emerald-700",
          border: "border-emerald-250/30",
          bg: "bg-emerald-50/70",
          detail: `Free until ${format(start, "h:mm a")}`
        };
      }
    }
    
    return { label: "Free", color: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-250/30", bg: "bg-emerald-50/70", detail: "Free all day" };
  };

  const teamAvailabilityRows = (employees ?? []).map((emp) => {
    const attRecord = attendance?.find((r) => r.employeeId === emp.id);
    const email = emp.email;
    const avail = getEmployeeAvailability(email);
    
    // Resolve today's meetings for this employee
    const normalizedEmail = email?.toLowerCase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayMeetings = normalizedEmail && allMeetings
      ? allMeetings.filter((m) => {
          const isAttendee = m.attendees?.some((a: string) => a.toLowerCase() === normalizedEmail);
          const isOrganizer = m.organizer?.toLowerCase() === normalizedEmail;
          if (!isAttendee && !isOrganizer) return false;
          
          const mStart = new Date(m.startTime);
          return mStart >= todayStart && mStart <= todayEnd;
        })
      : [];
    
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      avatarUrl: emp.avatarUrl,
      checkIn: attRecord?.checkIn ?? null,
      checkOut: attRecord?.checkOut ?? null,
      attendanceStatus: attRecord?.status ?? "ABSENT",
      availability: avail,
      todayMeetings,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Office Today</h1>
          <p className="text-sm text-muted-foreground">{today} — real-time snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-600">Live</span>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "In Office", value: presentNow.length, icon: <Users className="h-5 w-5 text-emerald-600" />, gradient: "bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] border-emerald-100 text-emerald-950" },
          { label: "Out Today", value: outToday.length, icon: <MonitorPlay className="h-5 w-5 text-slate-500" />, gradient: "bg-[linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)] border-slate-200 text-slate-800" },
          { label: "Meetings", value: meetings?.length ?? 0, icon: <Video className="h-5 w-5 text-blue-500" />, gradient: "bg-[linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_100%)] border-sky-100 text-sky-950" },
          { label: "Active Tasks", value: inProgressTasks.length, icon: <CheckSquare className="h-5 w-5 text-purple-500" />, gradient: "bg-[linear-gradient(135deg,#fdf4ff_0%,#f3e8ff_100%)] border-purple-100 text-purple-950" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Who's In & Live Availability */}
        <div className="bg-white/85 backdrop-blur-sm rounded-2xl border border-white/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4.5 border-b border-black/5 flex items-center gap-2 bg-white/40">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs animate-pulse" />
            <h3 className="font-bold text-slate-900">Team Availability & Status</h3>
            <span className="ml-auto text-xs font-bold text-slate-600 bg-white/85 border border-slate-200/50 px-2 py-0.5 rounded-full shadow-2xs">{teamAvailabilityRows.length} team members</span>
          </div>
          {attLoading || empLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : teamAvailabilityRows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No team members found.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {teamAvailabilityRows.map((r) => (
                <div key={r.employeeId} className="flex items-start gap-4 px-6 py-3.5 hover:bg-white/50 transition-colors">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-xl bg-[linear-gradient(135deg,#4f46e5,#0ea5e9)] flex items-center justify-center text-xs font-bold text-white shadow-2xs border border-white/20">
                      {r.employeeName.substring(0, 2).toUpperCase()}
                    </div>
                    {/* Ring showing attendance check-in status */}
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                      r.attendanceStatus === "PRESENT" || r.attendanceStatus === "LATE" ? "bg-emerald-500" :
                      r.attendanceStatus === "ON_LEAVE" ? "bg-blue-500" : "bg-slate-300"
                    }`} title={r.attendanceStatus} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{r.employeeName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-slate-500 font-medium truncate">{r.department}</span>
                      {r.checkIn && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-md px-1.5 py-0.2 font-medium">
                          Checked in at {r.checkIn}
                        </span>
                      )}
                    </div>

                    {/* Today's schedule detail list */}
                    {r.todayMeetings && r.todayMeetings.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 border-l-2 border-slate-100 pl-3">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Today's Schedule:</p>
                        {r.todayMeetings.map((m: any) => {
                          const start = parseISO(m.startTime);
                          const end = parseISO(m.endTime);
                          const now = new Date();
                          const isLive = now >= start && now <= end;
                          return (
                            <div key={m.id} className="text-xs text-slate-700 bg-slate-50/50 rounded-lg p-2 border border-slate-100 flex flex-col gap-1 max-w-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold truncate flex items-center gap-1.5 text-slate-850">
                                  {isLive ? (
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </span>
                                  ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                  )}
                                  {m.title}
                                </span>
                                <span className={`text-[10px] font-semibold shrink-0 ${isLive ? "text-rose-650" : "text-slate-500"}`}>
                                  {format(start, "h:mm a")} - {format(end, "h:mm a")}
                                </span>
                              </div>
                              {m.attendees && m.attendees.length > 0 && (
                                <div className="text-[10px] text-slate-500 font-medium truncate">
                                  Guests: {m.attendees.join(", ")}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Calendar Availability badge */}
                  <div className="text-right flex-shrink-0 mt-0.5">
                    <span className={`inline-flex flex-col items-end px-2.5 py-1 rounded-xl border text-[11px] font-semibold ${r.availability.bg} ${r.availability.border} ${r.availability.text}`}>
                      <span className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${r.availability.color}`} />
                        {r.availability.label}
                      </span>
                      <span className="text-[9px] opacity-75 font-normal truncate max-w-[120px]">{r.availability.detail}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's meeting timeline */}
        <div className="bg-white/85 backdrop-blur-sm rounded-2xl border border-white/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4.5 border-b border-black/5 bg-white/40">
            <h3 className="font-bold text-slate-900">Today's Meetings</h3>
            <p className="text-xs text-slate-600 mt-0.5">Scheduled for today</p>
          </div>
          {meetLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : meetings?.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No meetings scheduled for today.
            </div>
          ) : (
            <div className="px-6 py-4 space-y-0">
              {meetings?.map((m, i) => {
                const start = parseISO(m.startTime);
                const end = parseISO(m.endTime);
                const now = new Date();
                const isPast = now > end;
                const isCurrent = now >= start && now <= end;
                return (
                  <div key={m.id} className="flex gap-4 pb-6 relative last:pb-2">
                    {/* Timeline line */}
                    {i < (meetings?.length ?? 0) - 1 && (
                      <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-slate-200/60" />
                    )}
                    <div className={`mt-1 w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 shadow-2xs ${
                      isCurrent ? "border-primary bg-primary animate-pulse" :
                      isPast ? "border-slate-300 bg-slate-200" :
                      "border-primary bg-white"
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${isPast ? "text-gray-400 line-through" : "text-gray-800"}`}>
                          {m.title}
                        </p>
                        {isCurrent && (
                          <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium">Now</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(start, "h:mm a")} – {format(end, "h:mm a")}
                        {m.location && ` · ${m.location}`}
                      </p>
                      {m.meetLink && !isPast && (
                        <a
                          href={m.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        >
                          <Video className="h-3 w-3" />
                          Join meeting
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Active tasks */}
      <div className="bg-white/85 backdrop-blur-sm rounded-2xl border border-white/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4.5 border-b border-black/5 bg-white/40">
          <h3 className="font-bold text-slate-900">Active Tasks Right Now</h3>
          <p className="text-xs text-slate-600 mt-0.5">Tasks currently in progress across the team</p>
        </div>
        {tasksLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : inProgressTasks.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No tasks currently in progress.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {inProgressTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/50 transition-colors">
                <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 shadow-xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
                  {task.assignee && (
                    <p className="text-xs text-slate-500 font-medium">Assigned to {task.assignee.name}</p>
                  )}
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                  task.priority === "URGENT" ? "bg-red-50 text-red-700 border-red-200" :
                  task.priority === "HIGH" ? "bg-orange-50 text-orange-700 border-orange-200" :
                  "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
