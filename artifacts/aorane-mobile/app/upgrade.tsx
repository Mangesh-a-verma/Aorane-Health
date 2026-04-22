import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform, useColorScheme, Alert, Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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

type PlanItem = {
  key: string; label: string; price: number; badge: string;
  color: string; gradient: [string, string]; features: string[];
};

const FALLBACK_PLANS: PlanItem[] = [
  {
    key: "max", label: "Max", price: 199, badge: "Popular",
    color: "#0077B6", gradient: ["#0077B6","#023E8A"],
    features: ["AI Food Scan", "Personalized Diet Plan", "Health Reports PDF", "Medicine Reminders", "Exercise Tracking", "Water Tracker"],
  },
  {
    key: "pro", label: "Pro", price: 249, badge: "Best Value",
    color: "#8B5CF6", gradient: ["#8B5CF6","#6D28D9"],
    features: ["Sab Max features +", "Medical Report AI Scanner", "Advanced Gemini AI", "Priority Support", "Family Add-on", "Unlimited History"],
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
  const isDark = useColorScheme() === "dark";
  return (
    <LinearGradient colors={isDark ? ["rgba(56,189,248,0.18)","rgba(45,212,191,0.08)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.45)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 1.5 }, style]}>
      <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)" }}>
        {Platform.OS === "ios" ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
        {children}
      </View>
    </LinearGradient>
  );
}

function SuccessOverlay({ plan, inviteCode, onDone }: { plan: string; inviteCode?: string | null; onDone: () => void }) {
  const isDark = useColorScheme() === "dark";
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

        {/* Family invite code */}
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

export default function UpgradeScreen() {
  const isDark = useColorScheme() === "dark";
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
  const topPad = insets.top;
  const bg = isDark ? "#010814" : "#F0F9FF";

  const plan = (plans.find(p => p.key === selectedPlan) ?? plans[0])!;
  const finalPrice = Math.round((plan?.price ?? 0) * (1 - discount / 100));

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    api.getPlans("individual").then(res => {
      const paidPlans = res.plans.filter(p => Number(p.monthlyPrice) > 0 && p.isActive);
      if (paidPlans.length > 0) {
        const mapped: PlanItem[] = paidPlans.map(p => ({
          key: p.planKey,
          label: p.displayName,
          price: Number(p.monthlyPrice),
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
    }).catch(() => {}); // fallback to FALLBACK_PLANS
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

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollingOrderRef.current = null;
    setWaitingForPayment(false);
  }, []);

  const onPaymentSuccess = useCallback(async (paymentId: string, rzPaymentId: string, rzOrderId: string, rzSignature: string, isTestMode = false) => {
    stopPolling();
    try {
      const result = await api.verifyPayment({ paymentId, razorpayPaymentId: rzPaymentId, razorpayOrderId: rzOrderId, razorpaySignature: rzSignature, plan: selectedPlan, isTestMode });
      if (refreshUser) await refreshUser();
      if (result?.inviteCode) setFamilyInviteCode(result.inviteCode);
      setSuccess(true);
    } catch (e: unknown) {
      Alert.alert("Verification Failed", (e as Error).message || "Payment could not be verified");
    }
  }, [selectedPlan, refreshUser, stopPolling]);

  const startPollingForPayment = useCallback((orderId: string, _paymentId: string, _planKey: string) => {
    pollingOrderRef.current = { orderId, paymentId: _paymentId, plan: _planKey };
    setWaitingForPayment(true);
    let attempts = 0;
    const maxAttempts = 100; // ~5 minutes at 3s intervals
    pollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) { stopPolling(); return; }
      try {
        const status = await api.getOrderStatus(orderId);
        if (status.status === "success") {
          stopPolling();
          // Callback already processed payment & updated DB — just refresh user state
          if (refreshUser) await refreshUser();
          setSuccess(true);
          setLoading(false);
        }
      } catch { /* ignore polling errors, keep retrying */ }
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
        // Callback already processed payment & updated DB — just refresh user state
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

  const openRazorpayNative = (orderRes: { paymentId: string; razorpayOrderId: string; razorpayKeyId: string; amount: number }) => {
    // Use server-rendered checkout page (checkout.js hosted on our server)
    // This avoids the Razorpay API endpoint which returns 401 in browser
    const serverBase = Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin
      : (process.env.EXPO_PUBLIC_API_URL?.replace("/api", "") || "https://aorane.onrender.com");
    const checkoutUrl = `${serverBase}/api/payment/checkout/${orderRes.razorpayOrderId}`;
    Linking.openURL(checkoutUrl);
    // Start polling for payment confirmation after browser opens
    startPollingForPayment(orderRes.razorpayOrderId, orderRes.paymentId, selectedPlan);
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const orderRes = await api.createPaymentOrder(selectedPlan, promoCode.trim().toUpperCase() || undefined);

      if (Platform.OS === "web" && rzpReady && window.Razorpay && orderRes.razorpayKeyId && orderRes.razorpayOrderId) {
        const rzp = new window.Razorpay({
          key: orderRes.razorpayKeyId,
          amount: orderRes.amount * 100,
          currency: "INR",
          order_id: orderRes.razorpayOrderId,
          name: "Aorane Health",
          description: `${plan.label} Plan - 1 Month`,
          prefill: {
            contact: (user?.phone as string) || "",
          },
          theme: { color: plan.color },
          handler: async (response) => {
            setLoading(true);
            await onPaymentSuccess(
              orderRes.paymentId,
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature
            );
            setLoading(false);
          },
          modal: {
            ondismiss: () => setLoading(false),
          },
        });
        rzp.open();
        setLoading(false);
        return;
      }

      if (orderRes.razorpayOrderId && orderRes.razorpayKeyId) {
        openRazorpayNative({ paymentId: orderRes.paymentId, razorpayOrderId: orderRes.razorpayOrderId, razorpayKeyId: orderRes.razorpayKeyId, amount: orderRes.amount });
      }

    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF8F3" }}>
      <LinearGradient colors={["#FFF8F3", "#FEF0E7", "#FFF8F3"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        {/* Header */}
        <LinearGradient colors={["#E8622A", "#F5A623"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 20, padding: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 22 }}>Aorane Premium ✨</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Razorpay Secure Checkout · 100% Safe</Text>
          </View>
          <Text style={{ fontSize: 32 }}>🛡️</Text>
        </LinearGradient>

        {(user?.plan as string) !== "free" && (
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#10B98122", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <View>
                <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 15 }}>Active Plan: {(user?.plan as string || "free").toUpperCase()}</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Your premium plan is active</Text>
              </View>
            </View>
          </GlassCard>
        )}

        <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12 }}>Plan Chunein</Text>
        <View style={{ gap: 12, marginBottom: 16 }}>
          {plans.map(p => (
            <TouchableOpacity key={p.key} onPress={() => { setSelectedPlan(p.key); setDiscount(0); setPromoMsg(""); setPromoCode(""); }} activeOpacity={0.85}>
              <LinearGradient
                colors={selectedPlan === p.key ? p.gradient : (isDark ? ["rgba(255,255,255,0.04)","rgba(255,255,255,0.02)"] : ["rgba(255,255,255,0.8)","rgba(240,249,255,0.6)"] as [string,string])}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ borderRadius: 20, padding: 20, borderWidth: selectedPlan === p.key ? 0 : 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)" }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Text style={{ color: selectedPlan === p.key ? "#FFF" : (isDark ? "#F0F8FF" : "#1a1a2e"), fontFamily: "Inter_700Bold", fontSize: 20 }}>{p.label}</Text>
                      <View style={{ backgroundColor: selectedPlan === p.key ? "rgba(255,255,255,0.2)" : p.color + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: selectedPlan === p.key ? "#FFF" : p.color, fontFamily: "Inter_700Bold", fontSize: 10 }}>{p.badge}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: selectedPlan === p.key ? "#FFF" : (isDark ? "#F0F8FF" : "#1a1a2e"), fontFamily: "Inter_700Bold", fontSize: 32 }}>₹{p.price}</Text>
                      <Text style={{ color: selectedPlan === p.key ? "rgba(255,255,255,0.7)" : (isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)"), fontFamily: "Inter_400Regular", fontSize: 13, paddingBottom: 4 }}>/month</Text>
                    </View>
                  </View>
                  <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: selectedPlan === p.key ? "#FFF" : (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,119,182,0.3)"), alignItems: "center", justifyContent: "center" }}>
                    {selectedPlan === p.key && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFF" }} />}
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  {p.features.map((f, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={16} color={selectedPlan === p.key ? "rgba(255,255,255,0.8)" : p.color} />
                      <Text style={{ color: selectedPlan === p.key ? "rgba(255,255,255,0.85)" : (isDark ? "rgba(255,255,255,0.65)" : "rgba(10,22,40,0.65)"), fontFamily: "Inter_400Regular", fontSize: 13 }}>{f}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <GlassCard style={{ marginBottom: 16 }}>
          <View style={{ padding: 16 }}>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 10 }}>Promo Code</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={promoCode} onChangeText={t => { setPromoCode(t); setPromoMsg(""); setDiscount(0); }}
                placeholder="Enter code (e.g. AORANE20)" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.3)"}
                style={{ flex: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.06)", borderRadius: 12, padding: 12, color: isDark ? "#FFF" : "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 14, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)", textTransform: "uppercase" }}
                autoCapitalize="characters"
              />
              <TouchableOpacity onPress={validatePromo} disabled={validatingPromo || !promoCode.trim()} style={{ backgroundColor: "#1B998B", borderRadius: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", opacity: !promoCode.trim() ? 0.5 : 1 }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>{validatingPromo ? "..." : "Apply"}</Text>
              </TouchableOpacity>
            </View>
            {promoMsg ? <Text style={{ color: discount > 0 ? "#10B981" : "#DC2626", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 8 }}>{promoMsg}</Text> : null}
          </View>
        </GlassCard>

        <LinearGradient colors={isDark ? ["rgba(255,255,255,0.06)","rgba(255,255,255,0.02)"] : ["rgba(255,255,255,0.8)","rgba(240,249,255,0.6)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.12)" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_400Regular", fontSize: 14 }}>{plan.label} Plan (1 month)</Text>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>₹{plan.price}</Text>
          </View>
          {discount > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#10B981", fontFamily: "Inter_500Medium", fontSize: 14 }}>Promo Discount ({discount}%)</Text>
              <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>-₹{plan.price - finalPrice}</Text>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)", marginVertical: 8 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16 }}>Total</Text>
            <View style={{ alignItems: "flex-end" }}>
              {discount > 0 && <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.35)", fontFamily: "Inter_400Regular", fontSize: 12, textDecorationLine: "line-through" }}>₹{plan.price}</Text>}
              <Text style={{ color: "#E8622A", fontFamily: "Inter_700Bold", fontSize: 22 }}>₹{finalPrice}/mo</Text>
            </View>
          </View>
        </LinearGradient>

        <TouchableOpacity onPress={handleUpgrade} disabled={loading} style={{ borderRadius: 16, overflow: "hidden", opacity: loading ? 0.7 : 1 }}>
          <LinearGradient colors={plan.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
            <Ionicons name={loading ? "hourglass" : "card"} size={22} color="#FFF" />
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 17 }}>
              {loading ? "Processing..." : `Upgrade for ₹${finalPrice}`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 14 }}>
          <Ionicons name="lock-closed" size={12} color={isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)"} />
          <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular" }}>256-bit SSL • Razorpay Secure • Cancel anytime</Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 16, paddingBottom: 10 }}>
          {["UPI", "Cards", "NetBanking", "Wallets"].map(m => (
            <View key={m} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.08)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.12)" }}>
              <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{m}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {success && (
        <SuccessOverlay plan={selectedPlan} inviteCode={familyInviteCode} onDone={() => { setSuccess(false); setFamilyInviteCode(null); router.replace((selectedPlan === "family" ? "/family" : "/(tabs)") as never); }} />
      )}

      {waitingForPayment && !success && (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.88)", zIndex: 998, padding: 24 }]}>
          <LinearGradient colors={["#0D2040", "#091526"]} style={{ borderRadius: 24, padding: 32, alignItems: "center", width: "100%", maxWidth: 320, borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" }}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>💳</Text>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center", marginBottom: 8 }}>Payment Processing...</Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
              Browser mein payment complete karein.{"\n"}Payment confirm hone par app automatically update ho jayega.
            </Text>
            <TouchableOpacity onPress={checkPaymentNow} disabled={loading} style={{ backgroundColor: "#3B82F6", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: "100%", alignItems: "center", marginBottom: 12, opacity: loading ? 0.6 : 1 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {loading ? "Checking..." : "✓ Payment Ho Gayi? Check Karo"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={stopPolling} style={{ paddingVertical: 10, paddingHorizontal: 20 }}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", fontSize: 13 }}>Cancel / Wapas Jao</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}
