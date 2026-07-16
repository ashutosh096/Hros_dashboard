import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    if (isRegister) {
      try {
        const res = await fetch("/api/auth/register-employee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, department }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg("Account created successfully! Please wait for admin approval.");
          setName("");
          setEmail("");
          setPassword("");
          setIsRegister(false);
        } else {
          setError(data.error || "Failed to register.");
        }
      } catch (err) {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      await new Promise((r) => setTimeout(r, 400));
      const ok = await login(email, password);
      if (ok) {
        navigate("/");
      } else {
        setError("Invalid email or password.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: "admin" | "employee") => {
    if (role === "admin") {
      setEmail("admin@hrapp.com");
      setPassword("admin123");
    } else {
      setEmail("sarah@hrapp.com");
      setPassword("employee123");
    }
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#f0f4f9] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">H</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HR OS</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{isRegister ? "Sign Up" : "Login"}</h2>
          <p className="text-sm text-gray-500 mb-6">{isRegister ? "Create your employee account below" : "Enter your email and password below to login"}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 border-gray-200 focus:border-primary focus:ring-primary"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder={isRegister ? "employee@company.com" : "admin@hrapp.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-gray-200 focus:border-primary focus:ring-primary"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-gray-200"
                required
              />
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-medium text-gray-700">Department</Label>
                <select
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-11 px-3 border border-gray-250/70 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option>Engineering</option>
                  <option>Design</option>
                  <option>Marketing</option>
                  <option>Finance</option>
                  <option>Sales</option>
                  <option>HR</option>
                  <option>Management</option>
                </select>
              </div>
            )}

            {successMsg && (
              <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{successMsg}</p>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  {isRegister ? "Sign Up" : "Sign In"}
                </>
              )}
            </Button>
          </form>

          {/* Toggle register */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
                setSuccessMsg("");
              }}
              className="text-xs text-primary font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              {isRegister ? "Already have an account? Sign In" : "Don't have an account? Register as Employee"}
            </button>
          </div>
        </div>

        {/* Demo buttons */}
        <div className="flex justify-center gap-6 mt-6">
          <button
            type="button"
            onClick={() => fillDemo("admin")}
            className="text-sm text-gray-500 hover:text-primary transition-colors"
          >
            Use Admin Demo
          </button>
          <button
            type="button"
            onClick={() => fillDemo("employee")}
            className="text-sm text-gray-500 hover:text-primary transition-colors"
          >
            Use Employee Demo
          </button>
        </div>
      </div>
    </div>
  );
}
