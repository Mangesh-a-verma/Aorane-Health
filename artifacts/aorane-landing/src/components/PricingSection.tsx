import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Sparkles, Building2, Star, Zap, Crown, Users,
  Clock, ArrowRight, MessageCircle, ChevronRight,
} from "lucide-react";
import { useSiteSettings } from "@/lib/useSiteSettings";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlanFeature {
  text: string;
  upcoming?: boolean;
}

interface IndividualPlan {
  planKey: string;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  badge?: string;
  badgeColor?: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  features: PlanFeature[];
}

interface BusinessPlan {
  planKey: string;
  displayName: string;
  pricePerSeat: number;
  yearlyPricePerSeat: number;
  minSeats: number;
  crmPrice: number | "free";
  badge?: string;
  badgeColor?: string;
  accentColor: string;
  features: string[];
  isComingSoon?: boolean;
}

// ── Individual Plans ──────────────────────────────────────────────────────────
const individualPlans: IndividualPlan[] = [
  {
    planKey: "free",
    displayName: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    accentColor: "#6B7280",
    gradientFrom: "#F9FAFB",
    gradientTo: "#FFFFFF",
    features: [
      { text: "3000+ Verified Indian Foods" },
      { text: "AI Food Analysis (Text)" },
      { text: "Exercise & Yoga Tracking" },
      { text: "Water & Medicine Reminders" },
      { text: "BMI (India Calibrated)" },
      { text: "Blood SOS Network" },
    ],
  },
  {
    planKey: "max",
    displayName: "Max",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    badge: "POPULAR",
    badgeColor: "#10B981",
    accentColor: "#10B981",
    gradientFrom: "#ECFDF5",
    gradientTo: "#FFFFFF",
    features: [
      { text: "All Free Plan Features" },
      { text: "AI Food Analysis (Photo & Text)" },
      { text: "AI Medical Report Analysis" },
      { text: "AI Health Coach" },
      { text: "Health Report & Diet Plan" },
      { text: "Wearable Sync", upcoming: true },
    ],
  },
  {
    planKey: "pro",
    displayName: "Pro",
    monthlyPrice: 249,
    yearlyPrice: 2490,
    accentColor: "#7C3AED",
    gradientFrom: "#F5F3FF",
    gradientTo: "#FFFFFF",
    features: [
      { text: "All Max Plan Features" },
      { text: "AI Intelligence & Analytics" },
      { text: "Health Predictions" },
      { text: "Stress Monitor" },
      { text: "Health Report (Weekly)" },
      { text: "WhatsApp Bot", upcoming: true },
    ],
  },
  {
    planKey: "family",
    displayName: "Family",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    badge: "4 MEMBERS",
    badgeColor: "#7C3AED",
    accentColor: "#7C3AED",
    gradientFrom: "#F5F3FF",
    gradientTo: "#FFFFFF",
    features: [
      { text: "All Pro Plan Features" },
      { text: "4 Members in One Plan" },
      { text: "Family Health Track" },
      { text: "Family Health Dashboard" },
      { text: "Shared Billing" },
    ],
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
    crmPrice: 499,
    accentColor: "#0747A6",
    features: [
      "All MAX App Features per Member",
      "Employees Health Track",
      "Team Health Dashboard",
      "Enrollment Code Management",
      "Department-wise Analytics",
      "HR Reports (PDF)",
      "GST-Ready Invoicing",
      "Email Support",
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
    accentColor: "#0747A6",
    features: [
      "All PRO App Features per Member",
      "Everything in Max Plan",
      "Stress Level Monitor",
      "Monthly Health Report",
      "Advanced Workforce Analytics",
      "Custom Wellness Programs",
      "24/7 Priority Support",
      "Dedicated Account Manager",
    ],
  },
  {
    planKey: "custom",
    displayName: "Custom",
    pricePerSeat: 0,
    yearlyPricePerSeat: 0,
    minSeats: 250,
    crmPrice: "free",
    accentColor: "#B45309",
    isComingSoon: true,
    features: [
      "Everything in Pro",
      "Dedicated Account Manager",
      "Custom HRMS / ERP Integration",
      "SLA Guarantee (99.9% Uptime)",
      "DPDPA Compliance Reports",
      "White-label Option",
      "On-premise Deployment",
      "Executive Health Dashboards",
    ],
  },
];

// ── Individual Plan Card ──────────────────────────────────────────────────────
function IndividualCard({
  plan, isYearly, highlight, onInstall,
}: {
  plan: IndividualPlan; isYearly: boolean; highlight: boolean; onInstall: () => void;
}) {
  const isFree = plan.monthlyPrice === 0;
  const displayPrice = isYearly && !isFree
    ? Math.round(plan.yearlyPrice / 12)
    : plan.monthlyPrice;
  const savings = !isFree ? plan.monthlyPrice * 12 - plan.yearlyPrice : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative rounded-3xl flex flex-col overflow-hidden"
      style={{
        border: highlight ? `2px solid ${plan.accentColor}` : "1.5px solid #E5E7EB",
        boxShadow: highlight
          ? `0 8px 40px ${plan.accentColor}28`
          : "0 2px 12px rgba(0,0,0,0.05)",
        background: highlight
          ? `linear-gradient(160deg, ${plan.gradientFrom}, ${plan.gradientTo})`
          : "#FFFFFF",
        transform: highlight ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Top accent bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${plan.accentColor}, ${plan.accentColor}80)` }}
      />

      {/* Badge */}
      {plan.badge && (
        <div
          className="absolute top-4 right-4 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wide"
          style={{ background: plan.badgeColor }}
        >
          {plan.badge}
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Header */}
        <div className="mb-5">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: `${plan.accentColor}15` }}
          >
            {plan.planKey === "free" && <Sparkles className="w-5 h-5" style={{ color: plan.accentColor }} />}
            {plan.planKey === "max" && <Crown className="w-5 h-5" style={{ color: plan.accentColor }} />}
            {plan.planKey === "pro" && <Zap className="w-5 h-5" style={{ color: plan.accentColor }} />}
            {plan.planKey === "family" && <Users className="w-5 h-5" style={{ color: plan.accentColor }} />}
          </div>
          <h3 className="text-xl font-extrabold text-gray-900">{plan.displayName}</h3>
        </div>

        {/* Price */}
        <div className="mb-5 pb-5 border-b border-gray-100">
          {isFree ? (
            <div>
              <p className="text-4xl font-extrabold text-gray-900">
                ₹0
                <span className="text-base font-normal text-gray-400">/month</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Forever free · no credit card</p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold text-gray-400">₹</span>
                <span className="text-4xl font-extrabold text-gray-900">{displayPrice}</span>
                <span className="text-sm text-gray-400">/month</span>
              </div>
              {isYearly ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-gray-400">₹{plan.yearlyPrice}/year</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: plan.accentColor }}
                  >
                    Save ₹{savings}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1.5">
                  ₹{plan.yearlyPrice}/year · save ₹{savings}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-2.5 flex-1 mb-6">
          {plan.features.map((f) => (
            <li key={f.text} className="flex items-start gap-2.5">
              {f.upcoming ? (
                <span
                  className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-amber-100"
                >
                  <Clock className="w-2.5 h-2.5 text-amber-500" />
                </span>
              ) : (
                <span
                  className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${plan.accentColor}20` }}
                >
                  <Check className="w-2.5 h-2.5" style={{ color: plan.accentColor }} />
                </span>
              )}
              <span className={`text-sm ${f.upcoming ? "text-amber-600 font-medium" : "text-gray-700"}`}>
                {f.text}
                {f.upcoming && (
                  <span className="ml-1.5 text-[10px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">
                    SOON
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <motion.button
          onClick={onInstall}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-2xl text-sm font-bold text-center transition-all"
          style={
            highlight
              ? { background: plan.accentColor, color: "#fff" }
              : {
                  border: `2px solid ${plan.accentColor}50`,
                  color: plan.accentColor,
                  background: "transparent",
                }
          }
        >
          {isFree ? "Start Free" : "Start Free Trial"}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Business Plan Card ────────────────────────────────────────────────────────
function BusinessCard({
  plan, highlight, isYearly,
}: {
  plan: BusinessPlan; highlight: boolean; isYearly: boolean;
}) {
  const effectivePerSeat = isYearly ? plan.yearlyPricePerSeat : plan.pricePerSeat;
  const minMonthly = effectivePerSeat * plan.minSeats;
  const yearlyTotal = plan.yearlyPricePerSeat * plan.minSeats * 12;
  const monthlyTotal = plan.pricePerSeat * plan.minSeats * 12;
  const yearlySavings = monthlyTotal - yearlyTotal;

  if (plan.isComingSoon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative rounded-3xl flex flex-col overflow-hidden"
        style={{
          border: "1.5px dashed #D97706",
          background: "linear-gradient(160deg, #FFFBEB, #FFFFFF)",
        }}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-600" />
        <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1 rounded-full border border-amber-200 tracking-wide">
          COMING SOON
        </div>
        <div className="p-6 flex flex-col flex-1">
          <div className="mb-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 bg-amber-100">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-xl font-extrabold text-gray-900">Custom</h3>
            <p className="text-xs text-gray-400 mt-1">Enterprise · 250+ seats</p>
          </div>

          <div className="mb-5 pb-5 border-b border-amber-100">
            <p className="text-2xl font-extrabold text-amber-700">Custom Pricing</p>
            <p className="text-xs text-gray-400 mt-1">Tailored to your team size & needs</p>
          </div>

          <ul className="space-y-2.5 flex-1 mb-6">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-amber-100">
                  <Check className="w-2.5 h-2.5 text-amber-600" />
                </span>
                <span className="text-sm text-gray-600">{f}</span>
              </li>
            ))}
          </ul>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-center mb-4">
            <p className="text-xs font-bold text-amber-700">🚧 Under Development</p>
            <p className="text-xs text-amber-600 mt-0.5">Self-serve enterprise portal launching soon</p>
          </div>

          <a
            href="mailto:sales@aorane.com?subject=Custom Enterprise Plan Enquiry"
            className="w-full py-3 rounded-2xl text-sm font-bold text-center border-2 border-amber-400 text-amber-700 hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Contact Sales
          </a>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative rounded-3xl flex flex-col overflow-hidden"
      style={{
        border: highlight ? `2px solid ${plan.accentColor}` : "1.5px solid #E5E7EB",
        boxShadow: highlight
          ? `0 8px 40px ${plan.accentColor}22`
          : "0 2px 12px rgba(0,0,0,0.05)",
        background: highlight
          ? `linear-gradient(160deg, #EEF4FF, #FFFFFF)`
          : "#FFFFFF",
        transform: highlight ? "scale(1.02)" : "scale(1)",
      }}
    >
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${plan.accentColor}, ${plan.accentColor}80)` }}
      />

      {plan.badge && (
        <div
          className="absolute top-4 right-4 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wide"
          style={{ background: plan.badgeColor }}
        >
          {plan.badge}
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Header */}
        <div className="mb-5">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: `${plan.accentColor}15` }}
          >
            {plan.planKey === "org_max"
              ? <Building2 className="w-5 h-5" style={{ color: plan.accentColor }} />
              : <Star className="w-5 h-5" style={{ color: plan.accentColor }} />}
          </div>
          <h3 className="text-xl font-extrabold text-gray-900">{plan.displayName}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Min {plan.minSeats} seats</p>
        </div>

        {/* Price */}
        <div className="mb-4 pb-4 border-b border-gray-100">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-gray-400">₹</span>
            <span className="text-4xl font-extrabold text-gray-900">{effectivePerSeat}</span>
            <span className="text-sm text-gray-400">/seat/month</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Min {plan.minSeats} seats =&nbsp;
            <span className="font-bold text-gray-700">
              ₹{minMonthly.toLocaleString("en-IN")}/month min
            </span>
          </p>
          {isYearly && yearlySavings > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-400">
                ₹{yearlyTotal.toLocaleString("en-IN")}/year
              </span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: plan.accentColor }}
              >
                Save ₹{yearlySavings.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>

        {/* CRM Badge */}
        <div
          className={`mb-4 flex items-center justify-between rounded-xl px-3 py-2.5 ${
            plan.crmPrice === "free"
              ? "bg-emerald-50 border border-emerald-100"
              : "bg-blue-50 border border-blue-100"
          }`}
        >
          <span className="text-xs font-semibold text-gray-600">Business CRM</span>
          {plan.crmPrice === "free" ? (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> FREE INCLUDED
            </span>
          ) : (
            <span className="text-xs font-bold text-blue-700">
              ₹{plan.crmPrice}/month add-on
            </span>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-2.5 flex-1 mb-6">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${plan.accentColor}20` }}
              >
                <Check className="w-2.5 h-2.5" style={{ color: plan.accentColor }} />
              </span>
              <span className="text-sm text-gray-700">{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <motion.a
          href="mailto:business@aorane.in?subject=Demo Request"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-2xl text-sm font-bold text-center transition-all flex items-center justify-center gap-2"
          style={
            highlight
              ? { background: plan.accentColor, color: "#fff" }
              : { border: `2px solid ${plan.accentColor}50`, color: plan.accentColor }
          }
        >
          Book a Demo
          <ChevronRight className="w-4 h-4" />
        </motion.a>
      </div>
    </motion.div>
  );
}

