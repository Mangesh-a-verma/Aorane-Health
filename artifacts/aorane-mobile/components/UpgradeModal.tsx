import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const { height: SCREEN_H } = Dimensions.get("window");

const PLAN_NAMES: Record<string, string> = { FREE: "Free", PRO: "Pro", MAX: "Max", FAMILY: "Family" };
const UPGRADE_PRICE: Record<string, string> = { PRO: "299", MAX: "599", FAMILY: "999" };

const FEATURE_INFO: Record<string, {
  label: string;
  rows: { name: string; free: string; pro: string; max: string }[];
}> = {
  food_scan: {
    label: "Food Photo Scan",
    rows: [
      { name: "Photo Scans per day",      free: "3",         pro: "15",        max: "Unlimited" },
      { name: "Nutrition analysis",        free: "✅",        pro: "✅",        max: "✅"         },
      { name: "Macro breakdown",           free: "✅",        pro: "✅",        max: "✅"         },
      { name: "Priority AI processing",   free: "❌",        pro: "✅",        max: "✅"         },
    ],
  },
  medical_scan: {
    label: "Lab Report Scan",
    rows: [
      { name: "Medical scans per day",     free: "1",         pro: "5",         max: "Unlimited" },
      { name: "Report summary",            free: "✅",        pro: "✅",        max: "✅"         },
      { name: "Risk assessment",           free: "❌",        pro: "✅",        max: "✅"         },
      { name: "Priority AI processing",   free: "❌",        pro: "✅",        max: "✅"         },
    ],
  },
  diet_plan: {
    label: "Diet Plan Generator",
    rows: [
      { name: "Diet plans per day",        free: "1",         pro: "3",         max: "10"        },
      { name: "Personalized plan",         free: "✅",        pro: "✅",        max: "✅"         },
      { name: "Weekly chart",              free: "❌",        pro: "✅",        max: "✅"         },
      { name: "Custom calorie targets",   free: "❌",        pro: "✅",        max: "✅"         },
    ],
  },
  health_coach: {
    label: "AI Health Coach",
    rows: [
      { name: "AI suggestions per day",    free: "5",         pro: "30",        max: "Unlimited" },
      { name: "Personalized tips",         free: "✅",        pro: "✅",        max: "✅"         },
      { name: "Meal planning",             free: "❌",        pro: "✅",        max: "✅"         },
      { name: "Weekly health insights",   free: "❌",        pro: "✅",        max: "✅"         },
    ],
  },
};

function getVal(row: { free: string; pro: string; max: string }, plan: string) {
  const p = plan.toUpperCase();
  if (p === "FREE") return row.free;
  if (p === "PRO") return row.pro;
  return row.max;
}

