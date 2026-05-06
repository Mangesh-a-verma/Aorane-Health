import { motion } from "framer-motion";
import { Scan, Brain, Dumbbell, Users, Building2, Lock, Camera, Sparkles, Shield, Activity, Heart, Bell, MessageSquare, Zap, Barcode, FileText, Utensils } from "lucide-react";

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
    icon: MessageSquare,
    title: "WhatsApp Health Bot",
    desc: "Log meals, water & exercise directly on WhatsApp. Bot sends reminders, weekly reports — no app open needed.",
    color: "#25D366",
    bg: "#F0FFF4",
    comingSoon: true,
    comingLabel: "Coming Soon",
  },
  {
    icon: Barcode,
    title: "Packaged Food Scanner",
    desc: "Scan any barcode on chips, biscuits, drinks or packaged food — instant nutrition from FSSAI database. No AI cost, instant result.",
    color: "#F97316",
    bg: "#FFF7ED",
    comingSoon: true,
    comingLabel: "Coming Soon",
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
            const cs = (f as { comingSoon?: boolean }).comingSoon;
            const csLabel = (f as { comingLabel?: string }).comingLabel ?? "Coming Soon";
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group bg-white rounded-2xl border p-4 card-hover cursor-default relative overflow-hidden"
                style={{
                  borderColor: cs ? f.color + "40" : "rgb(243,244,246)",
                  background: cs ? f.bg + "60" : "white",
                }}
              >
                {cs && (
                  <div
                    className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: f.color + "18", color: f.color, border: `1px solid ${f.color}30` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: f.color }} />
                    {csLabel}
                  </div>
                )}
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

        {/* Coming Soon banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4"
          style={{
            background: "linear-gradient(135deg, #F0FFF4 0%, #DCFCE7 50%, #FFF7ED 100%)",
            border: "1.5px solid #86EFAC",
          }}
        >
          <div className="flex -space-x-2 shrink-0">
            {[
              { icon: MessageSquare, bg: "#25D366" },
              { icon: Barcode, bg: "#F97316" },
            ].map(({ icon: Icon, bg }, idx) => (
              <div key={idx} className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border-2 border-white" style={{ background: bg }}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            ))}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-bold text-green-700 mb-0.5">🚀 Coming Very Soon — Pro & Max Plan</p>
            <h3 className="text-sm font-extrabold text-gray-900">
              WhatsApp Bot · Barcode Scanner
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Track health without opening the app. Scan packaged food barcodes instantly.
            </p>
          </div>
          <button
            onClick={onNotifyClick}
            className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-green-700 bg-white border border-green-200 rounded-xl px-4 py-2 hover:bg-green-50 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Notify Me
          </button>
        </motion.div>
      </div>
    </section>
  );
}
