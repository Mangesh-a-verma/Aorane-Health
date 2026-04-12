import { Router } from "express";
import { db, usersTable, subscriptionsTable, paymentsTable, promoCodesTable, planPricingTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { requireAuth } from "../../middlewares/user-auth";
import type { AuthRequest } from "../../middlewares/user-auth";
import crypto from "crypto";

const router = Router();

async function getPlanFromDB(planKey: string) {
  const [plan] = await db.select().from(planPricingTable)
    .where(eq(planPricingTable.planKey, planKey));
  return plan;
}

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
    const razorpayKeyId = process.env["RAZORPAY_KEY_ID"];
    const razorpayKeySecret = process.env["RAZORPAY_KEY_SECRET"];
    let razorpayOrderId: string | null = null;
    if (razorpayKeyId && razorpayKeySecret) {
      const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
      const rzRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount * 100, currency: "INR", receipt: `aorane_${req.userId!.substring(0, 8)}` }),
      });
      if (rzRes.ok) {
        const rzData = await rzRes.json() as { id: string };
        razorpayOrderId = rzData.id;
      }
    }
    const [payment] = await db.insert(paymentsTable).values({
      userId: req.userId!, amount: finalAmount.toString(), currency: "INR",
      plan, seats: 1, razorpayOrderId, status: "pending",
    }).returning();
    res.json({
      success: true, paymentId: payment.id,
      razorpayOrderId, razorpayKeyId: razorpayKeyId || null,
      amount: finalAmount, plan, discount, promoUsed,
      planLabel: planData.displayName,
      isTestMode: !razorpayKeyId,
    });
  } catch {
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

router.post("/payment/verify", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, isTestMode } = req.body as Record<string, unknown>;
    const razorpayKeySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!isTestMode && razorpayKeySecret) {
      const body = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSig = crypto.createHmac("sha256", razorpayKeySecret).update(body).digest("hex");
      if (expectedSig !== razorpaySignature) {
        res.status(400).json({ error: "Payment signature invalid" });
        return;
      }
    }
    await db.update(paymentsTable).set({ status: "success", razorpayPaymentId: razorpayPaymentId as string }).where(eq(paymentsTable.id, paymentId as string));
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await db.insert(subscriptionsTable).values({ userId: req.userId!, plan: plan as string, status: "active", source: "razorpay", expiresAt });
    await db.update(usersTable).set({ plan: plan as "free" | "pro" | "max" | "family" }).where(eq(usersTable.id, req.userId!));
    res.json({ success: true, message: `${plan} plan activate ho gaya!` });
  } catch {
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

router.post("/payment/promo/validate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code, plan } = req.body as { code: string; plan: string };
    if (!code) { res.status(400).json({ error: "Code required" }); return; }
    const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, code.toUpperCase()));
    if (!promo) { res.status(404).json({ error: "Invalid promo code" }); return; }
    if (!promo.isActive) { res.status(400).json({ error: "This promo code is no longer active" }); return; }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) { res.status(400).json({ error: "This promo code has expired" }); return; }
    if (promo.applicablePlans && !promo.applicablePlans.includes(plan)) {
      res.status(400).json({ error: `This code is only valid for: ${promo.applicablePlans.join(", ")}` }); return;
    }
    res.json({ valid: true, discount: promo.discountPct, code: promo.code, message: `${promo.discountPct}% discount applied!` });
  } catch {
    res.status(500).json({ error: "Failed to validate promo code" });
  }
});

export default router;
