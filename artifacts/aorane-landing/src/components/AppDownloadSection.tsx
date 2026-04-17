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
            <div className="w-7 h-7 bg-[#0747A6] rounded-xl flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div className="bg-[#0747A6] rounded-2xl p-3 text-white">
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
              <p className="text-[#10B981] text-[9px] font-bold">82%</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#10B981] rounded-full" style={{ width: "82%" }} />
            </div>
            <p className="text-white font-bold text-sm mt-1">8,240 <span className="text-white/30 text-[9px]">/ 10,000</span></p>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5">
            <p className="text-white/50 text-[9px] mb-1">NVIDIA AI Insight</p>
            <p className="text-white/80 text-[9px] leading-relaxed">
              Sleep quality up 12% this week. Consider adding 10min morning walk.
            </p>
          </div>

          <div className="flex gap-2 mt-auto">
            {["🏠", "🍎", "💪", "💊", "👤"].map((icon, i) => (
              <div key={i} className={`flex-1 h-8 rounded-xl flex items-center justify-center text-sm ${i === 0 ? "bg-[#0747A6]" : "bg-white/5"}`}>
                {icon}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -right-6 top-12 bg-white rounded-2xl p-2.5 shadow-xl border border-gray-100 w-28">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 bg-[#10B981]/15 rounded-lg flex items-center justify-center">
            <Apple className="w-3 h-3 text-[#10B981]" />
          </div>
          <p className="text-[10px] font-bold text-gray-800">Food Scan</p>
        </div>
        <p className="text-[9px] text-gray-500">Dal Makhani detected</p>
        <p className="text-[9px] font-bold text-[#0747A6] mt-0.5">452 kcal · 18g protein</p>
      </div>

      <div className="absolute -left-8 bottom-20 bg-white rounded-2xl p-2.5 shadow-xl border border-gray-100 w-28">
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
    <section className="py-20 px-4 sm:px-6 lg:px-8 overflow-hidden" style={{ background: "linear-gradient(135deg, #0747A6 0%, #0D47A1 50%, #1565C0 100%)" }}>
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
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-5">
              Download Aorane.{" "}
              <span className="text-[#10B981]">Free forever</span>
            </h2>
            <p className="text-lg text-white/70 leading-relaxed mb-8 max-w-lg">
              Join 2 lakh+ Indians transforming their health. Start free — no credit card, no hidden charges. India's most comprehensive health companion in your pocket.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <motion.a
                href="https://play.google.com/store/apps/details?id=in.aorane.app"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 bg-white rounded-2xl px-5 py-3.5 shadow-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M3.18 23.76c.3.17.64.24.99.2L15.77 12 3.18.04a1.5 1.5 0 00-.99.2C1.68.59 1.5 1.1 1.5 1.72v20.56c0 .62.18 1.13.69 1.48z"/>
                    <path d="M19.82 9.37L17.2 7.85 14.23 12l2.97 4.15 2.62-1.52a2 2 0 000-3.26z"/>
                    <path d="M4.17.24L15.77 12 4.17 23.76 16.44 16.9a.5.5 0 000-.87L4.17.24z" fill="#333"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Get it on</p>
                  <p className="text-sm font-bold text-gray-900">Google Play</p>
                </div>
              </motion.a>

              <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-5 py-3.5 border border-white/20">
                <Smartphone className="w-6 h-6 text-white/50" />
                <div>
                  <p className="text-[10px] text-white/50">Coming Soon</p>
                  <p className="text-sm font-semibold text-white/70">App Store (iOS)</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                { icon: Star, val: "4.8★ Rating", sub: "50,000+ reviews" },
                { icon: Download, val: "2L+ Downloads", sub: "Free forever" },
                { icon: Shield, val: "DPDPA Safe", sub: "India data only" },
              ].map((item) => (
                <div key={item.val} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                  <item.icon className="w-4 h-4 text-[#10B981]" />
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
