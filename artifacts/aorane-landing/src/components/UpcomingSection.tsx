import { motion } from "framer-motion";
import {
  MessageSquare,
  Barcode,
  Stethoscope,
  Zap,
} from "lucide-react";

const upcoming = [
  {
    icon: MessageSquare,
    color: "#25D366",
    bg: "linear-gradient(135deg, #25D36615 0%, #22C55E10 100%)",
    border: "#25D36630",
    tag: "Next Release",
    tagColor: "#15803d",
    tagBg: "#DCFCE7",
    title: "WhatsApp Health Bot",
    desc: "Log food, water & exercise by just sending a WhatsApp message. Bot reminds you for medicines, sends evening calorie update — like a personal health assistant on your favourite app.",
    points: ["Food log via chat", "Medicine & water reminders", "Weekly report on WhatsApp", "Zero app-open needed"],
    plan: "Pro Plan",
  },
  {
    icon: Barcode,
    color: "#F97316",
    bg: "linear-gradient(135deg, #F9731615 0%, #FB923C10 100%)",
    border: "#F9731630",
    tag: "Next Release",
    tagColor: "#c2410c",
    tagBg: "#FFF7ED",
    title: "Packaged Food Scanner",
    desc: "Scan the barcode on any biscuit, chips, juice, or packaged snack. Nutrition data from the FSSAI database loads instantly — no AI cost, no manual typing, just scan and done.",
    points: ["Instant FSSAI database lookup", "Maggi, chips, drinks — all covered", "Saves AI cost for common foods", "Works offline too"],
    plan: "All Plans",
  },
  {
    icon: Stethoscope,
    color: "#EF4444",
    bg: "linear-gradient(135deg, #EF444415 0%, #F8717110 100%)",
    border: "#EF444430",
    tag: "Q3 2026",
    tagColor: "#b91c1c",
    tagBg: "#FFF1F2",
    title: "Doctor & Dietitian Connect",
    desc: "Book a 30-min consultation with verified dietitians and doctors directly through Aorane. They see your full health history — no need to explain everything from scratch.",
    points: ["Verified Indian dietitians", "Health data auto-shared", "Prescription auto-sync", "Affordable video consults"],
    plan: "Max Plan",
  },
];

interface UpcomingSectionProps {
  onNotifyClick?: () => void;
}

export default function UpcomingSection({ onNotifyClick }: UpcomingSectionProps) {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3"
            style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Upcoming Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2">
            What's coming{" "}
            <span className="gradient-text">very soon</span>
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto text-sm">
            We're building India's most complete health platform — here's what's on the roadmap. Early access for Pro users.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {upcoming.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl border p-5 relative overflow-hidden flex flex-col gap-3 card-hover"
              style={{ background: item.bg, borderColor: item.border }}
            >
              {/* Tag */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ background: item.tagBg, color: item.tagColor }}
                >
                  {item.tag}
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: item.color + "15", color: item.color }}
                >
                  {item.plan}
                </span>
              </div>

              {/* Icon + Title */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: item.color }}
                >
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-extrabold text-gray-900 leading-snug">{item.title}</h3>
              </div>

              {/* Desc */}
              <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>

              {/* Points */}
              <ul className="space-y-1 mt-auto">
                {item.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: item.color + "20" }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>

              {/* Notify Me button on each card */}
              <button
                onClick={onNotifyClick}
                className="mt-1 text-[11px] font-bold flex items-center gap-1 self-start px-3 py-1.5 rounded-lg border transition-colors"
                style={{ color: item.color, borderColor: item.color + "40", background: item.color + "08" }}
              >
                <Zap className="w-3 h-3" />
                Notify me when live
              </button>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)",
          }}
        >
          <div>
            <p className="text-xs font-bold text-orange-400 mb-1">🎯 Be the first to get early access</p>
            <h3 className="text-base font-extrabold text-white">
              Download Aorane free — unlock features as they launch
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Pro users get all upcoming features first. Free users get core features always.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onNotifyClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-white/30 text-white hover:bg-white/10 transition-all"
            >
              <Zap className="w-4 h-4" />
              Notify Me
            </button>
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
              style={{ background: "#E85D26", color: "white" }}
            >
              Download Free
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
