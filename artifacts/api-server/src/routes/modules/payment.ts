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
    if (!planData || planData.type !== "individual" || planData.planKey === "free") {
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
    let razorpayOrderId: string | null = null;
    let orderIsTestMode = !isLiveMode();
    if (isLiveMode()) {
      try {
        const order = await createOrder({ amount: finalAmount, receipt: `usr_${req.userId!.substring(0, 8)}` });
        razorpayOrderId = order.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Razorpay error";
        res.status(502).json({ error: `Payment gateway error: ${msg}` }); return;
      }
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
      isTestMode: orderIsTestMode,
    });
  } catch {
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

// ─── POST: verify one-time payment ───────────────────────────────────────────
router.post("/payment/verify", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, isTestMode } = req.body as Record<string, unknown>;
    if (!isTestMode && isLiveMode()) {
      const valid = verifyPaymentSignature(razorpayOrderId as string, razorpayPaymentId as string, razorpaySignature as string);
      if (!valid) { res.status(400).json({ error: "Payment signature invalid" }); return; }
    }
    await db.update(paymentsTable).set({ status: "success", razorpayPaymentId: razorpayPaymentId as string }).where(eq(paymentsTable.id, paymentId as string));
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await db.insert(subscriptionsTable).values({
      userId: req.userId!, plan: plan as string, status: "active",
      source: "razorpay", expiresAt, paymentType: "one_time", autoRenew: false, nextRenewalAt: expiresAt,
    });
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
    if (!planData || planData.type !== "individual" || planData.planKey === "free") {
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

export default router;
