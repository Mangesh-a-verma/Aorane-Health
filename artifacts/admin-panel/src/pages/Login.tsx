import React, { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  ShieldAlert, Eye, EyeOff, AlertCircle,
  Brain, Droplet, Users, BarChart3, Mail, Lock, Loader2,
} from "lucide-react";

const FEATURES = [
  { icon: Users,     color: "#FF914D", label: "12K+ Active Users", sub: "Across India" },
  { icon: Brain,     color: "#6366F1", label: "AI-powered",        sub: "Health Intelligence" },
  { icon: Droplet,   color: "#DC2626", label: "Blood Emergency",   sub: "Real-time alerts" },
  { icon: BarChart3, color: "#00BF63", label: "Revenue Analytics", sub: "Live dashboard" },
];

export default function Login() {
  useLocation();
  const { login } = useAuth();
  const emailRef    = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showForgotNote, setShowForgotNote] = useState(false);

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
    <div className="min-h-screen flex bg-background text-foreground">

      {/* ── Left brand panel (fixed dark navy — on-brand regardless of theme) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[54%] p-14 relative overflow-hidden"
           style={{
             background: "linear-gradient(150deg, #050A30 0%, #0a1442 48%, #040817 100%)",
             borderRight: "1px solid rgba(255,255,255,0.05)",
           }}>

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(255,145,77,0.09) 0%, transparent 70%)" }} />
          <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(0,191,99,0.07) 0%, transparent 70%)" }} />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" style={{ height: 48, width: "auto", objectFit: "contain" }} />
          <div className="text-[9px] font-mono tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.25)" }}>
            ADMIN CONSOLE
          </div>
        </div>

        {/* Hero text */}
        <div className="relative">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-4" style={{ color: "var(--brand-green)" }}>
            Platform Intelligence
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-3" style={{ color: "#eef2f8", letterSpacing: "-0.02em" }}>
            India's Premium<br />
            <span style={{
              background: "linear-gradient(135deg, var(--brand-orange), var(--brand-green))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Health-Tech Platform
            </span>
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.42)", maxWidth: "380px" }}>
            Real-time control over users, revenue, AI models, and emergency health operations — all in one command center.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f.label}
                   className="flex items-center gap-3 p-3.5 rounded-2xl"
                   style={{ background: "linear-gradient(145deg,#0e1a2e,#0a1524)", boxShadow: "5px 5px 12px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.035)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                     style={{ background: `${f.color}22` }}>
                  <f.icon size={15} style={{ color: f.color }} />
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: "#dbe3f0" }}>{f.label}</div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.32)" }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative flex items-center gap-4 text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.24)" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--brand-green)" }} />
            All Systems Operational
          </div>
          <span>·</span>
          <span>v2.0 · India 🇮🇳</span>
          <span>·</span>
          <span>256-bit Encrypted</span>
        </div>
      </div>

      {/* ── Right sign-in panel (theme-aware neumorphic surface) ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[18%] right-[14%] w-56 h-56 rounded-full"
               style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--brand-orange) 8%, transparent) 0%, transparent 72%)" }} />
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2 text-center">
          <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" style={{ height: 44, width: "auto", objectFit: "contain", margin: "0 auto 6px" }} />
          <div className="text-xs text-muted-foreground">Admin Console</div>
        </div>

        <div className="relative w-full max-w-sm neu-lg page-enter rounded-[28px] p-8 sm:p-10">

          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign In</h1>
            <p className="text-xs mt-1.5 text-muted-foreground">Restricted access — authorized personnel only</p>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-6 tone-danger">
            <ShieldAlert size={13} className="shrink-0" />
            <span className="text-[11px] font-medium">Restricted access. Authorized personnel only.</span>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-5 tone-danger">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span className="text-xs">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Admin Email</label>
              <div className="relative flex items-center rounded-xl neu-inset focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
                <Mail size={14} className="absolute left-4 text-muted-foreground shrink-0" />
                <input
                  ref={emailRef}
                  type="email"
                  name="email"
                  autoComplete="username email"
                  placeholder="admin@aorane.com"
                  className="w-full rounded-xl pl-11 pr-4 py-2.5 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Password</label>
              <div className="relative flex items-center rounded-xl neu-inset focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
                <Lock size={14} className="absolute left-4 text-muted-foreground shrink-0" />
                <input
                  ref={passwordRef}
                  type={showPass ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl pl-11 pr-10 py-2.5 text-sm bg-transparent outline-none text-foreground tracking-wide placeholder:text-muted-foreground/60"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 text-muted-foreground hover:text-foreground transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end -mt-1">
              <button type="button" onClick={() => setShowForgotNote(v => !v)}
                      className="text-[11.5px] font-medium text-primary hover:text-primary/80 transition-colors">
                Forgot password?
              </button>
            </div>
            {showForgotNote && (
              <p className="text-[11px] text-muted-foreground -mt-2">
                Password resets aren't self-service yet — contact your Aorane super admin to reset it for you.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white mt-2 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 bg-brand-gradient"
              style={{ boxShadow: "5px 5px 13px var(--np-shadow-dark), -3px -3px 10px var(--np-shadow-light)" }}
            >
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : <>
                    <ShieldAlert size={14} />
                    Access Admin Panel
                  </>}
            </button>
          </form>

          <div className="flex items-center justify-center gap-3 mt-6 text-[10px] font-mono text-muted-foreground/70">
            <span>256-bit TLS</span>
            <span>·</span>
            <span>DPDP Compliant</span>
            <span>·</span>
            <span>Made in India 🇮🇳</span>
          </div>
        </div>
      </div>
    </div>
  );
}
