import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Heart, Brain, Droplets, Dumbbell, Building2, Users, BarChart3,
  Shield, Smartphone, ArrowRight, Eye, EyeOff, AlertCircle,
  CheckCircle2, Star, ChevronRight, Activity, Pill, Apple,
  Zap, Lock, Globe, TrendingUp, Cpu, Stethoscope,
} from "lucide-react";

const FEATURES_USER = [
  { icon: Brain, label: "AI Food Scanner", desc: "Photo-based nutrition tracking with instant AI analysis", color: "#10B981", glow: "#10B98140" },
  { icon: Activity, label: "Health Scorecard", desc: "Daily health score with personalized insights", color: "#0EA5E9", glow: "#0EA5E940" },
  { icon: Dumbbell, label: "Exercise Tracker", desc: "MET-based calorie calculation & workout logs", color: "#8B5CF6", glow: "#8B5CF640" },
  { icon: Pill, label: "Medicine Reminder", desc: "Never miss a dose with smart notifications", color: "#EF4444", glow: "#EF444440" },
  { icon: Droplets, label: "Water Tracker", desc: "Stay hydrated with intelligent reminders", color: "#06B6D4", glow: "#06B6D440" },
  { icon: Heart, label: "Family Health", desc: "Manage health for your entire family", color: "#F59E0B", glow: "#F59E0B40" },
];

const FEATURES_BIZ = [
  { icon: Users, label: "Member Management", desc: "Complete employee health profiles in one place" },
  { icon: BarChart3, label: "Analytics & Reports", desc: "Real-time health metrics and trend analysis" },
  { icon: Shield, label: "DPDP Compliant", desc: "Enterprise-grade data privacy guaranteed" },
  { icon: Building2, label: "Multi-location", desc: "Manage all branches from a single dashboard" },
];

const TESTIMONIALS = [
  { name: "Dr. Sharma", org: "Apollo Wellness, Delhi", text: "AORANE completely transformed health tracking for our 500+ employees. The AI insights are remarkable.", stars: 5 },
  { name: "Priya Singh", org: "FitLife Gym, Mumbai", text: "Our members love it. Member retention has improved by 40% since we started using AORANE.", stars: 5 },
  { name: "Rahul Verma", org: "Corporate HR, Bangalore", text: "The multilingual support is a game changer. Every employee can use it in their preferred language.", stars: 5 },
];

const BUSINESS_TYPES = [
  { emoji: "🏥", type: "Hospitals & Clinics", desc: "Patient health records & tracking" },
  { emoji: "💪", type: "Gyms & Fitness Centers", desc: "Member progress & attendance" },
  { emoji: "🏢", type: "Corporate Wellness", desc: "Employee health programs" },
  { emoji: "🧪", type: "Diagnostic Labs", desc: "Report sharing & follow-ups" },
  { emoji: "🍎", type: "Nutrition Centers", desc: "Diet plans & monitoring" },
  { emoji: "🏫", type: "Schools & Colleges", desc: "Student health management" },
];

