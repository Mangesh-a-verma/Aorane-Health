import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  CreditCard, CheckCircle, AlertCircle, RefreshCw, FileText,
  Users, Calendar, IndianRupee, Info, ChevronDown, ChevronUp,
  RotateCcw, XCircle, CalendarClock, Receipt, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardShell, EmptyState, NeuCard, PageHeader } from "@/components/portal/primitives";
import { cn } from "@/lib/utils";

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
  max: { label: "Max", pricePerSeat: 249, yearlyPricePerSeat: 211, color: "#0077B6", features: ["Everything in Pro", "Advanced health analytics & charts", "Health risk distribution alerts", "Weekly & monthly team reports", "Priority support", "Custom announcements to employees"], discountPercent: 0, offerLabel: null },
  pro: { label: "Pro", pricePerSeat: 199, yearlyPricePerSeat: 169, color: "#7C3AED", features: ["Basic aggregate health dashboard", "Enrollment code management", "Employee search", "GST-ready invoice", "Email support"], discountPercent: 0, offerLabel: null },
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
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

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
    api.getInvoices()
      .then((d) => setInvoices(d.invoices || []))
      .catch(() => setInvoices([]))
      .finally(() => setInvoicesLoading(false));
  }, []);

  const planInfo = seatPlans[selectedPlan] ?? FALLBACK_SEAT_PLANS[selectedPlan];
  const minSeats = selectedPlan === "max" ? 20 : 10;

  useEffect(() => {
    setSeatCount(c => Math.max(minSeats, c));
  }, [selectedPlan, minSeats]);
  const pricePerSeat = billing === "yearly" ? planInfo.yearlyPricePerSeat : planInfo.pricePerSeat;
  const months = billing === "yearly" ? 12 : 1;
  const baseAmount = pricePerSeat * Math.max(minSeats, seatCount) * months;
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
    if (seatCount < minSeats) { setError(`Minimum ${minSeats} seats required for ${selectedPlan === "pro" ? "Pro" : "Max"} plan`); return; }
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

  const invoiceField = (inv: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) if (inv[k] != null) return inv[k];
    return undefined;
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="Account"
          title="Billing & Plans"
          description="Seat-based pricing — pay only for what you need."
          actions={<Badge variant="soft"><CreditCard size={11} /> Subscription</Badge>}
        />

        {success && (
          <NeuCard variant="flat" className="flex items-center gap-3 p-4 tone-mint">
            <CheckCircle size={18} className="shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </NeuCard>
        )}
        {error && (
          <NeuCard variant="flat" className="flex items-center gap-3 p-4 tone-danger">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-sm">{error}</p>
          </NeuCard>
        )}

        {/* Current Plan Status */}
        <CardShell>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl tone-primary">
                <CreditCard size={20} />
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground">Current Plan</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {currentPlan === "basic" ? "Free (Basic)" : currentPlan} · {org?.totalSeats} seats · {org?.usedSeats} used
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isActive ? <Badge variant="success">✓ Active</Badge> : <Badge variant="warning">⚠ No Active Plan</Badge>}
              {!loadingSubscription && subscription?.auto_renew && (
                <Badge variant="soft"><RotateCcw size={10} /> Auto-renew ON</Badge>
              )}
            </div>
          </div>
          {expiresAt && (
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock size={13} className="text-primary" />
                {subscription?.auto_renew ? `Auto-renews on ${expiresAt}` : `Active until ${expiresAt}`}
              </div>
              {subscription?.auto_renew && (
                <Button variant="ghost" size="sm" onClick={handleCancelAutoRenew} disabled={cancelling} className="text-destructive hover:text-destructive">
                  {cancelling ? <RefreshCw size={12} className="animate-spin" /> : <XCircle size={12} />}
                  Cancel auto-renew
                </Button>
              )}
            </div>
          )}
        </CardShell>

        <Tabs defaultValue="plans">
          <TabsList className="neu-inset h-auto flex-wrap gap-1 rounded-2xl p-1.5 bg-transparent">
            <TabsTrigger value="plans" className="rounded-xl px-4 py-2">Plans</TabsTrigger>
            <TabsTrigger value="checkout" className="rounded-xl px-4 py-2">Purchase Seats</TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-xl px-4 py-2">Invoices</TabsTrigger>
          </TabsList>

          {/* Plans */}
          <TabsContent value="plans" className="mt-6">
            <CardShell title="Choose Plan">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(["pro", "max"] as const).map((key) => {
                  const plan = seatPlans[key] ?? FALLBACK_SEAT_PLANS[key];
                  const isSelected = selectedPlan === key;
                  const monthlySave = plan.pricePerSeat > 0 && plan.yearlyPricePerSeat > 0
                    ? Math.round((1 - plan.yearlyPricePerSeat / plan.pricePerSeat) * 100)
                    : 0;
                  return (
                    <NeuCard
                      key={key}
                      variant={isSelected ? "raised" : "flat"}
                      className={cn("relative text-left p-5 cursor-pointer transition-all", isSelected && "ring-2 ring-primary/30")}
                      onClick={() => setSelectedPlan(key)}
                    >
                      {plan.offerLabel && <Badge variant="success" className="absolute -top-2.5 left-5">{plan.offerLabel}</Badge>}
                      {!plan.offerLabel && key === "pro" && <Badge variant="lavender" className="absolute -top-2.5 left-5">Popular</Badge>}
                      <div className="font-bold text-foreground mb-1">{plan.label}</div>
                      <div className="text-xl font-bold text-primary">
                        {formatINR(billing === "yearly" ? plan.yearlyPricePerSeat : plan.pricePerSeat)}
                        <span className="text-xs font-normal text-muted-foreground">/seat/mo</span>
                      </div>
                      {plan.discountPercent > 0 && (
                        <div className="text-[10px] text-[oklch(0.5_0.13_162)] font-medium mt-0.5">{plan.discountPercent}% off applied</div>
                      )}
                      {billing === "yearly" && monthlySave > 0 && (
                        <div className="text-[10px] text-[oklch(0.5_0.13_162)] font-medium mt-0.5">Save {monthlySave}% yearly</div>
                      )}
                      <ul className="mt-3 space-y-1.5">
                        {plan.features.slice(0, 3).map(f => (
                          <li key={f} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <CheckCircle size={10} className="text-[oklch(0.68_0.12_162)] mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </NeuCard>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-xs font-medium text-foreground mb-2">{planInfo.label} plan includes:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {planInfo.features.map(f => (
                    <div key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle size={11} className="text-[oklch(0.68_0.12_162)] mt-0.5 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </CardShell>
          </TabsContent>

          {/* Purchase Seats (real checkout flow) */}
          <TabsContent value="checkout" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <CardShell title="Seats & Billing Cycle">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Number of Seats <span className="text-muted-foreground font-normal">(min {minSeats})</span>
                      </label>
                      <div className="neu-inset flex items-center rounded-2xl overflow-hidden">
                        <button onClick={() => setSeatCount(c => Math.max(minSeats, c - 10))}
                          className="px-4 py-3 text-primary font-bold text-lg hover:bg-secondary/50 transition-colors">−</button>
                        <input
                          type="number"
                          value={seatCount}
                          min={minSeats}
                          step={5}
                          onChange={e => setSeatCount(Math.max(minSeats, parseInt(e.target.value) || minSeats))}
                          className="flex-1 text-center py-3 font-bold text-foreground bg-transparent focus:outline-none text-lg"
                        />
                        <button onClick={() => setSeatCount(c => c + 10)}
                          className="px-4 py-3 text-primary font-bold text-lg hover:bg-secondary/50 transition-colors">+</button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Users size={11} /> {org?.usedSeats} currently enrolled
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Billing Cycle</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["monthly", "yearly"] as const).map(b => (
                          <button key={b} onClick={() => setBilling(b)}
                            className={cn("py-3 rounded-2xl text-sm font-semibold transition-all", billing === b ? "neu text-primary" : "neu-flat text-muted-foreground")}>
                            {b === "monthly" ? "Monthly" : <>Yearly {seatPlans[selectedPlan]?.yearlyPricePerSeat > 0 && seatPlans[selectedPlan]?.pricePerSeat > 0 ? <span className="text-[10px] text-[oklch(0.5_0.13_162)] font-bold block">Save {Math.round((1 - seatPlans[selectedPlan].yearlyPricePerSeat / seatPlans[selectedPlan].pricePerSeat) * 100)}%</span> : ""}</>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardShell>

                <CardShell title="GST Details" description="For invoice — optional">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Your State</label>
                      <select value={orgState} onChange={e => setOrgState(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl neu-inset bg-transparent text-foreground text-sm focus:outline-none">
                        <option value="">Select state</option>
                        {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {orgState && (
                        <p className="text-[11px] mt-1 text-muted-foreground">
                          {orgState === AORANE_STATE
                            ? "Same state as Aorane → CGST + SGST (9% + 9%)"
                            : "Different state → IGST (18%)"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">GSTIN <span className="text-muted-foreground font-normal">(optional)</span></label>
                      <input type="text" value={orgGstin} onChange={e => setOrgGstin(e.target.value.toUpperCase())}
                        placeholder="22AAAAA0000A1Z5"
                        maxLength={15}
                        className="w-full px-3 py-2.5 rounded-xl neu-inset bg-transparent text-foreground text-sm font-mono-data focus:outline-none" />
                      <p className="text-[11px] mt-1 text-muted-foreground">For B2B GST invoice</p>
                    </div>
                  </div>
                </CardShell>
              </div>

              {/* Order Summary */}
              <div>
                <NeuCard className="p-5 sticky top-6">
                  <h3 className="font-bold text-foreground mb-4">Order Summary</h3>
                  <div className="space-y-2.5 text-sm mb-4">
                    <div className="flex justify-between text-foreground">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-semibold">{planInfo.label} {billing === "yearly" ? "(Yearly)" : "(Monthly)"}</span>
                    </div>
                    <div className="flex justify-between text-foreground">
                      <span className="text-muted-foreground">Seats</span>
                      <span className="font-semibold">{seatCount}</span>
                    </div>
                    <div className="flex justify-between text-foreground">
                      <span className="text-muted-foreground">Price/seat{billing === "yearly" ? "/mo" : ""}</span>
                      <span className="font-semibold">{formatINR(pricePerSeat)}</span>
                    </div>
                    {billing === "yearly" && (
                      <div className="flex justify-between text-foreground">
                        <span className="text-muted-foreground">Months</span>
                        <span className="font-semibold">12</span>
                      </div>
                    )}
                    <div className="border-t border-border/60 pt-2.5">
                      <div className="flex justify-between text-foreground">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold">{formatINR(gst.baseAmount)}</span>
                      </div>

                      <button onClick={() => setShowInvoice(!showInvoice)}
                        className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
                        <FileText size={11} /> GST Breakdown
                        {showInvoice ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      {showInvoice && (
                        <div className="mt-2 neu-inset rounded-xl p-3 space-y-1.5 text-xs">
                          <div className="text-muted-foreground font-medium mb-2">
                            Invoice No: AOR/{yearlyFY}/XXXX
                            <div className="text-[10px] text-muted-foreground/70 mt-0.5">HSN: 998313</div>
                          </div>
                          {gst.isSameState ? (
                            <>
                              <div className="flex justify-between"><span className="text-muted-foreground">CGST (9%)</span><span>{formatINR(gst.cgstAmount)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">SGST (9%)</span><span>{formatINR(gst.sgstAmount)}</span></div>
                            </>
                          ) : (
                            <div className="flex justify-between"><span className="text-muted-foreground">IGST (18%)</span><span>{formatINR(gst.igstAmount)}</span></div>
                          )}
                          {!orgState && (
                            <p className="text-muted-foreground text-[10px] flex items-center gap-1 mt-1">
                              <Info size={10} /> Select state to see GST type
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between mt-2">
                        <span className="text-muted-foreground">GST (18%)</span>
                        <span className="font-semibold text-foreground">{formatINR(gst.gstAmount)}</span>
                      </div>
                    </div>
                    <div className="border-t border-border/60 pt-2.5 flex justify-between">
                      <span className="font-bold text-foreground">Total</span>
                      <span className="font-bold text-primary text-lg">{formatINR(gst.totalAmount)}</span>
                    </div>
                    {billing === "yearly" && (
                      <div className="text-[11px] tone-mint text-center rounded-lg py-1.5">
                        You save {formatINR(((seatPlans[selectedPlan]?.pricePerSeat ?? FALLBACK_SEAT_PLANS[selectedPlan]?.pricePerSeat ?? 0) - pricePerSeat) * seatCount * 12 || 0)} per year
                      </div>
                    )}
                  </div>

                  <Button variant="brand" className="w-full" onClick={handlePay} disabled={paying || seatCount < 10}>
                    {paying ? (
                      <><RefreshCw size={15} className="animate-spin" /> Processing...</>
                    ) : (
                      <><IndianRupee size={15} /> Pay {formatINR(gst.totalAmount)}</>
                    )}
                  </Button>

                  <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Calendar size={11} />
                      Active for {billing === "yearly" ? "12 months" : "1 month"} from payment
                    </div>
                    <div className="flex items-center gap-1.5"><FileText size={11} />
                      GST invoice sent to {org?.contactEmail || "your email"}
                    </div>
                    <div className="flex items-center gap-1.5"><CheckCircle size={11} className="text-[oklch(0.68_0.12_162)]" />
                      Enrollment code ready immediately
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/60 text-center text-[11px] text-muted-foreground">
                    Secure payments via Razorpay · All amounts in INR · GST applicable
                  </div>
                </NeuCard>
              </div>
            </div>
          </TabsContent>

          {/* Invoices */}
          <TabsContent value="invoices" className="mt-6">
            <CardShell title="Invoice History" description="Your organization's GST invoices, generated on each successful payment.">
              {invoicesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw size={20} className="animate-spin text-primary" />
                </div>
              ) : invoices.length === 0 ? (
                <EmptyState icon={<Receipt />} title="No invoices yet" description="Invoices appear here after your first successful payment." />
              ) : (
                <div className="neu-inset overflow-x-auto rounded-2xl">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv, i) => {
                        const number = invoiceField(inv, "invoiceNumber", "invoice_number", "number") as string | undefined;
                        const date = invoiceField(inv, "createdAt", "created_at", "date") as string | undefined;
                        const amount = invoiceField(inv, "totalAmount", "total_amount", "amount") as number | undefined;
                        const status = invoiceField(inv, "status") as string | undefined;
                        const pdfUrl = invoiceField(inv, "pdfUrl", "pdf_url", "invoiceUrl") as string | undefined;
                        return (
                          <TableRow key={number || i}>
                            <TableCell className="font-medium">{number || `#${i + 1}`}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {date ? new Date(date).toLocaleDateString("en-IN") : "—"}
                            </TableCell>
                            <TableCell className="font-semibold">{amount != null ? formatINR(Number(amount)) : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={status === "paid" || status === "success" ? "success" : "outline"}>{status || "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {pdfUrl ? (
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={pdfUrl} target="_blank" rel="noreferrer"><Download size={13} /> PDF</a>
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardShell>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
