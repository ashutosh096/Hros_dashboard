import { useState } from "react";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X, Search, Mail, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const DEPT_COLORS: Record<string, string> = {
  Engineering: "bg-blue-50 text-blue-700",
  HR: "bg-purple-50 text-purple-700",
  Marketing: "bg-pink-50 text-pink-700",
  Finance: "bg-amber-50 text-amber-700",
  Sales: "bg-emerald-50 text-emerald-700",
  Design: "bg-cyan-50 text-cyan-700",
  Management: "bg-indigo-50 text-indigo-700",
};

const DEPARTMENTS = ["All", "Management", "Engineering", "Design", "Marketing", "Finance", "Sales", "HR"];

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: employees, isLoading } = useListEmployees();
  const { mutate: createEmployee } = useCreateEmployee();
  const { mutate: updateEmployee } = useUpdateEmployee();
  const qc = useQueryClient();

  const filtered = employees?.filter((e) => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "All" || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  const existingDepts = ["All", ...Array.from(new Set(employees?.map((e) => e.department) ?? []))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Directory</h1>
          <p className="text-sm text-muted-foreground">{filtered?.length ?? 0} members across all departments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 w-52"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {existingDepts.map((d) => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                deptFilter === d
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered?.map((emp) => (
            <div key={emp.id} className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow relative">
              {emp.status === "INACTIVE" && (
                <span className="absolute top-3 right-3 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                  Pending Approval
                </span>
              )}
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary mb-4">
                {emp.name.charAt(0)}
              </div>
              <p className="font-semibold text-gray-900">{emp.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">{emp.position ?? "Team Member"}</p>
              
              <div className="flex flex-col gap-2 items-center mb-4">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${DEPT_COLORS[emp.department] ?? "bg-gray-100 text-gray-600"}`}>
                  {emp.department}
                </span>
                
                {isAdmin && emp.status === "INACTIVE" && (
                  <button
                    type="button"
                    onClick={() => {
                      updateEmployee(
                        { id: emp.id, data: { status: "ACTIVE" } },
                        { onSuccess: () => qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() }) }
                      );
                    }}
                    className="mt-1 flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-3xs cursor-pointer"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Approve Access
                  </button>
                )}
              </div>

              <div className="w-full border-t border-border pt-3 mt-auto">
                <a
                  href={`mailto:${emp.email}`}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {emp.email}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddEmployeeModal
          onClose={() => setShowModal(false)}
          onCreate={(data) => {
            createEmployee({ data }, {
              onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
                setShowModal(false);
              },
            });
          }}
        />
      )}
    </div>
  );
}

function AddEmployeeModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const [form, setForm] = useState({
    name: "", email: "", department: "Engineering",
    jobTitle: "", phone: "", salary: "", status: "ACTIVE",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Employee</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          {[
            { label: "Full Name *", key: "name", placeholder: "John Doe", type: "text" },
            { label: "Email *", key: "email", placeholder: "john@company.com", type: "email" },
            { label: "Job Title", key: "jobTitle", placeholder: "Software Engineer", type: "text" },
            { label: "Phone", key: "phone", placeholder: "+1 555-0100", type: "text" },
            { label: "Base Salary", key: "salary", placeholder: "75000", type: "number" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
            <select
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {DEPARTMENTS.slice(1).map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              onClick={() => onCreate({ ...form, salary: form.salary ? parseFloat(form.salary) : undefined })}
              className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              Add Employee
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