export default function Landing() {
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
    <div className="min-h-screen text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif", background: "linear-gradient(135deg, #020B18 0%, #051B2C 40%, #081F30 70%, #04141F 100%)" }}>

      {/* ── FIXED BACKGROUND ORBS ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #0EA5E9 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute top-1/3 -left-32 w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute -bottom-32 right-1/4 w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)", filter: "blur(40px)" }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: "rgba(2,11,24,0.75)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 0 20px rgba(14,165,233,0.4)" }}>
              <Heart size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ background: "linear-gradient(90deg, #fff, #94d2e8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AORANE</span>
            <span className="text-xs text-white/30 ml-1 hidden sm:block">Your Health Coach</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#login" className="text-sm font-semibold text-white/60 hover:text-white transition-colors hidden sm:block">
              Business Login
            </a>
            <a href="#download" className="hidden sm:flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 0 20px rgba(14,165,233,0.3)" }}>
              <Smartphone size={14} /> App Download
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 pt-20 pb-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-14 items-center">

            {/* Left: Hero Text */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-7 border"
                style={{ background: "rgba(14,165,233,0.1)", borderColor: "rgba(14,165,233,0.25)", color: "#7DD3FC" }}>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                India's #1 AI Health Management Platform
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
                Your Health,
                <span className="block mt-1" style={{ background: "linear-gradient(90deg, #38BDF8, #34D399, #818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  In Your Hands
                </span>
              </h1>

              <p className="text-white/50 text-lg leading-relaxed mb-10 max-w-xl">
                AORANE is India's complete health platform — AI-powered health tracking for individuals and powerful CRM & analytics for businesses.
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap gap-8 mb-10">
                {[
                  { val: "50,000+", label: "Active Users", icon: Users },
                  { val: "500+", label: "Businesses", icon: Building2 },
                  { val: "10", label: "Languages", icon: Globe },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.2)" }}>
                      <s.icon size={18} style={{ color: "#38BDF8" }} />
                    </div>
                    <div>
                      <div className="text-xl font-extrabold text-white">{s.val}</div>
                      <div className="text-xs text-white/40">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* App Badges */}
              <div id="download" className="flex flex-wrap gap-3">
                <a href="https://play.google.com/store" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all hover:scale-105"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}>
                  <span className="text-2xl">▶</span>
                  <div>
                    <div className="text-[10px] text-white/40 leading-none">Get it on</div>
                    <div className="text-sm font-bold leading-tight">Google Play</div>
                  </div>
                </a>
                <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all hover:scale-105"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}>
                  <Apple size={22} />
                  <div>
                    <div className="text-[10px] text-white/40 leading-none">Download on the</div>
                    <div className="text-sm font-bold leading-tight">App Store</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Right: Glass Login Card */}
            <div id="login" className="flex justify-center lg:justify-end">
              <div className="w-full max-w-md rounded-3xl p-8 border"
                style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}>

                {/* Inner glow */}
                <div className="absolute -inset-px rounded-3xl pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(14,165,233,0.08) 0%, transparent 60%)", borderRadius: "24px" }} />

                <div className="flex items-center gap-3 mb-7">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 0 24px rgba(14,165,233,0.5)" }}>
                    <Building2 size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Business Login</h2>
                    <p className="text-xs text-white/40">Access your organization portal</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 border"
                    style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@yourorg.com"
                      className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all placeholder-white/20"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                      onFocus={e => { e.target.style.borderColor = "rgba(14,165,233,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.1)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl px-4 py-3 pr-11 text-white text-sm focus:outline-none transition-all placeholder-white/20"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                        onFocus={e => { e.target.style.borderColor = "rgba(14,165,233,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.1)"; }}
                        onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading}
                    className="w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                    style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 8px 24px rgba(14,165,233,0.35)" }}>
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Go to Dashboard <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>

                <div className="mt-5 pt-5 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <p className="text-sm text-white/40">
                    New organization?{" "}
                    <a href="/register" className="font-semibold hover:text-white transition-colors" style={{ color: "#38BDF8" }}>
                      Register here
                    </a>
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  {[{ icon: "🔒", text: "Encrypted" }, { icon: "🇮🇳", text: "DPDP Act" }, { icon: "✓", text: "ISO 27001" }].map(b => (
                    <div key={b.text} className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border"
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                      <span>{b.icon}</span><span>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE PILLS ── */}
      <div className="relative z-10 flex justify-center gap-3 flex-wrap px-4 pb-12 -mt-8">
        {[
          { icon: Zap, label: "AI-Powered" },
          { icon: Shield, label: "DPDP Compliant" },
          { icon: Lock, label: "256-bit Encrypted" },
          { icon: Cpu, label: "Gemini AI" },
          { icon: Stethoscope, label: "Medically Accurate" },
        ].map(p => (
          <div key={p.label} className="flex items-center gap-2 text-xs font-medium rounded-full px-3.5 py-2 border"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.50)", backdropFilter: "blur(8px)" }}>
            <p.icon size={12} style={{ color: "#38BDF8" }} />
            {p.label}
          </div>
        ))}
      </div>

      {/* ── USER FEATURES ── */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 border"
              style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)", color: "#6EE7B7" }}>
              <Smartphone size={12} /> Mobile App Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Your Health's{" "}
              <span style={{ background: "linear-gradient(90deg, #38BDF8, #34D399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Complete Solution
              </span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              AI-powered health tracking in 10 Indian languages — in your own language, on your own terms
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {FEATURES_USER.map((f) => (
              <div key={f.label}
                className="group rounded-2xl p-5 text-center transition-all duration-300 cursor-default border hover:scale-105"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = f.color + "40"; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${f.glow}`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                  style={{ background: f.color + "18", border: `1px solid ${f.color}30` }}>
                  <f.icon size={22} style={{ color: f.color }} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{f.label}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUSINESS FEATURES ── */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section divider */}
          <div className="w-full h-px mb-20" style={{ background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.3), rgba(16,185,129,0.3), transparent)" }} />

          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
                style={{ background: "rgba(14,165,233,0.1)", borderColor: "rgba(14,165,233,0.2)", color: "#7DD3FC" }}>
                <Building2 size={12} /> For Businesses
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-5">
                Manage Your Business
                <span className="block mt-1" style={{ background: "linear-gradient(90deg, #38BDF8, #34D399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Health Journey
                </span>
              </h2>
              <p className="text-white/40 text-lg mb-8 leading-relaxed">
                Gyms, hospitals, corporate wellness, clinics — powerful tools for every health business in one platform.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {FEATURES_BIZ.map(f => (
                  <div key={f.label} className="rounded-2xl p-4 border transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 0 16px rgba(14,165,233,0.3)" }}>
                      <f.icon size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">{f.label}</h3>
                    <p className="text-xs text-white/40">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Business types glass card */}
            <div className="rounded-3xl p-8 border"
              style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.09)", boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }}>
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <TrendingUp size={18} style={{ color: "#38BDF8" }} />
                Who can use AORANE?
              </h3>
              <div className="space-y-2">
                {BUSINESS_TYPES.map(item => (
                  <div key={item.type}
                    className="flex items-center gap-4 p-3 rounded-xl transition-all cursor-default group border border-transparent"
                    style={{ background: "rgba(255,255,255,0.0)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.12)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0)"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border"
                      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
                      {item.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{item.type}</div>
                      <div className="text-xs text-white/40 truncate">{item.desc}</div>
                    </div>
                    <ChevronRight size={14} className="text-white/20 group-hover:text-sky-400 transition-colors shrink-0" />
                  </div>
                ))}
              </div>
              <a href="#login"
                className="mt-6 w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 8px 24px rgba(14,165,233,0.3)" }}>
                Login Now <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="w-full h-px mb-20" style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.3), rgba(139,92,246,0.3), transparent)" }} />
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-white mb-3">
              What Our Customers Say
            </h2>
            <p className="text-white/40">Trusted by businesses across India</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-2xl p-6 border transition-all hover:scale-[1.02]"
                style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} size={14} className="fill-amber-400" style={{ color: "#FBBF24" }} />
                  ))}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)" }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{t.name}</div>
                    <div className="text-xs text-white/40">{t.org}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl p-12 text-center border overflow-hidden relative"
            style={{ background: "rgba(14,165,233,0.06)", backdropFilter: "blur(20px)", borderColor: "rgba(14,165,233,0.2)", boxShadow: "0 0 80px rgba(14,165,233,0.1)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(14,165,233,0.12) 0%, transparent 60%)" }} />
            <div className="relative z-10">
              <div className="text-4xl mb-4">🚀</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Start Today — It's Free
              </h2>
              <p className="text-white/50 text-lg mb-8 max-w-xl mx-auto">
                Download the app or join the business portal — both start free with no setup fees.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a href="#download"
                  className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 8px 32px rgba(14,165,233,0.4)" }}>
                  <Smartphone size={18} /> Download App
                </a>
                <a href="#login"
                  className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl border transition-all hover:scale-105"
                  style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}>
                  <Building2 size={18} /> Business Login
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 py-14 px-4 sm:px-6 lg:px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)" }}>
                  <Heart size={14} className="text-white" />
                </div>
                <span className="font-bold text-lg text-white">AORANE</span>
              </div>
              <p className="text-white/30 text-sm leading-relaxed">India's own health management platform — in your language, for your health.</p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-white/60">App Features</h4>
              <ul className="space-y-2 text-white/30 text-sm">
                {["AI Food Scanner", "Exercise Tracker", "Health Scorecard", "Medicine Reminder"].map(i => (
                  <li key={i} className="hover:text-white/60 transition-colors cursor-default">{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-white/60">Business</h4>
              <ul className="space-y-2 text-sm">
                {[["Login", "#login"], ["Register", "/register"], ["Pricing", "#"], ["Support", "#"]].map(([l, h]) => (
                  <li key={l}><a href={h} className="text-white/30 hover:text-white/60 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-white/60">Contact</h4>
              <ul className="space-y-2 text-white/30 text-sm">
                <li>support@aorane.in</li>
                <li>+91 98765 43210</li>
                <li>New Delhi, India 🇮🇳</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-8 text-xs text-white/25"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span>© 2026 AORANE Health Pvt. Ltd. All rights reserved.</span>
            <div className="flex gap-5">
              {["Privacy Policy", "Terms of Service", "DPDP Compliance"].map(l => (
                <a key={l} href="#" className="hover:text-white/50 transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