// ── Install Modal ─────────────────────────────────────────────────────────────
function InstallModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-[#0747A6]/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">📲</span>
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 mb-2">Download AORANE</h3>
        <p className="text-sm text-gray-500 mb-6">
          Available on Android. iOS coming soon.
        </p>
        <a
          href="https://play.google.com/store/apps/details?id=com.aorane.app"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#0747A6] flex items-center justify-center gap-2 hover:bg-[#0a3d8a] transition-colors"
        >
          Get it on Google Play
          <ArrowRight className="w-4 h-4" />
        </a>
        <button
          onClick={onClose}
          className="mt-3 w-full py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </motion.div>
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
  useSiteSettings();

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
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    tab === "individual" ? "bg-[#0747A6] text-white shadow" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Individual & Family
                </button>
                <button
                  onClick={() => setTab("business")}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    tab === "business" ? "bg-[#0747A6] text-white shadow" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  For Business
                </button>
              </div>
            )}

            {/* Monthly/Yearly toggle */}
            <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-2 border border-gray-200 shadow-sm">
              <span className={`text-sm font-semibold ${!isYearly ? "text-[#0747A6]" : "text-gray-400"}`}>
                Monthly
              </span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isYearly ? "bg-[#0747A6]" : "bg-gray-200"}`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    isYearly ? "translate-x-5" : "translate-x-0"
                  }`}
                />
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
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              {individualPlans.map((plan) => (
                <IndividualCard
                  key={plan.planKey}
                  plan={plan}
                  isYearly={isYearly}
                  highlight={plan.planKey === "max"}
                  onInstall={() => setInstallOpen(true)}
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
              {/* Business portal link */}
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
                      <p className="text-xs text-gray-500 mt-0.5">
                        Seat management, team analytics & CRM on business.aorane.com
                      </p>
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

              {/* 3-column business plans grid */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {businessPlans.map((plan) => (
                  <BusinessCard
                    key={plan.planKey}
                    plan={plan}
                    highlight={plan.planKey === "org_pro"}
                    isYearly={isYearly}
                  />
                ))}
              </div>

              <div className="mt-8 text-center space-y-1">
                <p className="text-sm text-gray-500">
                  Business pricing is per seat per month. Minimum seats apply.
                </p>
                <p className="text-sm text-gray-500">
                  GST @18% extra on all paid plans. Contact us for bulk pricing.
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

      {/* Install Modal */}
      <AnimatePresence>
        {installOpen && <InstallModal onClose={() => setInstallOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}
