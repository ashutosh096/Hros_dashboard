/**
 * @fileoverview Main structural layout for authenticated pages.
 * Renders sidebar, header navigation, and child content viewport.
 */

import { Sidebar } from "./sidebar";
import { useAuth } from "@/contexts/auth-context";
import { Bell, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/attendance": "Attendance",
  "/meetings": "Meetings",
  "/tasks": "Tasks",
  "/team": "Team",
  "/announcements": "Announcements",
  "/office-today": "Office Today",
  "/salary": "Salary",
  "/applications": "Applications",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const pageTitle = PAGE_TITLES[location] ?? "HR OS";

  return (
    <div className="min-h-screen flex bg-[linear-gradient(135deg,#eef7ff_0%,#f7f0ff_46%,#fff7e6_100%)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top header */}
        <header className="h-14 bg-white/78 backdrop-blur border-b border-white/70 flex items-center px-6 gap-4 flex-shrink-0 shadow-sm z-10">
          <span className="text-sm text-slate-700 font-semibold">{pageTitle}</span>
          <div className="ml-auto flex items-center gap-3">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            {user && (
              <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#4f46e5,#0ea5e9)] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {user.initials}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
