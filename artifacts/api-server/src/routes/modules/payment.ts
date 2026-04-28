import { Router } from "express";
import { db, usersTable, subscriptionsTable, paymentsTable, promoCodesTable, planPricingTable, familyGroupsTable, familyMembersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import {
  isLiveMode, createPlan, createSubscription, cancelSubscription,
  verifySubscriptionSignature, verifyPaymentSignature, createOrder,
} from "../../lib/razorpay";

function generateFamilyCode() {
  return "FAM" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function autoCreateFamilyGroup(userId: string): Promise<string | null> {
  try {
    const existing = await db.select().from(familyMembersTable).where(eq(familyMembersTable.userId, userId));
    if (existing.length) {
      const [grp] = await db.select().from(familyGroupsTable).where(eq(familyGroupsTable.id, existing[0].groupId));
      return grp?.inviteCode ?? null;
    }
    const inviteCode = generateFamilyCode();
    const [group] = await db.insert(familyGroupsTable).values({ ownerId: userId, inviteCode, maxMembers: 4 }).returning();
    await db.insert(familyMembersTable).values({ groupId: group.id, userId, role: "owner" });
    return inviteCode;
  } catch { return null; }
}

const router = Router();

async function getPlanFromDB(planKey: string) {
  const [plan] = await db.select().from(planPricingTable).where(eq(planPricingTable.planKey, planKey));
  return plan;
}

// ─── GET: Razorpay connectivity test (admin debug only) ──────────────────────
router.get("/payment/razorpay-test", async (_req, res) => {
  const keyId = process.env["RAZORPAY_KEY_ID"] || null;
  const secret = process.env["RAZORPAY_KEY_SECRET"] || null;

  if (!keyId || !secret) {
    res.json({ ok: false, reason: "Keys not configured in environment", keyId: null });
    return;
  }

  const mode = keyId.startsWith("rzp_live_") ? "LIVE" : keyId.startsWith("rzp_test_") ? "TEST" : "UNKNOWN";
  const maskedKey = keyId.substring(0, 12) + "..." + keyId.slice(-4);

  try {
    const auth = `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;
    const r = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      headers: { Authorization: auth, "Content-Type": "application/json" },
    });
    const body = await r.json() as Record<string, unknown>;
    if (r.ok) {
      res.json({ ok: true, mode, maskedKey, status: r.status, message: "Razorpay auth successful ✅" });
    } else {
      res.json({ ok: false, mode, maskedKey, status: r.status, razorpayError: (body as { error?: { description?: string } }).error?.description || JSON.stringify(body) });
    }
  } catch (e) {
    res.json({ ok: false, mode, maskedKey, networkError: (e as Error).message });
  }
});

// ─── GET: current subscription status ────────────────────────────────────────
router.get("/payment/subscription", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [sub] = await db.select().from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, req.userId!), eq(subscriptionsTable.status, "active")))
      .orderBy(desc(subscriptionsTable.createdAt)).limit(1);
    const [user] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, req.userId!));
    res.json({ subscription: sub || null, plan: user?.plan || "free" });
  } catch {
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// ─── POST: validate promo code ────────────────────────────────────────────────
router.post("/payment/promo/validate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code, plan } = req.body as { code: string; plan: string };
    if (!code) { res.status(400).json({ error: "Code required" }); return; }
    const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, code.toUpperCase()));
    if (!promo) { res.status(404).json({ error: "Invalid promo code" }); return; }
    if (!promo.isActive) { res.status(400).json({ error: "This promo code is no longer active" }); return; }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      res.status(400).json({ error: "This promo code has expired" }); return;
    }
    if (promo.applicablePlans && !promo.applicablePlans.includes(plan)) {
      res.status(400).json({ error: `This code is only valid for: ${promo.applicablePlans.join(", ")}` }); return;
    }
    res.json({ valid: true, discount: promo.discountPct, code: promo.code, message: `${promo.discountPct}% discount applied!` });
  } catch {
    res.status(500).json({ error: "Failed to validate promo code" });
  }
});

// ─── POST: one-time payment order ─────────────────────────────────────────────
router.post("/payment/order", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { plan, promoCode } = req.body as { plan: string; promoCode?: string };
    const planData = await getPlanFromDB(plan);
    if (!planData || !["individual", "family"].includes(planData.type) || planData.planKey === "free" || Number(planData.monthlyPrice) <= 0) {
      res.status(400).json({ error: "Invalid plan" }); return;
    }
    let discount = 0;
    let promoUsed: string | null = null;
    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, promoCode.toUpperCase()));
      if (promo && promo.isActive && (!promo.expiresAt || new Date(promo.expiresAt) > new Date())) {
        discount = promo.discountPct;
        promoUsed = promo.code;
      }
    }
    const baseAmount = Number(planData.monthlyPrice);
    const finalAmount = Math.round(baseAmount * (1 - discount / 100));
    if (!isLiveMode()) {
      res.status(503).json({ error: "Payment gateway not configured. Please contact support." }); return;
    }
    let razorpayOrderId: string | null = null;
    try {
      const order = await createOrder({ amount: finalAmount, receipt: `usr_${req.userId!.substring(0, 8)}` });
      razorpayOrderId = order.id;
    } catch (err) {
      res.status(502).json({ error: `Payment gateway error: ${err instanceof Error ? err.message : "Razorpay error"}` });
      return;
    }
    const [payment] = await db.insert(paymentsTable).values({
      userId: req.userId!, amount: finalAmount.toString(), currency: "INR",
      plan, seats: 1, razorpayOrderId, status: "pending",
    }).returning();
    res.json({
      success: true, paymentId: payment.id, razorpayOrderId,
      razorpayKeyId: process.env["RAZORPAY_KEY_ID"] || null,
      amount: finalAmount, plan, discount, promoUsed,
      planLabel: planData.displayName,
      isTestMode: false,
    });
  } catch {
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

// ─── POST: verify one-time payment ───────────────────────────────────────────
router.post("/payment/verify", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature, plan } = req.body as Record<string, unknown>;
    // ALWAYS verify signature in LIVE mode — no bypass allowed
    if (isLiveMode()) {
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        res.status(400).json({ error: "Payment details missing" }); return;
      }
      const valid = verifyPaymentSignature(razorpayOrderId as string, razorpayPaymentId as string, razorpaySignature as string);
      if (!valid) { res.status(400).json({ error: "Payment signature invalid — payment not verified" }); return; }
    }
    // Ensure payment belongs to this user and is still pending
    const [existingPayment] = await db.select().from(paymentsTable)
      .where(and(eq(paymentsTable.id, paymentId as string), eq(paymentsTable.userId, req.userId!)));
    if (!existingPayment) { res.status(404).json({ error: "Payment not found" }); return; }
    if (existingPayment.status === "success") {
      res.json({ success: true, message: "Payment already verified", alreadyDone: true }); return;
    }
    await db.update(paymentsTable).set({ status: "success", razorpayPaymentId: razorpayPaymentId as string }).where(eq(paymentsTable.id, paymentId as string));
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await db.insert(subscriptionsTable).values({
      userId: req.userId!, plan: plan as string, status: "active",
      source: "razorpay", expiresAt, paymentType: "one_time", autoRenew: false, nextRenewalAt: expiresAt,
    }).onConflictDoNothing();
    await db.update(usersTable).set({ plan: plan as "free" | "pro" | "max" | "family" }).where(eq(usersTable.id, req.userId!));
    let inviteCode: string | null = null;
    if (plan === "family") inviteCode = await autoCreateFamilyGroup(req.userId!);
    res.json({ success: true, message: `${plan} plan activated successfully!`, expiresAt, inviteCode });
  } catch {
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// ─── POST: create auto-recurring subscription ─────────────────────────────────
router.post("/payment/subscription/create", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { plan, promoCode } = req.body as { plan: string; promoCode?: string };
    const planData = await getPlanFromDB(plan);
    if (!planData || !["individual", "family"].includes(planData.type) || planData.planKey === "free" || Number(planData.monthlyPrice) <= 0) {
      res.status(400).json({ error: "Invalid plan" }); return;
    }
    let discount = 0;
    let promoUsed: string | null = null;
    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, promoCode.toUpperCase()));
      if (promo && promo.isActive && (!promo.expiresAt || new Date(promo.expiresAt) > new Date())) {
        discount = promo.discountPct;
        promoUsed = promo.code;
      }
    }
    const baseAmount = Number(planData.monthlyPrice);
    const finalAmount = Math.round(baseAmount * (1 - discount / 100));

    if (!isLiveMode()) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const [sub] = await db.insert(subscriptionsTable).values({
        userId: req.userId!, plan, status: "active", source: "razorpay",
        expiresAt, paymentType: "recurring", autoRenew: true, nextRenewalAt: expiresAt,
      }).returning();
      await db.update(usersTable).set({ plan: plan as "free" | "pro" | "max" | "family" }).where(eq(usersTable.id, req.userId!));
      return res.json({
        isTestMode: true, subscriptionId: sub.id, plan, amount: finalAmount, promoUsed,
        expiresAt, nextRenewalAt: expiresAt,
        message: "Auto-renew subscription activated (test mode)",
      });
    }

    const rzPlan = await createPlan({ name: `Aorane ${planData.displayName} Monthly`, amount: finalAmount, period: "monthly" });
    const rzSub = await createSubscription({ planId: rzPlan.id, totalCount: 120, notes: { userId: req.userId!, plan } });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const [sub] = await db.insert(subscriptionsTable).values({
      userId: req.userId!, plan, status: "pending", source: "razorpay",
      expiresAt, paymentType: "recurring", autoRenew: true,
      nextRenewalAt: expiresAt, razorpaySubscriptionId: rzSub.id,
    }).returning();

    return res.json({
      isTestMode: false, razorpaySubscriptionId: rzSub.id,
      razorpayKeyId: process.env["RAZORPAY_KEY_ID"],
      subscriptionId: sub.id, plan, amount: finalAmount, discount, promoUsed,
      planLabel: planData.displayName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create subscription";
    return res.status(500).json({ error: msg });
  }
});

// ─── POST: verify subscription first payment ──────────────────────────────────
router.post("/payment/subscription/verify", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { subscriptionId, razorpaySubscriptionId, razorpayPaymentId, razorpaySignature, plan } = req.body as Record<string, string>;
    if (isLiveMode()) {
      const valid = verifySubscriptionSignature(razorpaySubscriptionId, razorpayPaymentId, razorpaySignature);
      if (!valid) { res.status(400).json({ error: "Payment signature invalid" }); return; }
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await db.update(subscriptionsTable).set({ status: "active", expiresAt, nextRenewalAt: expiresAt }).where(eq(subscriptionsTable.id, subscriptionId));
    await db.update(usersTable).set({ plan: plan as "free" | "pro" | "max" | "family" }).where(eq(usersTable.id, req.userId!));
    let inviteCode: string | null = null;
    if (plan === "family") inviteCode = await autoCreateFamilyGroup(req.userId!);
    res.json({ success: true, message: "Auto-renew subscription activated!", expiresAt, inviteCode });
  } catch {
    res.status(500).json({ error: "Failed to verify subscription" });
  }
});

// ─── DELETE: cancel auto-renew ────────────────────────────────────────────────
router.delete("/payment/subscription/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [sub] = await db.select().from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, req.userId!), eq(subscriptionsTable.status, "active")))
      .orderBy(desc(subscriptionsTable.createdAt)).limit(1);
    if (!sub) { res.status(404).json({ error: "No active subscription found" }); return; }
    if (isLiveMode() && sub.razorpaySubscriptionId) {
      await cancelSubscription(sub.razorpaySubscriptionId, true);
    }
    await db.update(subscriptionsTable).set({ autoRenew: false }).where(eq(subscriptionsTable.id, sub.id));
    res.json({ success: true, message: "Auto-renew cancelled. Plan stays active until expiry.", expiresAt: sub.expiresAt });
  } catch {
    res.status(500).json({ error: "Failed to cancel auto-renew" });
  }
});

// ─── GET: Check payment order status (for mobile polling after browser checkout)
router.get("/payment/order-status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.query as { orderId?: string };
    if (!orderId) { res.status(400).json({ error: "orderId required" }); return; }
    const [payment] = await db.select().from(paymentsTable)
      .where(and(eq(paymentsTable.razorpayOrderId, orderId), eq(paymentsTable.userId, req.userId!)));
    if (!payment) { res.status(404).json({ error: "Order not found" }); return; }
    res.json({ status: payment.status, plan: payment.plan, paymentId: payment.id, razorpayPaymentId: payment.razorpayPaymentId });
  } catch {
    res.status(500).json({ error: "Failed to fetch order status" });
  }
});

// ─── GET: Server-rendered Razorpay checkout page (for mobile browser) ────────
// Mobile app opens this URL in browser — loads checkout.js + opens payment modal
router.get("/payment/checkout/:orderId", async (req, res) => {
  const { orderId } = req.params as { orderId: string };
  try {
    const [payment] = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.razorpayOrderId, orderId));
    if (!payment || payment.status !== "pending") {
      res.status(404).setHeader("Content-Type", "text/html").send(
        `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
         <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#fff;">
         <div style="text-align:center;padding:40px;max-width:340px">
           <div style="font-size:56px;margin-bottom:16px">⚠️</div>
           <h2 style="color:#f87171;margin:0 0 8px">Order Not Found</h2>
           <p style="color:rgba(255,255,255,0.5);font-size:14px">This payment link is invalid or already used. Please go back to the app and try again.</p>
         </div></body></html>`
      );
      return;
    }
    const keyId = process.env["RAZORPAY_KEY_ID"] || "";
    const amountPaise = Math.round(Number(payment.amount) * 100);
    const serverBase = process.env["RENDER_EXTERNAL_URL"] || `https://aorane.onrender.com`;
    const callbackUrl = `${serverBase}/api/payment/rzp-callback`;
    const planLabel = (payment.plan || "Premium").replace(/^\w/, c => c.toUpperCase());

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <title>Aorane Payment</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0A1628;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif}
    .card{background:#0D2040;border:1px solid rgba(59,130,246,0.3);border-radius:24px;padding:40px 32px;text-align:center;max-width:340px;width:90%}
    h2{color:#fff;font-size:20px;margin-bottom:8px}
    p{color:rgba(255,255,255,0.55);font-size:14px;line-height:1.5}
    .loader{width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:#3B82F6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .retry-btn{margin-top:20px;padding:12px 24px;background:#3B82F6;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;width:100%}
  </style>
</head>
<body>
  <div class="card" id="loading-card">
    <div class="loader"></div>
    <h2>Aorane Payment</h2>
    <p>Secure checkout kholna...</p>
    <button class="retry-btn" id="open-btn" style="display:none" onclick="openRazorpay()">Payment Karo</button>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var rzpInstance = null;
    function openRazorpay() {
      if (rzpInstance) { rzpInstance.open(); return; }
      var options = {
        key: "${keyId}",
        order_id: "${orderId}",
        amount: ${amountPaise},
        currency: "INR",
        name: "Aorane Health",
        description: "${planLabel} Plan - 1 Month",
        image: "https://aorane.in/logo.png",
        redirect: true,
        callback_url: "${callbackUrl}",
        theme: { color: "#E8622A" },
        modal: {
          backdropclose: false,
          escape: false,
          ondismiss: function() {
            document.getElementById('loading-card').innerHTML =
              '<div style="font-size:48px;margin-bottom:16px">❌</div>' +
              '<h2 style="color:#f87171;margin:0 0 8px">Payment Cancelled</h2>' +
              '<p style="color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:16px">Aapne payment cancel ki. App mein wapas jaake dobara try karein.</p>' +
              '<button class="retry-btn" onclick="openRazorpay()">Dobara Try Karo</button>';
          }
        }
      };
      rzpInstance = new Razorpay(options);
      rzpInstance.open();
    }
    // Auto-open when page loads
    window.addEventListener('load', function() {
      setTimeout(openRazorpay, 500);
    });
    // Show retry button after 4 seconds in case auto-open fails
    setTimeout(function() {
      document.getElementById('open-btn').style.display = 'block';
    }, 4000);
  </script>
</body>
</html>`);
  } catch {
    res.status(500).setHeader("Content-Type", "text/html").send(
      `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
       <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#fff;font-family:sans-serif">
       <div style="text-align:center;padding:40px"><h2>Server Error</h2><p>Please go back to the app and try again.</p></div></body></html>`
    );
  }
});

// ─── GET/POST: Razorpay native mobile checkout callback ──────────────────────
// Razorpay embedded checkout redirects here after payment on native browser
router.post("/payment/rzp-callback", async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body as Record<string, string>;
  const isValid = razorpay_order_id && razorpay_payment_id && razorpay_signature
    ? verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
    : false;

  // Try to update payment record in DB
  if (isValid && razorpay_order_id) {
    try {
      await db.update(paymentsTable)
        .set({ status: "success", razorpayPaymentId: razorpay_payment_id })
        .where(eq(paymentsTable.razorpayOrderId, razorpay_order_id));
      // Activate user plan via payment record
      const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.razorpayOrderId, razorpay_order_id));
      if (payment?.userId && payment?.plan) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await db.insert(subscriptionsTable).values({
          userId: payment.userId, plan: payment.plan as "free" | "pro" | "max" | "family",
          status: "active", source: "razorpay", expiresAt, paymentType: "one_time",
          autoRenew: false, nextRenewalAt: expiresAt,
        }).onConflictDoNothing();
        await db.update(usersTable)
          .set({ plan: payment.plan as "free" | "pro" | "max" | "family" })
          .where(eq(usersTable.id, payment.userId));
        if (payment.plan === "family") await autoCreateFamilyGroup(payment.userId);
      }
    } catch { /* best effort */ }
  }

  // Return HTML page — user sees this in their browser before closing
  const html = isValid
    ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payment Successful</title></head>
       <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
       <div style="background:#0D2040;border-radius:24px;padding:40px 32px;text-align:center;max-width:340px;border:1px solid rgba(16,185,129,0.3)">
         <div style="font-size:64px;margin-bottom:16px">✅</div>
         <h2 style="color:#34d399;margin:0 0 8px">Payment Successful!</h2>
         <p style="color:rgba(255,255,255,0.6);margin:0 0 24px;font-size:14px">Your Aorane Premium plan is now active. Close this window and return to the app.</p>
         <div style="background:rgba(16,185,129,0.1);border-radius:12px;padding:12px;font-size:12px;color:rgba(255,255,255,0.4)">
           Payment ID: ${razorpay_payment_id}
         </div>
       </div></body></html>`
    : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payment Failed</title></head>
       <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
       <div style="background:#0D2040;border-radius:24px;padding:40px 32px;text-align:center;max-width:340px;border:1px solid rgba(239,68,68,0.3)">
         <div style="font-size:64px;margin-bottom:16px">❌</div>
         <h2 style="color:#f87171;margin:0 0 8px">Payment Cancelled</h2>
         <p style="color:rgba(255,255,255,0.6);margin:0 0 24px;font-size:14px">Payment was not completed. Close this window and try again from the app.</p>
       </div></body></html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// Also handle GET (Razorpay sometimes redirects with GET for cancel)
router.get("/payment/rzp-callback", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Aorane Pay</title></head>
    <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
    <div style="background:#0D2040;border-radius:24px;padding:40px 32px;text-align:center;max-width:340px">
      <div style="font-size:48px;margin-bottom:16px">💙</div>
      <h2 style="color:#94ccff;margin:0 0 8px">Return to Aorane App</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px">Close this window and check your plan status in the app.</p>
    </div></body></html>`);
});

// ─── GET: Server-rendered Razorpay Subscription checkout page (for mobile) ───
// Mobile app opens this URL in browser — loads checkout.js + opens subscription modal
router.get("/payment/subscription-checkout/:razorpaySubscriptionId", async (req, res) => {
  const { razorpaySubscriptionId } = req.params as { razorpaySubscriptionId: string };
  const { subscriptionId, plan } = req.query as { subscriptionId?: string; plan?: string };

  try {
    const keyId = process.env["RAZORPAY_KEY_ID"] || "";
    const serverBase = process.env["RENDER_EXTERNAL_URL"] || `https://aorane.onrender.com`;
    const callbackUrl = `${serverBase}/api/payment/subscription-rzp-callback`;
    const planLabel = (plan || "Premium").replace(/^\w/, c => c.toUpperCase());

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <title>Aorane Autopay Setup</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0A1628;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif}
    .card{background:#0D2040;border:1px solid rgba(232,98,42,0.3);border-radius:24px;padding:40px 32px;text-align:center;max-width:340px;width:90%}
    h2{color:#fff;font-size:20px;margin-bottom:8px}
    p{color:rgba(255,255,255,0.55);font-size:14px;line-height:1.5}
    .badge{display:inline-block;background:rgba(232,98,42,0.15);border:1px solid rgba(232,98,42,0.4);border-radius:20px;padding:4px 14px;font-size:12px;color:#E8622A;margin-bottom:16px}
    .loader{width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:#E8622A;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .retry-btn{margin-top:20px;padding:12px 24px;background:#E8622A;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;width:100%}
    .note{margin-top:12px;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5}
  </style>
</head>
<body>
  <div class="card" id="loading-card">
    <div class="loader"></div>
    <div class="badge">🔄 Auto-debit Monthly</div>
    <h2>Aorane Autopay</h2>
    <p>${planLabel} Plan — Monthly Auto-renewal</p>
    <button class="retry-btn" id="open-btn" style="display:none" onclick="openRazorpay()">Autopay Setup Karo</button>
    <p class="note">Razorpay secure mandate — cancel anytime from app</p>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var rzpInstance = null;
    function openRazorpay() {
      if (rzpInstance) { rzpInstance.open(); return; }
      var options = {
        key: "${keyId}",
        subscription_id: "${razorpaySubscriptionId}",
        name: "Aorane Health",
        description: "${planLabel} Plan — Monthly Autopay",
        image: "https://aorane.in/logo.png",
        redirect: true,
        callback_url: "${callbackUrl}?subscriptionId=${subscriptionId || ""}&plan=${plan || ""}",
        theme: { color: "#E8622A" },
        modal: {
          backdropclose: false,
          escape: false,
          ondismiss: function() {
            document.getElementById('loading-card').innerHTML =
              '<div style="font-size:48px;margin-bottom:16px">❌</div>' +
              '<h2 style="color:#f87171;margin:0 0 8px">Setup Cancelled</h2>' +
              '<p style="color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:16px">Autopay setup cancel ki gayi. App mein wapas jaake dobara try karein.</p>' +
              '<button class="retry-btn" onclick="openRazorpay()">Dobara Try Karo</button>';
          }
        }
      };
      rzpInstance = new Razorpay(options);
      rzpInstance.open();
    }
    window.addEventListener('load', function() { setTimeout(openRazorpay, 500); });
    setTimeout(function() { document.getElementById('open-btn').style.display = 'block'; }, 4000);
  </script>
</body>
</html>`);
  } catch {
    res.status(500).setHeader("Content-Type", "text/html").send(
      `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
       <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#fff;font-family:sans-serif">
       <div style="text-align:center;padding:40px"><h2>Server Error</h2><p>Please go back to the app and try again.</p></div></body></html>`
    );
  }
});

// ─── POST: Razorpay Subscription first-payment callback ───────────────────────
// After user completes first payment in subscription checkout, Razorpay redirects here
router.post("/payment/subscription-rzp-callback", async (req, res) => {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body as Record<string, string>;
  const { subscriptionId, plan } = req.query as { subscriptionId?: string; plan?: string };

  const isValid = razorpay_subscription_id && razorpay_payment_id && razorpay_signature
    ? verifySubscriptionSignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)
    : false;

  if (isValid && subscriptionId) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await db.update(subscriptionsTable).set({
        status: "active",
        expiresAt,
        razorpayPaymentId: razorpay_payment_id,
        nextRenewalAt: expiresAt,
      }).where(eq(subscriptionsTable.id, subscriptionId));
      const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subscriptionId));
      if (sub?.userId && sub?.plan) {
        await db.update(usersTable).set({ plan: sub.plan }).where(eq(usersTable.id, sub.userId));
      }
    } catch { /* best effort */ }
  }

  const html = isValid
    ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Autopay Active</title></head>
       <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
       <div style="background:#0D2040;border-radius:24px;padding:40px 32px;text-align:center;max-width:340px;border:1px solid rgba(232,98,42,0.4)">
         <div style="font-size:64px;margin-bottom:16px">🔄</div>
         <h2 style="color:#E8622A;margin:0 0 8px">Autopay Active!</h2>
         <p style="color:rgba(255,255,255,0.6);margin:0 0 16px;font-size:14px">${(plan || "Premium").charAt(0).toUpperCase() + (plan || "Premium").slice(1)} plan auto-renews every month. Close this window and return to the app.</p>
         <div style="background:rgba(232,98,42,0.1);border-radius:12px;padding:12px;font-size:12px;color:rgba(255,255,255,0.4)">
           Payment ID: ${razorpay_payment_id || "N/A"}
         </div>
       </div></body></html>`
    : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Setup Failed</title></head>
       <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
       <div style="background:#0D2040;border-radius:24px;padding:40px 32px;text-align:center;max-width:340px;border:1px solid rgba(239,68,68,0.3)">
         <div style="font-size:64px;margin-bottom:16px">❌</div>
         <h2 style="color:#f87171;margin:0 0 8px">Setup Failed</h2>
         <p style="color:rgba(255,255,255,0.6);margin:0 0 24px;font-size:14px">Autopay setup verify nahi ho payi. App mein wapas jaake dobara try karein.</p>
       </div></body></html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// Also handle GET for subscription callback (browser navigation)
router.get("/payment/subscription-rzp-callback", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Aorane Autopay</title></head>
    <body style="margin:0;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
    <div style="background:#0D2040;border-radius:24px;padding:40px 32px;text-align:center;max-width:340px">
      <div style="font-size:48px;margin-bottom:16px">🔄</div>
      <h2 style="color:#E8622A;margin:0 0 8px">Return to Aorane App</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px">Close this window and check your subscription status in the app.</p>
    </div></body></html>`);
});

export default router;
