/**
 * @fileoverview Applications submission and review dashboard view.
 * Handles submission forms and admin approval queues.
 */

import { useState } from "react";
import {
  useListApplications,
  useCreateApplication,
  useUpdateApplication,
  useDeleteApplication,
  getListApplicationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Briefcase, Plus, X, ExternalLink, Search, Trash2, Edit2, CheckCircle2, Loader2 } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  WORKING: "bg-blue-50 text-blue-700 border border-blue-200",
  FILLED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "WORKING", label: "Working" },
  { value: "FILLED", label: "Filled" },
];

export default function ApplicationsPage() {
  const { user } = useAuth();
  const { data: applications, isLoading } = useListApplications();
  const { mutate: createApplication } = useCreateApplication();
  const { mutate: updateApplication } = useUpdateApplication();
  const { mutate: deleteApplication } = useDeleteApplication();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListApplicationsQueryKey() });

  const handleCreate = (data: any) => {
    createApplication(
      { data },
      {
        onSuccess: () => {
          invalidate();
          setShowModal(false);
        },
      }
    );
  };

  const handleUpdate = (id: number, data: any) => {
    updateApplication(
      { id, data },
      {
        onSuccess: () => {
          invalidate();
          setEditingApp(null);
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this application?")) {
      deleteApplication({ id }, { onSuccess: invalidate });
    }
  };

  const handleStatusChange = (id: number, status: string) => {
    updateApplication({ id, data: { status: status as any } }, { onSuccess: invalidate });
  };

  // Filter
  const filteredApps = (applications ?? []).filter((app) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      app.title?.toLowerCase().includes(query) ||
      app.notes?.toLowerCase().includes(query) ||
      app.status?.toLowerCase().includes(query)
    );
  });

  // Stats
  const totalCount = applications?.length ?? 0;
  const pendingCount = applications?.filter((a) => a.status === "PENDING").length ?? 0;
  const workingCount = applications?.filter((a) => a.status === "WORKING").length ?? 0;
  const filledCount = applications?.filter((a) => a.status === "FILLED").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and track work or job application links and statuses.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Application
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Applications", value: totalCount, style: "bg-slate-50 text-slate-800 border-slate-200" },
          { label: "Pending", value: pendingCount, style: "bg-amber-50/70 text-amber-900 border-amber-100" },
          { label: "Working", value: workingCount, style: "bg-blue-50/70 text-blue-900 border-blue-100" },
          { label: "Filled", value: filledCount, style: "bg-emerald-50/70 text-emerald-900 border-emerald-100" },
        ].map((s, idx) => (
          <div key={idx} className={`rounded-2xl p-5 border shadow-3xs flex flex-col justify-between hover:shadow-2xs transition-all ${s.style}`}>
            <span className="text-xs font-bold uppercase tracking-wider opacity-75">{s.label}</span>
            <span className="text-3xl font-extrabold mt-2">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative w-full sm:max-w-md bg-white/75 border border-white/60 p-3 rounded-2xl shadow-3xs backdrop-blur-md">
        <span className="absolute inset-y-0 left-3 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </span>
        <input
          type="text"
          placeholder="Search applications by title, notes, status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="bg-white/85 backdrop-blur-sm rounded-2xl border border-border shadow-3xs p-12 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No applications found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-white/85 backdrop-blur-sm rounded-2xl border border-white/80 p-5 shadow-3xs hover:shadow-2xs transition-all hover:-translate-y-0.5 duration-250 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <h3 className="font-bold text-slate-800 text-base leading-snug break-words flex-1">{app.title}</h3>
                  <select
                    value={app.status}
                    onChange={(e) => handleStatusChange(app.id, e.target.value)}
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer ${STATUS_STYLES[app.status]}`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {app.notes && (
                  <p className="text-xs text-slate-600 mb-4 line-clamp-3 break-words bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                    {app.notes}
                  </p>
                )}
              </div>

              <div className="mt-auto pt-3 border-t border-black/5 flex items-center justify-between">
                <a
                  href={app.link.startsWith("http") ? app.link : `https://${app.link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Link
                </a>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingApp(app)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                    title="Edit Details"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(app.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-700 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <ApplicationModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          title="Add New Application"
        />
      )}

      {/* Editing Modal */}
      {editingApp && (
        <ApplicationModal
          application={editingApp}
          onClose={() => setEditingApp(null)}
          onSubmit={(data) => handleUpdate(editingApp.id, data)}
          title="Edit Application Details"
        />
      )}
    </div>
  );
}

function ApplicationModal({
  application,
  onClose,
  onSubmit,
  title,
}: {
  application?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  title: string;
}) {
  const [form, setForm] = useState({
    title: application?.title ?? "",
    link: application?.link ?? "",
    status: application?.status ?? "PENDING",
    notes: application?.notes ?? "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.link) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-black/5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Application Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Google - Frontend Developer"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Application URL/Link *</label>
            <input
              type="text"
              required
              placeholder="e.g. https://careers.google.com/..."
              value={form.link}
              onChange={(e) => set("link", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="PENDING">Pending</option>
              <option value="WORKING">Working</option>
              <option value="FILLED">Filled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description / Notes</label>
            <textarea
              placeholder="Add details, notes, deadline info..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
            >
              Save Application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
