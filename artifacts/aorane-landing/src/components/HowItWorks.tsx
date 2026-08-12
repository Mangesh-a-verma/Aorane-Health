import { motion } from "framer-motion";
import { Smartphone, Scan, Brain, TrendingUp, ArrowRight } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Smartphone,
    title: "Download & Sign Up",
    desc: "Create your free account in 60 seconds. OTP login — no passwords needed. Available on Android (Play Store ID: in.aorane.app).",
    color: "#05473C",
    bg: "#E6F4F1",
  },
  {
    num: "02",
    icon: Scan,
    title: "Log Your Health",
    desc: "Snap food photos, log exercises, enter vitals. AI does the heavy lifting — voice input, photo recognition, and smart suggestions included.",
    color: "#10B981",
    bg: "#F0FDF9",
  },
  {
    num: "03",
    icon: Brain,
    title: "Get AI Insights",
    desc: "AI-powered analysis of your data delivers personalized health recommendations daily. Early risk detection, pattern recognition, custom advice.",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    num: "04",
    icon: TrendingUp,
    title: "Track & Improve",
    desc: "Watch your health score climb week over week. Set personal goals, beat your records, share achievements with family and friends.",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F8F6]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[#05473C] glass-panel-soft px-3 py-1.5 rounded-full uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C79A]" />
            How It Works
          </span>
          <h2 className="font-display mt-4 text-3xl sm:text-4xl font-medium text-gray-900">
            Start your health journey in{" "}
            <span className="gradient-text-teal italic">4 simple steps</span>
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">
            From download to your first AI health insight — takes less than 5 minutes.
          </p>
        </motion.div>

        <div className="relative">
          <div className="hidden lg:block absolute top-20 left-0 right-0 h-0.5 border-t-2 border-dashed border-gray-200 mx-32" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative z-10 mb-5">
                  <div
                    className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg"
                    style={{ background: step.color }}
                  >
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <div
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white shadow"
                    style={{ background: step.bg, color: step.color, border: `2px solid ${step.color}` }}
                  >
                    {step.num}
                  </div>
                </div>

                <h3 className="text-base font-extrabold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>

                {i < steps.length - 1 && (
                  <ArrowRight
                    className="hidden lg:block absolute -right-6 top-8 w-5 h-5 text-gray-300"
                    style={{ zIndex: 20 }}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-14 text-center"
        >
          <div
            className="inline-flex items-center gap-2 px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold text-sm cursor-default"
            title="Coming soon on Google Play"
          >
            <Smartphone className="w-4 h-4" />
            Coming Soon on Play Store
          </div>
          <p className="mt-3 text-xs text-gray-400">No credit card required · Free forever plan available</p>
        </motion.div>
      </div>
    </section>
  );
}
