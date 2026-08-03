import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform, Alert, Linking, AppState, AppStateStatus,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";
import { refreshTokensFromServer } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/storage";
import { logSilentError } from "@/lib/silentCatch";

declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOptions) => RazorpayInstance;
  }
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  image?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance { open(): void; }

// ── FIX 3: billingCycle field add kiya ──────────────────────────────────────
type PlanItem = {
  key: string; label: string;
  price: number;       // monthly price
  yearlyPrice: number; // yearly price (total for 12 months)
  badge: string;
  color: string; gradient: [string, string]; features: string[];
};

// ── FIX 3: yearlyPrice added in fallback plans ───────────────────────────────
const FALLBACK_PLANS: PlanItem[] = [
  {
    key: "pro", label: "Pro", price: 199, yearlyPrice: 1990, badge: "Popular",
    color: "#0077B6", gradient: ["#0077B6","#023E8A"],
    features: ["AI Food Scan", "Personalized Diet Plan", "Health Reports PDF", "Medicine Reminders", "Exercise Tracking", "Water Tracker"],
  },
  {
    key: "max", label: "Max", price: 249, yearlyPrice: 2490, badge: "Best Value",
    color: "#8B5CF6", gradient: ["#8B5CF6","#6D28D9"],
    features: ["Everything in Pro", "Medical Report AI Scanner", "Advanced Gemini AI", "Priority Support", "Unlimited History", "Export PDF & CSV"],
  },
  {
    key: "family", label: "Family", price: 499, yearlyPrice: 4990, badge: "4 Members",
    color: "#F59E0B", gradient: ["#F59E0B","#D97706"],
    features: ["Everything in Max", "Up to 4 Family Members", "Family Health Dashboard", "Shared Health Reports", "Member Health Alerts", "Family Reminders"],
  },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window === "undefined") { resolve(false); return; }
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <LinearGradient colors={["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 1.5 }, style]}>
      <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.5)" }}>
        {Platform.OS === "ios" ? <BlurView intensity={60} tint={"light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.45)" }]} />}
        {children}
      </View>
    </LinearGradient>
  );
}

function SuccessOverlay({ plan, inviteCode, onDone }: { plan: string; inviteCode?: string | null; onDone: () => void }) {
  const isFamilyPlan = plan === "family";
  const [copied, setCopied] = React.useState(false);

  const copyCode = async () => {
    if (!inviteCode) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteCode);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.85)", zIndex: 999, padding: 20 }]}>
      <LinearGradient colors={isFamilyPlan ? ["#F59E0B","#D97706"] : ["#0077B6","#1B998B"]} style={{ borderRadius: 28, padding: 32, alignItems: "center", width: "100%", maxWidth: 340 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: isFamilyPlan ? 40 : 0 }}>{isFamilyPlan ? "👨‍👩‍👧‍👦" : ""}</Text>
          {!isFamilyPlan && <Ionicons name="checkmark-circle" size={52} color="#FFF" />}
        </View>
        <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 24, textAlign: "center", marginBottom: 6 }}>
          {isFamilyPlan ? "Family Plan Active! 🎉" : "🎉 Congratulations!"}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter_500Medium", fontSize: 14, textAlign: "center", marginBottom: 4 }}>
          {plan.toUpperCase()} Plan is Active!
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", marginBottom: 20 }}>
          {isFamilyPlan ? "For 4 family members — share the code below" : "All premium features unlocked!"}
        </Text>
        {isFamilyPlan && inviteCode && (
          <View style={{ backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 16, alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6, letterSpacing: 1 }}>FAMILY INVITE CODE</Text>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: 4, marginBottom: 10 }}>{inviteCode}</Text>
            <TouchableOpacity onPress={copyCode} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color="#FFF" />
              <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{copied ? "Copied!" : "Copy Code"}</Text>
            </TouchableOpacity>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 }}>
              Family members → App → Family Health → Enter Code
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={onDone} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, width: "100%", alignItems: "center" }}>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>
            {isFamilyPlan ? "View Family" : "Go to Dashboard"}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

// ── NEW: Config type used by the modal wrapper (Meal Log / AI Scan / Intelligence) ──
export type UpgradeModalConfig =
  | {
      type: "plan_limit";
      featureKey: string;
      featureLabel: string;
      currentPlan: string;
      requiredPlan: string;
    }
  | {
      type: "daily_limit";
      featureKey: string;
      featureLabel: string;
      used: number;
      limit: number;
    };

