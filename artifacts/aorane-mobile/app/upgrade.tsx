import React, { useState } from "react";
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

const PLANS = [
  {
    key: "pro", label: "Pro", price: 199, badge: "Popular",
    color: "#0077B6", gradient: ["#0077B6","#023E8A"] as [string,string],
    features: ["AI Food Scan", "Personalized Diet Plan", "Health Reports PDF", "Medicine Reminders", "Exercise Tracking", "Water Tracker"],
  },
  {
    key: "max", label: "Max", price: 249, badge: "Best Value",
    color: "#8B5CF6", gradient: ["#8B5CF6","#6D28D9"] as [string,string],
    features: ["Sab Pro features +", "Medical Report AI Scanner", "Advanced Gemini AI", "Priority Support", "Family Add-on", "Unlimited History"],
  },
];

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

export default function UpgradeScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth() as { user: Record<string, unknown>; refreshUser?: () => void };
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "max">("pro");
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoMsg, setPromoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bg = isDark ? "#010814" : "#F0F9FF";

  const plan = PLANS.find(p => p.key === selectedPlan)!;
  const finalPrice = Math.round(plan.price * (1 - discount / 100));

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

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const orderRes = await api.createPaymentOrder(selectedPlan, promoCode.trim().toUpperCase() || undefined);
      if (orderRes.isTestMode) {
        Alert.alert(
          "Test Mode",
          `Razorpay keys configure nahi hain. Test mein payment directly activate karein?\n\nPlan: ${plan.label}\nAmount: ₹${finalPrice}`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Test Activate", onPress: async () => {
              await api.verifyPayment({ paymentId: orderRes.paymentId, plan: selectedPlan, isTestMode: true });
              Alert.alert("🎉 Congratulations!", `${plan.label} Plan activate ho gaya!`, [
                { text: "Done", onPress: () => router.back() }
              ]);
            }},
          ]
        );
      } else if (orderRes.razorpayKeyId && orderRes.razorpayOrderId) {
        const rzpUrl = `https://rzp.io/l/${orderRes.razorpayOrderId}`;
        Alert.alert("Razorpay Checkout", `Amount: ₹${finalPrice}\nOrder ID: ${orderRes.razorpayOrderId}\n\nBrowser mein payment page khulega`, [
          { text: "Cancel", style: "cancel" },
          { text: "Pay Now", onPress: () => Linking.openURL(rzpUrl) },
        ]);
      }
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Payment failed");
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={isDark ? ["#010814","#041428","#020C20"] : ["#E0F2FE","#BAE6FD","#F0FDF4"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 100, paddingHorizontal: 16 }}>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color={isDark ? "#FFF" : "#0077B6"} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 22 }}>AORANE Upgrade ✨</Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Premium features unlock karo</Text>
          </View>
        </View>

        {(user?.plan as string) !== "free" && (
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#10B98122", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <View>
                <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 15 }}>Active Plan: {(user?.plan as string || "free").toUpperCase()}</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Aapka premium plan active hai</Text>
              </View>
            </View>
          </GlassCard>
        )}

        <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12 }}>Plan Chunein</Text>
        <View style={{ gap: 12, marginBottom: 16 }}>
          {PLANS.map(p => (
            <TouchableOpacity key={p.key} onPress={() => setSelectedPlan(p.key as "pro" | "max")} activeOpacity={0.85}>
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
                value={promoCode} onChangeText={setPromoCode}
                placeholder="Code daalo" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.3)"}
                style={{ flex: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.06)", borderRadius: 12, padding: 12, color: isDark ? "#FFF" : "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 14, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)", textTransform: "uppercase" }}
                autoCapitalize="characters"
              />
              <TouchableOpacity onPress={validatePromo} disabled={validatingPromo} style={{ backgroundColor: "#1B998B", borderRadius: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>{validatingPromo ? "..." : "Apply"}</Text>
              </TouchableOpacity>
            </View>
            {promoMsg ? <Text style={{ color: discount > 0 ? "#10B981" : "#DC2626", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 8 }}>{promoMsg}</Text> : null}
          </View>
        </GlassCard>

        <LinearGradient colors={isDark ? ["rgba(255,255,255,0.06)","rgba(255,255,255,0.02)"] : ["rgba(255,255,255,0.8)","rgba(240,249,255,0.6)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.12)" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontFamily: "Inter_400Regular", fontSize: 14 }}>{plan.label} Plan</Text>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>₹{plan.price}</Text>
          </View>
          {discount > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#10B981", fontFamily: "Inter_500Medium", fontSize: 14 }}>Discount ({discount}%)</Text>
              <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>-₹{plan.price - finalPrice}</Text>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)", marginVertical: 8 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16 }}>Total</Text>
            <Text style={{ color: "#0077B6", fontFamily: "Inter_700Bold", fontSize: 20 }}>₹{finalPrice}/mo</Text>
          </View>
        </LinearGradient>

        <TouchableOpacity onPress={handleUpgrade} disabled={loading} style={{ borderRadius: 16, overflow: "hidden" }}>
          <LinearGradient colors={plan.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
            <Ionicons name="card" size={22} color="#FFF" />
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 17 }}>{loading ? "Processing..." : `₹${finalPrice} mein Upgrade Karo`}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 10 }}>Razorpay secure payment • Kabhi bhi cancel kar sako</Text>
      </ScrollView>
    </View>
  );
}
