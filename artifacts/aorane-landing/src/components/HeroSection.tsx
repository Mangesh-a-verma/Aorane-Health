import type { CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Brain, Smartphone, Building2, ArrowRight, Play, TrendingUp, Users, Activity, Signal, Wifi, BatteryFull } from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

const heartData = [
  { t: "6am", bpm: 58 }, { t: "9am", bpm: 72 }, { t: "12pm", bpm: 85 },
  { t: "3pm", bpm: 78 }, { t: "6pm", bpm: 90 }, { t: "9pm", bpm: 68 }, { t: "12am", bpm: 62 }
];

const sleepData = [
  { stage: "Deep", hours: 1.8 }, { stage: "Core", hours: 4.2 },
  { stage: "REM", hours: 1.5 }, { stage: "Awake", hours: 0.5 }
];

const orgData = [
  { dept: "Eng", score: 82 }, { dept: "HR", score: 91 }, { dept: "Sales", score: 74 },
  { dept: "Ops", score: 88 }, { dept: "Fin", score: 79 }, { dept: "Mkt", score: 86 }
];

const ActivityRing = ({ value, size, color, bg }: { value: number; size: number; color: string; bg: string }) => {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={10} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }} />
    </svg>
  );
};

function B2CDashboard() {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-gray-600">Heart Rate</span>
          </div>
          <span className="text-lg font-bold text-[#0747A6]">78 <span className="text-xs font-normal text-gray-400">bpm</span></span>
        </div>
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={heartData}>
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0747A6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0747A6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="bpm" stroke="#0747A6" strokeWidth={2} fill="url(#hrGrad)" dot={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v} bpm`, ""]} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3">Activity</p>
          <div className="flex items-center justify-center relative">
            <ActivityRing value={75} size={80} color="#0747A6" bg="#EEF4FF" />
            <div className="absolute inset-0 flex items-center justify-center">
              <ActivityRing value={60} size={56} color="#10B981" bg="#F0FDF9" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <ActivityRing value={90} size={34} color="#F59E0B" bg="#FFFBEB" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">Sleep</p>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={sleepData} layout="vertical" margin={{ left: -20 }}>
              <Bar dataKey="hours" fill="#0747A6" radius={4} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => [`${v}h`, ""]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4" style={{ background: "linear-gradient(135deg, var(--teal-deep), #082F28)" }}>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg width="80" height="80" className="rotate-[-90deg]">
              <circle cx="40" cy="40" r="33" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
              <circle
                cx="40" cy="40" r="33" fill="none" stroke="#00C79A" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 33}
                style={{ "--ring-offset": `${2 * Math.PI * 33 * (1 - 0.87)}` } as CSSProperties}
                className="ring-fg-animated"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-white font-mono-num">87</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/70 mb-1">AI Health Score</p>
            <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">Excellent</span>
            <p className="text-xs text-white/70 mt-1">+4 pts from last week</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function B2BDashboard() {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0747A6]" />
            <span className="text-xs font-semibold text-gray-600">Department Health Scores</span>
          </div>
          <span className="text-xs text-[#10B981] font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +6% MoM
          </span>
        </div>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={orgData}>
            <defs>
              <linearGradient id="orgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0747A6" stopOpacity={1} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <Bar dataKey="score" fill="url(#orgGrad)" radius={[4, 4, 0, 0]} />
            <XAxis dataKey="dept" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => [`${v}/100`, "Score"]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Members", value: "847", icon: Users, color: "#0747A6" },
          { label: "Avg Health Score", value: "83", icon: Activity, color: "#10B981" },
          { label: "Risk Alerts", value: "12", icon: Heart, color: "#F59E0B" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
            <m.icon className="w-4 h-4 mx-auto mb-1" style={{ color: m.color }} />
            <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
            <p className="text-xs text-gray-500 leading-tight">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-[#10B981] to-[#059669] rounded-2xl p-4 text-white">
        <p className="text-xs font-semibold opacity-80 mb-1">Absenteeism Reduction</p>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-extrabold">31%</span>
          <div>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">vs Industry Avg</span>
            <p className="text-xs opacity-80 mt-1">This quarter • 847 employees</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HeroSectionProps {
  audience: "b2c" | "b2b";
  onSignUp?: () => void;
}

export default function HeroSection({ audience, onSignUp }: HeroSectionProps) {
  const b2cContent = {
    badge: "Launching soon on Play Store — in.aorane.app",
    headline: "Your Personal\nHealth Intelligence\nPlatform",
    sub: "Track meals, exercise & vitals with AI. Get personalized AI-powered health insights. India's most comprehensive health companion.",
    cta1: { label: "Coming Soon on Play Store", href: "", icon: Smartphone },
    cta2: { label: "Watch Demo", href: "#dashboard" },
  };
  const b2bContent = {
    badge: "Trusted by 500+ Indian enterprises",
    headline: "Population Health\nManagement for\nYour Organization",
    sub: "Monitor workforce wellness at scale. Reduce absenteeism by 31%, cut healthcare costs, and boost productivity with real-time population health analytics.",
    cta1: { label: "Start Free Trial", href: "#pricing", icon: Building2 },
    cta2: { label: "See Case Studies", href: "#trust" },
  };
  const c = audience === "b2c" ? b2cContent : b2bContent;

  return (
    <section className="hero-gradient min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
          <motion.div
            key={audience + "-left"}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 glass-panel-soft text-[#05473C] text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
            >
              <span className="w-2 h-2 bg-[#00C79A] rounded-full animate-pulse" />
              {c.badge}
            </motion.div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.6rem] font-medium leading-[1.08] tracking-tight text-gray-900 mb-6">
              {c.headline.split("\n").map((line, i) => (
                <span key={i}>
                  {i === 1 ? <span className="gradient-text-teal italic">{line}</span> : line}
                  {i < 2 && <br />}
                </span>
              ))}
            </h1>

            <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-lg">
              {c.sub}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              {audience === "b2b" ? (
                <motion.button
                  onClick={onSignUp}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 blue-gradient text-white rounded-2xl font-semibold text-sm shadow-lg hover:opacity-90 transition-opacity"
                >
                  <Building2 className="w-4 h-4" />
                  {c.cta1.label}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              ) : (
              <div
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-semibold text-sm cursor-default"
                title="Coming soon on Google Play"
              >
                <c.cta1.icon className="w-4 h-4" />
                {c.cta1.label}
              </div>
              )}
            </div>
          </motion.div>

          <motion.div
            key={audience + "-right"}
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <div className="mesh-blob mesh-drift-1 w-96 h-96 -top-16 -right-16" style={{ background: "radial-gradient(circle at 30% 30%, rgba(0,199,154,0.4), transparent 60%)" }} />
            <div className="mesh-blob mesh-drift-2 w-80 h-80 -bottom-10 -left-10" style={{ background: "radial-gradient(circle at 40% 60%, rgba(255,122,92,0.3), transparent 60%)" }} />

            <div className="relative float-card">
              <div className="glass-panel rounded-[2.75rem] p-3" style={{ background: "rgba(10,20,17,0.9)" }}>
                <div className="absolute left-1/2 -translate-x-1/2 top-3 w-24 h-5 bg-black/70 rounded-full z-10" />
                <div className="bg-white rounded-[2.1rem] overflow-hidden pt-7 pb-5 px-4">
                  {audience === "b2c" ? (
                    <div className="flex items-center justify-between mb-4 px-1">
                      <span className="text-xs font-bold text-gray-500 font-mono-num">9:41</span>
                      <span className="text-xs font-bold tracking-wide" style={{ color: "#05473C" }}>AORANE</span>
                      <div className="flex items-center gap-1">
                        <Signal className="w-3 h-3 text-gray-400" />
                        <Wifi className="w-3 h-3 text-gray-400" />
                        <BatteryFull className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                      <span className="ml-2 text-xs text-gray-400 font-mono-num">Aorane Business Dashboard</span>
                    </div>
                  )}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={audience}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                    >
                      {audience === "b2c" ? <B2CDashboard /> : <B2BDashboard />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="glass-panel float-chip absolute top-2 -right-8 z-10 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-gray-800 hidden lg:flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#FF7A5C]/15 text-[#B84730] flex items-center justify-center">◆</span>
              Meal logged in 1.8s
            </div>
            <div className="glass-panel float-chip absolute bottom-20 -left-8 z-10 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-gray-800 hidden lg:flex items-center gap-2" style={{ animationDelay: "1.6s" }}>
              <span className="w-6 h-6 rounded-lg bg-[#00C79A]/15 text-[#05473C] flex items-center justify-center">⌁</span>
              Health Connect synced
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