function getTimeToMidnightIST(): string {
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const midnight = new Date(istNow);
  midnight.setUTCHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - istNow.getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PlanLimitContent({
  featureKey, currentPlan, requiredPlan, onUpgrade, onClose,
}: {
  featureKey: string; currentPlan: string; requiredPlan: string;
  onUpgrade: () => void; onClose: () => void;
}) {
  const lockPulse = useRef(new Animated.Value(1)).current;
  const info = FEATURE_INFO[featureKey] ?? FEATURE_INFO.food_scan;
  const reqUpper = requiredPlan.toUpperCase();
  const curUpper = currentPlan.toUpperCase();
  const price = UPGRADE_PRICE[reqUpper] ?? "299";

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulse, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(lockPulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <>
      <View style={{ alignItems: "center", marginBottom: 14 }}>
        <Animated.View style={{ transform: [{ scale: lockPulse }] }}>
          <LinearGradient colors={["#00A693", "#0B84D6"]} style={s.iconBg}>
            <Ionicons name="lock-closed" size={30} color="#FFF" />
          </LinearGradient>
        </Animated.View>
      </View>

      <Text style={s.title}>
        Yeh feature {PLAN_NAMES[reqUpper] ?? requiredPlan} plan mein hai
      </Text>
      <Text style={s.subtitle}>{info.label} ke liye upgrade karo</Text>

      <View style={s.compareCard}>
        <View style={s.compareHeader}>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={s.comparePlanName}>{PLAN_NAMES[curUpper] ?? currentPlan}</Text>
            <Text style={s.comparePlanSub}>Aapka plan</Text>
          </View>
          <View style={s.compareArrow}>
            <Ionicons name="arrow-forward" size={13} color="#FFF" />
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[s.comparePlanName, { color: "#00A693" }]}>{PLAN_NAMES[reqUpper] ?? requiredPlan}</Text>
            <Text style={s.comparePlanSub}>Upgrade karo</Text>
          </View>
        </View>

        {info.rows.map((row, i) => {
          const curVal = getVal(row, curUpper);
          const newVal = getVal(row, reqUpper);
          const isHighlighted = curVal !== newVal;
          return (
            <View key={i} style={[s.compareRow, isHighlighted && s.compareRowHighlighted]}>
              <Text style={s.compareFeatureName} numberOfLines={1}>{row.name}</Text>
              <View style={s.compareValues}>
                <Text style={[s.compareVal, curVal === "❌" && { color: "#EF4444" }]}>{curVal}</Text>
                <Ionicons name="arrow-forward" size={9} color="#CBD5E1" style={{ marginHorizontal: 4 }} />
                <Text style={[s.compareVal, { color: "#00A693", fontFamily: "Inter_700Bold" }]}>{newVal}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={s.pricePill}>
        <Ionicons name="pricetag-outline" size={12} color="#00A693" />
        <Text style={s.priceText}>Sirf ₹{price}/month</Text>
      </View>

      <TouchableOpacity onPress={onUpgrade} activeOpacity={0.85} style={{ marginBottom: 10 }}>
        <LinearGradient colors={["#00A693", "#0B84D6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
          <Text style={s.primaryBtnText}>Upgrade Karo →</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.ghostBtn}>
        <Text style={s.ghostBtnText}>Baad mein</Text>
      </TouchableOpacity>
    </>
  );
}

function DailyLimitContent({
  featureLabel, used, limit, onUpgrade, onClose,
}: {
  featureLabel: string; used: number; limit: number;
  onUpgrade: () => void; onClose: () => void;
}) {
  const [countdown, setCountdown] = useState(getTimeToMidnightIST());
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pct = limit > 0 ? Math.min(used / limit, 1) : 1;

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
    const interval = setInterval(() => setCountdown(getTimeToMidnightIST()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <View style={{ alignItems: "center", marginBottom: 14 }}>
        <LinearGradient colors={["#F59E0B", "#EF4444"]} style={s.iconBg}>
          <Ionicons name="time" size={30} color="#FFF" />
        </LinearGradient>
      </View>

      <Text style={s.title}>Aaj ki limit khatam ho gayi!</Text>
      <Text style={s.subtitle}>{featureLabel} ke saare daily uses ho gaye</Text>

      <View style={s.progressCard}>
        <View style={s.progressHeader}>
          <Text style={s.progressLabel}>{featureLabel}</Text>
          <Text style={s.progressCount}>{used}/{limit} used</Text>
        </View>
        <View style={s.progressTrack}>
          <Animated.View
            style={[
              s.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
        <View style={s.resetRow}>
          <Ionicons name="moon-outline" size={12} color="#90A4B5" />
          <Text style={s.resetText}>Kal subah reset hoga</Text>
          <View style={s.countdownBadge}>
            <Ionicons name="timer-outline" size={10} color="#0B84D6" />
            <Text style={s.countdownText}>{countdown} mein</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={onUpgrade} activeOpacity={0.85} style={{ marginBottom: 10 }}>
        <LinearGradient colors={["#00A693", "#0B84D6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
          <Text style={s.primaryBtnText}>Pro plan leke unlimited karo →</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.ghostBtn}>
        <Text style={s.ghostBtnText}>Kal tak wait karein</Text>
      </TouchableOpacity>
    </>
  );
}

export type UpgradeModalConfig =
  | { type: "plan_limit";  featureKey: string; featureLabel: string; currentPlan: string; requiredPlan: string }
  | { type: "daily_limit"; featureKey: string; featureLabel: string; used: number; limit: number };

export function UpgradeModal({ config, onClose }: { config: UpgradeModalConfig | null; onClose: () => void }) {
  const slideY  = useRef(new Animated.Value(SCREEN_H * 0.75)).current;
  const bgAlpha = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (config) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.spring(slideY,  { toValue: 0,   tension: 62, friction: 10, useNativeDriver: true }),
        Animated.timing(bgAlpha, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,  { toValue: SCREEN_H * 0.75, duration: 210, useNativeDriver: true }),
        Animated.timing(bgAlpha, { toValue: 0,               duration: 210, useNativeDriver: true }),
      ]).start();
    }
  }, [config]);

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onClose();
    try { router.push("/subscription" as never); } catch { }
  };

  if (!config) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar backgroundColor="rgba(0,0,0,0.72)" barStyle="light-content" />
      <Animated.View style={[s.overlay, { opacity: bgAlpha }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <View style={s.sheetContainer} pointerEvents="box-none">
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={s.handle} />
          {config.type === "plan_limit" ? (
            <PlanLimitContent
              featureKey={config.featureKey}
              currentPlan={config.currentPlan}
              requiredPlan={config.requiredPlan}
              onUpgrade={handleUpgrade}
              onClose={onClose}
            />
          ) : (
            <DailyLimitContent
              featureLabel={config.featureLabel}
              used={config.used}
              limit={config.limit}
              onUpgrade={handleUpgrade}
              onClose={onClose}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.72)" },
  sheetContainer: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 38,
    paddingTop: 8,
    maxHeight: SCREEN_H * 0.78,
  },
  handle: {
    width: 40, height: 4, backgroundColor: "#E2EDF4",
    borderRadius: 2, alignSelf: "center", marginBottom: 18,
  },
  iconBg: {
    width: 68, height: 68, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold", fontSize: 19, color: "#1A2B3C",
    textAlign: "center", marginBottom: 6, lineHeight: 26,
  },
  subtitle: {
    fontFamily: "Inter_400Regular", fontSize: 13, color: "#90A4B5",
    textAlign: "center", marginBottom: 14, lineHeight: 19,
  },
  compareCard: {
    backgroundColor: "#F0F9FF", borderRadius: 18, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#BAE6FD",
  },
  compareHeader: {
    flexDirection: "row", alignItems: "center", marginBottom: 10,
  },
  comparePlanName: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#1A2B3C" },
  comparePlanSub: { fontFamily: "Inter_400Regular", fontSize: 10, color: "#90A4B5", marginTop: 1 },
  compareArrow: {
    backgroundColor: "#0B84D6", borderRadius: 12,
    width: 22, height: 22, alignItems: "center", justifyContent: "center", marginHorizontal: 6,
  },
  compareRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 6,
    paddingHorizontal: 8, borderRadius: 8, marginBottom: 2,
  },
  compareRowHighlighted: {
    backgroundColor: "#00A69310",
    borderWidth: 1, borderColor: "#00A69328",
  },
  compareFeatureName: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: "#374151", flex: 1,
  },
  compareValues: { flexDirection: "row", alignItems: "center" },
  compareVal: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#90A4B5" },
  pricePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#86EFAC",
    borderRadius: 99, paddingVertical: 6, paddingHorizontal: 14,
    alignSelf: "center", marginBottom: 14,
  },
  priceText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#00A693" },
  primaryBtn: { borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#FFF", letterSpacing: 0.2 },
  ghostBtn: { paddingVertical: 12, alignItems: "center" },
  ghostBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#90A4B5" },
  progressCard: {
    backgroundColor: "#FFFBEB", borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#1A2B3C" },
  progressCount: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#EF4444" },
  progressTrack: { height: 10, backgroundColor: "#FEF3C7", borderRadius: 5, overflow: "hidden", marginBottom: 10 },
  progressFill: { height: "100%", borderRadius: 5, backgroundColor: "#EF4444" },
  resetRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  resetText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#90A4B5", flex: 1 },
  countdownBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  countdownText: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#0B84D6" },
});
