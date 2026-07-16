import { useState } from "react";
import { useListAnnouncements, useCreateAnnouncement, useDeleteAnnouncement, getListAnnouncementsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Megaphone, Plus, X, Pin, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-50 text-slate-600 border border-slate-250 font-bold",
  NORMAL: "bg-blue-50 text-blue-700 border border-blue-200 font-bold",
  HIGH: "bg-orange-50 text-orange-700 border border-orange-200 font-bold",
  URGENT: "bg-red-50 text-red-750 border border-red-200 font-bold animate-pulse",
};

export default function AnnouncementsPage() {
  const [showModal, setShowModal] = useState(false);
  const { data: announcements, isLoading } = useListAnnouncements();
  const { mutate: createAnn } = useCreateAnnouncement();
  const { mutate: deleteAnn } = useDeleteAnnouncement();
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-muted-foreground">Company-wide updates and notices.</p>
        </div>
        {user?.role === "ADMIN" && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Announcement
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : announcements?.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-16 flex flex-col items-center text-center">
          <Megaphone className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-semibold text-gray-700 mb-1">No announcements yet</h3>
          <p className="text-sm text-muted-foreground">Post the first announcement above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements?.map((ann) => (
            <div
              key={ann.id}
              className={`rounded-2xl border backdrop-blur-sm p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
                ann.pinned
                  ? "bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_100%)] border-primary/35 shadow-indigo-100/50"
                  : "bg-white/85 border-white/85"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {ann.pinned && (
                    <Pin className="h-4 w-4 text-primary mt-1 flex-shrink-0 animate-bounce" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-base leading-snug">{ann.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[ann.priority] ?? "bg-gray-100 text-gray-600"}`}>
                        {ann.priority}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 mb-2">
                      Posted by {ann.author} · {format(parseISO(ann.createdAt), "MMM d, yyyy")}
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed font-normal">{ann.content}</p>
                  </div>
                </div>
                {user?.role === "ADMIN" && (
                  <button
                    onClick={() => deleteAnn({ id: ann.id }, { onSuccess: invalidate })}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50/70 border border-transparent hover:border-red-100/50 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NewAnnouncementModal
          onClose={() => setShowModal(false)}
          onCreate={(data) => {
            createAnn({ data }, { onSuccess: () => { invalidate(); setShowModal(false); } });
          }}
          authorName={user?.name ?? "Admin"}
        />
      )}
    </div>
  );
}

function NewAnnouncementModal({ onClose, onCreate, authorName }: {
  onClose: () => void;
  onCreate: (d: any) => void;
  authorName: string;
}) {
  const [form, setForm] = useState({ title: "", content: "", priority: "NORMAL", pinned: false });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">New Announcement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input
              type="text"
              placeholder="Announcement title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
            <textarea
              placeholder="Write your announcement..."
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => set("pinned", e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                <span className="text-sm font-medium text-gray-700">Pin announcement</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              onClick={() => onCreate({ title: form.title, content: form.content, priority: form.priority as any, pinned: form.pinned, author: authorName })}
              className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
