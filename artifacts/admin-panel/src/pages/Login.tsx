import React, { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  ShieldAlert, Eye, EyeOff, AlertCircle,
  Brain, Droplet, Users, BarChart3, Lock,
} from "lucide-react";

const FEATURES = [
  { icon: Users,    color: "#0077B6", label: "12K+ Active Users",    sub: "Across India" },
  { icon: Brain,    color: "#6366F1", label: "NVIDIA AI Powered",    sub: "Health Intelligence" },
  { icon: Droplet,  color: "#DC2626", label: "Blood Emergency",      sub: "Real-time alerts" },
  { icon: BarChart3,color: "#1B998B", label: "Revenue Analytics",    sub: "Live dashboard" },
];

export default function Login() {
  useLocation();
  const { login } = useAuth();
  const emailRef    = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email    = emailRef.current?.value?.trim() || "";
    const password = passwordRef.current?.value || "";
    if (!email || !password) { setError("Please enter your email and password"); return; }
    setLoading(true); setError("");
    localStorage.removeItem("ap_token");
    localStorage.removeItem("ap_admin");
    try {
      const res = await api.login(email, password);
      login(res.token, res.admin);
    } catch (err) {
      const msg = (err as Error).message || "Authentication failed";
      if (msg.includes("JSON") || msg.includes("Unexpected") || msg.includes("empty") || msg.includes("non-JSON")) {
        setError("Server response error — please hard refresh (Ctrl+Shift+R) and try again");
      } else {
        setError(msg);
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#090e1c" }}>

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] p-14 relative overflow-hidden"
           style={{
             background: "linear-gradient(145deg, #0a1428 0%, #0d1f3a 50%, #071525 100%)",
             borderRight: "1px solid rgba(255,255,255,0.05)",
           }}>

        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(0,119,182,0.12) 0%, transparent 70%)" }} />
          <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(27,153,139,0.1) 0%, transparent 70%)" }} />
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)" }} />
        </div>

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" style={{ height: 56, width: "auto", objectFit: "contain" }} />
            <div>
              <div className="text-[9px] font-mono tracking-[0.3em]"
                   style={{ color: "rgba(255,255,255,0.25)" }}>
                ADMIN CONSOLE
              </div>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-4"
               style={{ color: "#1B998B" }}>
            Platform Intelligence
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-3"
              style={{ color: "#dee1f7", letterSpacing: "-0.02em" }}>
            India's Premium<br />
            <span style={{
              background: "linear-gradient(135deg, #0077B6, #1B998B)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Health-Tech Platform
            </span>
          </h2>
          <p className="text-sm leading-relaxed mb-8"
             style={{ color: "rgba(255,255,255,0.38)", maxWidth: "380px" }}>
            Real-time control over users, revenue, AI models, and emergency health operations — all in one command center.
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f.label}
                   className="flex items-center gap-3 p-3.5 rounded-2xl transition-all"
                   style={{
                     background: "rgba(255,255,255,0.04)",
                     border: "1px solid rgba(255,255,255,0.06)",
                   }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                     style={{ background: `${f.color}18` }}>
                  <f.icon size={15} style={{ color: f.color }} />
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: "#dee1f7" }}>{f.label}</div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.32)" }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative flex items-center gap-4 text-[10px] font-mono"
             style={{ color: "rgba(255,255,255,0.22)" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            All Systems Operational
          </div>
          <span>·</span>
          <span>v2.0 · India 🇮🇳</span>
          <span>·</span>
          <span>256-bit Encrypted</span>
        </div>
      </div>

      {/* ── Right Panel (Login Form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">

        {/* Mobile background orbs */}
        <div className="absolute inset-0 pointer-events-none lg:hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(0,119,182,0.1) 0%, transparent 70%)" }} />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(27,153,139,0.08) 0%, transparent 70%)" }} />
        </div>

        <div className="relative w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" style={{ height: 56, width: "auto", objectFit: "contain", margin: "0 auto 8px" }} />
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Admin Console</div>
          </div>

          {/* Form card */}
          <div className="rounded-2xl p-8"
               style={{
                 background: "rgba(255,255,255,0.04)",
                 backdropFilter: "blur(24px)",
                 WebkitBackdropFilter: "blur(24px)",
                 border: "1px solid rgba(255,255,255,0.08)",
                 boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
               }}>

            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#dee1f7" }}>
                Sign In
              </h1>
              <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                Restricted access — authorized personnel only
              </p>
            </div>

            {/* Security notice */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-6"
                 style={{
                   background: "rgba(239,68,68,0.08)",
                   border: "1px solid rgba(239,68,68,0.15)",
                 }}>
              <Lock size={11} style={{ color: "#f87171" }} className="shrink-0" />
              <span className="text-[11px]" style={{ color: "#f87171" }}>
                Restricted access. Authorized personnel only.
              </span>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-5"
                   style={{
                     background: "rgba(239,68,68,0.08)",
                     border: "1px solid rgba(239,68,68,0.15)",
                   }}>
                <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                <span className="text-xs" style={{ color: "#f87171" }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5"
                       style={{ color: "rgba(255,255,255,0.5)" }}>
                  Admin Email
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  name="email"
                  autoComplete="username email"
                  placeholder="admin@aorane.com"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#dee1f7",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#0077B6")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5"
                       style={{ color: "rgba(255,255,255,0.5)" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPass ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-2.5 pr-10 text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#dee1f7",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#0077B6")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: "rgba(255,255,255,0.25)" }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white mt-2 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #0077B6, #1B998B)" }}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>
                      <ShieldAlert size={14} />
                      Access Admin Panel
                    </>}
              </button>
            </form>

            <div className="flex items-center justify-center gap-3 mt-6 text-[10px] font-mono"
                 style={{ color: "rgba(255,255,255,0.2)" }}>
              <span>256-bit TLS</span>
              <span>·</span>
              <span>DPDP Compliant</span>
              <span>·</span>
              <span>Made in India 🇮🇳</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
