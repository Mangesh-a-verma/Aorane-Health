import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Scan, Brain, Dumbbell, Camera, Users, Lock, Smartphone, Activity, Heart, Moon, Droplets, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState } from "react";

const features = [
  {
    icon: Scan,
    color: "#10B981",
    bg: "#F0FDF9",
    badge: "AI Powered · Gemini",
    title: "AI Food Scanner",
    subtitle: "Scan any meal. Know exact nutrition instantly.",
    desc: "Point your camera at any Indian dish — from dal makhani to idli sambhar to biryani. Gemini AI identifies every ingredient, calculates macros (protein, carbs, fat, fiber, calories) and logs it in under 2 seconds. Also supports voice input and manual text entry.",
    chips: ["500+ Indian dishes", "Photo + Voice + Text input", "Restaurant menu scanner", "Semantic caching"],
    metrics: [{ val: "2s", label: "AI Response" }, { val: "95%", label: "Accuracy" }, { val: "500+", label: "Dishes" }],
    flip: false,
  },
  {
    icon: Brain,
    color: "#7C3AED",
    bg: "#F5F3FF",
    badge: "AI-powered · Llama 3.3 70B",
    title: "Health Intelligence",
    subtitle: "Predictive health AI that gets smarter every day.",
    desc: "Llama 3.3 70B model analyses your 30+ health data points — sleep, food, exercise, vitals, stress — and delivers daily personalized insights, weekly health score trends, and early risk detection alerts tailored to your lifestyle.",
    chips: ["Daily AI health brief", "Early risk detection", "Pattern recognition", "Personalized recommendations"],
    metrics: [{ val: "30+", label: "Data Points" }, { val: "Daily", label: "Insights" }, { val: "87", label: "Avg Score" }],
    flip: true,
  },
  {
    icon: Dumbbell,
    color: "#F59E0B",
    bg: "#FFFBEB",
    badge: "Science Backed · MET",
    title: "Exercise Engine",
    subtitle: "Calorie-accurate workout tracking using MET science.",
    desc: "300+ exercises with Metabolic Equivalent of Task (MET) values from scientific literature. Enter your body weight and workout duration — get scientifically accurate calorie burn. Supports photo recognition, voice commands, and manual entry for any exercise type.",
    chips: ["300+ exercises", "MET-based accuracy", "Photo & voice input", "Yoga to weightlifting"],
    metrics: [{ val: "300+", label: "Exercises" }, { val: "MET", label: "Science" }, { val: "3x", label: "Input Modes" }],
    flip: false,
  },
  {
    icon: Camera,
    color: "#EF4444",
    bg: "#FFF1F2",
    badge: "Smart Scan",
    title: "Medical Report Scan",
    subtitle: "Upload prescriptions or lab reports. AI reads them.",
    desc: "Upload photos of prescriptions, blood test reports, X-rays, or doctor's notes. AI extracts medication names, dosages, lab values, and vital readings. Stores securely in your medical history with encrypted cloud backup.",
    chips: ["Prescription OCR", "Lab report analysis", "Medication tracking", "Encrypted storage"],
    metrics: [{ val: "OCR", label: "Technology" }, { val: "AES-256", label: "Encrypted" }, { val: "Auto", label: "Reminders" }],
    flip: true,
  },
  {
    icon: Users,
    color: "#0747A6",
    bg: "#EEF4FF",
    badge: "Family Plan",
    title: "Family Health Hub",
    subtitle: "One account. Six members. Complete family health.",
    desc: "Add parents, children, spouse — up to 6 family members under one account. Each member gets full Pro features with their own profile. Monitor elderly parents' vitals remotely, track children's nutrition, manage everyone's medicine schedules from one dashboard.",
    chips: ["Up to 6 members", "Medicine reminders", "Elderly care", "Children nutrition"],
    metrics: [{ val: "6", label: "Members" }, { val: "1", label: "Billing" }, { val: "24/7", label: "Monitoring" }],
    flip: false,
  },
  {
    icon: Lock,
    color: "#6B7280",
    bg: "#F9FAFB",
    badge: "Privacy First",
    title: "Privacy by Design",
    subtitle: "Your health data is yours. 8 privacy controls.",
    desc: "8 granular privacy toggles let you control exactly what data is tracked and stored. Stress logs, sleep records, and medicine history default to private — only you see them. Full DPDPA 2023 compliance. Data stored in India. No selling, no ads, no tracking.",
    chips: ["8 privacy toggles", "DPDPA 2023", "India data residency", "No data selling"],
    metrics: [{ val: "8", label: "Privacy Controls" }, { val: "India", label: "Servers" }, { val: "Zero", label: "Data Selling" }],
    flip: true,
  },
];

export default function FeaturesPage() {
  const [audience, setAudience] = useState<"b2c" | "b2b">("b2c");

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Features — AI Food Scanner, Stress & Vitals Tracking | AORANE</title>
        <meta name="description" content="Explore AORANE's powerful features: AI food scanner for Indian dishes, stress monitoring, sleep analysis, exercise tracking with MET, medical report scanning, and AI-powered health insights." />
        <link rel="canonical" href="https://aorane.com/features" />
        <meta property="og:title" content="AORANE Features — AI-Powered Health Tracking" />
        <meta property="og:description" content="AI food scanner for Indian dishes, stress monitoring, sleep analysis, exercise tracking & AI-powered health insights. Everything you need for complete health management." />
        <meta property="og:url" content="https://aorane.com/features" />
      </Helmet>
      <Navbar audience={audience} onAudienceChange={setAudience} />

      <div className="pt-16 bg-gradient-to-r from-[#0747A6] to-[#1565C0] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-white/60 text-sm mb-2">aorane.com / features</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
              Powerful Features.<br />Simple to Use.
            </h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Every feature in Aorane is designed with one goal — to make your health journey effortless and intelligent.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-28">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className={`grid lg:grid-cols-2 gap-12 items-center ${f.flip ? "lg:grid-flow-col-dense" : ""}`}
          >
            <div className={f.flip ? "lg:col-start-2" : ""}>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4" style={{ background: f.bg, color: f.color }}>
                {f.badge}
              </span>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{f.title}</h2>
              <p className="text-xl text-gray-500 font-medium mb-4">{f.subtitle}</p>
              <p className="text-gray-600 leading-relaxed mb-6">{f.desc}</p>

              <div className="flex flex-wrap gap-2 mb-6">
                {f.chips.map((chip) => (
                  <span key={chip} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: f.bg, color: f.color }}>
                    <CheckCircle className="w-3 h-3" />
                    {chip}
                  </span>
                ))}
              </div>

              <div className="flex gap-6">
                {f.metrics.map((m) => (
                  <div key={m.label}>
                    <p className="text-2xl font-extrabold" style={{ color: f.color }}>{m.val}</p>
                    <p className="text-xs text-gray-500">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={f.flip ? "lg:col-start-1" : ""}>
              <div className="bg-[#F8FAFC] rounded-3xl border border-gray-100 p-10 flex items-center justify-center aspect-square max-w-sm mx-auto card-hover">
                <div className="w-32 h-32 rounded-3xl flex items-center justify-center shadow-xl" style={{ background: f.color }}>
                  <f.icon className="w-16 h-16 text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Footer />
    </div>
  );
}
