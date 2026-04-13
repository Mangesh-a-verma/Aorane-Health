import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Heart, Brain, Building2, Users, BarChart3, Shield, ArrowRight,
  Eye, EyeOff, AlertCircle, Activity, Zap, Lock, TrendingUp,
  CheckCircle2, ChevronLeft, ChevronRight, Star, Stethoscope,
  Dumbbell, HandHeart, FileText, UserCheck, Globe, Leaf,
} from "lucide-react";

const SLIDES = [
  {
    id: "corporate",
    badge: "🏢 Corporate Wellness",
    color: "#0EA5E9",
    glow: "rgba(14,165,233,0.3)",
    gradient: "linear-gradient(135deg, #0EA5E9, #3B82F6)",
    headline: "Apne Employees Ka Dhyan Rakho",
    sub: "Healthy employees = productive company. AORANE se apni team ki health monitor karo aur absenteeism 40% tak kam karo.",
    benefits: [
      { icon: Activity, text: "Real-time employee health dashboard" },
      { icon: BarChart3, text: "Department-wise health analytics" },
      { icon: Brain, text: "AI stress & burnout detection" },
      { icon: UserCheck, text: "Annual health report for each employee" },
    ],
    stats: [{ val: "40%", label: "Absenteeism Reduction" }, { val: "3x", label: "ROI on Health Benefits" }, { val: "92%", label: "Employee Satisfaction" }],
    graphic: (
      <div className="relative w-full h-64 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle, #0EA5E9, transparent)" }} />
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { icon: "💼", label: "HR Dashboard", color: "#0EA5E9" },
            { icon: "📊", label: "Analytics", color: "#3B82F6" },
            { icon: "🧠", label: "AI Insights", color: "#8B5CF6" },
            { icon: "✅", label: "Health Score", color: "#10B981" },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-2 p-3 rounded-2xl border"
              style={{ background: "rgba(255,255,255,0.06)", borderColor: item.color + "30" }}>
              <span className="text-3xl">{item.icon}</span>
              <span className="text-xs font-medium" style={{ color: item.color }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "hospital",
    badge: "🏥 Hospitals & Clinics",
    color: "#EF4444",
    glow: "rgba(239,68,68,0.3)",
    gradient: "linear-gradient(135deg, #EF4444, #F97316)",
    headline: "Patient Care Ko Next Level Pe Le Jao",
    sub: "Patients ki complete health history ek jagah. Reports, medicines, follow-ups — sab kuch digital aur secure.",
    benefits: [
      { icon: Stethoscope, text: "Patient health records & history" },
      { icon: FileText, text: "AI-powered medical report scanning" },
      { icon: Brain, text: "Post-treatment recovery tracking" },
      { icon: Shield, text: "DPDP compliant data security" },
    ],
    stats: [{ val: "60%", label: "Faster Diagnosis" }, { val: "10x", label: "Record Retrieval Speed" }, { val: "0", label: "Paper Records" }],
    graphic: (
      <div className="relative w-full h-64 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle, #EF4444, transparent)" }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="text-6xl">🏥</div>
          <div className="flex gap-3">
            {["🩺", "💊", "📋", "🩻"].map(e => (
              <div key={e} className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border"
                style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)" }}>
                {e}
              </div>
            ))}
          </div>
          <div className="px-4 py-2 rounded-full text-sm font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
            AI Report Scanner Active ✓
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "yoga",
    badge: "🧘 Yoga & Fitness Centers",
    color: "#10B981",
    glow: "rgba(16,185,129,0.3)",
    gradient: "linear-gradient(135deg, #10B981, #06B6D4)",
    headline: "Members Ki Fitness Journey Track Karo",
    sub: "Gym attendance se lekar diet plan tak — har member ki progress track karo. Member retention 40% badhao.",
    benefits: [
      { icon: Dumbbell, text: "Individual member fitness tracking" },
      { icon: TrendingUp, text: "Progress charts & goal setting" },
      { icon: Leaf, text: "AI diet & nutrition plans" },
      { icon: Users, text: "Group class & attendance management" },
    ],
    stats: [{ val: "40%", label: "Better Retention" }, { val: "5x", label: "Member Engagement" }, { val: "100%", label: "Digital Records" }],
    graphic: (
      <div className="relative w-full h-64 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle, #10B981, transparent)" }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="text-7xl">🧘</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Calories", val: "2,340", color: "#10B981" },
              { label: "Steps", val: "8,200", color: "#06B6D4" },
              { label: "Sleep", val: "7.5h", color: "#8B5CF6" },
            ].map(s => (
              <div key={s.label} className="text-center p-2 rounded-xl border"
                style={{ background: "rgba(16,185,129,0.1)", borderColor: s.color + "30" }}>
                <div className="text-sm font-bold" style={{ color: s.color }}>{s.val}</div>
                <div className="text-xs text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "insurance",
    badge: "🛡️ Insurance Companies",
    color: "#8B5CF6",
    glow: "rgba(139,92,246,0.3)",
    gradient: "linear-gradient(135deg, #8B5CF6, #EC4899)",
    headline: "Health Data Se Sahi Risk Assessment Karo",
    sub: "Real health data se accurate premium calculation aur wellness programs. Members ko healthy rakhne ka incentive do.",
    benefits: [
      { icon: Shield, text: "Real-time health risk assessment" },
      { icon: BarChart3, text: "Wellness program tracking & rewards" },
      { icon: FileText, text: "Digital claim documentation" },
      { icon: TrendingUp, text: "Predictive health analytics" },
    ],
    stats: [{ val: "35%", label: "Claim Reduction" }, { val: "2x", label: "Premium Accuracy" }, { val: "80%", label: "Member Wellness Score" }],
    graphic: (
      <div className="relative w-full h-64 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle, #8B5CF6, transparent)" }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="text-6xl">🛡️</div>
          <div className="flex flex-col gap-2 w-52">
            {[
              { label: "Low Risk Members", pct: 72, color: "#10B981" },
              { label: "Medium Risk", pct: 21, color: "#F59E0B" },
              { label: "High Risk", pct: 7, color: "#EF4444" },
            ].map(b => (
              <div key={b.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">{b.label}</span>
                  <span style={{ color: b.color }}>{b.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "ngo",
    badge: "🤝 NGOs & Social Orgs",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.3)",
    gradient: "linear-gradient(135deg, #F59E0B, #EF4444)",
    headline: "Samaj Ki Sehat Ka Dhyan Rakho",
    sub: "Underserved communities ke liye affordable health management. AORANE ke zariye health equity create karo.",
    benefits: [
      { icon: HandHeart, text: "Community health monitoring" },
      { icon: Globe, text: "10 Indian language support" },
      { icon: Users, text: "Bulk member enrollment" },
      { icon: Zap, text: "Free basic plan for NGOs" },
    ],
    stats: [{ val: "10", label: "Indian Languages" }, { val: "Free", label: "NGO Basic Plan" }, { val: "∞", label: "Communities Reached" }],
    graphic: (
      <div className="relative w-full h-64 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle, #F59E0B, transparent)" }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="text-6xl">🤝</div>
          <div className="grid grid-cols-2 gap-2">
            {["हिंदी", "मराठी", "বাংলা", "தமிழ்", "తెలుగు", "ਪੰਜਾਬੀ"].map(lang => (
              <div key={lang} className="px-3 py-1.5 rounded-full text-xs font-medium border text-center"
                style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#FCD34D" }}>
                {lang}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

const WHY_AORANE = [
  { icon: Shield, title: "DPDP Compliant", desc: "India ka Data Protection law — poora compliance. Employee data 100% secure.", color: "#0EA5E9" },
  { icon: Brain, title: "AI-Powered Insights", desc: "NVIDIA LLaMA AI se personalized health recommendations har member ke liye.", color: "#8B5CF6" },
  { icon: Globe, title: "10 Indian Languages", desc: "Hindi, Marathi, Bengali, Tamil — har employee apni bhasha mein.", color: "#10B981" },
  { icon: BarChart3, title: "Real-time Analytics", desc: "Live health dashboards, trend reports, aur export options.", color: "#F59E0B" },
  { icon: Zap, title: "Easy Onboarding", desc: "5 minute mein setup. CSV se bulk member import. Koi training nahi chahiye.", color: "#EF4444" },
  { icon: Lock, title: "256-bit Encrypted", desc: "Military-grade encryption. Har health record safe aur private.", color: "#06B6D4" },
];

const TESTIMONIALS = [
  { name: "Rajesh Sharma", org: "TechCorp India, HR Head", text: "AORANE se humari team ka average health score 23 points badha. Absenteeism 38% kam hua. ROI ekdum clear hai.", stars: 5, type: "🏢" },
  { name: "Dr. Priya Nair", org: "Nair Wellness Clinic, Pune", text: "Patient records dhundhna itna easy ho gaya. AI report scanner toh kamal ka feature hai — genuinely helpful.", stars: 5, type: "🏥" },
  { name: "Ankit Rawat", org: "FitLife Gyms, Delhi NCR", text: "Members ab app use karte hain daily. Retention 40% improve hua hai first 6 months mein hi.", stars: 5, type: "💪" },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback((idx: number) => {
    setCurrent((idx + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [isPaused]);

  const slide = SLIDES[current];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email aur password required hai"); return; }
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

      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full opacity-15 transition-all duration-1000"
          style={{ background: `radial-gradient(circle, ${slide.color} 0%, transparent 70%)`, filter: "blur(60px)" }} />
        <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: "rgba(2,11,24,0.80)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 0 20px rgba(14,165,233,0.4)" }}>
              <Heart size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight"
              style={{ background: "linear-gradient(90deg, #fff, #94d2e8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AORANE</span>
            <span className="text-xs px-2 py-0.5 rounded-full ml-1 hidden sm:block"
              style={{ background: "rgba(14,165,233,0.15)", color: "#7DD3FC", border: "1px solid rgba(14,165,233,0.2)" }}>
              Business Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#login-card" className="text-sm font-semibold text-white/50 hover:text-white transition-colors hidden sm:block">
              Sign In
            </a>
            <a href="/register"
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 0 16px rgba(14,165,233,0.3)" }}>
              Get Started Free
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO: Slider + Fixed Login ── */}
      <section className="relative z-10 pt-12 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-start">

            {/* LEFT: Slider */}
            <div
              className="relative rounded-3xl overflow-hidden border min-h-[560px] flex flex-col"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(16px)", borderColor: slide.color + "25", boxShadow: `0 0 40px ${slide.glow}20`, transition: "border-color 0.6s, box-shadow 0.6s" }}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Slide accent bar */}
              <div className="h-1 w-full transition-all duration-700" style={{ background: slide.gradient }} />

              <div className="p-8 flex flex-col flex-1">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6 self-start border"
                  style={{ background: slide.color + "18", borderColor: slide.color + "35", color: slide.color }}>
                  <span>{slide.badge}</span>
                </div>

                {/* Graphic area */}
                <div className="mb-6">
                  {slide.graphic}
                </div>

                {/* Headline */}
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 leading-tight transition-all duration-500">
                  {slide.headline}
                </h1>
                <p className="text-white/50 text-sm leading-relaxed mb-6">
                  {slide.sub}
                </p>

                {/* Benefits */}
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {slide.benefits.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: slide.color + "20" }}>
                        <b.icon size={13} style={{ color: slide.color }} />
                      </div>
                      <span className="text-xs text-white/70 leading-tight">{b.text}</span>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex gap-4 pb-2 flex-wrap">
                  {slide.stats.map((s, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xl font-extrabold" style={{ color: slide.color }}>{s.val}</div>
                      <div className="text-xs text-white/35">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation controls */}
              <div className="px-8 pb-6 flex items-center justify-between">
                {/* Dots */}
                <div className="flex gap-2">
                  {SLIDES.map((s, i) => (
                    <button key={i} onClick={() => goTo(i)}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === current ? "24px" : "8px",
                        height: "8px",
                        background: i === current ? slide.color : "rgba(255,255,255,0.2)",
                      }}
                    />
                  ))}
                </div>
                {/* Arrows */}
                <div className="flex gap-2">
                  <button onClick={() => goTo(current - 1)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all hover:scale-110"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                    <ChevronLeft size={16} className="text-white/50" />
                  </button>
                  <button onClick={() => goTo(current + 1)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all hover:scale-110"
                    style={{ background: slide.color + "25", borderColor: slide.color + "40" }}>
                    <ChevronRight size={16} style={{ color: slide.color }} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div key={current} className="h-full" style={{ background: slide.gradient, animation: isPaused ? "none" : "slideProgress 5s linear forwards" }} />
              </div>
            </div>

            {/* RIGHT: Fixed Login Card */}
            <div id="login-card" className="lg:sticky lg:top-24">
              <div className="w-full rounded-3xl p-8 border"
                style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)" }}>

                <div className="flex items-center gap-3 mb-7">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 0 24px rgba(14,165,233,0.5)" }}>
                    <Building2 size={22} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Business Login</h2>
                    <p className="text-xs text-white/40">Apne organization portal mein enter karo</p>
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
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="admin@yourorg.com"
                      className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all placeholder-white/20"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                      onFocus={e => { e.target.style.borderColor = "rgba(14,165,233,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.1)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-sm font-medium text-white/60">Password</label>
                    </div>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
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
                    ) : (<>Dashboard Pe Jao <ArrowRight size={16} /></>)}
                  </button>
                </form>

                <div className="mt-5 pt-5 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <p className="text-sm text-white/40">
                    Naya organization?{" "}
                    <a href="/register" className="font-semibold hover:text-white transition-colors" style={{ color: "#38BDF8" }}>
                      Free mein register karo
                    </a>
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  {[{ t: "🔒 Encrypted" }, { t: "🇮🇳 DPDP Act" }, { t: "✓ Secure" }].map(b => (
                    <div key={b.t} className="text-xs rounded-full px-2.5 py-1 border"
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                      {b.t}
                    </div>
                  ))}
                </div>

                {/* Quick stats */}
                <div className="mt-6 pt-5 border-t grid grid-cols-3 gap-3 text-center" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  {[
                    { val: "500+", label: "Organizations" },
                    { val: "50K+", label: "Members" },
                    { val: "10", label: "Languages" },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="text-base font-extrabold" style={{ color: "#38BDF8" }}>{s.val}</div>
                      <div className="text-xs text-white/35">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA below login */}
              <div className="mt-4 rounded-2xl p-5 border text-center"
                style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.15)" }}>
                <p className="text-sm text-white/60 mb-3">
                  Pehli baar? <span style={{ color: "#34D399" }}>14 din free trial</span> — koi credit card nahi chahiye
                </p>
                <a href="/register"
                  className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)", boxShadow: "0 6px 20px rgba(16,185,129,0.3)" }}>
                  Abhi Start Karo <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY AORANE ── */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="w-full h-px mb-16" style={{ background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.4), rgba(16,185,129,0.4), transparent)" }} />

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4 border"
              style={{ background: "rgba(14,165,233,0.1)", borderColor: "rgba(14,165,233,0.2)", color: "#7DD3FC" }}>
              <Zap size={12} /> AORANE Platform Advantages
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
              AORANE Kyu Choose Karo?
            </h2>
            <p className="text-white/40 max-w-xl mx-auto text-sm">
              India-first health platform — Indian languages, Indian compliance, Indian businesses ke liye banaya gaya
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {WHY_AORANE.map((f) => (
              <div key={f.title}
                className="rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.03] group cursor-default"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = f.color + "40"; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${f.color}20`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: f.color + "18", border: `1px solid ${f.color}30` }}>
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST SECTION ── */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl p-10 border text-center"
            style={{ background: "rgba(14,165,233,0.04)", borderColor: "rgba(14,165,233,0.12)", backdropFilter: "blur(20px)" }}>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Apne Employees Ka Dhyan Rakhna =<br />
              <span style={{ background: "linear-gradient(90deg, #38BDF8, #34D399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Unka Aap Pe Bharosa
              </span>
            </h2>
            <p className="text-white/45 max-w-2xl mx-auto text-sm leading-relaxed mb-8">
              Jab ek company apne employees ki health ka dhyan rakhti hai, toh employees company pe trust karte hain, 
              kam leave lete hain, aur zyada productive hote hain. AORANE isi trust ko build karta hai.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-8">
              {[
                { icon: "❤️", stat: "87%", label: "Employees feel valued" },
                { icon: "📈", stat: "3x", label: "Higher productivity" },
                { icon: "🏆", stat: "40%", label: "Lower attrition rate" },
                { icon: "💰", stat: "₹2.5L", label: "Avg savings per employee/year" },
              ].map(s => (
                <div key={s.label} className="text-center px-6 py-4 rounded-2xl border"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-xl font-extrabold text-white">{s.stat}</div>
                  <div className="text-xs text-white/40">{s.label}</div>
                </div>
              ))}
            </div>
            <a href="/register"
              className="inline-flex items-center gap-2 font-bold px-8 py-4 rounded-2xl transition-all hover:scale-105 text-sm"
              style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 12px 32px rgba(14,165,233,0.4)" }}>
              Apni Organization Register Karo <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-white mb-2">Jo Log Use Kar Rahe Hain, Woh Kya Kehte Hain</h2>
            <p className="text-white/35 text-sm">India bhar ke businesses ka bharosa</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl p-6 border"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} size={13} fill="#F59E0B" style={{ color: "#F59E0B" }} />
                  ))}
                </div>
                <p className="text-white/65 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg border"
                    style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }}>
                    {t.type}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{t.name}</div>
                    <div className="text-xs text-white/35">{t.org}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t py-10 px-4"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(2,11,24,0.5)" }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)" }}>
              <Heart size={14} className="text-white" />
            </div>
            <span className="font-bold text-white">AORANE</span>
            <span className="text-white/30 text-xs">Business Portal</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-white/30">
            <span>🇮🇳 Made in India</span>
            <span>•</span>
            <span>DPDP Compliant</span>
            <span>•</span>
            <span>© 2026 AORANE Health Tech</span>
          </div>
          <div className="flex gap-3 text-xs">
            <a href="https://aorane.com" className="text-white/30 hover:text-white/60 transition-colors">Main Website</a>
            <span className="text-white/15">•</span>
            <a href="mailto:business@aorane.in" className="text-white/30 hover:text-white/60 transition-colors">business@aorane.in</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes slideProgress {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </div>
  );
}
