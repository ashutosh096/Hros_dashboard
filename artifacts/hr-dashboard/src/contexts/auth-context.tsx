/**
 * @fileoverview React Context provider for handling authentication state.
 * Exposes login, logout, and current logged-in user profile attributes.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "ADMIN" | "EMPLOYEE";

export interface AuthUser {
  email: string;
  name: string;
  role: UserRole;
  department: string;
  initials: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const DEMO_USERS: Record<string, { password: string; user: AuthUser }> = {
  "admin@hrapp.com": {
    password: "admin123",
    user: { email: "admin@hrapp.com", name: "Alex Johnson", role: "ADMIN", department: "Management", initials: "AJ" },
  },
  "sarah@hrapp.com": {
    password: "employee123",
    user: { email: "sarah@hrapp.com", name: "Sarah Chen", role: "EMPLOYEE", department: "Engineering", initials: "SC" },
  },
  "david@hrapp.com": {
    password: "employee123",
    user: { email: "david@hrapp.com", name: "David Kowalski", role: "EMPLOYEE", department: "Engineering", initials: "DK" },
  },
};

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "hros_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not logged in");
      })
      .then((data) => {
        if (data.user) {
          const loggedUser: AuthUser = {
            email: data.user.email,
            name: data.user.name || data.user.email.split("@")[0],
            role: data.user.role as UserRole,
            department: data.user.department || "Management",
            initials: (data.user.name || data.user.email.split("@")[0])
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .substring(0, 2),
          };
          setUser(loggedUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
        } else {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Invalid email or password.");
    }
    if (data.user) {
      const loggedUser: AuthUser = {
        email: data.user.email,
        name: data.user.name || data.user.email.split("@")[0],
        role: data.user.role as UserRole,
        department: data.user.department || "Management",
        initials: (data.user.name || data.user.email.split("@")[0])
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2),
      };
      setUser(loggedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    fetch("/api/auth/logout", { method: "POST" })
      .finally(() => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
