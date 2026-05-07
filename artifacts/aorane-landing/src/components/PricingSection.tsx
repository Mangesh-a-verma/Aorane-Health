import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, Sparkles, Building2, Star, Zap, Crown, Users,
  Smartphone, Apple, ArrowRight, Clock,
} from "lucide-react";
import { useSiteSettings } from "@/lib/useSiteSettings";

// ── Types ─────────────────────────────────────────────────────────────────────
interface IndividualPlan {
  planKey: string;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  badge: string;
  badgeColor: string;
  color: string;
  included: string[];
  notIncluded: string[];
}

interface BusinessPlan {
  planKey: string;
  displayName: string;
  pricePerSeat: number;
  yearlyPricePerSeat: number;
  minSeats: number;
  crmPrice: number | "free";
  badge: string;
  badgeColor: string;
  color: string;
  employeeBase: string;
  features: string[];
}

// ── Individual Plans ──────────────────────────────────────────────────────────
const individualPlans: IndividualPlan[] = [
  {
    planKey: "free",
    displayName: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    badge: "",
    badgeColor: "",
    color: "#6B7280",
    included: [
      "Food Logging (unlimited, manual)",
      "AI Food Scan Text (5/day)",
      "3000+ Indian Foods Database",
      "Basic Health Score",
      "Health History (7 days only)",
      "Exercise Logging (basic)",
      "Water Tracker",
      "Blood Emergency Network",
      "Offline Logging",
      "Community Support",
    ],
    notIncluded: [
      "AI Food Scan Photo",
      "Medical Report Scan",
      "AI Diet Plan",
      "AI Coach",
      "Blood Sugar/BP Tracking",
      "Sleep Analysis",
      "Medicine Reminders",
    ],
  },
  {
    planKey: "max",
    displayName: "Max",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    badge: "POPULAR",
    badgeColor: "#10B981",
    color: "#10B981",
    included: [
      "Everything in Free",
      "AI Food Scan Photo (10/day)",
      "AI Food Scan Text (10/day)",
      "Medical Report Scan (5/day)",
      "AI Diet Plan (5/day)",
      "AI Health Coach (10/day)",
      "AI Meal Swap (20/day)",
      "Unlimited Health History",
      "Blood Sugar & BP Tracking",
      "Sleep Stage Analysis",
      "Medicine Schedules",
      "Period Tracker",
      "BMI (India calibrated)",
      "No Ads",
      "Priority Email Support",
    ],
    notIncluded: [],
  },
  {
    planKey: "pro",
    displayName: "Pro",
    monthlyPrice: 249,
    yearlyPrice: 2490,
    badge: "",
    badgeColor: "",
    color: "#7C3AED",
    included: [
      "Everything in Max",
      "Advanced AI Health Predictions",
      "Stress & Burnout AI Monitoring",
      "Export Data (PDF & CSV)",
      "24/7 Priority Support",
    ],
    notIncluded: [],
  },
  {
    planKey: "family",
    displayName: "Family",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    badge: "4 Members",
    badgeColor: "#7C3AED",
    color: "#7C3AED",
    included: [
      "All Pro features per member",
      "4 Member Accounts",
      "Family Health Dashboard",
      "Elderly Health Monitoring",
      "Family Wellness Challenges",
      "Single Billing for All",
    ],
    notIncluded: [],
  },
];

// ── Business Plans ────────────────────────────────────────────────────────────
const businessPlans: BusinessPlan[] = [
  {
    planKey: "org_max",
    displayName: "Max",
    pricePerSeat: 199,
    yearlyPricePerSeat: 169,
    minSeats: 10,
    crmPrice: "free",
    badge: "",
    badgeColor: "",
    color: "#0747A6",
    employeeBase: "All MAX plan features per employee",
    features: [
      "Team Health Dashboard (anonymous)",
      "Department-wise Analytics",
      "HR Reports (PDF)",
      "Admin Portal Access",
      "Employee Join Code",
      "Priority Email Support",
    ],
  },
  {
    planKey: "org_pro",
    displayName: "Pro",
    pricePerSeat: 249,
    yearlyPricePerSeat: 211,
    minSeats: 20,
    crmPrice: "free",
    badge: "RECOMMENDED",
    badgeColor: "#0747A6",
    color: "#0747A6",
    employeeBase: "All PRO plan features per employee",
    features: [
      "Everything in Max PLUS",
      "Advanced Workforce Analytics",
      "Stress Risk Monitoring",
      "Insurance API Access",
      "Custom Wellness Challenges",
      "Dedicated Account Manager",
      "24/7 Priority Support",
    ],
  },
];

// ── Plan Icons ────────────────────────────────────────────────────────────────
const planIcons: Record<string, React.ComponentType<{ className?: string; color?: string }>> = {
  free: Sparkles,
  max: Crown,
  pro: Zap,
  family: Users,
  org_max: Building2,
  org_pro: Star,
};

