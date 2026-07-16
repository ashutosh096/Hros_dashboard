import { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useListEmployees, getListTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { CalendarClock, Plus, X, ArrowRight } from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-blue-50 text-blue-600",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-orange-50 text-orange-700",
  URGENT: "bg-red-50 text-red-600",
};

const STATUS_COLS = [
  { key: "TODO", label: "To Do", bar: "bg-gray-300" },
  { key: "IN_PROGRESS", label: "In Progress", bar: "bg-primary" },
  { key: "DONE", label: "Done", bar: "bg-emerald-500" },
];

export default function TasksPage() {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: tasks, isLoading } = useListTasks({});
  const { data: employees } = useListEmployees();
  const { mutate: createTask } = useCreateTask();
  const { mutate: updateTask } = useUpdateTask();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTasksQueryKey({}) });

  const moveTask = (id: number, status: string) => {
    updateTask({ id, data: { status: status as any } }, { onSuccess: invalidate });
  };

  const currentEmployee = resolveCurrentEmployee(employees ?? [], user);
  const visibleTasks = isAdmin ? tasks ?? [] : (tasks ?? []).filter((task) => task.assigneeId === currentEmployee?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "All employee tasks" : "Tasks assigned to you"}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Assign Task
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {STATUS_COLS.map((col) => {
            const colTasks = visibleTasks.filter((t) => t.status === col.key);
            const gradients: Record<string, string> = {
              TODO: "bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] border-slate-200",
              IN_PROGRESS: "bg-[linear-gradient(180deg,#f5f3ff_0%,#ede9fe_100%)] border-indigo-100/80",
              DONE: "bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] border-emerald-100/80",
            };
            return (
              <div key={col.key} className={`rounded-2xl border shadow-sm overflow-hidden ${gradients[col.key] ?? "bg-white border-border"}`}>
                <div className="px-5 py-4 border-b border-black/5 flex items-center gap-2 bg-white/40 backdrop-blur-md">
                  <div className={`w-3 h-3 rounded-full ${col.bar} shadow-xs`} />
                  <h3 className="font-bold text-slate-800 text-sm">{col.label}</h3>
                  <span className="ml-auto w-6 h-6 rounded-full bg-white/80 border border-slate-200/50 text-slate-700 text-xs font-bold flex items-center justify-center shadow-2xs">
                    {colTasks.length}
                  </span>
                </div>
                <div className="p-3 space-y-3 min-h-[120px]">
                  {colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} isAdmin={isAdmin} onMove={moveTask} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <AssignTaskModal
          employees={employees ?? []}
          onClose={() => setShowModal(false)}
          onCreate={(data) => {
            createTask({ data }, { onSuccess: () => { invalidate(); setShowModal(false); } });
          }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onMove, isAdmin }: { task: any; onMove: (id: number, s: string) => void; isAdmin?: boolean }) {
  const nextStatus = STATUS_COLS.find((c) => c.key !== task.status && STATUS_COLS.indexOf(c) > STATUS_COLS.findIndex((s) => s.key === task.status));

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 border border-border/50 hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${PRIORITY_STYLES[task.priority] ?? "bg-gray-100 text-gray-600"}`}>
          {task.priority}
        </span>
        {nextStatus && (
          <button
            onClick={() => onMove(task.id, nextStatus.key)}
            className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors"
            title={`Move to ${nextStatus.label}`}
          >
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-1">{task.title}</p>
      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.assignee ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                {task.assignee.name?.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-[10px] text-muted-foreground">{task.assignee.name?.split(" ")[0]}</span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">Unassigned</span>
          )}
        </div>
        {task.dueDate && (
          <span className="text-[10px] text-muted-foreground">
            {format(parseISO(task.dueDate), "MMM d")}
          </span>
        )}
      </div>
    </div>
  );
}

function AssignTaskModal({ onClose, onCreate, employees }: {
  onClose: () => void;
  onCreate: (data: any) => void;
  employees: any[];
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd"),
    assigneeId: "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.title) return;
    onCreate({
      title: form.title,
      description: form.description || undefined,
      priority: form.priority as any,
      dueDate: form.dueDate || undefined,
      assigneeId: form.assigneeId || undefined,
      status: "TODO",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Assign Task to Employee</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input
              type="text"
              placeholder="Task title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign To</label>
            <select
              value={form.assigneeId}
              onChange={(e) => set("assigneeId", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="">Unassigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
              ))}
            </select>
          </div>

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
              Create Task
            </button>
          </div>
        </div>
      </div>
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

