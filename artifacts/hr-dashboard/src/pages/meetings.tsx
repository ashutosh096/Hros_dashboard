/**
 * @fileoverview Meetings scheduler dashboard view.
 * Displays interactive calendar and scheduling forms.
 */

import { useState, useEffect } from "react";
import { useListMeetings, useCreateMeeting, useDeleteMeeting, useListEmployees, getListMeetingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { CalendarDays, CalendarPlus, Clock, ExternalLink, FileText, MapPin, Trash2, Users, Video, X, RefreshCw, Calendar, Settings, ShieldCheck } from "lucide-react";

export default function MeetingsPage() {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: meetings, isLoading } = useListMeetings({});
  const { data: employees } = useListEmployees();
  const { mutate: createMeeting } = useCreateMeeting();
  const { mutate: deleteMeeting } = useDeleteMeeting();
  const qc = useQueryClient();

  const [syncing, setSyncing] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [hasGoogleConfig, setHasGoogleConfig] = useState(false);
  const [showSyncSetupModal, setShowSyncSetupModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllRecurring, setShowAllRecurring] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    // Check if there was a URL parameter sync=success
    const params = new URLSearchParams(window.location.search);
    if (params.get("sync") === "success") {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleSync(true);
    } else {
      // Auto-sync in the background on page load
      handleSync(false);
    }

    fetch(`/api/auth/google/config?email=${encodeURIComponent(user.email)}`)
      .then((r) => r.json())
      .then((data) => {
        setHasGoogleConfig(data.hasConfig);
        setGoogleConnected(data.hasConfig ? data.connected : (data.connected || localStorage.getItem(`gcal_connected_${user.email}`) === "true"));
      })
      .catch(() => {});
  }, [user?.email]);

  const handleSync = async (forceConnect = false) => {
    if (!user?.email) return;
    setSyncing(true);

    try {
      const configRes = await fetch(`/api/auth/google/config?email=${encodeURIComponent(user.email)}`);
      const configData = await configRes.json();
      
      const isSimulated = !configData.hasConfig;
      
      if (forceConnect && isSimulated) {
        localStorage.setItem(`gcal_connected_${user.email}`, "true");
        setGoogleConnected(true);
      }

      const response = await fetch("/api/meetings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          simulated: isSimulated,
        }),
      });

      if (response.ok) {
        qc.invalidateQueries({ queryKey: getListMeetingsQueryKey({}) });
      }
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.email) return;
    setSyncing(true);
    try {
      localStorage.removeItem(`gcal_connected_${user.email}`);
      setGoogleConnected(false);

      await fetch("/api/auth/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      
      qc.invalidateQueries({ queryKey: getListMeetingsQueryKey({}) });
    } catch (e) {
      console.error("Disconnect failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectClick = () => {
    if (hasGoogleConfig) {
      window.location.href = `/api/auth/google?email=${encodeURIComponent(user?.email || "")}`;
    } else {
      // Connect simulated mode immediately
      handleSync(true);
    }
  };

  const handleDelete = (id: number) => {
    deleteMeeting({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListMeetingsQueryKey({}) }) });
  };

  const currentEmployee = resolveCurrentEmployee(employees ?? [], user);
  const userEmail = currentEmployee?.email?.toLowerCase();

  // 1. Apply Search Query Filter
  const searchedMeetings = (meetings ?? []).filter((meeting) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = meeting.title?.toLowerCase().includes(query);
    const descMatch = meeting.description?.toLowerCase().includes(query);
    const organizerMatch = meeting.organizer?.toLowerCase().includes(query);
    const attendeeMatch = meeting.attendees?.some(a => a.toLowerCase().includes(query));
    return titleMatch || descMatch || organizerMatch || attendeeMatch;
  });

  // 2. Apply Deduplication Filter for Recurring Series (keep first upcoming, or most recent past instance)
  const filteredMeetings = (() => {
    if (showAllRecurring) return searchedMeetings;

    const now = Date.now();
    const googleSeriesGroups: Record<string, any[]> = {};
    const singleEvents: any[] = [];

    for (const m of searchedMeetings) {
      if (m.source === "GOOGLE_CALENDAR" && m.googleEventId) {
        const index = m.googleEventId.indexOf("_");
        const baseId = index > 0 ? m.googleEventId.slice(0, index) : m.googleEventId;
        if (!googleSeriesGroups[baseId]) {
          googleSeriesGroups[baseId] = [];
        }
        googleSeriesGroups[baseId].push(m);
      } else {
        singleEvents.push(m);
      }
    }

    const selectedSeriesEvents = Object.values(googleSeriesGroups).map((instances) => {
      const sorted = [...instances].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      const upcoming = sorted.find((inst) => new Date(inst.endTime).getTime() >= now);
      return upcoming || sorted[sorted.length - 1];
    });

    return [...singleEvents, ...selectedSeriesEvents].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  })();

  const employeeMeetings = filteredMeetings.filter((meeting) =>
    userEmail
      ? (meeting.attendees?.some((email) => email.toLowerCase() === userEmail) ||
         meeting.organizer?.toLowerCase() === userEmail)
      : false
  );
  const officeMeetings = isAdmin
    ? filteredMeetings
    : [];
  
  const meetingSections = isAdmin
    ? [{ title: "All Office Meetings", meetings: officeMeetings }]
    : [
        { title: "My Meetings", meetings: employeeMeetings },
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-sm text-muted-foreground">Schedule and join your meetings.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Google Calendar Sync status */}
          <div className="flex items-center gap-2 rounded-xl bg-white/70 border border-white/60 px-3 py-1.5 shadow-2xs backdrop-blur-md">
            <div className={`h-2 w-2 rounded-full ${googleConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
            <span className="text-xs font-semibold text-slate-700">
              {googleConnected ? (hasGoogleConfig ? "Google Calendar" : "Google Calendar (Simulated)") : "Google Calendar"}
            </span>
            {googleConnected ? (
              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2">
                <button
                  onClick={() => handleSync()}
                  disabled={syncing}
                  className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-700 transition-colors"
                  title="Sync Now"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-primary" : ""}`} />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectClick}
                disabled={syncing}
                className="ml-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Connect
              </button>
            )}
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              <CalendarPlus className="h-4 w-4" />
              Schedule Meeting
            </button>
          )}
        </div>
      </div>

      {/* Search and filter tools */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/70 border border-white/60 p-4 rounded-2xl shadow-2xs backdrop-blur-md">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search meetings by title, description, or attendee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white/80"
          />
        </div>
        
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-650 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAllRecurring}
            onChange={(e) => setShowAllRecurring(e.target.checked)}
            className="h-4 w-4 rounded border-slate-350 text-primary focus:ring-primary/35"
          />
          <span>Show all occurrences of recurring meetings</span>
        </label>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : meetings?.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-12 text-center">
          <CalendarPlus className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No meetings scheduled.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {meetingSections.map((section) => (
            <section key={section.title} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-600 border border-white">
                  {section.meetings.length}
                </span>
              </div>
              {section.meetings.length === 0 ? (
                <div className="rounded-lg border border-white/80 bg-white/70 p-8 text-center text-sm text-slate-500">
                  No meetings in this section.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {section.meetings.map((meeting) => (
                    <MeetingCard key={meeting.id} meeting={meeting} isAdmin={isAdmin} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {showModal && (
        <ScheduleMeetingModal
          employees={employees ?? []}
          googleConnected={googleConnected}
          onClose={() => setShowModal(false)}
          onCreate={(data) => {
            createMeeting({ data }, {
              onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListMeetingsQueryKey({}) });
                setShowModal(false);
              },
            });
          }}
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
    employees.find((emp) => String(emp.name).split(" ").map((part: string) => part[0]).join("").toUpperCase() === user.initials) ??
    employees.find((emp) => emp.role === "EMPLOYEE") ??
    null
  );
}

function getMeetingState(meeting: any) {
  const now = Date.now();
  const start = new Date(meeting.startTime).getTime();
  const end = new Date(meeting.endTime).getTime();
  if (now >= start && now <= end) return { label: "LIVE", style: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (now > end) return { label: "ENDED", style: "bg-slate-100 text-slate-600 border-slate-200" };
  return { label: "SCHEDULED", style: "bg-blue-50 text-blue-700 border-blue-200" };
}

function MeetingCard({ meeting, isAdmin, onDelete }: { meeting: any; isAdmin: boolean; onDelete: (id: number) => void }) {
  const state = getMeetingState(meeting);
  const attendees = meeting.attendees ?? [];

  const cardStyles = {
    LIVE: "bg-[linear-gradient(135deg,#f0fdf4_0%,#dcfce7_100%)] border-emerald-100 text-emerald-950",
    SCHEDULED: "bg-[linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_100%)] border-sky-100 text-sky-950",
    ENDED: "bg-[linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)] border-slate-200 text-slate-800",
  }[state.label as "LIVE" | "SCHEDULED" | "ENDED"] ?? "bg-white border-border text-slate-900";

  return (
    <div className={`rounded-2xl border shadow-sm p-5 flex min-w-0 flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${cardStyles}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          {meeting.source === "GOOGLE_CALENDAR" && (
            <div className="flex items-center gap-1 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50/80 text-[9px] font-bold text-blue-600 border border-blue-100/50 backdrop-blur-md shadow-3xs">
                <Calendar className="h-2.5 w-2.5" />
                Google Synced
              </span>
            </div>
          )}
          <h3 className="font-bold text-slate-900 text-base leading-snug break-words">{meeting.title}</h3>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-bold border flex-shrink-0 bg-white/80 backdrop-blur-md shadow-2xs ${state.style}`}>
          {state.label}
        </span>
      </div>

      {meeting.description && (
        <p className="text-sm opacity-80 mb-3 line-clamp-2 break-words">{meeting.description}</p>
      )}

      <div className="space-y-2 text-sm opacity-85 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
          <span className="text-xs truncate font-medium">{format(parseISO(meeting.startTime), "EEE, MMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
          <span className="text-xs truncate font-medium">{format(parseISO(meeting.startTime), "HH:mm")} - {format(parseISO(meeting.endTime), "HH:mm")}</span>
        </div>
        {meeting.location && (
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
            <span className="text-xs truncate font-medium">{meeting.location}</span>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold opacity-75 mb-2">
          <Users className="h-3.5 w-3.5" />
          Attendees
        </div>
        <div className="flex flex-wrap gap-1.5">
          {attendees.length > 0 ? attendees.slice(0, 4).map((attendee: string) => (
            <span key={attendee} className="max-w-full rounded-full bg-white/70 backdrop-blur-sm border border-white/50 px-2 py-1 text-[10px] font-semibold text-slate-700 truncate shadow-2xs">
              {attendee}
            </span>
          )) : (
            <span className="text-xs opacity-60">No attendees</span>
          )}
          {attendees.length > 4 && (
            <span className="rounded-full bg-white/70 backdrop-blur-sm border border-white/50 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-2xs">+{attendees.length - 4}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {["Notes", "Transcript", "MOM"].map((label) => (
          <button key={label} className="flex items-center justify-center gap-1 rounded-xl bg-white/60 hover:bg-white/80 border border-white/60 text-[11px] font-semibold text-slate-700 py-2 shadow-2xs transition-colors">
            <FileText className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-3 border-t border-black/5">
        {meeting.meetLink ? (
          <a
            href={meeting.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl hover:bg-primary/20 transition-all border border-primary/10 shadow-2xs"
          >
            <Video className="h-3.5 w-3.5" />
            Join
          </a>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-black/5 text-slate-500 text-xs font-semibold rounded-xl">
            No link
          </div>
        )}
        {isAdmin && (
          <button
            onClick={() => onDelete(meeting.id)}
            className="p-2 text-red-500 hover:bg-red-50/70 border border-transparent hover:border-red-150/50 rounded-xl transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ScheduleMeetingModal({ onClose, onCreate, employees, googleConnected }: {
  onClose: () => void;
  onCreate: (data: any) => void;
  employees: any[];
  googleConnected: boolean;
}) {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const [guestEmail, setGuestEmail] = useState("");
  const [addToGoogleCalendar, setAddToGoogleCalendar] = useState(googleConnected);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: today,
    start: "10:00",
    end: "11:00",
    meetLink: "",
    location: "",
    repeat: "Does not repeat",
    attendees: [] as string[],
    generateMeetLink: googleConnected,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!addToGoogleCalendar) {
      set("generateMeetLink", false);
    } else {
      set("generateMeetLink", true);
    }
  }, [addToGoogleCalendar]);

  const toggleAttendee = (email: string) => {
    setForm((f) => ({
      ...f,
      attendees: f.attendees.includes(email)
        ? f.attendees.filter((a) => a !== email)
        : [...f.attendees, email],
    }));
  };

  const handleAddGuest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = guestEmail.trim().toLowerCase();
    if (!trimmed) return;

    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      return;
    }

    if (!form.attendees.includes(trimmed)) {
      set("attendees", [...form.attendees, trimmed]);
    }
    setGuestEmail("");
  };

  const removeAttendee = (email: string) => {
    set("attendees", form.attendees.filter((a) => a !== email));
  };

  const handleSubmit = () => {
    if (!form.title || !form.date) return;
    const startTime = `${form.date}T${form.start}:00.000Z`;
    const endTime = `${form.date}T${form.end}:00.000Z`;
    onCreate({
      title: form.title,
      description: form.description || undefined,
      startTime,
      endTime,
      meetLink: form.generateMeetLink ? undefined : (form.meetLink || undefined),
      location: form.location || undefined,
      attendees: form.attendees,
      organizer: user?.email || "Admin",
      status: "SCHEDULED",
      addToGoogleCalendar: googleConnected ? addToGoogleCalendar : false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Schedule New Meeting</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input
              type="text"
              placeholder="Meeting title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              placeholder="What's this meeting about?"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start</label>
              <input
                type="time"
                value={form.start}
                onChange={(e) => set("start", e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End</label>
              <input
                type="time"
                value={form.end}
                onChange={(e) => set("end", e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-50/20 border border-blue-100/30 rounded-xl">
            <div className="space-y-0.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Add to Google Calendar
                {!googleConnected && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100/50">
                    Not Connected
                  </span>
                )}
              </label>
              <p className="text-[10px] text-slate-500">Syncs this meeting to your calendar</p>
            </div>
            {googleConnected ? (
              <input
                type="checkbox"
                checked={addToGoogleCalendar}
                onChange={(e) => setAddToGoogleCalendar(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/35 cursor-pointer"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  alert("Please connect your Google Calendar first on the main Meetings page.");
                }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Connect
              </button>
            )}
          </div>

          {addToGoogleCalendar && (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="space-y-0.5">
                <label className="text-xs font-bold text-slate-800">Generate Google Meet link</label>
                <p className="text-[10px] text-slate-500">Creates a Meet link automatically</p>
              </div>
              <input
                type="checkbox"
                checked={form.generateMeetLink}
                onChange={(e) => set("generateMeetLink", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/35"
              />
            </div>
          )}

          {(!addToGoogleCalendar || !form.generateMeetLink) ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Meeting Link (optional)</label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={form.meetLink}
                  onChange={(e) => set("meetLink", e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50/50 border border-blue-100/60 rounded-xl text-xs text-blue-800 font-medium flex items-center gap-2">
              <Video className="h-4 w-4 text-primary flex-shrink-0" />
              <span>✨ Google Meet link will be generated automatically.</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location (optional)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Conference Room A"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Repeat</label>
            <select
              value={form.repeat}
              onChange={(e) => set("repeat", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option>Does not repeat</option>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Invite Guests by Email</label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                placeholder="guest@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddGuest();
                  }
                }}
                className="flex-1 px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => handleAddGuest()}
                className="px-4 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Add
              </button>
            </div>
            
            {/* Displaying selected invitees */}
            {form.attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 border border-slate-100 rounded-xl">
                {form.attendees.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700"
                  >
                    <span className="truncate max-w-[120px]">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeAttendee(email)}
                      className="text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {employees.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Or Quick Select Internal Employees</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleAttendee(emp.email)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.attendees.includes(emp.email)
                        ? "bg-primary text-white border-primary"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:border-primary"
                    }`}
                  >
                    {emp.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              Schedule Meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
