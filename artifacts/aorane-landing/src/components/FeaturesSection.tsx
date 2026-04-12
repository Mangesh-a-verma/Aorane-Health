import { motion } from "framer-motion";
import { Scan, Brain, Dumbbell, Users, Building2, Lock, Camera, Sparkles, Shield, Activity, Heart, Bell } from "lucide-react";

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
              className="group bg-white rounded-3xl border border-gray-100 p-6 card-hover cursor-default"
            >
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
      </div>
    </section>
  );
}
