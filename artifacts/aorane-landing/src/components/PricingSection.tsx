import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Building2, Star, Zap, Crown, Users, Rocket } from "lucide-react";

interface Plan {
  planKey: string;
  displayName: string;
  type: string;
  monthlyPrice: string;
  yearlyPrice: string;
  features: string[];
  badge: string;
  color: string;
}

const API_BASE = (import.meta.env.VITE_API_URL as string) || "https://aorane.onrender.com";

const defaultIndividual: Plan[] = [
  { planKey: "free", displayName: "Free", type: "individual", monthlyPrice: "0", yearlyPrice: "0",
    features: ["Basic health tracking", "Food logging (text)", "Water & step tracking", "7-day history", "Community access"], badge: "", color: "#6B7280" },
  { planKey: "pro", displayName: "Pro", type: "individual", monthlyPrice: "199", yearlyPrice: "1990",
    features: ["Everything in Free", "AI Food Scanner", "Exercise with MET scoring", "NVIDIA AI insights", "Full health history", "Medical report scan", "Google Fit sync"], badge: "Popular", color: "#0747A6" },
  { planKey: "max", displayName: "Max", type: "individual", monthlyPrice: "249", yearlyPrice: "2490",
    features: ["Everything in Pro", "Advanced AI predictions", "Blood sugar & BP tracking", "Sleep stage analysis", "Priority support", "Export health data", "Period & stress tracking"], badge: "Best Value", color: "#7C3AED" },
  { planKey: "family", displayName: "Family", type: "individual", monthlyPrice: "499", yearlyPrice: "4990",
    features: ["4 Family Members", "All Max features per member", "Family health dashboard", "Elderly health monitoring", "Cross-member comparisons", "Family challenges", "Single billing"], badge: "Family", color: "#10B981" },
];

const defaultOrg: Plan[] = [
  { planKey: "starter", displayName: "Starter", type: "organization", monthlyPrice: "4999", yearlyPrice: "49990",
    features: ["Up to 50 employees", "Basic health dashboard", "Department analytics", "Monthly reports", "Email support"], badge: "", color: "#6B7280" },
  { planKey: "growth", displayName: "Growth", type: "organization", monthlyPrice: "12999", yearlyPrice: "129990",
    features: ["Up to 250 employees", "Advanced analytics", "Risk stratification", "Custom wellness programs", "API access", "Dedicated CSM", "Weekly reports"], badge: "Most Popular", color: "#0747A6" },
  { planKey: "enterprise", displayName: "Enterprise", type: "organization", monthlyPrice: "0", yearlyPrice: "0",
    features: ["Unlimited employees", "All Growth features", "Custom integrations", "SLA guarantee", "On-premise option", "Compliance reports", "24/7 Priority support", "White-labeling"], badge: "Enterprise", color: "#7C3AED" },
];

const planIcons: Record<string, React.ComponentType<{ className?: string; color?: string }>> = {
  free: Sparkles, pro: Zap, max: Crown, family: Users,
  starter: Building2, growth: Star, enterprise: Rocket
};

