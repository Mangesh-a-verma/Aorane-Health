import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { api, type OrgPlan } from "@/lib/api";
import { CreditCard, CheckCircle, Zap, Building2, Crown, AlertCircle, RefreshCw } from "lucide-react";

declare global {
  interface Window { Razorpay: new (opts: Record<string, unknown>) => { open(): void }; }
}

const PLAN_ICONS: Record<string, React.ElementType> = { starter: Zap, growth: Building2, enterprise: Crown };
const PLAN_FEATURES: Record<string, string[]> = {
  starter:    ["50 member seats", "Member health dashboard", "AORANE ID search", "Enrollment code management", "Basic analytics"],
  growth:     ["200 member seats", "Everything in Starter", "Advanced health analytics", "Team announcements & comms", "Member detail & health trends", "Priority support"],
  enterprise: ["500 member seats", "Everything in Growth", "Custom enrollment codes", "Data export (CSV)", "Dedicated account manager", "White-label reports"],
};

export default function Billing() {
  const { org, setOrg } = useAuth();
  const [plans, setPlans] = useState<Record<string, OrgPlan>>({});
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [subscription, setSubscription] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api.getBillingSubscription()
      .then((d) => { setPlans(d.plans); setSubscription(d.payment); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handlePay = async (planKey: string) => {
    setPaying(planKey);
    setError("");
    try {
      const order = await api.createBillingOrder(planKey, billing);
      if (order.isTestMode || !order.razorpayOrderId) {
        const result = await api.verifyBillingPayment({ paymentId: order.paymentId, plan: planKey, isTestMode: true });
        if (result.org) setOrg?.(result.org);
        setSuccess(result.message || "Plan activated!");
        setSubscription({ plan: planKey, status: "success" });
      } else {
        const ok = await loadRazorpay();
        if (!ok) { setError("Payment gateway failed to load. Please try again."); return; }
        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: order.razorpayKeyId, amount: order.amount * 100, currency: "INR",
            name: "AORANE Business", description: `${order.planLabel} Plan — ${order.seats} seats`,
            order_id: order.razorpayOrderId,
            handler: async (resp: Record<string, string>) => {
              try {
                const result = await api.verifyBillingPayment({
                  paymentId: order.paymentId,
                  razorpayOrderId: resp.razorpay_order_id,
                  razorpayPaymentId: resp.razorpay_payment_id,
                  razorpaySignature: resp.razorpay_signature,
                  plan: planKey,
                });
                if (result.org) setOrg?.(result.org);
                setSuccess(result.message || "Plan activated!");
                setSubscription({ plan: planKey, status: "success" });
                resolve();
              } catch (e) { reject(e); }
            },
            prefill: { email: org?.contactEmail, contact: org?.contactPhone },
            theme: { color: "#0077B6" },
          });
          rzp.open();
        });
      }
    } catch (e) {
      setError((e as Error).message || "Payment failed");
    } finally { setPaying(null); }
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </Layout>
  );

  const currentPlan = org?.plan || "basic";
  const isVerified = org?.isVerified;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your organization plan and seat allocation</p>
        </div>

        {success && (
          <div className="mb-6 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <CheckCircle size={20} className="text-emerald-500 shrink-0" />
            <p className="text-emerald-400 text-sm font-medium">{success}</p>
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <AlertCircle size={20} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Current status */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <CreditCard size={20} className="text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Current Plan</div>
                <div className="text-xs text-muted-foreground capitalize">{currentPlan === "basic" ? "Free (Basic)" : currentPlan} · {org?.totalSeats} seats · {org?.usedSeats} used</div>
              </div>
            </div>
            {isVerified ? (
              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full font-medium">✓ Active</span>
            ) : (
              <span className="text-xs bg-yellow-500/15 text-yellow-400 px-3 py-1 rounded-full font-medium">⚠ Unverified — Upgrade to activate</span>
            )}
          </div>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className={`text-sm font-medium ${billing === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
          <button onClick={() => setBilling(b => b === "monthly" ? "yearly" : "monthly")}
            className={`relative w-12 h-6 rounded-full transition-colors ${billing === "yearly" ? "bg-primary" : "bg-muted"}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${billing === "yearly" ? "left-7" : "left-1"}`} />
          </button>
          <span className={`text-sm font-medium ${billing === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
            Yearly <span className="text-emerald-400 text-xs font-medium">Save 17%</span>
          </span>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {Object.entries(plans).map(([key, plan]) => {
            const Icon = PLAN_ICONS[key] || Zap;
            const features = PLAN_FEATURES[key] || [];
            const amount = billing === "yearly" ? plan.priceYearly : plan.price;
            const isCurrentPlan = subscription && (subscription.plan as string) === key;
            const isPaying = paying === key;
            return (
              <div key={key} className={`relative bg-card border rounded-2xl p-6 flex flex-col transition-all ${isCurrentPlan ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : key === "growth" ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
                {key === "growth" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">Current Plan</div>
                )}
                <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center" style={{ backgroundColor: plan.color + "20" }}>
                  <Icon size={20} style={{ color: plan.color }} />
                </div>
                <h3 className="text-lg font-bold text-foreground">{plan.label}</h3>
                <div className="mt-2 mb-1">
                  <span className="text-3xl font-bold text-foreground">₹{amount.toLocaleString("en-IN")}</span>
                  <span className="text-muted-foreground text-sm">/{billing === "yearly" ? "yr" : "mo"}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.seats} member seats</p>
                <ul className="flex-1 space-y-2 mb-5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePay(key)}
                  disabled={isPaying || !!isCurrentPlan}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${isCurrentPlan ? "bg-emerald-500/10 text-emerald-400 cursor-default" : "text-white hover:opacity-90 active:scale-95"}`}
                  style={isCurrentPlan ? {} : { backgroundColor: plan.color }}
                >
                  {isPaying ? <RefreshCw size={15} className="animate-spin" /> : isCurrentPlan ? "✓ Active" : `Upgrade to ${plan.label}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Note about Razorpay Key */}
        {!Object.values(plans).length && (
          <p className="text-center text-muted-foreground text-sm">Loading plans...</p>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Secure payments via Razorpay · GST applicable · Cancel anytime
        </p>
      </div>
    </Layout>
  );
}
