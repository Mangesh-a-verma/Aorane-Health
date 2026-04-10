import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Heart, Brain, Droplets, Dumbbell, Building2, Users, BarChart3,
  Shield, Smartphone, ArrowRight, Eye, EyeOff, AlertCircle,
  CheckCircle2, Star, ChevronRight, Activity, Pill, Apple,
} from "lucide-react";

const FEATURES_USER = [
  { icon: Brain, label: "AI Food Scanner", desc: "Photo se nutrition track karo", color: "#00B896" },
  { icon: Activity, label: "Health Scorecard", desc: "Daily health score jaano", color: "#0077B6" },
  { icon: Dumbbell, label: "Exercise Tracker", desc: "MET-based calorie calc", color: "#7C3AED" },
  { icon: Pill, label: "Medicine Reminder", desc: "Kabhi dose mat bhoolo", color: "#EF4444" },
  { icon: Droplets, label: "Water Tracker", desc: "Hydration goals achieve karo", color: "#06B6D4" },
  { icon: Heart, label: "Family Health", desc: "Poore parivaar ka dhyan", color: "#F59E0B" },
];

const FEATURES_BIZ = [
  { icon: Users, label: "Member Management", desc: "Employees ka health manage karo" },
  { icon: BarChart3, label: "Analytics & Reports", desc: "Real-time health insights" },
  { icon: Shield, label: "DPDP Compliant", desc: "Data privacy guaranteed" },
  { icon: Building2, label: "Multi-location", desc: "Branches ko ek jagah manage karo" },
];

