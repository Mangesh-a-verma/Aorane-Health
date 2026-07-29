import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "What is Aorane's Health Score and how is it calculated?",
    a: "Aorane's Health Score is a single number from 0 to 100 that reflects your overall health, calculated using an ICMR/WHO-weighted formula that combines your food, exercise, sleep, and stress data into one composite score, updated daily.",
  },
  {
    q: "Is Aorane free to use?",
    a: "Yes, Aorane has a free forever plan that includes core health tracking features. Paid plans (Max, Pro, Family) unlock additional AI-powered features like advanced diet planning and family health management.",
  },
  {
    q: "Does Aorane recognize Indian food?",
    a: "Yes, Aorane's AI Food Scanner is trained to recognize over 3,000 Indian dishes, including regional foods, and logs full nutrition breakdown (calories, protein, carbs, fat, fiber) in under 2 seconds from a photo.",
  },
  {
    q: "Is my health data safe and private on Aorane?",
    a: "Yes. Aorane offers 8 granular privacy controls, and sensitive data like stress logs, sleep records, and medicine history are private by default. All data is stored in India and the platform is fully compliant with India's DPDPA 2023. Aorane does not sell data or show ads.",
  },
  {
    q: "Does Aorane sync with Google Fit or Samsung Health?",
    a: "Yes, Aorane integrates with Google Health Connect on Android, which automatically syncs data from Google Fit, Samsung Health, and other connected health apps.",
  },
  {
    q: "Can I track my family's health on Aorane?",
    a: "Yes, Aorane's Family Health Hub lets one account manage health tracking for up to 6 family members from a single dashboard.",
  },
  {
    q: "Is Aorane available on iOS?",
    a: "Aorane is currently available for Android via Google Play Store. An iOS version is planned for a future release.",
  },
  {
    q: "Is Aorane a substitute for a doctor?",
    a: "No, Aorane is not a medical device and does not provide medical diagnoses. It is a wellness tracking and insights tool intended to complement, not replace, professional medical advice.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F8F6] overflow-hidden">
      <div className="mesh-blob mesh-drift-2 w-[450px] h-[450px] -bottom-32 right-1/4" style={{ background: "radial-gradient(circle at 40% 60%, rgba(0,199,154,0.15), transparent 65%)" }} />
      <div className="relative max-w-3xl mx-auto z-[1]">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[#05473C] glass-panel-soft px-3 py-1.5 rounded-full uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C79A]" />Frequently Asked Questions
          </span>
          <h2 className="font-display mt-4 text-3xl sm:text-4xl font-medium text-gray-900">
            Questions? <span className="gradient-text-teal italic">We've got answers</span>
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q} className="glass-panel-soft rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-semibold text-gray-900">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-[#05473C] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
