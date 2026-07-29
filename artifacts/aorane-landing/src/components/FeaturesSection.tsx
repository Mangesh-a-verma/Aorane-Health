import { motion } from "framer-motion";
import { Scan, Brain, Dumbbell, Users, Building2, Lock, Camera, Sparkles, Shield, Activity, Heart, Bell, Droplet, MessageSquare, Barcode, FileText, Utensils } from "lucide-react";

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
    title: "AI-powered Health Intelligence",
    desc: "Aorane AI analyses your patterns and provides personalized health predictions and lifestyle recommendations.",
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
    desc: "Create a family group (up to 4 members) and monitor health of parents, children, and elders — all in one account.",
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
    icon: FileText,
    title: "Weekly Health Report",
    desc: "Every Sunday, get a full AI-written health summary delivered on WhatsApp & email — calories, macros, stress, exercise trends.",
    color: "#3B82F6",
    bg: "#EFF6FF",
  },
  {
    icon: Utensils,
    title: "AI Diet Chart Generator",
    desc: "Tell Aorane your goal — weight loss, diabetes, muscle gain — and get a personalized 7-day Indian meal plan. Roti, dal, sabzi included.",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    icon: Droplet,
    title: "SOS Blood Emergency",
    desc: "Request or offer blood in a medical emergency. Instantly alerts nearby verified donors matching the required blood group — free for every user.",
    color: "#DC2626",
    bg: "#FEF2F2",
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
    desc: "DPDPA compliant, end-to-end encryption, 256-bit encryption at rest and in transit. Audit trails included.",
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
    comingLabel: "Coming Soon",
  },
  {
    icon: Barcode,
    title: "Cafeteria Nutrition Tracker",
    desc: "Employees scan packaged snacks from office cafeteria — nutrition auto-logged. Helps HR track workforce diet quality.",
    color: "#F97316",
    bg: "#FFF7ED",
    comingSoon: true,
    comingLabel: "Coming Soon",
  },
];

interface FeaturesSectionProps {
  audience: "b2c" | "b2b";
  onNotifyClick?: () => void;
}

export default function FeaturesSection({ audience, onNotifyClick }: FeaturesSectionProps) {
  const features = audience === "b2c" ? b2cFeatures : b2bFeatures;
  const title = audience === "b2c"
    ? { pre: "Everything your health needs", highlight: "all in one app" }
    : { pre: "Enterprise wellness", highlight: "built for Indian businesses" };

  return (
    <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full uppercase tracking-widest">
            {audience === "b2c" ? "Features" : "Enterprise Features"}
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900">
            {title.pre}{" "}
            <span className="gradient-text">{title.highlight}</span>
          </h2>
          <p className="mt-2 text-gray-500 max-w-xl mx-auto text-sm">
            {audience === "b2c"
              ? "From AI food scanning to family health tracking — Aorane covers every aspect of your wellness journey."
              : "Aorane Business gives HR teams and leadership the tools to build a healthier, more productive workforce."}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group bg-white rounded-2xl border border-gray-100 p-4 card-hover cursor-default relative overflow-hidden"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                  style={{ background: f.bg }}
                >
                  <f.icon className="w-4.5 h-4.5" style={{ color: f.color, width: 18, height: 18 }} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
