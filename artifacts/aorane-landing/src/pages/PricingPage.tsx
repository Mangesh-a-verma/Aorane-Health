import { useState } from "react";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingSection from "@/components/PricingSection";
import { formatPrice } from "@/lib/market";

type CompRow =
  | { section: true; feature: string; free?: never; max?: never; pro?: never; family?: never }
  | { section?: false; feature: string; free: boolean | string; max: boolean | string; pro: boolean | string; family: boolean | string };

const comparisonRows: CompRow[] = [
  { section: true,  feature: "📊 Basic Features" },
  { feature: "Food Logging (manual)",       free: true,        max: true,        pro: true,        family: true        },
  { feature: "Water Tracker",               free: true,        max: true,        pro: true,        family: true        },
  { feature: "Exercise Logging",            free: "Basic",     max: true,        pro: true,        family: true        },
  { feature: "Health Score",                free: "Basic",     max: "Advanced",  pro: "Advanced",  family: "Advanced"  },
  { feature: "Health History",              free: "7 days",    max: "Unlimited", pro: "Unlimited", family: "Unlimited" },
  { feature: "Indian Foods Database",       free: "3000+",     max: "3000+",     pro: "3000+",     family: "3000+"     },
  { feature: "Blood Emergency Network",     free: true,        max: true,        pro: true,        family: true        },
  { feature: "Offline Logging",             free: true,        max: true,        pro: true,        family: true        },
  { feature: "Community Support",           free: true,        max: true,        pro: true,        family: true        },
  { feature: "Ads",                         free: "Shown",     max: "No Ads",    pro: "No Ads",    family: "No Ads"    },

  { section: true,  feature: "🤖 AI Features" },
  { feature: "AI Food Scan (text)",         free: "5/day",     max: "10/day",    pro: "10/day",    family: "10/day"    },
  { feature: "AI Food Scan (photo)",        free: false,       max: "10/day",    pro: "10/day",    family: "10/day"    },
  { feature: "Medical Report Scan",         free: false,       max: "5/day",     pro: "5/day",     family: "5/day"     },
  { feature: "AI Diet Plan",                free: false,       max: "5/day",     pro: "5/day",     family: "5/day"     },
  { feature: "AI Health Coach",             free: false,       max: "10/day",    pro: "10/day",    family: "10/day"    },
  { feature: "AI Meal Swap",               free: false,       max: "20/day",    pro: "20/day",    family: "20/day"    },
  { feature: "AI Health Predictions",       free: false,       max: false,       pro: true,        family: true        },
  { feature: "Stress & Burnout AI",         free: false,       max: false,       pro: true,        family: true        },

  { section: true,  feature: "⚕️ Health Tracking" },
  { feature: "Blood Sugar & BP Tracking",   free: false,       max: true,        pro: true,        family: true        },
  { feature: "Sleep Stage Analysis",        free: false,       max: true,        pro: true,        family: true        },
  { feature: "Medicine Reminders",          free: true,        max: true,        pro: true,        family: true        },
  { feature: "Period Tracker",              free: false,       max: true,        pro: true,        family: true        },
  { feature: "BMI (India Calibrated)",      free: true,        max: true,        pro: true,        family: true        },
  { feature: "Wearable Sync",              free: false,       max: "Phase 4",   pro: "Phase 4",   family: "Phase 4"   },
  { feature: "Export Data (PDF & CSV)",     free: false,       max: false,       pro: true,        family: true        },
  { feature: "Support Level",               free: "Community", max: "Priority Email", pro: "24/7 Priority", family: "24/7 Priority" },

  { section: true,  feature: "👨‍👩‍👧‍👦 Family Features" },
  { feature: "Member Accounts",             free: "1",         max: "1",         pro: "1",         family: "4"         },
  { feature: "Family Health Dashboard",     free: false,       max: false,       pro: false,       family: true        },
  { feature: "Elderly Health Monitoring",   free: false,       max: false,       pro: false,       family: true        },
  { feature: "Family Wellness Challenges",  free: false,       max: false,       pro: false,       family: true        },
  { feature: "Single Billing for All",      free: false,       max: false,       pro: false,       family: true        },
];

const faqs = [
  { q: "Can I change my plan anytime?", a: "Yes. Upgrade or downgrade instantly from within the app. Prorated billing applies — you only pay for what you use." },
  { q: "Is my health data secure?", a: "Absolutely. All data is encrypted with AES-256 at rest and in transit. We are DPDPA 2023 compliant and store all data on Indian servers. We never sell your data." },
  { q: "What payment methods are supported?", a: "We accept UPI (GPay, PhonePe, Paytm), debit/credit cards, and net banking — all via Razorpay. GST is included in all prices." },
  { q: "Is there a free trial for paid plans?", a: "Yes! Every paid plan comes with a 14-day free trial. No credit card required to start. Cancel before 14 days and you will not be charged." },
  { q: "Can family members use their own devices?", a: "Yes. Each family member gets their own login and profile. They can use Aorane independently on their own device — all under your one Family plan." },
  { q: "Does Aorane work offline?", a: "Basic health logging (food, exercise, water) works completely offline. Data syncs automatically when internet is restored. AI features require connectivity." },
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
      <Helmet>
        <title>Pricing — Free & Premium Health Plans | AORANE</title>
        <meta name="description" content="AORANE pricing plans made for India. Free forever plan + Pro ₹199/mo + Max ₹249/mo + Family ₹499/mo. AI food scanner, diet plans, health insights. No hidden fees. GST extra." />
        <link rel="canonical" href="https://aorane.com/pricing" />
        <meta property="og:title" content="AORANE Pricing — Affordable Health Plans for India" />
        <meta property="og:description" content="Free forever + Pro ₹199/mo + Max ₹249/mo + Family ₹499/mo. AI features, offline logging & more. Start free, upgrade anytime." />
        <meta property="og:url" content="https://aorane.com/pricing" />
      </Helmet>
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

      <PricingSection onBusinessSignUp={() => { window.location.href = "https://business.aorane.com/#pricing"; }} />

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
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 w-56">Feature</th>
                    {(["Free", "Max", "Pro", "Family"] as const).map((plan) => (
                      <th key={plan} className={`px-4 py-4 text-center text-sm font-bold ${plan === "Max" ? "text-[#0747A6] bg-[#EEF4FF]" : "text-gray-700"}`}>
                        {plan}
                        {plan === "Max" && <span className="block text-xs font-normal text-[#0747A6] mt-0.5">{formatPrice(249)}/mo</span>}
                        {plan === "Pro" && <span className="block text-xs font-normal text-purple-600 mt-0.5">{formatPrice(199)}/mo</span>}
                        {plan === "Family" && <span className="block text-xs font-normal text-emerald-600 mt-0.5">{formatPrice(499)}/mo</span>}
                        {plan === "Free" && <span className="block text-xs font-normal text-gray-400 mt-0.5">{formatPrice(0)}/mo</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) =>
                    row.section ? (
                      <tr key={row.feature + i} className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={5} className="px-6 py-2.5 text-xs font-bold uppercase text-gray-500 tracking-widest">
                          {row.feature}
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.feature} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-3.5 text-sm text-gray-700 font-medium">{row.feature}</td>
                        {(["free", "max", "pro", "family"] as const).map((plan) => (
                          <td key={plan} className={`px-4 py-3.5 text-center ${plan === "max" ? "bg-[#EEF4FF]/50" : ""}`}>
                            <Cell val={row[plan]!} />
                          </td>
                        ))}
                      </tr>
                    )
                  )}
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
