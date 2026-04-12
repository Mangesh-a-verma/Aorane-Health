import { motion } from "framer-motion";
import { Scan, Brain, Dumbbell, Users, Building2, Lock, Camera, Sparkles, Shield, Activity, Heart, Bell, MessageSquare, Zap } from "lucide-react";

const b2cFeatures = [
  {
    icon: Scan,
    title: "AI Food Scanner",
    desc: "Snap a photo of any meal — Gemini AI identifies 500+ ingredients, calculates macros, and logs your nutrition instantly.",
    color: "#10B981",
    bg: "#F0FDF9",
  },
  {
    icon: Brain,
    title: "NVIDIA Health Intelligence",
    desc: "Llama 3.3 70B analyses your patterns and provides personalized health predictions and lifestyle recommendations.",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    icon: Dumbbell,
    title: "MET Exercise Engine",
    desc: "300+ exercises with MET-based calorie calculation. Supports photo, voice, and text input for effortless logging.",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    icon: Camera,
    title: "Smart Medical Scan",
    desc: "Upload prescriptions, lab reports, or X-rays. AI extracts vitals, medications, and stores them securely.",
    color: "#EF4444",
    bg: "#FFF1F2",
  },
  {
    icon: Users,
    title: "Family Health Hub",
    desc: "Create a family group and monitor health of parents, children, and elders — all in one account.",
    color: "#0747A6",
    bg: "#EEF4FF",
  },
  {
    icon: Lock,
    title: "Privacy-First Design",
    desc: "8 granular privacy toggles. Stress, Sleep & Medicine logs default to private. Your data, your control.",
    color: "#6B7280",
    bg: "#F9FAFB",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Health Bot",
    desc: "Log meals, exercise & water directly on WhatsApp. Bot reminds you like a friend — medicine alerts, meal nudges, weekly reports. Coming to Pro plan!",
    color: "#25D366",
    bg: "#F0FFF4",
    comingSoon: true,
  },
];

const b2bFeatures = [
  {
    icon: Building2,
    title: "Organization Portal",
    desc: "Manage 1000+ employees, track department health scores, generate compliance reports in one click.",
    color: "#0747A6",
    bg: "#EEF4FF",
  },
  {
    icon: Brain,
    title: "Population Analytics",
    desc: "AI-powered health risk stratification. Identify high-risk employees before absenteeism impacts productivity.",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    icon: Activity,
    title: "Real-time Monitoring",
    desc: "Live health dashboards per department. Set custom wellness KPIs and automated health alerts.",
    color: "#10B981",
    bg: "#F0FDF9",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "DPDPA compliant, ISO 27001 certified, 256-bit encryption at rest and in transit. Audit trails included.",
    color: "#6B7280",
    bg: "#F9FAFB",
  },
  {
    icon: Heart,
    title: "Wellness Programs",
    desc: "Build custom wellness challenges, step contests, and nutrition programs for your workforce.",
    color: "#EF4444",
    bg: "#FFF1F2",
  },
  {
    icon: Bell,
    title: "Smart Alerts & Reports",
    desc: "Auto-generate weekly health reports for leadership. Custom alerts for risk indicators via SMS and email.",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Employee Engagement",
    desc: "Employees log health data and receive wellness nudges directly on WhatsApp — no app open required. Highest engagement rate in India.",
    color: "#25D366",
    bg: "#F0FFF4",
    comingSoon: true,
  },
];

interface FeaturesSectionProps {
  audience: "b2c" | "b2b";
}

export default function FeaturesSection({ audience }: FeaturesSectionProps) {
  const features = audience === "b2c" ? b2cFeatures : b2bFeatures;
  const title = audience === "b2c"
    ? { pre: "Everything your health needs", highlight: "all in one app" }
    : { pre: "Enterprise wellness", highlight: "built for Indian businesses" };

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full uppercase tracking-widest">
            {audience === "b2c" ? "Features" : "Enterprise Features"}
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">
            {title.pre}{" "}
            <span className="gradient-text">{title.highlight}</span>
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">
            {audience === "b2c"
              ? "From AI food scanning to family health tracking — AORANE covers every aspect of your wellness journey."
              : "AORANE Business gives HR teams and leadership the tools to build a healthier, more productive workforce."}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="group bg-white rounded-3xl border p-6 card-hover cursor-default relative overflow-hidden"
              style={{
                borderColor: (f as { comingSoon?: boolean }).comingSoon ? "#25D36633" : "rgb(243,244,246)",
              }}
            >
              {(f as { comingSoon?: boolean }).comingSoon && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: "#25D36618", color: "#16a34a", border: "1px solid #25D36630" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Coming Soon
                </div>
              )}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: f.bg }}
              >
                <f.icon className="w-6 h-6" style={{ color: f.color }} />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* WhatsApp Coming Soon banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-5"
          style={{
            background: "linear-gradient(135deg, #F0FFF4 0%, #DCFCE7 100%)",
            border: "1.5px solid #86EFAC",
          }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "#25D366" }}>
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#25D36618", color: "#15803d" }}>
                🚀 Coming Next Month — Pro Plan
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-gray-900">
              WhatsApp Health Bot
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              India mein sabse easy health tracking — sirf WhatsApp pe message karo.
              Khana, exercise, paani — sab kuch log ho jaayega. Bot yaad bhi dilaayega!
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Zap className="w-4 h-4" style={{ color: "#25D366" }} />
            <span className="text-sm font-bold" style={{ color: "#15803d" }}>Notify me</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
