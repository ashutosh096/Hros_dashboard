/**
 * @fileoverview Navigation sidebar layout component.
 * Provides links to main dashboard sub-views.
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Clock,
  CalendarClock,
  MonitorPlay,
  Megaphone,
  CheckSquare,
  DollarSign,
  Users,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const adminNav = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/attendance", icon: Clock, label: "Attendance" },
  { href: "/meetings", icon: CalendarClock, label: "Meetings" },
  { href: "/office-today", icon: MonitorPlay, label: "Office Today" },
  { href: "/announcements", icon: Megaphone, label: "Announcements" },
  { href: "/tasks", icon: CheckSquare, label: "Tasks" },
  { href: "/salary", icon: DollarSign, label: "Salary" },
  { href: "/applications", icon: Briefcase, label: "Applications" },
  { href: "/team", icon: Users, label: "Team" },
];

const employeeNav = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/attendance", icon: Clock, label: "Attendance" },
  { href: "/meetings", icon: CalendarClock, label: "Meetings" },
  { href: "/office-today", icon: MonitorPlay, label: "Office Today" },
  { href: "/announcements", icon: Megaphone, label: "Announcements" },
  { href: "/tasks", icon: CheckSquare, label: "Tasks" },
  { href: "/salary", icon: DollarSign, label: "Salary" },
  { href: "/applications", icon: Briefcase, label: "Applications" },
  { href: "/team", icon: Users, label: "Team" },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  const navItems = user?.role === "ADMIN" ? adminNav : employeeNav;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[linear-gradient(180deg,#10233d_0%,#15294a_55%,#21365d_100%)] text-[hsl(var(--sidebar-foreground))]">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,#38bdf8,#8b5cf6)] flex items-center justify-center flex-shrink-0 shadow-md shadow-sky-950/30">
          <span className="text-sm font-bold text-white">H</span>
        </div>
        <span className="font-bold text-lg text-white">HR OS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
              <div
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm font-medium border ${
                  isActive
                    ? "bg-white/18 text-white border-white/18 shadow-sm"
                    : "bg-white/5 text-slate-300 border-white/5 hover:bg-white/10 hover:border-white/12 hover:text-white"
                }`}
              >
                <span className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isActive ? "bg-sky-400/22 text-sky-100" : "bg-white/8 text-slate-300 group-hover:bg-white/12 group-hover:text-white"
                }`}>
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span>{item.label}</span>
                {isActive && <ChevronRight className="ml-auto h-4 w-4 opacity-75" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User profile at bottom */}
      {user && (
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/8">
            <div className="w-9 h-9 rounded-full bg-[linear-gradient(135deg,#f97316,#ec4899)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-300 truncate capitalize">{user.role.toLowerCase()}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-white/12 text-slate-300 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div className="md:hidden h-14 bg-[linear-gradient(90deg,#10233d,#3a1d66)] flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[linear-gradient(135deg,#38bdf8,#8b5cf6)] flex items-center justify-center">
            <span className="text-xs font-bold text-white">H</span>
          </div>
          <span className="font-bold text-white">HR OS</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-white p-1"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-60 md:static md:w-60 md:flex md:flex-col transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <SidebarContent />
      </div>
    </>
  );
}