const TESTIMONIALS = [
  { name: "Dr. Sharma", org: "Apollo Wellness, Delhi", text: "AORANE ne hamare 500+ employees ki health tracking completely change kar di.", stars: 5 },
  { name: "Priya Singh", org: "FitLife Gym, Mumbai", text: "Members bahut happy hain. Retention 40% badh gayi!", stars: 5 },
  { name: "Rahul Verma", org: "Corporate HR, Bangalore", text: "Sabse acchi cheez — Hindi mein kaam karta hai!", stars: 5 },
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
    if (!email || !password) { setError("Email aur password dono zaroori hain"); return; }
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
    <div className="min-h-screen bg-white font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0077B6] to-[#00B896] flex items-center justify-center">
              <Heart size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold text-[#0D1F33] tracking-tight">AORANE</span>
            <span className="text-xs text-[#7A90A4] ml-1 hidden sm:block">Your Health Coach</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#login"
              className="text-sm font-semibold text-[#0077B6] hover:text-[#005f91] transition-colors"
            >
              Business Login
            </a>
            <a
              href="#download"
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-[#0077B6] to-[#00B896] text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              <Smartphone size={14} /> App Download
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#E8F7FB] via-[#F0FAF6] to-white pt-16 pb-20">
        {/* Decorative blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#BAE6FD]/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 bg-[#A7F3D0]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#E8F4FF] border border-[#C0DEFF] text-[#0077B6] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <div className="w-2 h-2 rounded-full bg-[#00B896] animate-pulse" />
                India ka #1 Health Management Platform
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0D1F33] leading-tight mb-5">
                Aapki Health,
                <span className="block bg-gradient-to-r from-[#0077B6] to-[#00B896] bg-clip-text text-transparent">
                  Aapke Haath Mein
                </span>
              </h1>
              <p className="text-[#7A90A4] text-lg leading-relaxed mb-8 max-w-lg">
                AORANE ek complete Indian health platform hai — individual users ke liye AI-powered health tracking,
                aur businesses ke liye powerful CRM & analytics.
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap gap-6 mb-8">
                {[
                  { val: "50,000+", label: "Active Users" },
                  { val: "500+", label: "Businesses" },
                  { val: "10", label: "Indian Languages" },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-2xl font-extrabold text-[#0077B6]">{s.val}</div>
                    <div className="text-xs text-[#7A90A4] font-medium">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div id="download" className="flex flex-wrap gap-3">
                <a
                  href="https://play.google.com/store"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#0D1F33] text-white px-5 py-3 rounded-xl hover:bg-[#1a2f4a] transition-colors shadow-md"
                >
                  <span className="text-2xl">▶</span>
                  <div>
                    <div className="text-xs text-white/60 leading-none">Get it on</div>
                    <div className="text-sm font-bold leading-tight">Google Play</div>
                  </div>
                </a>
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#0D1F33] text-white px-5 py-3 rounded-xl hover:bg-[#1a2f4a] transition-colors shadow-md"
                >
                  <Apple size={22} />
                  <div>
                    <div className="text-xs text-white/60 leading-none">Download on the</div>
                    <div className="text-sm font-bold leading-tight">App Store</div>
                  </div>
                </a>
              </div>
              <p className="text-xs text-[#7A90A4] mt-3">
                Web version bhi available hai — browser mein seedha use karo!
              </p>
            </div>

            {/* Right: Business Login Card */}
            <div id="login" className="flex justify-center lg:justify-end">
              <div className="w-full max-w-md bg-white border border-[#E2EFF5] rounded-3xl shadow-2xl shadow-[#0077B6]/10 p-8">
                {/* Card Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0077B6] to-[#00B896] flex items-center justify-center shadow-lg shadow-[#0077B6]/25">
                    <Building2 size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#0D1F33]">Business Login</h2>
                    <p className="text-xs text-[#7A90A4]">Apne organization portal mein jaao</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 flex items-start gap-2.5 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0D1F33] mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@aapkaorg.com"
                      className="w-full bg-[#F5FBFD] border border-[#E2EFF5] rounded-xl px-4 py-3 text-[#0D1F33] placeholder-[#7A90A4]/60 focus:outline-none focus:border-[#0077B6] focus:ring-2 focus:ring-[#0077B6]/15 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#0D1F33] mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#F5FBFD] border border-[#E2EFF5] rounded-xl px-4 py-3 pr-11 text-[#0D1F33] placeholder-[#7A90A4]/60 focus:outline-none focus:border-[#0077B6] focus:ring-2 focus:ring-[#0077B6]/15 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A90A4] hover:text-[#0077B6] transition-colors"
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-[#0077B6] to-[#00B896] hover:opacity-90 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0077B6]/25 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Dashboard mein jao <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-[#E2EFF5]">
                  <p className="text-center text-sm text-[#7A90A4]">
                    Nayi organization?{" "}
                    <a href="/register" className="text-[#0077B6] font-semibold hover:text-[#005f91] transition-colors">
                      Register karein
                    </a>
                  </p>
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  {[
                    { icon: "🔒", text: "Encrypted" },
                    { icon: "🇮🇳", text: "DPDP Act" },
                    { icon: "✓", text: "ISO 27001" },
                  ].map(b => (
                    <div key={b.text} className="flex items-center gap-1 text-xs text-[#7A90A4] bg-[#F5FBFD] border border-[#E2EFF5] px-2.5 py-1 rounded-full">
                      <span>{b.icon}</span>
                      <span>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── USER FEATURES ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#E8F4FF] border border-[#C0DEFF] text-[#0077B6] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Smartphone size={12} /> Mobile App Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D1F33] mb-4">
              Aapki Health ka<br />
              <span className="bg-gradient-to-r from-[#0077B6] to-[#00B896] bg-clip-text text-transparent">
                Complete Solution
              </span>
            </h2>
            <p className="text-[#7A90A4] max-w-xl mx-auto">
              10 Indian languages mein AI-powered health tracking — bilkul apni bhasha mein
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {FEATURES_USER.map((f) => (
              <div key={f.label} className="group bg-white border border-[#E2EFF5] rounded-2xl p-5 text-center hover:shadow-lg hover:border-[#0077B6]/20 transition-all duration-200 cursor-default">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: f.color + "18" }}
                >
                  <f.icon size={22} style={{ color: f.color }} />
                </div>
                <h3 className="text-sm font-bold text-[#0D1F33] mb-1">{f.label}</h3>
                <p className="text-xs text-[#7A90A4] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUSINESS FEATURES ── */}
      <section className="py-20 bg-gradient-to-br from-[#E8F7FB] to-[#F0FAF6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white border border-[#C0DEFF] text-[#0077B6] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Building2 size={12} /> For Businesses
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D1F33] mb-5">
                Apne Business ki<br />
                <span className="bg-gradient-to-r from-[#0077B6] to-[#00B896] bg-clip-text text-transparent">
                  Health Journey Manage Karo
                </span>
              </h2>
              <p className="text-[#7A90A4] text-lg mb-8 leading-relaxed">
                Gyms, hospitals, corporate wellness, clinics — sab ke liye powerful tools ek hi platform mein.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {FEATURES_BIZ.map(f => (
                  <div key={f.label} className="bg-white border border-[#E2EFF5] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-9 h-9 bg-gradient-to-br from-[#0077B6] to-[#00B896] rounded-xl flex items-center justify-center mb-3">
                      <f.icon size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0D1F33] mb-1">{f.label}</h3>
                    <p className="text-xs text-[#7A90A4]">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Business types list */}
            <div className="bg-white border border-[#E2EFF5] rounded-3xl p-8 shadow-xl shadow-[#0077B6]/8">
              <h3 className="text-lg font-bold text-[#0D1F33] mb-6">Kaun use kar sakta hai?</h3>
              <div className="space-y-3">
                {[
                  { emoji: "🏥", type: "Hospitals & Clinics", desc: "Patient health records & tracking" },
                  { emoji: "💪", type: "Gyms & Fitness Centers", desc: "Member progress & attendance" },
                  { emoji: "🏢", type: "Corporate Wellness", desc: "Employee health programs" },
                  { emoji: "🧪", type: "Diagnostic Labs", desc: "Report sharing & follow-ups" },
                  { emoji: "🍎", type: "Nutrition Centers", desc: "Diet plans & monitoring" },
                  { emoji: "🏫", type: "Schools & Colleges", desc: "Student health management" },
                ].map(item => (
                  <div key={item.type} className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F5FBFD] transition-colors group">
                    <div className="w-10 h-10 bg-[#F0FAFB] border border-[#E2EFF5] rounded-xl flex items-center justify-center text-lg shrink-0">
                      {item.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#0D1F33]">{item.type}</div>
                      <div className="text-xs text-[#7A90A4] truncate">{item.desc}</div>
                    </div>
                    <ChevronRight size={14} className="text-[#7A90A4] group-hover:text-[#0077B6] transition-colors shrink-0" />
                  </div>
                ))}
              </div>
              <a
                href="#login"
                className="mt-6 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#0077B6] to-[#00B896] text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#0077B6]/20"
              >
                Abhi Login Karein <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-[#0D1F33] mb-3">
              Unhone kaha hai
            </h2>
            <p className="text-[#7A90A4]">Poore India mein businesses ka bharosa</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-[#F5FBFD] border border-[#E2EFF5] rounded-2xl p-6">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} size={14} className="text-[#F59E0B] fill-[#F59E0B]" />
                  ))}
                </div>
                <p className="text-[#0D1F33] text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <div className="text-sm font-bold text-[#0D1F33]">{t.name}</div>
                  <div className="text-xs text-[#7A90A4]">{t.org}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 bg-gradient-to-r from-[#0077B6] to-[#00B896]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Shuru karo aaj hi
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            App download karo ya business portal join karo — dono free shuru hote hain!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#download"
              className="flex items-center gap-2 bg-white text-[#0077B6] font-bold px-6 py-3.5 rounded-xl hover:bg-white/90 transition-colors shadow-lg"
            >
              <Smartphone size={18} /> App Download Karo
            </a>
            <a
              href="#login"
              className="flex items-center gap-2 bg-white/15 border border-white/30 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-white/25 transition-colors backdrop-blur-sm"
            >
              <Building2 size={18} /> Business Login
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0D1F33] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0077B6] to-[#00B896] flex items-center justify-center">
                  <Heart size={13} className="text-white" />
                </div>
                <span className="font-bold text-lg">AORANE</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">India ka apna health management platform. Aapki bhasha mein.</p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 text-white/80">App Features</h4>
              <ul className="space-y-2 text-white/50 text-sm">
                <li>AI Food Scanner</li>
                <li>Exercise Tracker</li>
                <li>Health Scorecard</li>
                <li>Medicine Reminder</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 text-white/80">Business</h4>
              <ul className="space-y-2 text-white/50 text-sm">
                <li><a href="#login" className="hover:text-white transition-colors">Login Karein</a></li>
                <li><a href="/register" className="hover:text-white transition-colors">Register Karein</a></li>
                <li>Pricing</li>
                <li>Support</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 text-white/80">Contact</h4>
              <ul className="space-y-2 text-white/50 text-sm">
                <li>support@aorane.in</li>
                <li>+91 98765 43210</li>
                <li>New Delhi, India 🇮🇳</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-white/40 text-xs">
            <span>© 2026 AORANE Health Pvt. Ltd. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white/70 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white/70 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white/70 transition-colors">DPDP Compliance</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
