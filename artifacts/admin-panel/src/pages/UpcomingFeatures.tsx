import { motion } from "framer-motion";
import {
  MessageSquare, Clock, CheckCircle2, Rocket, Calendar,
  IndianRupee, Users, Zap, Bell, Brain, Camera, Star,
  ArrowRight, Building2, HeartPulse, Shield,
} from "lucide-react";

interface FeatureCard {
  icon: React.ElementType;
  title: string;
  description: string;
  status: "coming_soon" | "in_development" | "planned";
  eta: string;
  plan: string;
  planColor: string;
  highlights: string[];
  color: string;
}

const upcomingFeatures: FeatureCard[] = [
  {
    icon: MessageSquare,
    title: "WhatsApp Bot Integration",
    description: "Users can log food, exercise, and water directly via WhatsApp. Bot sends personalized reminders like a health companion — meal reminders, medicine alerts, exercise nudges, and weekly health reports. WhatsApp is the most-used platform in India!",
    status: "coming_soon",
    eta: "Q2 2026 (Next Month)",
    plan: "Pro / Max",
    planColor: "#7C3AED",
    highlights: [
      "Food logging via natural language (Hindi/English)",
      "Medicine & meal reminders — just like having a personal health companion",
      "Weekly health report on WhatsApp",
      "Exercise & water tracking via chat",
      "Gemini AI parses user messages automatically",
    ],
    color: "#25D366",
  },
  {
    icon: HeartPulse,
    title: "AI Agent Health Detection",
    description: "Proactive health anomaly detection using AI-powered LLaMA. System auto-detects patterns like irregular BP, missed medicines, poor sleep cycles, and alerts user before problems escalate.",
    status: "in_development",
    eta: "Q2 2026",
    plan: "Max",
    planColor: "#F59E0B",
    highlights: [
      "Pattern anomaly detection across all vitals",
      "Early warning system for BP/sugar irregularity",
      "Sleep quality correlation with health score",
      "Proactive push notifications with AI explanations",
    ],
    color: "#EF4444",
  },
  {
    icon: Camera,
    title: "Smart Barcode / Product Scanner",
    description: "Scan any packaged food barcode — Gemini instantly fetches nutritional data from Open Food Facts + FSSAI database. No manual typing needed.",
    status: "in_development",
    eta: "Q2 2026",
    plan: "All Plans",
    planColor: "#10B981",
    highlights: [
      "Barcode scan via mobile camera",
      "Auto-fill calories, protein, carbs, fat",
      "FSSAI India database integration",
      "Allergen detection and warnings",
    ],
    color: "#F59E0B",
  },
  {
    icon: Building2,
    title: "Corporate Health Insurance Integration",
    description: "Partner with Indian health insurers (Star Health, Niva Bupa). Users earn insurance benefits based on their Aorane health score. Win-win for corporate wellness.",
    status: "planned",
    eta: "Q3 2026",
    plan: "Business / Enterprise",
    planColor: "#0747A6",
    highlights: [
      "Health score → insurance premium discount",
      "Real-time data sharing with insurer API",
      "Corporate group health plans",
      "Wellness challenge rewards",
    ],
    color: "#0747A6",
  },
  {
    icon: Brain,
    title: "Advanced Period & Fertility AI",
    description: "Enhanced menstrual cycle tracking with AI-predicted ovulation, PCOS risk detection, and personalized nutrition recommendations based on cycle phase.",
    status: "planned",
    eta: "Q3 2026",
    plan: "Pro / Max",
    planColor: "#7C3AED",
    highlights: [
      "Cycle phase-based diet recommendations",
      "PCOS / endometriosis risk flag",
      "Mood & energy correlation tracking",
      "Fertility window predictions",
    ],
    color: "#EC4899",
  },
  {
    icon: Shield,
    title: "Ayurveda Dosha Intelligence",
    description: "AI-powered Prakriti (dosha) assessment. Personalized food, exercise, and lifestyle recommendations based on Vata/Pitta/Kapha type — India-first wellness approach.",
    status: "planned",
    eta: "Q4 2026",
    plan: "Max",
    planColor: "#F59E0B",
    highlights: [
      "Prakriti assessment questionnaire",
      "Dosha-specific food recommendations",
      "Seasonal wellness calendar (Ritucharya)",
      "Ayurvedic supplement suggestions",
    ],
    color: "#D97706",
  },
];

