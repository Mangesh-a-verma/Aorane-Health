import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Building2, Star, Zap, Crown, Users, Rocket, Smartphone, Apple, X } from "lucide-react";
import { useSiteSettings } from "@/lib/useSiteSettings";

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

const API_BASE = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, "")
  : import.meta.env.BASE_URL.replace(/\/$/, "");

const defaultIndividual: Plan[] = [
  { planKey: "free", displayName: "Free", type: "individual", monthlyPrice: "0", yearlyPrice: "0",
    features: [
      "Food logging (manual) — unlimited",
      "AI Food Scan (text) — 5 scans/day",
      "Water tracker & reminders",
      "Exercise logging (basic)",
      "Step counter",
      "7-day health history",
      "Basic daily health score",
      "Community forum access",
    ], badge: "", color: "#6B7280" },
  { planKey: "max", displayName: "Max", type: "individual", monthlyPrice: "199", yearlyPrice: "1990",
    features: [
      "Everything in Free",
      "AI Food Scanner (photo) — 10/day",
      "Medical Report Scan — 5/day",
      "AI Diet Plan — 5 plans/day",
      "AI Health Coach & tips — 10/day",
      "AI Meal Swap — 20/day",
      "Full unlimited health history",
      "Blood sugar & BP tracking",
      "Sleep stage analysis",
      "Google Fit / Samsung Health sync",
      "Priority email support",
    ], badge: "Popular", color: "#0747A6" },
  { planKey: "pro", displayName: "Pro", type: "individual", monthlyPrice: "249", yearlyPrice: "2490",
    features: [
      "Everything in Max",
      "Advanced AI health predictions",
      "Period cycle tracker",
      "Stress & burnout AI monitoring",
      "Personalized health goals AI",
      "Export data — PDF & CSV",
      "24/7 priority support",
    ], badge: "Best Value", color: "#7C3AED" },
  { planKey: "family", displayName: "Family", type: "individual", monthlyPrice: "499", yearlyPrice: "4990",
    features: [
      "4 individual member accounts",
      "All Max features per member",
      "Family health dashboard",
      "Elderly health monitoring",
      "Cross-family health comparisons",
      "Family wellness challenges",
      "Single billing for all members",
    ], badge: "Family", color: "#10B981" },
];

const defaultOrg: Plan[] = [
  { planKey: "starter", displayName: "Max", type: "organization", monthlyPrice: "179", yearlyPrice: "1781",
    features: ["Min 10 users", "Aggregate health dashboard", "Enrollment code management", "Employee search & filter", "GST-ready invoicing", "Department analytics", "Monthly reports", "Email support"], badge: "", color: "#6B7280" },
  { planKey: "growth", displayName: "Pro", type: "organization", monthlyPrice: "224", yearlyPrice: "2231",
    features: ["Min 50 users", "Everything in Max", "Advanced health analytics", "Health risk alerts", "Custom wellness programs", "Weekly & monthly team reports", "Custom announcements", "Priority support"], badge: "Most Popular", color: "#0747A6" },
  { planKey: "enterprise", displayName: "Enterprise", type: "organization", monthlyPrice: "0", yearlyPrice: "0",
    features: ["Unlimited users", "All Pro features", "Custom integrations", "SLA guarantee", "On-premise option", "Compliance reports", "24/7 Priority support", "White-labeling"], badge: "Enterprise", color: "#7C3AED" },
];

const planIcons: Record<string, React.ComponentType<{ className?: string; color?: string }>> = {
  free: Sparkles, pro: Zap, max: Crown, family: Users,
  starter: Building2, growth: Star, enterprise: Rocket
};

function PlanCard({ plan, isYearly, highlight, onBusinessSignUp, onMobileInstall }: { plan: Plan; isYearly: boolean; highlight: boolean; onBusinessSignUp?: () => void; onMobileInstall?: () => void }) {
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
              <span className="text-sm text-gray-400">
                {plan.type === "organization" ? "/user/mo" : "/mo"}
              </span>
            </div>
            {isYearly && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">₹{price}/{plan.type === "organization" ? "user/yr" : "year"}</span>
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
          onClick={plan.type === "individual" ? onMobileInstall : onBusinessSignUp}
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
          {plan.type === "individual" ? (isFree ? "Install App — Free" : "Install App") : (isFree ? "Get Started Free" : "Choose Plan")}
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
  const [installOpen, setInstallOpen] = useState(false);
  const settings = useSiteSettings();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const [indRes, orgRes] = await Promise.all([
          fetch(`${API_BASE}/api/plans?type=individual`),
          fetch(`${API_BASE}/api/plans?type=organization`),
        ]);
        if (indRes.ok) {
          const d = await indRes.json();
          if (d.plans?.length) setIndPlans(d.plans.map((p: Record<string, unknown>) => ({
            ...p,
            badge: p.badgeText ?? "",
            color: p.badgeColor ?? "#6B7280",
          })));
        }
        if (orgRes.ok) {
          const d = await orgRes.json();
          if (d.plans?.length) setOrgPlans(d.plans.map((p: Record<string, unknown>) => ({
            ...p,
            badge: p.badgeText ?? "",
            color: p.badgeColor ?? "#6B7280",
          })));
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
                onMobileInstall={tab === "individual" ? () => {
                  const url = settings.androidPlayStoreUrl || "https://play.google.com/store/apps/details?id=in.aorane.app";
                  window.open(url, "_blank", "noopener,noreferrer");
                } : undefined}
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

      {/* Install App Modal — choose Android/iOS */}
      <AnimatePresence>
        {installOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setInstallOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setInstallOpen(false)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-600" />
              </button>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 bg-gradient-to-br from-[#0747A6] to-[#10B981] flex items-center justify-center">
                  <Smartphone className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900">Install Aorane App</h3>
                <p className="text-sm text-gray-500 mt-1">Choose your device to start tracking your health</p>
              </div>

              <div className="space-y-3">
                <a
                  href={settings.androidPlayStoreUrl || "https://play.google.com/store/apps/details?id=in.aorane.app"}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 border-[#0747A6] bg-[#0747A6] text-white hover:bg-[#0a3d8a] transition-all"
                >
                  <Smartphone className="w-7 h-7" />
                  <div className="flex-1 text-left">
                    <div className="text-xs opacity-80">Available now on</div>
                    <div className="text-base font-bold">Google Play Store</div>
                  </div>
                  <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">Live</span>
                </a>

                <button
                  disabled={!settings.iosAppStoreUrl}
                  onClick={() => settings.iosAppStoreUrl && window.open(settings.iosAppStoreUrl, "_blank")}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${settings.iosAppStoreUrl ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-800 cursor-pointer" : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"}`}
                >
                  <Apple className="w-7 h-7" />
                  <div className="flex-1 text-left">
                    <div className="text-xs opacity-80">{settings.iosAppStoreUrl ? "Available on" : "Coming soon to"}</div>
                    <div className="text-base font-bold">Apple App Store</div>
                  </div>
                  {!settings.iosAppStoreUrl && <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Soon</span>}
                </button>
              </div>

              <p className="text-xs text-center text-gray-400 mt-5">
                Free download · 30-day money-back guarantee · Secure & private
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