function PlanCard({ plan, isYearly, highlight, onBusinessSignUp }: { plan: Plan; isYearly: boolean; highlight: boolean; onBusinessSignUp?: () => void }) {
  const Icon = planIcons[plan.planKey] || Sparkles;
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  const isCustom = plan.planKey === "enterprise" || plan.monthlyPrice === "0" && plan.planKey !== "free";
  const isFree = plan.planKey === "free";
  const monthlyFromYearly = isYearly && !isFree && !isCustom
    ? (parseFloat(plan.yearlyPrice) / 12).toFixed(0)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative rounded-3xl border p-6 flex flex-col transition-all duration-300 ${
        highlight
          ? "border-[#0747A6] shadow-[0_0_0_2px_#0747A620,0_12px_40px_rgba(7,71,166,0.18)] scale-[1.02]"
          : "border-gray-100 card-hover bg-white"
      } ${highlight ? "bg-gradient-to-b from-[#EEF4FF] to-white" : "bg-white"}`}
    >
      {plan.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full shadow"
          style={{ background: plan.color }}
        >
          {plan.badge}
        </div>
      )}
      <div className="mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: plan.color + "15" }}>
          <Icon className="w-5 h-5" color={plan.color} />
        </div>
        <h3 className="text-lg font-extrabold text-gray-900">{plan.displayName}</h3>
      </div>

      <div className="mb-5">
        {isCustom ? (
          <div>
            <p className="text-3xl font-extrabold text-gray-900">Custom</p>
            <p className="text-xs text-gray-400 mt-1">Contact us for pricing</p>
          </div>
        ) : isFree ? (
          <div>
            <p className="text-3xl font-extrabold text-gray-900">Free</p>
            <p className="text-xs text-gray-400 mt-1">Forever — no credit card</p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg text-gray-400">₹</span>
              <span className="text-3xl font-extrabold text-gray-900">
                {monthlyFromYearly || price}
              </span>
              <span className="text-sm text-gray-400">/mo</span>
            </div>
            {isYearly && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">₹{price}/year</span>
                <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded-full">Save 17%</span>
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-2.5 flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: plan.color + "20" }}>
              <Check className="w-2.5 h-2.5" style={{ color: plan.color }} />
            </div>
            <span className="text-sm text-gray-600">{f}</span>
          </li>
        ))}
      </ul>

      {isCustom ? (
        <motion.a
          href="mailto:business@aorane.in"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-2xl text-sm font-bold text-center transition-all border-2 hover:bg-gray-50"
          style={{ borderColor: plan.color + "40", color: plan.color }}
        >
          Contact Sales
        </motion.a>
      ) : (
        <motion.button
          onClick={onBusinessSignUp}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full py-3 rounded-2xl text-sm font-bold text-center transition-all ${
            highlight ? "text-white shadow-md hover:opacity-90" : "border-2 hover:bg-gray-50"
          }`}
          style={highlight
            ? { background: plan.color }
            : { borderColor: plan.color + "40", color: plan.color }
          }
        >
          {isFree ? "Get Started Free" : "Choose Plan"}
        </motion.button>
      )}
    </motion.div>
  );
}

export default function PricingSection({ onBusinessSignUp }: { onBusinessSignUp?: () => void } = {}) {
  const [tab, setTab] = useState<"individual" | "organization">("individual");
  const [isYearly, setIsYearly] = useState(false);
  const [indPlans, setIndPlans] = useState<Plan[]>(defaultIndividual);
  const [orgPlans, setOrgPlans] = useState<Plan[]>(defaultOrg);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const [indRes, orgRes] = await Promise.all([
          fetch(`${API_BASE}/api/plans?type=individual`),
          fetch(`${API_BASE}/api/plans?type=organization`),
        ]);
        if (indRes.ok) {
          const d = await indRes.json();
          if (d.plans?.length) setIndPlans(d.plans);
        }
        if (orgRes.ok) {
          const d = await orgRes.json();
          if (d.plans?.length) setOrgPlans(d.plans);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const plans = tab === "individual" ? indPlans : orgPlans;
  const highlightKey = tab === "individual" ? "pro" : "growth";

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="text-xs font-bold text-[#0747A6] bg-[#0747A6]/10 px-3 py-1 rounded-full uppercase tracking-widest">
            Pricing
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">
            Simple, transparent <span className="gradient-text">pricing</span>
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">
            Start free. Upgrade as you grow. No hidden charges — made for India.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <div className="flex bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
              <button
                onClick={() => setTab("individual")}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "individual" ? "bg-[#0747A6] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
              >
                Individual & Family
              </button>
              <button
                onClick={() => setTab("organization")}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "organization" ? "bg-[#0747A6] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
              >
                For Organizations
              </button>
            </div>

            <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-2 border border-gray-200 shadow-sm">
              <span className={`text-sm font-semibold ${!isYearly ? "text-[#0747A6]" : "text-gray-400"}`}>Monthly</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isYearly ? "bg-[#0747A6]" : "bg-gray-200"}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isYearly ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <span className={`text-sm font-semibold ${isYearly ? "text-[#0747A6]" : "text-gray-400"}`}>
                Yearly <span className="text-xs text-[#10B981] font-bold">Save 17%</span>
              </span>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className={`grid gap-6 ${
              plans.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
            }`}
          >
            {plans.map((plan) => (
              <PlanCard
                key={plan.planKey}
                plan={plan}
                isYearly={isYearly}
                highlight={plan.planKey === highlightKey}
                onBusinessSignUp={tab === "organization" ? onBusinessSignUp : undefined}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 text-center text-sm text-gray-500"
        >
          All plans include 30-day money-back guarantee. Secure payments via Razorpay.
          <br />
          Prices include GST. Cancel anytime.
        </motion.div>
      </div>
    </section>
  );
}
