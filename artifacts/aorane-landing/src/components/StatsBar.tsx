import { motion } from "framer-motion";
import { Users, Star, Activity, Shield, Clock, TrendingUp } from "lucide-react";

const stats = [
  { icon: Users, val: "2,00,000+", label: "Active Users", color: "#0747A6" },
  { icon: Star, val: "4.8 / 5.0", label: "Play Store Rating", color: "#F59E0B" },
  { icon: Activity, val: "15+", label: "Health Metrics Tracked", color: "#10B981" },
  { icon: Shield, val: "DPDPA & ISO", label: "Compliant Platform", color: "#7C3AED" },
  { icon: Clock, val: "< 2s", label: "AI Response Time", color: "#EF4444" },
  { icon: TrendingUp, val: "31%", label: "Absenteeism Reduction", color: "#059669" },
];

export default function StatsBar() {
  return (
    <section className="bg-white border-y border-gray-100 py-10 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="text-center"
            >
              <div className="w-10 h-10 rounded-2xl mx-auto mb-2 flex items-center justify-center" style={{ background: `${s.color}12` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <p className="text-xl font-extrabold text-gray-900">{s.val}</p>
              <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
