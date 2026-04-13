import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingSection from "@/components/PricingSection";

const comparisonRows = [
  { feature: "Food logging", free: true, pro: true, max: true, family: true },
  { feature: "AI Food Scanner", free: false, pro: true, max: true, family: true },
  { feature: "NVIDIA AI insights", free: false, pro: true, max: true, family: true },
  { feature: "Exercise tracking (MET)", free: "Basic", pro: true, max: true, family: true },
  { feature: "Medical report scan", free: false, pro: true, max: true, family: true },
  { feature: "Family members", free: "1", pro: "1", max: "1", family: "4" },
  { feature: "Sleep stage analysis", free: false, pro: false, max: true, family: true },
  { feature: "Blood sugar & BP tracking", free: false, pro: false, max: true, family: true },
  { feature: "Period & stress tracking", free: false, pro: false, max: true, family: true },
  { feature: "Health history", free: "7 days", pro: "Unlimited", max: "Unlimited", family: "Unlimited" },
  { feature: "Data export", free: false, pro: false, max: true, family: true },
  { feature: "Priority support", free: false, pro: false, max: true, family: true },
  { feature: "Google Fit sync", free: false, pro: true, max: true, family: true },
];

const faqs = [
  { q: "Can I change my plan anytime?", a: "Yes. Upgrade or downgrade instantly from within the app. Prorated billing applies — you only pay for what you use." },
  { q: "Is my health data secure?", a: "Absolutely. All data is encrypted with AES-256 at rest and in transit. We are DPDPA 2023 compliant and store all data on Indian servers. We never sell your data." },
  { q: "What payment methods are supported?", a: "We accept UPI (GPay, PhonePe, Paytm), debit/credit cards, and net banking — all via Razorpay. GST is included in all prices." },
  { q: "Is there a free trial for paid plans?", a: "Yes! Every paid plan comes with a 14-day free trial. No credit card required to start. Cancel before 14 days and you will not be charged." },
  { q: "Can family members use their own devices?", a: "Yes. Each family member gets their own login and profile. They can use AORANE independently on their own device — all under your one Family plan." },
  { q: "Does AORANE work offline?", a: "Basic health logging (food, exercise, water) works completely offline. Data syncs automatically when internet is restored. AI features require connectivity." },
];

function Cell({ val }: { val: boolean | string }) {
  if (val === true) return <Check className="w-4 h-4 text-[#10B981] mx-auto" />;
  if (val === false) return <X className="w-4 h-4 text-gray-300 mx-auto" />;
  return <span className="text-xs font-semibold text-[#0747A6]">{val}</span>;
}

function FAQItem({ faq }: { faq: typeof faqs[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F8FAFC] transition-colors">
        <span className="font-semibold text-gray-900 text-sm">{faq.q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="px-6 pb-4">
          <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
        </motion.div>
      )}
    </div>
  );
}

export default function PricingPage() {
  const [audience, setAudience] = useState<"b2c" | "b2b">("b2c");

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar audience={audience} onAudienceChange={setAudience} />

      <div className="pt-16 bg-gradient-to-r from-[#0747A6] to-[#1565C0] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-white/60 text-sm mb-2">aorane.com / pricing</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">Simple Pricing. No Surprises.</h1>
            <p className="text-white/70 text-lg">Start free. Pay only when you need more. Made for India.</p>
          </motion.div>
        </div>
      </div>

      <PricingSection />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Full Plan Comparison</h2>
          <p className="text-gray-500 text-center text-sm mb-8">Individual plans comparison. Organization plans available separately.</p>

          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 w-48">Feature</th>
                    {["Free", "Pro", "Max", "Family"].map((plan, i) => (
                      <th key={plan} className={`px-4 py-4 text-center text-sm font-bold ${i === 1 ? "text-[#0747A6] bg-[#EEF4FF]" : "text-gray-700"}`}>
                        {plan}
                        {i === 1 && <span className="block text-xs font-normal text-[#0747A6] mt-0.5">₹199/mo</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={row.feature} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-6 py-3.5 text-sm text-gray-700 font-medium">{row.feature}</td>
                      {(["free", "pro", "max", "family"] as const).map((plan) => (
                        <td key={plan} className={`px-4 py-3.5 text-center ${plan === "pro" ? "bg-[#EEF4FF]/50" : ""}`}>
                          <Cell val={row[plan]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Frequently Asked Questions</h2>
          <p className="text-gray-500 text-center text-sm mb-8">Got more questions? Email us at support@aorane.com or call +91 73078 26291</p>
          <div className="space-y-3">
            {faqs.map((faq) => <FAQItem key={faq.q} faq={faq} />)}
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
