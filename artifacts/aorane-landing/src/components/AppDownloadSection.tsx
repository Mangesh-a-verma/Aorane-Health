import { motion } from "framer-motion";
import { Smartphone, Star, Shield, Download, Heart, Activity, Apple, Droplets } from "lucide-react";

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 220, height: 440 }}>
      <div className="w-full h-full bg-gray-900 rounded-[40px] border-4 border-gray-700 shadow-2xl overflow-hidden relative">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-800 rounded-full z-10" />
        <div className="h-full bg-gradient-to-b from-[#0A0F1E] to-[#090e1c] pt-10 pb-4 px-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-[10px]">Good Morning</p>
              <p className="text-white font-bold text-xs">Arjun</p>
            </div>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "#05473C" }}>
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div className="rounded-2xl p-3 text-white" style={{ background: "linear-gradient(135deg, #05473C, #082F28)" }}>
            <p className="text-[9px] opacity-70 mb-0.5">AI Health Score</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black">87</span>
              <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">Excellent</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/8 rounded-xl p-2.5">
              <Heart className="w-3 h-3 text-red-400 mb-1" />
              <p className="text-white font-bold text-sm">78</p>
              <p className="text-white/40 text-[9px]">bpm</p>
            </div>
            <div className="bg-white/8 rounded-xl p-2.5">
              <Droplets className="w-3 h-3 text-blue-400 mb-1" />
              <p className="text-white font-bold text-sm">1.8L</p>
              <p className="text-white/40 text-[9px]">hydration</p>
            </div>
          </div>

          <div className="bg-white/8 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-white/70 text-[9px]">Daily Steps</p>
              <p className="text-[#00C79A] text-[9px] font-bold">82%</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: "82%", background: "#00C79A" }} />
            </div>
            <p className="text-white font-bold text-sm mt-1">8,240 <span className="text-white/30 text-[9px]">/ 10,000</span></p>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5">
            <p className="text-white/50 text-[9px] mb-1">AI-powered Insight</p>
            <p className="text-white/80 text-[9px] leading-relaxed">
              Sleep quality up 12% this week. Consider adding 10min morning walk.
            </p>
          </div>

          <div className="flex gap-2 mt-auto">
            {["🏠", "🍎", "💪", "💊", "👤"].map((icon, i) => (
              <div
                key={i}
                className={`flex-1 h-8 rounded-xl flex items-center justify-center text-sm ${i === 0 ? "" : "bg-white/5"}`}
                style={i === 0 ? { background: "#05473C" } : undefined}
              >
                {icon}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -right-6 top-12 glass-panel rounded-2xl p-2.5 w-28">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 bg-[#00C79A]/15 rounded-lg flex items-center justify-center">
            <Apple className="w-3 h-3 text-[#05473C]" />
          </div>
          <p className="text-[10px] font-bold text-gray-800">Food Scan</p>
        </div>
        <p className="text-[9px] text-gray-500">Dal Makhani detected</p>
        <p className="text-[9px] font-bold text-[#05473C] mt-0.5">452 kcal · 18g protein</p>
      </div>

      <div className="absolute -left-8 bottom-20 glass-panel rounded-2xl p-2.5 w-28">
        <div className="flex items-center gap-1 mb-1">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />)}
        </div>
        <p className="text-[9px] text-gray-600">"Best health app in India!"</p>
        <p className="text-[9px] font-bold text-gray-400 mt-0.5">— Play Store</p>
      </div>
    </div>
  );
}

export default function AppDownloadSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 overflow-hidden" style={{ background: "linear-gradient(135deg, #05473C 0%, #082F28 100%)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-xs font-bold text-white/60 bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest mb-6">
              Available Now
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-medium text-white leading-tight mb-5">
              Download Aorane.{" "}
              <span className="italic text-[#00C79A]">Free forever</span>
            </h2>
            <p className="text-lg text-white/70 leading-relaxed mb-8 max-w-lg">
              Be among the first to transform your health with Aorane. Start free — no credit card, no hidden charges. India's most comprehensive health companion in your pocket.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-5 py-3.5 border border-white/20">
                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white/50">
                    <path d="M17.523 15.341a.84.84 0 01-.84.84H7.317a.84.84 0 010-1.68h9.366a.84.84 0 01.84.84zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-5.5V9a1 1 0 012 0v5.5l2-2a1 1 0 111.414 1.414l-3.707 3.707a1 1 0 01-1.414 0L7.586 13.914A1 1 0 019 12.5l2 2z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-white/50">Coming Soon</p>
                  <p className="text-sm font-semibold text-white/70">Google Play Store</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-5 py-3.5 border border-white/20">
                <Smartphone className="w-6 h-6 text-white/50" />
                <div>
                  <p className="text-[10px] text-white/50">Coming Soon</p>
                  <p className="text-sm font-semibold text-white/70">App Store (iOS)</p>
                </div>
              </div>
            </div>

            <p className="mb-8 text-xs text-white/40">
              We're finalising our Play Store listing — check back soon, or reach out at{" "}
              <a href="mailto:support@aorane.com" className="underline text-white/60">support@aorane.com</a> for early access.
            </p>

            <div className="flex flex-wrap gap-3">
              {[
                { icon: Shield, val: "DPDPA Safe", sub: "India data only" },
                { icon: Heart, val: "Free Forever", sub: "No hidden charges" },
              ].map((item) => (
                <div key={item.val} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                  <item.icon className="w-4 h-4 text-[#00C79A]" />
                  <div>
                    <p className="text-xs font-bold text-white">{item.val}</p>
                    <p className="text-[10px] text-white/50">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs text-white/40">
              Package ID: <span className="font-mono text-white/60">in.aorane.app</span> · Requires Android 8.0+
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex justify-center lg:justify-end"
          >
            <div className="relative">
              <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-[#10B981]/15 rounded-full blur-3xl" />
              <div className="float-card">
                <PhoneMockup />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
