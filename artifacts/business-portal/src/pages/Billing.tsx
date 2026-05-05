import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  CreditCard, CheckCircle, AlertCircle, RefreshCw, FileText,
  Users, Calendar, IndianRupee, Info, ChevronDown, ChevronUp,
  RotateCcw, XCircle, CalendarClock
} from "lucide-react";

declare global {
  interface Window { Razorpay: new (opts: Record<string, unknown>) => { open(): void }; }
}

interface SeatPlanInfo {
  label: string;
  pricePerSeat: number;
  yearlyPricePerSeat: number;
  color: string;
  features: string[];
  discountPercent: number;
  offerLabel: string | null;
}

const FALLBACK_SEAT_PLANS: Record<string, SeatPlanInfo> = {
  max: { label: "Max", pricePerSeat: 199, yearlyPricePerSeat: 169, color: "#0077B6", features: ["Basic aggregate health dashboard", "Enrollment code management", "Employee search", "GST-ready invoice", "Email support"], discountPercent: 0, offerLabel: null },
  pro: { label: "Pro", pricePerSeat: 249, yearlyPricePerSeat: 211, color: "#7C3AED", features: ["Everything in Max", "Advanced health analytics & charts", "Health risk distribution alerts", "Weekly & monthly team reports", "Priority support", "Custom announcements to employees"], discountPercent: 0, offerLabel: null },
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Chandigarh", "Puducherry",
];

const AORANE_STATE = "Uttar Pradesh";
const GST_RATE = 0.18;

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

interface GSTBreakdown {
  baseAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  isSameState: boolean;
}

function calcGST(baseAmount: number, orgState: string): GSTBreakdown {
  const isSameState = orgState === AORANE_STATE;
  const gstAmount = Math.round(baseAmount * GST_RATE);
  const cgstAmount = isSameState ? Math.round(gstAmount / 2) : 0;
  const sgstAmount = isSameState ? Math.round(gstAmount / 2) : 0;
  const igstAmount = isSameState ? 0 : gstAmount;
  return { baseAmount, gstAmount, cgstAmount, sgstAmount, igstAmount, totalAmount: baseAmount + gstAmount, isSameState };
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  payment_type?: string;
  auto_renew?: boolean;
  next_renewal_at?: string;
  expires_at?: string;
}