// ── Individual Plan Card ──────────────────────────────────────────────────────
function IndividualCard({
  plan,
  isYearly,
  highlight,
  onInstall,
}: {
  plan: IndividualPlan;
  isYearly: boolean;
  highlight: boolean;
  onInstall: () => void;
}) {
  const Icon = planIcons[plan.planKey] || Sparkles;
  const isFree = plan.monthlyPrice === 0;

  const displayPrice = isYearly && !isFree
    ? Math.round(plan.yearlyPrice / 12)
    : plan.monthlyPrice;

  const savings = !isFree
    ? plan.monthlyPrice * 12 - plan.yearlyPrice
    : 0;

  // Wearable sync shown separately with clock icon only for MAX
  const showWearable = plan.planKey === "max";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative rounded-3xl border p-6 flex flex-col transition-all duration-300 ${
        highlight
          ? "border-2 shadow-[0_8px_32px_rgba(16,185,129,0.18)] scale-[1.02]"
          : "border-gray-100 bg-white"
      }`}
      style={highlight ? { borderColor: plan.color, background: "linear-gradient(to bottom, #ECFDF5, #fff)" } : {}}
    >
      {plan.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm whitespace-nowrap"
          style={{ background: plan.badgeColor }}
        >
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: plan.color + "18" }}
        >
          <Icon className="w-5 h-5" color={plan.color} />
        </div>
        <h3 className="text-lg font-extrabold text-gray-900">{plan.displayName}</h3>
      </div>

      {/* Price */}
      <div className="mb-5">
        {isFree ? (
          <div>
            <p className="text-3xl font-extrabold text-gray-900">₹0<span className="text-base font-normal text-gray-400">/month</span></p>
            <p className="text-xs text-gray-400 mt-1">Forever free · no credit card</p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-gray-400">₹</span>
              <span className="text-3xl font-extrabold text-gray-900">{displayPrice}</span>
              <span className="text-sm text-gray-400">/month</span>
            </div>
            {isYearly ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-400">₹{plan.yearlyPrice}/year</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: plan.color }}>
                  Save ₹{savings}
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-1">₹{plan.yearlyPrice}/year · save ₹{savings}</p>
            )}
          </div>
        )}
      </div>

      {/* ✅ Included features */}
      <ul className="space-y-2 flex-1 mb-3">
        {plan.included.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <div
              className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ background: plan.color + "20" }}
            >
              <Check className="w-2.5 h-2.5" style={{ color: plan.color }} />
            </div>
            <span className="text-sm text-gray-700">{f}</span>
          </li>
        ))}
        {/* Wearable Sync — Phase 4 */}
        {showWearable && (
          <li className="flex items-start gap-2.5">
            <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-amber-100">
              <Clock className="w-2.5 h-2.5 text-amber-500" />
            </div>
            <span className="text-sm text-gray-400">Wearable Sync <span className="text-amber-500 font-semibold">(Phase 4 — Soon)</span></span>
          </li>
        )}
      </ul>

      {/* ❌ Not included (only show on Free card) */}
      {plan.notIncluded.length > 0 && (
        <ul className="space-y-2 mb-5 border-t border-gray-100 pt-3">
          {plan.notIncluded.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-gray-100">
                <X className="w-2.5 h-2.5 text-gray-400" />
              </div>
              <span className="text-sm text-gray-400">{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* CTA */}
      <motion.button
        onClick={onInstall}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full py-3 rounded-2xl text-sm font-bold text-center transition-all mt-auto ${
          highlight ? "text-white shadow-md hover:opacity-90" : "border-2 hover:bg-gray-50"
        }`}
        style={
          highlight
            ? { background: plan.color }
            : { borderColor: plan.color + "50", color: plan.color }
        }
      >
        {isFree ? "Start Free" : "Start Free Trial"}
      </motion.button>
    </motion.div>
  );
}

