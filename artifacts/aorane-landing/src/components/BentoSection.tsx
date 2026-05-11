import { motion } from "framer-motion";
import { Heart, Brain, Footprints, Moon, Droplets, Apple, Zap, Thermometer } from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, RadialBarChart, RadialBar,
  ResponsiveContainer, Tooltip
} from "recharts";

const bpmData = Array.from({ length: 24 }, (_, i) => ({
  t: i,
  bpm: 65 + Math.sin(i * 0.7) * 15 + (Math.random() * 5)
}));

const ecgPoints = [
  0, 0, 0, 0.1, 0, 0, 0, -0.1, 0.8, -0.4, 1, -0.3, 0.1, 0, 0, 0, 0,
  0.1, 0, 0, 0, -0.1, 0.8, -0.4, 1, -0.3, 0.1, 0, 0
];
const ecgData = ecgPoints.map((v, i) => ({ i, v }));

const sleepPhases = [
  { phase: "Awake", fill: "#94A3B8" },
  { phase: "REM", fill: "#0747A6" },
  { phase: "Core", fill: "#10B981" },
  { phase: "Deep", fill: "#7C3AED" },
];

const radialData = [
  { name: "Stand", value: 85, fill: "#0747A6" },
  { name: "Move", value: 72, fill: "#10B981" },
  { name: "Exercise", value: 60, fill: "#F59E0B" },
];

export default function BentoSection() {
  return (
    <section id="dashboard" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-xs font-bold text-[#0747A6] bg-[#0747A6]/10 px-3 py-1 rounded-full uppercase tracking-widest">
            Live Health Dashboard
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">
            Everything in one <span className="gradient-text">intelligent view</span>
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">
            Real-time health metrics beautifully visualized — from ECG waves to sleep stages.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[160px] gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="col-span-2 row-span-1 bg-white rounded-3xl p-5 card-hover border border-gray-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                  <Heart className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">ECG Rhythm</p>
                  <p className="text-sm font-bold text-gray-800">Normal Sinus</p>
                </div>
              </div>
              <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">Live</span>
            </div>
            <ResponsiveContainer width="100%" height={85}>
              <LineChart data={ecgData}>
                <Line type="monotone" dataKey="v" stroke="#EF4444" strokeWidth={2} dot={false}
                  strokeDasharray="600" strokeDashoffset="0"
                  style={{ animation: "ecgMove 3s linear infinite" }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="col-span-1 row-span-1 bg-gradient-to-br from-[#0747A6] to-[#1565C0] rounded-3xl p-5 card-hover text-white"
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-semibold opacity-70">Heart Rate</p>
            <p className="text-3xl font-extrabold mt-1">78</p>
            <p className="text-xs opacity-60">bpm • Resting</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 }}
            className="col-span-1 row-span-1 bg-white rounded-3xl p-5 card-hover border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <Moon className="w-4 h-4 text-[#7C3AED]" />
              <p className="text-xs font-semibold text-gray-500">Sleep Score</p>
            </div>
            <p className="text-3xl font-extrabold text-[#0747A6]">87<span className="text-base font-normal text-gray-400">/100</span></p>
            <p className="text-xs text-gray-400 mt-1">7h 32m • Deep: 1h 48m</p>
            <div className="flex gap-1 mt-2">
              {[40, 65, 90, 75, 30].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: h / 4, background: h > 60 ? "#7C3AED" : "#E0D4F8" }} />
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="col-span-2 row-span-1 bg-white rounded-3xl p-5 card-hover border border-gray-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#0747A6]/10 rounded-xl flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#0747A6]" />
                </div>
                <p className="text-xs font-semibold text-gray-500">24h Heart Rate</p>
              </div>
              <span className="text-sm font-bold text-[#0747A6]">Avg 72 bpm</span>
            </div>
            <ResponsiveContainer width="100%" height={85}>
              <AreaChart data={bpmData}>
                <defs>
                  <linearGradient id="bpmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0747A6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0747A6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="bpm" stroke="#0747A6" strokeWidth={2} fill="url(#bpmGrad)" dot={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(0)} bpm`, ""]} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.18 }}
            className="col-span-1 row-span-1 bg-white rounded-3xl p-5 card-hover border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <Footprints className="w-4 h-4 text-[#10B981]" />
              <p className="text-xs font-semibold text-gray-500">Daily Steps</p>
            </div>
            <p className="text-3xl font-extrabold text-[#10B981]">8,240</p>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#10B981] rounded-full" style={{ width: "82%" }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">82% of goal • 10,000</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="col-span-1 row-span-1 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-3xl p-5 card-hover text-white"
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Apple className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-semibold opacity-70">Calories Today</p>
            <p className="text-3xl font-extrabold mt-1">1,840</p>
            <p className="text-xs opacity-60">kcal • Goal: 2,200</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.22 }}
            className="col-span-1 row-span-1 bg-white rounded-3xl p-5 card-hover border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-[#7C3AED]" />
              <p className="text-xs font-semibold text-gray-500">Activity Rings</p>
            </div>
            <div className="flex items-center justify-center relative h-20">
              <svg width={80} height={80} className="rotate-[-90deg]">
                {radialData.map((d, i) => {
                  const r = 36 - i * 11;
                  const c = 2 * Math.PI * r;
                  return (
                    <g key={d.name}>
                      <circle cx={40} cy={40} r={r} fill="none" stroke={d.fill + "22"} strokeWidth={8} />
                      <circle cx={40} cy={40} r={r} fill="none" stroke={d.fill} strokeWidth={8}
                        strokeDasharray={`${(d.value / 100) * c} ${c}`} strokeLinecap="round" />
                    </g>
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center rotate-0">
                <p className="text-xs font-bold text-gray-600">72%</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="col-span-1 row-span-1 bg-white rounded-3xl p-5 card-hover border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-4 h-4 text-blue-400" />
              <p className="text-xs font-semibold text-gray-500">Hydration</p>
            </div>
            <p className="text-3xl font-extrabold text-blue-500">1.8<span className="text-base font-normal text-gray-400">L</span></p>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`flex-1 h-4 rounded-sm ${i < 5 ? "bg-blue-400" : "bg-blue-100"}`} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">5/8 glasses • Goal: 2.5L</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.27 }}
            className="col-span-2 row-span-1 bg-gradient-to-r from-[#0747A6] to-[#7C3AED] rounded-3xl p-5 card-hover text-white"
          >
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-5 h-5 opacity-80" />
              <p className="text-sm font-semibold opacity-80">AI-powered Health Intelligence</p>
            </div>
            <p className="text-xs opacity-60 mb-3">Powered by Llama 3.3 70B — Real-time analysis</p>
            <div className="bg-white/15 rounded-2xl p-3 text-sm">
              <p className="font-semibold mb-1">Weekly Insight</p>
              <p className="text-xs opacity-80 leading-relaxed">
                Your sleep quality improved 12% this week. Maintain your 10pm bedtime schedule.
                Increase protein intake post-workout for better recovery.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
