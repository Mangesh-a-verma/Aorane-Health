import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Eye, EyeOff, AlertCircle, ArrowRight, Shield, BarChart3, Users } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password are required"); return; }
    setIsLoading(true);
    setError("");
    localStorage.removeItem("bp_token");
    localStorage.removeItem("bp_admin");
    localStorage.removeItem("bp_org");
    try {
      const res = await api.login(email, password);
      login(res.token, res.admin, res.org);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif", background: "#F8FAFC" }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[460px] shrink-0 p-12"
        style={{ background: "linear-gradient(160deg, #0077B6 0%, #005E8E 60%, #00496F 100%)" }}>
        <div>
          <div className="flex items-center gap-3 mb-14">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white text-lg font-bold">A</span>
            </div>
            <span className="text-white text-xl font-bold tracking-wide">AORANE Business</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Employee health,<br />measured. Not guessed.
          </h2>
          <p className="text-white/70 text-base leading-relaxed">
            Real-time aggregate health analytics for your entire workforce — privacy-safe, GST-compliant, built for Indian companies.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { icon: BarChart3, text: "Live aggregate health dashboard" },
            { icon: Users, text: "Seat-based enrollment management" },
            { icon: Shield, text: "DPDP Act 2023 compliant" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Icon size={15} className="text-white" />
              </div>
              <span className="text-white/80 text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#0077B6" }}>
              <span className="text-white font-bold">A</span>
            </div>
            <span className="text-[#0D1F33] font-bold text-lg">AORANE Business</span>
          </div>

          <h1 className="text-2xl font-bold text-[#0D1F33] mb-1">Welcome back</h1>
          <p className="text-[#6B7280] text-sm mb-7">Sign in to your organization account</p>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-[#0D1F33] text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition-all"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[#374151]">Password</label>
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[#E5E7EB] bg-white text-[#0D1F33] text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]">
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0077B6, #005E8E)" }}
            >
              {isLoading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
              ) : (
                <>Sign in <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-[#6B7280] text-sm">Don't have an account? </span>
            <a href="/register" className="text-[#0077B6] text-sm font-medium hover:underline">Register your organization</a>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E5E7EB] text-center">
            <p className="text-xs text-[#9CA3AF]">Protected by DPDP Act 2023 &bull; 256-bit SSL encryption &bull; Made in India 🇮🇳</p>
          </div>
        </div>
      </div>
    </div>
  );
}