type ActiveSubscription = {
  id: string; plan: string; status: string; expiresAt: string;
  autoRenew: boolean; nextRenewalAt: string | null; razorpaySubscriptionId: string | null;
} | null;

// ── FIX 3: Billing cycle type ─────────────────────────────────────────────────
type BillingCycle = "monthly" | "yearly";

function UpgradeScreenContent({ config, onClose }: { config?: UpgradeModalConfig | null; onClose?: () => void }) {
  const goBack = useCallback(() => {
    if (onClose) onClose();
    else router.back();
  }, [onClose]);
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth() as { user: Record<string, unknown>; refreshUser?: () => void };
  const [plans, setPlans] = useState<PlanItem[]>(FALLBACK_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoMsg, setPromoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [success, setSuccess] = useState(false);
  const [familyInviteCode, setFamilyInviteCode] = useState<string | null>(null);
  const [rzpReady, setRzpReady] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingOrderRef = useRef<{ orderId: string; paymentId: string; plan: string } | null>(null);

  // ── FIX 3: billingCycle state ─────────────────────────────────────────────
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  // ── Autopay / Subscription state ─────────────────────────────────────────────
  const [isAutopay, setIsAutopay] = useState(true);
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [waitingForSubscription, setWaitingForSubscription] = useState(false);
  const subPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSubIdRef = useRef<string | null>(null);
  const topPad = insets.top;
  const bg = "#F0F9FF";

  const plan = (plans.find(p => p.key === selectedPlan) ?? plans[0])!;

  // ── FIX 3: Price calculation based on billing cycle ───────────────────────
  // Monthly: simple monthly price after promo
  // Yearly: yearly total after promo (yearly is already ~2 months free)
  const basePrice = billingCycle === "yearly" ? (plan?.yearlyPrice ?? plan?.price * 10) : (plan?.price ?? 0);
  const finalPrice = Math.round(basePrice * (1 - discount / 100));
  // Monthly equivalent for yearly (for display)
  const monthlyEquivalent = billingCycle === "yearly" ? Math.round(finalPrice / 12) : finalPrice;
  // Savings per year vs monthly
  const yearlySavings = billingCycle === "yearly"
    ? Math.round((plan?.price ?? 0) * 12 - finalPrice)
    : 0;

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (subPollingRef.current) clearInterval(subPollingRef.current);
    };
  }, []);

  useEffect(() => {
    api.getSubscriptionStatus().then(res => {
      setActiveSubscription(res.subscription);
    }).catch((e) => logSilentError('background-task', e));
  }, []);

  useEffect(() => {
    api.getPlans("individual").then(res => {
      const paidPlans = res.plans.filter((p: any) => Number(p.monthlyPrice) > 0 && p.isActive);
      if (paidPlans.length > 0) {
        const mapped: PlanItem[] = paidPlans.map((p: any) => ({
          key: p.planKey,
          label: p.displayName,
          price: Number(p.effectiveMonthlyPrice ?? p.monthlyPrice),
          // ── FIX 3: yearlyPrice from API ─────────────────────────────────
          yearlyPrice: Number(p.effectiveYearlyPrice ?? p.yearlyPrice ?? Number(p.monthlyPrice) * 10),
          badge: p.badgeText ?? "",
          color: p.badgeColor ?? "#0077B6",
          gradient: p.gradientColors ?? [p.badgeColor ?? "#0077B6", "#023E8A"],
          features: p.features ?? [],
        }));
        setPlans(mapped);
        if (!mapped.find(p => p.key === selectedPlan)) {
          setSelectedPlan(mapped[0].key);
        }
      }
    }).catch((e) => logSilentError('background-task', e));
    if (Platform.OS === "web") {
      loadRazorpayScript().then(ok => setRzpReady(ok));
    }
  }, []);

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    try {
      const res = await api.validatePromoCode(promoCode.trim().toUpperCase(), selectedPlan);
      setDiscount(res.discount);
      setPromoMsg(res.message);
    } catch (e: unknown) {
      setDiscount(0);
      setPromoMsg((e as Error).message || "Invalid code");
    } finally { setValidatingPromo(false); }
  };

  const stopSubPolling = useCallback(() => {
    if (subPollingRef.current) { clearInterval(subPollingRef.current); subPollingRef.current = null; }
    pendingSubIdRef.current = null;
    setWaitingForSubscription(false);
  }, []);

  const startSubPolling = useCallback((subscriptionId: string) => {
    pendingSubIdRef.current = subscriptionId;
    setWaitingForSubscription(true);
    let attempts = 0;
    const maxAttempts = 100;
    subPollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) { stopSubPolling(); return; }
      try {
        const res = await api.getSubscriptionStatus();
        // ── FIX 1: Only show success when server CONFIRMS active status ──────
        if (res.subscription?.status === "active") {
          stopSubPolling();
          setActiveSubscription(res.subscription);
          if (refreshUser) await refreshUser();
          setSuccess(true); // real success, not fake
        }
      } catch { }
    }, 3000);
  }, [refreshUser, stopSubPolling]);

  const handleCancelSubscription = async () => {
    Alert.alert(
      "Cancel Autopay",
      "Your plan will remain active until expiry after cancelling autopay. Are you sure?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setLoadingSubscription(true);
            try {
              const res = await api.cancelSubscription();
              const statusRes = await api.getSubscriptionStatus();
              setActiveSubscription(statusRes.subscription);
              Alert.alert("Autopay Cancelled", res.message || "Autopay cancelled. Plan remains active until expiry.");
            } catch (e: unknown) {
              Alert.alert("Error", (e as Error).message || "Could not cancel. Please try again.");
            } finally { setLoadingSubscription(false); }
          },
        },
      ]
    );
  };

  // ── FIX 3: billingCycle pass to API ──────────────────────────────────────
  const handleSubscriptionUpgrade = async () => {
    setLoading(true);
    try {
      const subRes = await api.createSubscription(
        selectedPlan,
        promoCode.trim().toUpperCase() || undefined,
        billingCycle, // pass billing cycle
      );

      if (subRes.expiresAt && !subRes.razorpaySubscriptionId) {
        // Test mode — subscription directly activated
        if (subRes.accessToken) await storage.setToken(subRes.accessToken);
        if (subRes.refreshToken) await storage.setRefreshToken(subRes.refreshToken);
        const statusRes = await api.getSubscriptionStatus();
        setActiveSubscription(statusRes.subscription);
        if (refreshUser) await refreshUser();
        setSuccess(true);
        setLoading(false);
        return;
      }

      if (subRes.razorpaySubscriptionId) {
        const serverBase = Platform.OS === "web" && typeof window !== "undefined"
          ? window.location.origin
          : (process.env.EXPO_PUBLIC_API_URL?.replace("/api", "") || "https://aorane.onrender.com");
        const checkoutUrl = `${serverBase}/api/payment/subscription-checkout/${subRes.razorpaySubscriptionId}?subscriptionId=${subRes.subscriptionId}&plan=${selectedPlan}`;
        Linking.openURL(checkoutUrl);
        startSubPolling(subRes.subscriptionId);
      }
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Autopay setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionNow = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSubscriptionStatus();
      // ── FIX 1: Only confirm if server says active ─────────────────────────
      if (res.subscription?.status === "active") {
        stopSubPolling();
        await refreshTokensFromServer().catch((e) => logSilentError('token-refresh', e));
        setActiveSubscription(res.subscription);
        if (refreshUser) await refreshUser();
        setSuccess(true);
      } else {
        Alert.alert("Subscription Pending", "Autopay is not yet active. Please complete the payment in your browser.");
      }
    } catch {
      Alert.alert("Error", "Could not check status. Please try again.");
    } finally { setLoading(false); }
  }, [refreshUser, stopSubPolling]);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollingOrderRef.current = null;
    setWaitingForPayment(false);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current === "background" || appStateRef.current === "inactive";
      const isNowActive = nextState === "active";
      appStateRef.current = nextState;

      if (wasBackground && isNowActive && pollingOrderRef.current) {
        const { orderId } = pollingOrderRef.current;
        try {
          const status = await api.getOrderStatus(orderId);
          // ── FIX 1: Only trigger success on confirmed server status ─────────
          if (status.status === "success") {
            stopPolling();
            if (refreshUser) await refreshUser();
            setSuccess(true);
          } else {
            Alert.alert(
              "Payment Status",
              "Did you complete the payment?",
              [
                {
                  text: "No, I Cancelled",
                  style: "destructive",
                  onPress: () => {
                    stopPolling();
                    setLoading(false);
                    Alert.alert("Payment Cancelled", "Your payment was cancelled. Tap 'Upgrade' to try again.");
                  },
                },
                { text: "Yes, Payment Done", onPress: () => {} },
              ]
            );
          }
        } catch { }
      }
    });
    return () => sub.remove();
  }, [refreshUser, stopPolling]);

  const onPaymentSuccess = useCallback(async (paymentId: string, rzPaymentId: string, rzOrderId: string, rzSignature: string) => {
    stopPolling();
    try {
      const result = await api.verifyPayment({
        paymentId,
        razorpayPaymentId: rzPaymentId,
        razorpayOrderId: rzOrderId,
        razorpaySignature: rzSignature,
        plan: selectedPlan,
      });
      // ── FIX 1: Tokens + refreshUser both done BEFORE setSuccess ──────────
      if (result?.accessToken) await storage.setToken(result.accessToken);
      if (result?.refreshToken) await storage.setRefreshToken(result.refreshToken);
      if (refreshUser) await refreshUser();
      if (result?.inviteCode) setFamilyInviteCode(result.inviteCode);
      // Only show success popup after server verification confirmed
      setSuccess(true);
    } catch (e: unknown) {
      Alert.alert("Verification Failed", (e as Error).message || "Payment could not be verified. Contact support.");
    }
  }, [selectedPlan, refreshUser, stopPolling]);

  const startPollingForPayment = useCallback((orderId: string, _paymentId: string, _planKey: string) => {
    pollingOrderRef.current = { orderId, paymentId: _paymentId, plan: _planKey };
    setWaitingForPayment(true);
    let attempts = 0;
    const maxAttempts = 100;
    pollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) { stopPolling(); return; }
      try {
        const status = await api.getOrderStatus(orderId);
        if (status.status === "success") {
          stopPolling();
          await refreshTokensFromServer().catch((e) => logSilentError('token-refresh', e));
          if (refreshUser) await refreshUser();
          setSuccess(true);
          setLoading(false);
        }
      } catch { }
    }, 3000);
  }, [refreshUser, stopPolling]);

  const checkPaymentNow = useCallback(async () => {
    if (!pollingOrderRef.current) return;
    const { orderId } = pollingOrderRef.current;
    setLoading(true);
    try {
      const status = await api.getOrderStatus(orderId);
      if (status.status === "success") {
        stopPolling();
        await refreshTokensFromServer().catch((e) => logSilentError('token-refresh', e));
        if (refreshUser) await refreshUser();
        setSuccess(true);
      } else {
        Alert.alert("Payment Pending", "Payment is not confirmed yet. Please complete payment in the browser and try again.");
      }
    } catch {
      Alert.alert("Error", "Could not check payment status. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [refreshUser, stopPolling]);

  // ── FIX 2: Browser open + polling BOTH needed — no change here, but
  //           startPollingForPayment ensures app waits for real confirmation ──
  const openRazorpayNative = (orderRes: { paymentId: string; razorpayOrderId: string; razorpayKeyId: string; amount: number }) => {
    const serverBase = Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin
      : (process.env.EXPO_PUBLIC_API_URL?.replace("/api", "") || "https://aorane.onrender.com");
    const checkoutUrl = `${serverBase}/api/payment/checkout/${orderRes.razorpayOrderId}`;
    Linking.openURL(checkoutUrl);
    startPollingForPayment(orderRes.razorpayOrderId, orderRes.paymentId, selectedPlan);
  };

  // ── FIX 3: Pass billingCycle to one-time order API ───────────────────────
  const handleUpgrade = async () => {
    if (isAutopay) { return handleSubscriptionUpgrade(); }
    setLoading(true);
    try {
      const orderRes = await api.createPaymentOrder(
        selectedPlan,
        promoCode.trim().toUpperCase() || undefined,
        billingCycle, // NEW: pass billing cycle
      );

      if (Platform.OS === "web" && rzpReady && window.Razorpay && orderRes.razorpayKeyId && orderRes.razorpayOrderId) {
        const rzp = new window.Razorpay({
          key: orderRes.razorpayKeyId,
          amount: orderRes.amount * 100,
          currency: "INR",
          order_id: orderRes.razorpayOrderId,
          name: "Aorane Health",
          description: billingCycle === "yearly"
            ? `${plan.label} Plan - 1 Year`
            : `${plan.label} Plan - 1 Month`,
          prefill: { contact: (user?.phone as string) || "" },
          theme: { color: plan.color },
          handler: async (response) => {
            setLoading(true);
            await onPaymentSuccess(orderRes.paymentId, response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature);
            setLoading(false);
          },
          modal: { ondismiss: () => setLoading(false) },
        });
        rzp.open();
        setLoading(false);
        return;
      }

      if (orderRes.razorpayOrderId && orderRes.razorpayKeyId) {
        openRazorpayNative({
          paymentId: orderRes.paymentId,
          razorpayOrderId: orderRes.razorpayOrderId,
          razorpayKeyId: orderRes.razorpayKeyId,
          amount: orderRes.amount,
        });
      }

    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Labels for billing button ────────────────────────────────────────────
  const upgradeButtonLabel = () => {
    if (loading) return "Processing...";
    if (isAutopay) return `Setup Autopay ₹${monthlyEquivalent}/mo`;
    if (billingCycle === "yearly") return `Pay Yearly ₹${finalPrice}`;
    return `Pay Once ₹${finalPrice}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF8F3" }}>
      <LinearGradient colors={["#FFF8F3", "#FEF0E7", "#FFF8F3"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        {/* Header */}
        <LinearGradient colors={["#E8622A", "#F5A623"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 20, padding: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={goBack} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 22 }}>Aorane Premium ✨</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Razorpay Secure Checkout · 100% Safe</Text>
          </View>
          <Text style={{ fontSize: 32 }}>🛡️</Text>
        </LinearGradient>

        {/* ── Context banner: why this modal opened (Meal Log / AI Scan / Intelligence) ── */}
        {config && (
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#E8622A22", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={config.type === "daily_limit" ? "time-outline" : "lock-closed-outline"} size={18} color="#E8622A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {config.featureLabel}
                </Text>
                <Text style={{ color: "rgba(10,22,40,0.55)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                  {config.type === "daily_limit"
                    ? `Daily limit reached: ${config.used}/${config.limit} used today`
                    : `Requires ${config.requiredPlan} plan (you're on ${config.currentPlan?.toUpperCase?.() || config.currentPlan})`}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Active plan card */}
        {(user?.plan as string) !== "free" && (
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: activeSubscription?.autoRenew ? 12 : 0 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#10B98122", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 15 }}>Active Plan: {(user?.plan as string || "free").toUpperCase()}</Text>
                  <Text style={{ color: "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                    {/* ── FIX 4: Show expiry date clearly ── */}
                    {activeSubscription?.expiresAt
                      ? `Expires: ${new Date(activeSubscription.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                      : activeSubscription?.autoRenew
                      ? "🔄 Autopay active — auto-renews monthly"
                      : "Your premium plan is active"}
                  </Text>
                </View>
                {activeSubscription?.autoRenew && (
                  <View style={{ backgroundColor: "#E8622A22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#E8622A55" }}>
                    <Text style={{ color: "#E8622A", fontFamily: "Inter_700Bold", fontSize: 10 }}>AUTOPAY</Text>
                  </View>
                )}
              </View>
              {activeSubscription?.autoRenew && (
                <TouchableOpacity onPress={handleCancelSubscription} disabled={loadingSubscription} style={{ backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" }}>
                  <Text style={{ color: "#ef4444", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {loadingSubscription ? "Cancelling..." : "Cancel Autopay"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </GlassCard>
        )}

        {/* ── FIX 3: Billing Cycle Toggle (Monthly / Yearly) ── */}
        {/* Only show when NOT autopay, since Razorpay subscriptions are monthly-only */}
        {!isAutopay && (
          <GlassCard style={{ marginBottom: 12 }}>
            <View style={{ padding: 4, flexDirection: "row", borderRadius: 18 }}>
              <TouchableOpacity
                onPress={() => { setBillingCycle("monthly"); setDiscount(0); setPromoMsg(""); setPromoCode(""); }}
                style={{ flex: 1, paddingVertical: 11, borderRadius: 16, alignItems: "center", backgroundColor: billingCycle === "monthly" ? "#E8622A" : "transparent" }}
              >
                <Text style={{ color: billingCycle === "monthly" ? "#FFF" : ("rgba(10,22,40,0.5)"), fontFamily: "Inter_700Bold", fontSize: 13 }}>📅 Monthly</Text>
                {billingCycle === "monthly" && (
                  <Text style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 }}>Pay month by month</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setBillingCycle("yearly"); setDiscount(0); setPromoMsg(""); setPromoCode(""); }}
                style={{ flex: 1, paddingVertical: 11, borderRadius: 16, alignItems: "center", backgroundColor: billingCycle === "yearly" ? "#10B981" : "transparent" }}
              >
                <Text style={{ color: billingCycle === "yearly" ? "#FFF" : ("rgba(10,22,40,0.5)"), fontFamily: "Inter_700Bold", fontSize: 13 }}>🎁 Yearly</Text>
                {billingCycle === "yearly" ? (
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter_700Bold", fontSize: 10, marginTop: 2 }}>2 months FREE!</Text>
                ) : (
                  <Text style={{ color: "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 }}>Save ~17%</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Autopay Toggle */}
        <GlassCard style={{ marginBottom: 16 }}>
          <View style={{ padding: 4, flexDirection: "row", borderRadius: 18 }}>
            <TouchableOpacity
              onPress={() => { setIsAutopay(true); setBillingCycle("monthly"); }}
              style={{ flex: 1, paddingVertical: 11, borderRadius: 16, alignItems: "center", backgroundColor: isAutopay ? "#E8622A" : "transparent" }}
            >
              <Text style={{ color: isAutopay ? "#FFF" : ("rgba(10,22,40,0.5)"), fontFamily: "Inter_700Bold", fontSize: 13 }}>🔄 Auto-debit Monthly</Text>
              {isAutopay && <Text style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 }}>Recommended • Cancel anytime</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsAutopay(false)}
              style={{ flex: 1, paddingVertical: 11, borderRadius: 16, alignItems: "center", backgroundColor: !isAutopay ? ("rgba(0,119,182,0.12)") : "transparent" }}
            >
              <Text style={{ color: !isAutopay ? ("#1a1a2e") : ("rgba(10,22,40,0.4)"), fontFamily: "Inter_700Bold", fontSize: 13 }}>💳 Pay Once</Text>
              {!isAutopay && <Text style={{ color: "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 }}>{billingCycle === "yearly" ? "1 year" : "1 month"} only</Text>}
            </TouchableOpacity>
          </View>
        </GlassCard>

        <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12 }}>Choose a Plan</Text>
        <View style={{ gap: 12, marginBottom: 16 }}>
          {plans.map(p => (
            <TouchableOpacity key={p.key} onPress={() => { setSelectedPlan(p.key); setDiscount(0); setPromoMsg(""); setPromoCode(""); }} activeOpacity={0.85}>
              <LinearGradient
                colors={selectedPlan === p.key ? p.gradient : (["rgba(255,255,255,0.8)","rgba(240,249,255,0.6)"] as [string,string])}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ borderRadius: 20, padding: 20, borderWidth: selectedPlan === p.key ? 0 : 1, borderColor: "rgba(0,119,182,0.15)" }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Text style={{ color: selectedPlan === p.key ? "#FFF" : ("#1a1a2e"), fontFamily: "Inter_700Bold", fontSize: 20 }}>{p.label}</Text>
                      <View style={{ backgroundColor: selectedPlan === p.key ? "rgba(255,255,255,0.2)" : p.color + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: selectedPlan === p.key ? "#FFF" : p.color, fontFamily: "Inter_700Bold", fontSize: 10 }}>{p.badge}</Text>
                      </View>
                    </View>
                    {/* ── FIX 3: Show price based on billing cycle ── */}
                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                      {billingCycle === "yearly" ? (
                        <>
                          <Text style={{ color: selectedPlan === p.key ? "#FFF" : ("#1a1a2e"), fontFamily: "Inter_700Bold", fontSize: 32 }}>
                            ₹{Math.round(p.yearlyPrice / 12)}
                          </Text>
                          <Text style={{ color: selectedPlan === p.key ? "rgba(255,255,255,0.7)" : ("rgba(10,22,40,0.5)"), fontFamily: "Inter_400Regular", fontSize: 13, paddingBottom: 4 }}>/mo</Text>
                          <View style={{ backgroundColor: "#10B98133", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2, marginLeft: 4 }}>
                            <Text style={{ color: selectedPlan === p.key ? "#6EE7B7" : "#10B981", fontFamily: "Inter_700Bold", fontSize: 10 }}>YEARLY</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={{ color: selectedPlan === p.key ? "#FFF" : ("#1a1a2e"), fontFamily: "Inter_700Bold", fontSize: 32 }}>₹{p.price}</Text>
                          <Text style={{ color: selectedPlan === p.key ? "rgba(255,255,255,0.7)" : ("rgba(10,22,40,0.5)"), fontFamily: "Inter_400Regular", fontSize: 13, paddingBottom: 4 }}>/month</Text>
                        </>
                      )}
                    </View>
                    {/* ── FIX 3: Show yearly total & savings ── */}
                    {billingCycle === "yearly" && (
                      <Text style={{ color: selectedPlan === p.key ? "rgba(255,255,255,0.65)" : "#10B981", fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 2 }}>
                        ₹{p.yearlyPrice}/yr · Save ₹{p.price * 12 - p.yearlyPrice} vs monthly
                      </Text>
                    )}
                  </View>
                  <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: selectedPlan === p.key ? "#FFF" : ("rgba(0,119,182,0.3)"), alignItems: "center", justifyContent: "center" }}>
                    {selectedPlan === p.key && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFF" }} />}
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  {p.features.map((f, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={16} color={selectedPlan === p.key ? "rgba(255,255,255,0.8)" : p.color} />
                      <Text style={{ color: selectedPlan === p.key ? "rgba(255,255,255,0.85)" : ("rgba(10,22,40,0.65)"), fontFamily: "Inter_400Regular", fontSize: 13 }}>{f}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Promo code */}
        <GlassCard style={{ marginBottom: 16 }}>
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 10 }}>Promo Code</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={promoCode} onChangeText={t => { setPromoCode(t); setPromoMsg(""); setDiscount(0); }}
                placeholder="Enter code (e.g. AORANE20)" placeholderTextColor={"rgba(10,22,40,0.3)"}
                style={{ flex: 1, backgroundColor: "rgba(0,119,182,0.06)", borderRadius: 12, padding: 12, color: "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 14, borderWidth: 1, borderColor: "rgba(0,119,182,0.15)", textTransform: "uppercase" }}
                autoCapitalize="characters"
              />
              <TouchableOpacity onPress={validatePromo} disabled={validatingPromo || !promoCode.trim()} style={{ backgroundColor: "#1B998B", borderRadius: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", opacity: !promoCode.trim() ? 0.5 : 1 }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>{validatingPromo ? "..." : "Apply"}</Text>
              </TouchableOpacity>
            </View>
            {promoMsg ? <Text style={{ color: discount > 0 ? "#10B981" : "#DC2626", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 8 }}>{promoMsg}</Text> : null}
          </View>
        </GlassCard>

        {/* ── FIX 3: Price summary with yearly breakdown ── */}
        <LinearGradient colors={["rgba(255,255,255,0.8)","rgba(240,249,255,0.6)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "rgba(0,119,182,0.12)" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: "rgba(10,22,40,0.6)", fontFamily: "Inter_400Regular", fontSize: 14 }}>
              {plan.label} Plan ({billingCycle === "yearly" ? "1 year" : "1 month"})
            </Text>
            <Text style={{ color: "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              ₹{billingCycle === "yearly" ? plan.yearlyPrice : plan.price}
            </Text>
          </View>
          {billingCycle === "yearly" && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#10B981", fontFamily: "Inter_500Medium", fontSize: 14 }}>Yearly savings (2 months free)</Text>
              <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>-₹{plan.price * 12 - plan.yearlyPrice}</Text>
            </View>
          )}
          {discount > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#10B981", fontFamily: "Inter_500Medium", fontSize: 14 }}>Promo Discount ({discount}%)</Text>
              <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>-₹{basePrice - finalPrice}</Text>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: "rgba(0,119,182,0.1)", marginVertical: 8 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16 }}>Total</Text>
            <View style={{ alignItems: "flex-end" }}>
              {discount > 0 && (
                <Text style={{ color: "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular", fontSize: 12, textDecorationLine: "line-through" }}>
                  ₹{basePrice}
                </Text>
              )}
              {billingCycle === "yearly" ? (
                <>
                  <Text style={{ color: "#E8622A", fontFamily: "Inter_700Bold", fontSize: 22 }}>₹{finalPrice}/yr</Text>
                  <Text style={{ color: "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular", fontSize: 12 }}>≈ ₹{monthlyEquivalent}/mo</Text>
                </>
              ) : (
                <Text style={{ color: "#E8622A", fontFamily: "Inter_700Bold", fontSize: 22 }}>
                  ₹{finalPrice}{isAutopay ? "/mo" : ""}
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>

        <TouchableOpacity onPress={handleUpgrade} disabled={loading} style={{ borderRadius: 16, overflow: "hidden", opacity: loading ? 0.7 : 1 }}>
          <LinearGradient
            colors={isAutopay ? ["#E8622A","#F5A623"] : billingCycle === "yearly" ? ["#10B981","#059669"] : plan.gradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ padding: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
          >
            <Ionicons
              name={loading ? "hourglass" : isAutopay ? "refresh-circle" : billingCycle === "yearly" ? "calendar" : "card"}
              size={22} color="#FFF"
            />
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 17 }}>
              {upgradeButtonLabel()}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 14 }}>
          <Ionicons name="lock-closed" size={12} color={"rgba(10,22,40,0.4)"} />
          <Text style={{ color: "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular" }}>
            {isAutopay
              ? "256-bit SSL • Razorpay Mandate • Cancel anytime from app"
              : billingCycle === "yearly"
              ? "256-bit SSL • Razorpay Secure • 1 Year Access"
              : "256-bit SSL • Razorpay Secure • Cancel anytime"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 16, paddingBottom: 10 }}>
          {["UPI", "Cards", "NetBanking", "Wallets"].map(m => (
            <View key={m} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(0,119,182,0.08)", borderWidth: 1, borderColor: "rgba(0,119,182,0.12)" }}>
              <Text style={{ color: "rgba(10,22,40,0.5)", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{m}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {success && (
        <SuccessOverlay
          plan={selectedPlan}
          inviteCode={familyInviteCode}
          onDone={() => {
            setSuccess(false);
            setFamilyInviteCode(null);
            goBack();
            router.push((selectedPlan === "family" ? "/family" : "/(tabs)") as never);
          }}
        />
      )}

      {/* Waiting for one-time payment overlay */}
      {waitingForPayment && !success && (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.88)", zIndex: 998, padding: 24 }]}>
          <LinearGradient colors={["#0D2040", "#091526"]} style={{ borderRadius: 24, padding: 32, alignItems: "center", width: "100%", maxWidth: 320, borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" }}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>💳</Text>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center", marginBottom: 8 }}>Payment Processing...</Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
              Complete your payment in the browser.{"\n"}The app will update automatically once payment is confirmed.
            </Text>
            <TouchableOpacity onPress={checkPaymentNow} disabled={loading} style={{ backgroundColor: "#3B82F6", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: "100%", alignItems: "center", marginBottom: 12, opacity: loading ? 0.6 : 1 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {loading ? "Checking..." : "✓ I've Completed Payment"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { stopPolling(); setLoading(false); Alert.alert("Payment Cancelled", "No problem! Tap 'Upgrade' whenever you're ready."); }}
              style={{ paddingVertical: 10, paddingHorizontal: 20 }}
            >
              <Text style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", fontSize: 13 }}>❌ Cancel Payment</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {/* Waiting for subscription/autopay overlay */}
      {waitingForSubscription && !success && (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.88)", zIndex: 998, padding: 24 }]}>
          <LinearGradient colors={["#1A0A04", "#2D1100"]} style={{ borderRadius: 24, padding: 32, alignItems: "center", width: "100%", maxWidth: 320, borderWidth: 1, borderColor: "rgba(232,98,42,0.4)" }}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>🔄</Text>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center", marginBottom: 8 }}>Autopay Setup...</Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
              Complete Razorpay mandate in the browser.{"\n"}The app will update automatically once done.
            </Text>
            <TouchableOpacity onPress={checkSubscriptionNow} disabled={loading} style={{ backgroundColor: "#E8622A", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: "100%", alignItems: "center", marginBottom: 12, opacity: loading ? 0.6 : 1 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {loading ? "Checking..." : "✓ Autopay Setup Complete"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { stopSubPolling(); setLoading(false); Alert.alert("Setup Cancelled", "No problem! Tap 'Setup Autopay' whenever you're ready."); }}
              style={{ paddingVertical: 10, paddingHorizontal: 20 }}
            >
              <Text style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", fontSize: 13 }}>❌ Cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

// ── NEW: Named modal wrapper used by Meal Log / AI Scan / Intelligence screens ──
// Renders nothing when `config` is null/undefined. Shown as a full-screen modal
// overlay when a plan/daily limit is hit, reusing the existing premium-plans UI.
export function UpgradeModal({ config, onClose }: { config: UpgradeModalConfig | null; onClose: () => void }) {
  if (!config) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <UpgradeScreenContent config={config} onClose={onClose} />
    </Modal>
  );
}

// Default export kept for backward compatibility (standalone full-screen route usage, if any).
export default function UpgradeScreen() {
  return <UpgradeScreenContent />;
}