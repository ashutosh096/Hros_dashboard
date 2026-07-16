import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { DollarSign, Download, Eye, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SalarySlip {
  employeeId: number;
  employeeName: string;
  department: string;
  baseSalary: number;
  month: string;
  workingDays: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  deductions: number;
  netPayable: number;
  status: "PAID" | "PENDING";
}

function useSalary(month: string) {
  return useQuery<SalarySlip[]>({
    queryKey: ["salary", month],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/salary?month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch salary data");
      return res.json();
    },
    staleTime: 60_000,
  });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function SalaryPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [detailSlip, setDetailSlip] = useState<SalarySlip | null>(null);
  const { data: slips, isLoading } = useSalary(month);

  const visibleSlips = user?.role === "EMPLOYEE"
    ? slips?.filter((s) => s.employeeName === user.name)
    : slips;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary & Compensation</h1>
          <p className="text-sm text-muted-foreground">Monthly salary records and payslips.</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Summary cards - admin only */}
      {user?.role === "ADMIN" && slips && slips.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Payroll",
              value: fmtCurrency(slips.reduce((s, r) => s + r.netPayable, 0)),
              icon: <DollarSign className="h-5 w-5 text-blue-600" />,
              bg: "bg-blue-50",
            },
            {
              label: "Employees Paid",
              value: slips.filter((s) => s.status === "PAID").length,
              icon: <span className="text-lg">✓</span>,
              bg: "bg-emerald-50",
            },
            {
              label: "Pending",
              value: slips.filter((s) => s.status === "PENDING").length,
              icon: <span className="text-lg">⏳</span>,
              bg: "bg-amber-50",
            },
            {
              label: "Total Deductions",
              value: fmtCurrency(slips.reduce((s, r) => s + r.deductions, 0)),
              icon: <span className="text-lg">↓</span>,
              bg: "bg-red-50",
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>{s.icon}</div>
              <div>
                <div className="text-xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Salary slips list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : !visibleSlips || visibleSlips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-16 flex flex-col items-center text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No salary data for {format(parseISO(month + "-01"), "MMMM yyyy")}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSlips.map((slip) => (
            <div key={slip.employeeId} className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    {slip.employeeName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{slip.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{slip.department}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Base Salary</p>
                    <p className="font-semibold text-gray-900">{fmtCurrency(slip.baseSalary)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-red-500">Deductions</p>
                    <p className="font-semibold text-red-500">-{fmtCurrency(slip.deductions)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Net Payable</p>
                    <p className="text-xl font-bold text-gray-900">{fmtCurrency(slip.netPayable)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      slip.status === "PAID" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {slip.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailSlip(slip)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border text-sm rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Details
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary text-sm rounded-xl hover:bg-primary/20 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detailSlip && (
        <SalaryDetailModal slip={detailSlip} onClose={() => setDetailSlip(null)} />
      )}
    </div>
  );
}

function SalaryDetailModal({ slip, onClose }: { slip: SalarySlip; onClose: () => void }) {
  const monthLabel = format(parseISO(slip.month + "-01"), "MMMM yyyy");
  const dailyRate = slip.baseSalary / slip.workingDays;
  const earned = (slip.presentDays + slip.halfDays * 0.5) * dailyRate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Salary Slip</h2>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Employee info */}
          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {slip.employeeName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{slip.employeeName}</p>
              <p className="text-xs text-muted-foreground">{slip.department}</p>
            </div>
            <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium ${
              slip.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              {slip.status}
            </span>
          </div>

          {/* Attendance summary */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Attendance</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Working Days", value: slip.workingDays },
                { label: "Present", value: slip.presentDays },
                { label: "Half Day", value: slip.halfDays },
                { label: "Absent", value: slip.absentDays },
              ].map((s) => (
                <div key={s.label} className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings breakdown */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Earnings Breakdown</p>
            <div className="space-y-2">
              {[
                { label: "Base Salary", value: slip.baseSalary, color: "text-gray-900" },
                { label: "Earned Salary", value: earned, color: "text-gray-900" },
                { label: "Deductions (absent days)", value: -slip.deductions, color: "text-red-500" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={`font-medium ${row.color}`}>
                    {row.value < 0 ? `-${fmtCurrency(Math.abs(row.value))}` : fmtCurrency(row.value)}
                  </span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span>Net Payable</span>
                <span className="text-primary text-base">{fmtCurrency(slip.netPayable)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