const statusConfig = {
  coming_soon: { label: "Coming Soon", color: "#25D366", bg: "rgba(37,211,102,0.1)", dot: "bg-green-400 animate-pulse" },
  in_development: { label: "In Development", color: "#F59E0B", bg: "rgba(245,158,11,0.1)", dot: "bg-yellow-400 animate-pulse" },
  planned: { label: "Planned", color: "#6B7280", bg: "rgba(107,114,128,0.1)", dot: "bg-gray-400" },
};

export default function UpcomingFeatures() {
  const comingSoon = upcomingFeatures.filter(f => f.status === "coming_soon");
  const inDev = upcomingFeatures.filter(f => f.status === "in_development");
  const planned = upcomingFeatures.filter(f => f.status === "planned");

  return (
    <div className="p-6 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}>
              <Rocket size={16} className="text-white" />
            </div>
            Upcoming Features
          </h1>
          <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
            Product roadmap — features in pipeline for Aorane platform
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.2)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          WhatsApp Bot — Next Month!
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Zap, label: "Coming Soon", value: comingSoon.length.toString(), color: "#25D366" },
          { icon: Clock, label: "In Development", value: inDev.length.toString(), color: "#F59E0B" },
          { icon: Calendar, label: "Planned", value: planned.length.toString(), color: "#6B7280" },
          { icon: Star, label: "Total Pipeline", value: upcomingFeatures.length.toString(), color: "#7C3AED" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
              style={{ background: s.color + "18" }}>
              <s.icon size={15} style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Feature cards */}
      {[
        { label: "🚀 Coming Soon", items: comingSoon },
        { label: "⚙️ In Development", items: inDev },
        { label: "📅 Planned", items: planned },
      ].map((group) => (
        <div key={group.label} className="space-y-4">
          <h2 className="text-sm font-semibold tracking-widest uppercase"
            style={{ color: "hsl(var(--muted-foreground))" }}>
            {group.label}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {group.items.map((f, i) => {
              const sc = statusConfig[f.status];
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl p-5 space-y-4"
                  style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: f.color + "18" }}>
                        <f.icon size={18} style={{ color: f.color }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{f.title}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          <span className="text-[10px] font-semibold" style={{ color: sc.color }}>
                            {sc.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                      style={{ background: f.planColor + "18", color: f.planColor }}>
                      {f.plan}
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {f.description}
                  </p>

                  <div className="space-y-1.5">
                    {f.highlights.map((h) => (
                      <div key={h} className="flex items-start gap-2">
                        <CheckCircle2 size={11} className="shrink-0 mt-0.5" style={{ color: f.color }} />
                        <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{h}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2"
                    style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                      <Calendar size={11} />
                      ETA: {f.eta}
                    </div>
                    <div className="flex items-center gap-1 text-[11px]" style={{ color: f.color }}>
                      Coming soon <ArrowRight size={10} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* WhatsApp cost note */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl p-5"
        style={{ background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.15)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={15} style={{ color: "#25D366" }} />
          <span className="text-sm font-bold" style={{ color: "#25D366" }}>WhatsApp Bot — Cost Analysis</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: IndianRupee, label: "Cost per Pro User", value: "~₹34/month", sub: "incl. WhatsApp API + AI" },
            { icon: Users, label: "Break-even Users", value: "~50 Pro users", sub: "to cover infra costs" },
            { icon: Zap, label: "Margin at 1000 users", value: "88% gross", sub: "₹2.65L/month profit" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(37,211,102,0.1)" }}>
                <m.icon size={14} style={{ color: "#25D366" }} />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{m.value}</div>
                <div className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>{m.label}</div>
                <div className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))" }}>{m.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