// ── Business Plan Card ────────────────────────────────────────────────────────
function BusinessCard({ plan, highlight, isYearly }: { plan: BusinessPlan; highlight: boolean; isYearly: boolean }) {
  const Icon = planIcons[plan.planKey] || Building2;
  const effectivePerSeat = isYearly ? plan.yearlyPricePerSeat : plan.pricePerSeat;
  const minMonthly = effectivePerSeat * plan.minSeats;
  const yearlyTotal = plan.yearlyPricePerSeat * plan.minSeats * 12;
  const monthlyTotal = plan.pricePerSeat * plan.minSeats * 12;
  const yearlySavings = monthlyTotal - yearlyTotal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative rounded-3xl border p-6 flex flex-col transition-all duration-300 ${
        highlight
          ? "border-2 shadow-[0_8px_32px_rgba(7,71,166,0.15)] scale-[1.02]"
          : "border-gray-100 bg-white"
      }`}
      style={highlight ? { borderColor: plan.color, background: "linear-gradient(to bottom, #EEF4FF, #fff)" } : {}}
    >
      {plan.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm"
          style={{ background: plan.badgeColor }}
        >
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: plan.color + "18" }}
        >
          <Icon className="w-5 h-5" color={plan.color} />
        </div>
        <h3 className="text-lg font-extrabold text-gray-900">{plan.displayName}</h3>
      </div>

      {/* Per-seat pricing */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-sm text-gray-400">₹</span>
          <span className="text-3xl font-extrabold text-gray-900">{effectivePerSeat}</span>
          <span className="text-sm text-gray-400">/seat/month</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Min {plan.minSeats} seats = <span className="font-bold text-gray-700">₹{minMonthly.toLocaleString("en-IN")}/month minimum</span>
        </p>
        {isYearly && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-400">Billed ₹{yearlyTotal.toLocaleString("en-IN")}/year</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: plan.color }}>
              Save ₹{yearlySavings.toLocaleString("en-IN")}
            </span>
          </div>
        )}

        {/* CRM Line */}
        <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 bg-emerald-50 border border-emerald-100">
          <span className="text-xs text-gray-600 font-medium">CRM Platform:</span>
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
            <Check className="w-3 h-3" /> FREE INCLUDED
          </span>
        </div>
      </div>

      {/* Employee base */}
      <div
        className="mb-4 rounded-xl px-3 py-2 text-xs font-semibold"
        style={{ background: plan.color + "12", color: plan.color }}
      >
        ✦ {plan.employeeBase}
      </div>

      {/* Business features */}
      <ul className="space-y-2 flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <div
              className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ background: plan.color + "20" }}
            >
              <Check className="w-2.5 h-2.5" style={{ color: plan.color }} />
            </div>
            <span className="text-sm text-gray-700">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <motion.a
        href="mailto:business@aorane.in?subject=Demo Request"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full py-3 rounded-2xl text-sm font-bold text-center transition-all ${
          highlight ? "text-white shadow-md hover:opacity-90" : "border-2 hover:bg-gray-50"
        }`}
        style={
          highlight
            ? { background: plan.color }
            : { borderColor: plan.color + "50", color: plan.color }
        }
      >
        Book Demo
      </motion.a>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PricingSection({
  onBusinessSignUp,
  orgOnly,
}: {
  onBusinessSignUp?: () => void;
  orgOnly?: boolean;
} = {}) {
  const [tab, setTab] = useState<"individual" | "business">(orgOnly ? "business" : "individual");
  const [isYearly, setIsYearly] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const settings = useSiteSettings();

  const handleInstall = () => setInstallOpen(true);

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto">

        {/* Heading */}
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

          {/* Tabs + Toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            {!orgOnly && (
              <div className="flex bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
                <button
                  onClick={() => setTab("individual")}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "individual" ? "bg-[#0747A6] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Individual & Family
                </button>
                <button
                  onClick={() => setTab("business")}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "business" ? "bg-[#0747A6] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
                >
                  For Business
                </button>
              </div>
            )}

            {/* Monthly/Yearly toggle — for both individual and business */}
            <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-2 border border-gray-200 shadow-sm">
              <span className={`text-sm font-semibold ${!isYearly ? "text-[#0747A6]" : "text-gray-400"}`}>Monthly</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isYearly ? "bg-[#0747A6]" : "bg-gray-200"}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isYearly ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <span className={`text-sm font-semibold ${isYearly ? "text-[#0747A6]" : "text-gray-400"}`}>
                Yearly
              </span>
              {isYearly && (
                <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  Save up to 15%
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Cards */}
        <AnimatePresence mode="wait">
          {tab === "individual" ? (
            <motion.div
              key="individual"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {individualPlans.map((plan) => (
                <IndividualCard
                  key={plan.planKey}
                  plan={plan}
                  isYearly={isYearly}
                  highlight={plan.planKey === "max"}
                  onInstall={handleInstall}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="business"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 mx-auto max-w-2xl"
              >
                <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-[#0747A6]/8 to-[#10B981]/8 border border-[#0747A6]/20 rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0747A6]/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-[#0747A6]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Full Business Portal</p>
                      <p className="text-xs text-gray-500 mt-0.5">Seat management, team analytics & CRM on business.aorane.com</p>
                    </div>
                  </div>
                  <a
                    href="https://business.aorane.com/#pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-white bg-[#0747A6] px-4 py-2.5 rounded-xl hover:bg-[#0a3d8a] transition-colors whitespace-nowrap"
                  >
                    View Portal <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </motion.div>

              <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
                {businessPlans.map((plan) => (
                  <BusinessCard
                    key={plan.planKey}
                    plan={plan}
                    highlight={plan.planKey === "org_pro"}
                    isYearly={isYearly}
                  />
                ))}
              </div>

              {/* Business notes */}
              <div className="mt-8 text-center space-y-1">
                <p className="text-sm text-gray-500">
                  Business pricing is per seat per month. Minimum seats apply.
                </p>
                <p className="text-sm text-gray-500">
                  Contact us for custom enterprise pricing above 250 seats.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 text-center text-sm text-gray-400"
        >
          Prices in INR. GST @18% extra on paid plans.
          {tab === "individual" && (
            <> &nbsp;·&nbsp; 30-day money-back guarantee. Secure payments via Razorpay.</>
          )}
        </motion.div>
      </div>

      {/* Install App Modal */}
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
              <button
                onClick={() => setInstallOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
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
                  {!settings.iosAppStoreUrl && (
                    <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Soon</span>
                  )}
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