export default function Billing() {
  const { org, setOrg } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"max" | "pro">("max");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [seatCount, setSeatCount] = useState(10);
  const [orgState, setOrgState] = useState(org?.state || "");
  const [orgGstin, setOrgGstin] = useState(org?.gstin || "");
  const [showInvoice, setShowInvoice] = useState(false);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [seatPlans, setSeatPlans] = useState<Record<string, SeatPlanInfo>>(FALLBACK_SEAT_PLANS);

  useEffect(() => {
    api.getSeatPlans()
      .then((d) => {
        if (d.plans && Object.keys(d.plans).length > 0) {
          setSeatPlans(d.plans as Record<string, SeatPlanInfo>);
        }
      })
      .catch(() => {});
    api.getBillingSubscription()
      .then((d) => {
        if (d.payment) {
          setSubscription({
            plan: d.payment.plan,
            status: d.payment.status,
            payment_type: d.payment.paymentType || d.payment.payment_type,
            auto_renew: d.payment.autoRenew ?? d.payment.auto_renew,
            next_renewal_at: d.payment.nextRenewalAt || d.payment.next_renewal_at,
            expires_at: d.payment.expiresAt || d.payment.expires_at,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoadingSubscription(false));
  }, []);

  const planInfo = seatPlans[selectedPlan] ?? FALLBACK_SEAT_PLANS[selectedPlan];
  const pricePerSeat = billing === "yearly" ? planInfo.yearlyPricePerSeat : planInfo.pricePerSeat;
  const months = billing === "yearly" ? 12 : 1;
  const baseAmount = pricePerSeat * Math.max(10, seatCount) * months;
  const gst = calcGST(baseAmount, orgState || "Delhi");
  const yearlyFY = (() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  })();

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handlePay = async () => {
    if (seatCount < 10) { setError("Minimum 10 seats required"); return; }
    setPaying(true);
    setError("");
    setSuccess("");
    try {
      const order = await api.createSeatOrder(selectedPlan, seatCount, billing, orgGstin, orgState);

      if (order.isTestMode) {
        // Test mode: skip Razorpay checkout, verify directly
        const result = await api.verifySeatPayment({
          paymentId: order.paymentId,
          razorpayPaymentId: "test_" + Date.now(),
          razorpayOrderId: order.razorpayOrderId || "test_order",
          razorpaySignature: "test_sig",
          seats: seatCount,
          plan: selectedPlan,
          billingCycle: billing,
          isTestMode: true,
        });
        if (result.org) setOrg?.(result.org);
        setSuccess((result.message || `${seatCount} seats activated!`) + " [Test Mode]");
        setSubscription({ plan: selectedPlan, status: "success", payment_type: "one_time", expires_at: result.expiresAt });
        return;
      }

      if (!order.razorpayKeyId) {
        setError("Payment gateway not ready. Please contact support.");
        return;
      }

      const ok = await loadRazorpay();
      if (!ok) { setError("Razorpay checkout failed to load. Check your internet connection and try again."); return; }
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.razorpayKeyId,
          amount: order.totalAmount * 100,
          currency: "INR",
          order_id: order.razorpayOrderId,
          name: "Aorane Business",
          description: `${planInfo.label} Plan — ${seatCount} seats (${billing})`,
          handler: async (resp: Record<string, string>) => {
            try {
              const result = await api.verifySeatPayment({
                paymentId: order.paymentId,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpayOrderId: resp.razorpay_order_id,
                razorpaySignature: resp.razorpay_signature,
                seats: seatCount,
                plan: selectedPlan,
                billingCycle: billing,
              });
              if (result.org) setOrg?.(result.org);
              setSuccess(result.message || `${seatCount} seats activated!`);
              setSubscription({ plan: selectedPlan, status: "success", payment_type: "one_time", expires_at: result.expiresAt });
              resolve();
            } catch (e) { reject(e); }
          },
          prefill: { email: org?.contactEmail, contact: org?.contactPhone },
          theme: { color: "#0077B6" },
          modal: { ondismiss: () => resolve() },
        });
        rzp.open();
      });
    } catch (e) {
      setError((e as Error).message || "Payment failed. Please try again.");
    } finally { setPaying(false); }
  };

  const handleCancelAutoRenew = async () => {
    setCancelling(true);
    try {
      const result = await api.cancelBillingSubscription();
      setSuccess(result.message || "Auto-renew cancelled.");
      setSubscription((s) => s ? { ...s, auto_renew: false } : s);
    } catch (e) {
      setError((e as Error).message || "Failed to cancel");
    } finally { setCancelling(false); }
  };

  const currentPlan = org?.plan || "basic";
  const isActive = org?.isVerified && subscription?.status === "success";
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="pill-chip bg-primary/10 text-primary uppercase">
              <CreditCard size={11} /> Subscription
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">Billing &amp; Plans</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Seat-based pricing — pay only for what you need.</p>
        </div>

        {success && (
          <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4">
            <CheckCircle size={18} className="shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}
        {error && (
          <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Current Plan Status */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0077B6]/10 flex items-center justify-center">
                <CreditCard size={20} className="text-[#0077B6]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#0D1F33]">Current Plan</div>
                <div className="text-xs text-[#6B7280] capitalize">
                  {currentPlan === "basic" ? "Free (Basic)" : currentPlan} · {org?.totalSeats} seats · {org?.usedSeats} used
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isActive ? (
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-medium">✓ Active</span>
              ) : (
                <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-full font-medium">⚠ No Active Plan</span>
              )}
              {!loadingSubscription && subscription?.auto_renew && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                  <RotateCcw size={10} /> Auto-renew ON
                </span>
              )}
            </div>
          </div>
          {expiresAt && (
            <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <CalendarClock size={13} className="text-[#0077B6]" />
                {subscription?.auto_renew ? `Auto-renews on ${expiresAt}` : `Active until ${expiresAt}`}
              </div>
              {subscription?.auto_renew && (
                <button onClick={handleCancelAutoRenew} disabled={cancelling}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors">
                  {cancelling ? <RefreshCw size={12} className="animate-spin" /> : <XCircle size={12} />}
                  Cancel auto-renew
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="lg:col-span-2 space-y-5">

            {/* Step 1: Choose Plan */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-[#0077B6] text-white flex items-center justify-center text-xs font-bold">1</div>
                <h3 className="font-semibold text-[#0D1F33]">Choose Plan</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["max", "pro"] as const).map((key) => {
                  const plan = seatPlans[key] ?? FALLBACK_SEAT_PLANS[key];
                  const isSelected = selectedPlan === key;
                  const monthlySave = plan.pricePerSeat > 0 && plan.yearlyPricePerSeat > 0
                    ? Math.round((1 - plan.yearlyPricePerSeat / plan.pricePerSeat) * 100)
                    : 0;
                  return (
                    <button key={key} onClick={() => setSelectedPlan(key)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all ${isSelected ? "border-[#0077B6] bg-[#0077B6]/5" : "border-[#E5E7EB] hover:border-[#0077B6]/40"}`}>
                      {plan.offerLabel && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{plan.offerLabel}</div>
                      )}
                      {!plan.offerLabel && key === "pro" && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#7C3AED] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Popular</div>
                      )}
                      <div className="font-bold text-[#0D1F33] mb-1">{plan.label}</div>
                      <div className="text-xl font-bold" style={{ color: plan.color }}>
                        {formatINR(billing === "yearly" ? plan.yearlyPricePerSeat : plan.pricePerSeat)}
                        <span className="text-xs font-normal text-[#6B7280]">/seat/mo</span>
                      </div>
                      {plan.discountPercent > 0 && (
                        <div className="text-[10px] text-emerald-600 font-medium mt-0.5">{plan.discountPercent}% off applied</div>
                      )}
                      {billing === "yearly" && monthlySave > 0 && (
                        <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Save {monthlySave}% yearly</div>
                      )}
                      <ul className="mt-3 space-y-1.5">
                        {plan.features.slice(0, 3).map(f => (
                          <li key={f} className="flex items-start gap-1.5 text-[11px] text-[#6B7280]">
                            <CheckCircle size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              {/* Full features comparison */}
              <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                <p className="text-xs font-medium text-[#374151] mb-2">{planInfo.label} plan includes:</p>
                <div className="grid grid-cols-2 gap-1">
                  {planInfo.features.map(f => (
                    <div key={f} className="flex items-start gap-1.5 text-xs text-[#6B7280]">
                      <CheckCircle size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Seats & Billing Cycle */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-[#0077B6] text-white flex items-center justify-center text-xs font-bold">2</div>
                <h3 className="font-semibold text-[#0D1F33]">Seats & Billing Cycle</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">
                    Number of Seats <span className="text-[#9CA3AF] font-normal">(min 10)</span>
                  </label>
                  <div className="flex items-center border border-[#E5E7EB] rounded-xl overflow-hidden bg-white">
                    <button onClick={() => setSeatCount(c => Math.max(10, c - 10))}
                      className="px-4 py-3 text-[#0077B6] font-bold text-lg hover:bg-[#F3F4F6] transition-colors">−</button>
                    <input
                      type="number"
                      value={seatCount}
                      min={10}
                      step={5}
                      onChange={e => setSeatCount(Math.max(10, parseInt(e.target.value) || 10))}
                      className="flex-1 text-center py-3 font-bold text-[#0D1F33] focus:outline-none text-lg"
                    />
                    <button onClick={() => setSeatCount(c => c + 10)}
                      className="px-4 py-3 text-[#0077B6] font-bold text-lg hover:bg-[#F3F4F6] transition-colors">+</button>
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-1 flex items-center gap-1">
                    <Users size={11} /> {org?.usedSeats} currently enrolled
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Billing Cycle</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["monthly", "yearly"] as const).map(b => (
                      <button key={b} onClick={() => setBilling(b)}
                        className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${billing === b ? "border-[#0077B6] bg-[#0077B6]/5 text-[#0077B6]" : "border-[#E5E7EB] text-[#6B7280]"}`}>
                        {b === "monthly" ? "Monthly" : <>Yearly {seatPlans[selectedPlan]?.yearlyPricePerSeat > 0 && seatPlans[selectedPlan]?.pricePerSeat > 0 ? <span className="text-[10px] text-emerald-600 font-bold block">Save {Math.round((1 - seatPlans[selectedPlan].yearlyPricePerSeat / seatPlans[selectedPlan].pricePerSeat) * 100)}%</span> : ""}</>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: GST Details */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-[#0077B6] text-white flex items-center justify-center text-xs font-bold">3</div>
                <h3 className="font-semibold text-[#0D1F33]">GST Details</h3>
                <span className="text-xs text-[#9CA3AF]">(For invoice — optional)</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Your State</label>
                  <select value={orgState} onChange={e => setOrgState(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#0D1F33] text-sm focus:outline-none focus:border-[#0077B6] focus:ring-2 focus:ring-[#0077B6]/20 transition-all">
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {orgState && (
                    <p className="text-[11px] mt-1 text-[#6B7280]">
                      {orgState === AORANE_STATE
                        ? "Same state as Aorane → CGST + SGST (9% + 9%)"
                        : "Different state → IGST (18%)"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">GSTIN <span className="text-[#9CA3AF] font-normal">(optional)</span></label>
                  <input type="text" value={orgGstin} onChange={e => setOrgGstin(e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#0D1F33] text-sm font-mono focus:outline-none focus:border-[#0077B6] focus:ring-2 focus:ring-[#0077B6]/20 transition-all" />
                  <p className="text-[11px] mt-1 text-[#9CA3AF]">For B2B GST invoice</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="space-y-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 sticky top-6">
              <h3 className="font-bold text-[#0D1F33] mb-4">Order Summary</h3>

              <div className="space-y-2.5 text-sm mb-4">
                <div className="flex justify-between text-[#374151]">
                  <span>Plan</span>
                  <span className="font-semibold">{planInfo.label} {billing === "yearly" ? "(Yearly)" : "(Monthly)"}</span>
                </div>
                <div className="flex justify-between text-[#374151]">
                  <span>Seats</span>
                  <span className="font-semibold">{seatCount}</span>
                </div>
                <div className="flex justify-between text-[#374151]">
                  <span>Price/seat{billing === "yearly" ? "/mo" : ""}</span>
                  <span className="font-semibold">{formatINR(pricePerSeat)}</span>
                </div>
                {billing === "yearly" && (
                  <div className="flex justify-between text-[#374151]">
                    <span>Months</span>
                    <span className="font-semibold">12</span>
                  </div>
                )}
                <div className="border-t border-[#F3F4F6] pt-2.5">
                  <div className="flex justify-between text-[#374151]">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatINR(gst.baseAmount)}</span>
                  </div>

                  {/* GST breakdown toggle */}
                  <button onClick={() => setShowInvoice(!showInvoice)}
                    className="flex items-center gap-1 text-xs text-[#0077B6] mt-2 hover:underline">
                    <FileText size={11} /> GST Breakdown
                    {showInvoice ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {showInvoice && (
                    <div className="mt-2 bg-[#F8FAFC] rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="text-[#6B7280] font-medium mb-2">
                        Invoice No: AOR/{yearlyFY}/XXXX
                        <div className="text-[10px] text-[#9CA3AF] mt-0.5">HSN: 998313</div>
                      </div>
                      {gst.isSameState ? (
                        <>
                          <div className="flex justify-between text-[#374151]"><span>CGST (9%)</span><span>{formatINR(gst.cgstAmount)}</span></div>
                          <div className="flex justify-between text-[#374151]"><span>SGST (9%)</span><span>{formatINR(gst.sgstAmount)}</span></div>
                        </>
                      ) : (
                        <div className="flex justify-between text-[#374151]"><span>IGST (18%)</span><span>{formatINR(gst.igstAmount)}</span></div>
                      )}
                      {!orgState && (
                        <p className="text-[#9CA3AF] text-[10px] flex items-center gap-1 mt-1">
                          <Info size={10} /> Select state to see GST type
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between mt-2">
                    <span className="text-[#374151]">GST (18%)</span>
                    <span className="font-semibold text-[#374151]">{formatINR(gst.gstAmount)}</span>
                  </div>
                </div>
                <div className="border-t border-[#E5E7EB] pt-2.5 flex justify-between">
                  <span className="font-bold text-[#0D1F33]">Total</span>
                  <span className="font-bold text-[#0077B6] text-lg">{formatINR(gst.totalAmount)}</span>
                </div>
                {billing === "yearly" && (
                  <div className="text-[11px] text-emerald-600 text-center bg-emerald-50 rounded-lg py-1.5">
                    You save {formatINR((SEAT_PLANS[selectedPlan].pricePerSeat - pricePerSeat) * seatCount * 12 || 0)} per year
                  </div>
                )}
              </div>

              <button
                onClick={handlePay}
                disabled={paying || seatCount < 10}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #0077B6, #005E8E)" }}
              >
                {paying ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                ) : (
                  <><IndianRupee size={15} /> Pay {formatINR(gst.totalAmount)}</>
                )}
              </button>

              <div className="mt-3 space-y-1.5 text-[11px] text-[#9CA3AF]">
                <div className="flex items-center gap-1.5"><Calendar size={11} />
                  Active for {billing === "yearly" ? "12 months" : "1 month"} from payment
                </div>
                <div className="flex items-center gap-1.5"><FileText size={11} />
                  GST invoice sent to {org?.contactEmail || "your email"}
                </div>
                <div className="flex items-center gap-1.5"><CheckCircle size={11} className="text-emerald-500" />
                  Enrollment code ready immediately
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#F3F4F6] text-center text-[11px] text-[#9CA3AF]">
                Secure payments via Razorpay · All amounts in INR · GST applicable
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
