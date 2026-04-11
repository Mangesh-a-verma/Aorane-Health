import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import {
  Platform, StyleSheet, View, Text,
  TouchableOpacity, Animated, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const PRIMARY  = "#0077B6";
const SKY      = "#0EA5E9";
const ACCENT   = "#00B896";
const INACTIVE = "rgba(13,31,51,0.30)";
const BAR_H    = 64;   // visible tab bar height
const SCAN_D   = 56;   // scan button diameter
const SCAN_LIFT = 4;   // pixels the button floats above bar top

// ── Animated tab icon ────────────────────────────────────────────────────────
function TabIcon({ name, focused, label }: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const dot   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1.18 : 1, useNativeDriver: true, damping: 14 }),
      Animated.timing(dot,   { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  return (
    <View style={ti.wrap}>
      <Animated.View style={[ti.icon, { transform: [{ scale }] }]}>
        {focused && (
          <LinearGradient
            colors={["rgba(0,119,182,0.14)", "rgba(14,165,233,0.07)"]}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Ionicons name={name} size={22} color={focused ? PRIMARY : INACTIVE} />
      </Animated.View>
      <Text style={[ti.label, { color: focused ? PRIMARY : INACTIVE }]}>{label}</Text>
      {focused && <Animated.View style={[ti.dot, { opacity: dot }]} />}
    </View>
  );
}
const ti = StyleSheet.create({
  wrap:  { alignItems: "center", gap: 2 },
  icon:  { width: 44, height: 30, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  dot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: PRIMARY, marginTop: 1 },
});

// ── Floating SCAN button ─────────────────────────────────────────────────────
function ScanButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });

  return (
    <Pressable
      onPressIn ={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, damping: 12 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, damping: 10 }).start()}
      onPress={onPress}
      hitSlop={12}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <Animated.View style={[sb.glow, { opacity: glowOp }]} />
        <LinearGradient
          colors={[PRIMARY, SKY, ACCENT]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={sb.circle}
        >
          <Ionicons name="scan-outline" size={28} color="#FFF" />
        </LinearGradient>
        <Text style={sb.label}>SCAN</Text>
      </Animated.View>
    </Pressable>
  );
}
const sb = StyleSheet.create({
  glow: {
    position: "absolute",
    width: SCAN_D + 18, height: SCAN_D + 18,
    borderRadius: (SCAN_D + 18) / 2,
    backgroundColor: SKY, opacity: 0.3,
    top: -9, left: -9,
  },
  circle: {
    width: SCAN_D, height: SCAN_D,
    borderRadius: SCAN_D / 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.92)",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14,
    elevation: 16,
  },
  label: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: PRIMARY, letterSpacing: 1, marginTop: 3,
  },
});

// ── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { name: "dashboard", on: "home"          as const, off: "home-outline"           as const, label: "Home"     },
  { name: "exercise",  on: "barbell"       as const, off: "barbell-outline"        as const, label: "Exercise" },
  { name: "medicine",  on: "medkit"        as const, off: "medkit-outline"         as const, label: "Medical"  },
  { name: "profile",   on: "person-circle" as const, off: "person-circle-outline"  as const, label: "Profile"  },
];

// ── Custom Tab Bar ───────────────────────────────────────────────────────────
// Uses a single outer wrapper with overflow:visible so the floating
// scan button can escape the bar bounds on Android & iOS equally.
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom;

  // Total height the wrapper occupies (bar + safe area + space for scan btn)
  const wrapperH = BAR_H + safeBottom + SCAN_LIFT + SCAN_D / 2;

  const activeRoute = state.routes[state.index]?.name ?? "";

  // Order: Home | Exercise | SCAN (center) | Medical | Profile
  const slots: Array<"dashboard" | "exercise" | "scan" | "medicine" | "profile"> =
    ["dashboard", "exercise", "scan", "medicine", "profile"];

  return (
    <View
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: wrapperH, overflow: "visible" }}
      pointerEvents="box-none"
    >
      {/* ── Bar background ─────────────────────────────────── */}
      <View style={[bar.bg, { height: BAR_H + safeBottom }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={90} tint="extraLight" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, bar.solid,
          { backgroundColor: Platform.OS === "ios" ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.97)" }
        ]} />
        <View style={bar.topLine} />
      </View>

      {/* ── Tab row (3 normal tabs + center placeholder) ───── */}
      <View style={[bar.row, { height: BAR_H, bottom: safeBottom }]}>
        {slots.map((slot) => {
          if (slot === "scan") {
            // Transparent placeholder — same width as other tabs
            return <View key="scan-slot" style={{ flex: 1 }} pointerEvents="none" />;
          }
          const cfg     = TABS.find((t) => t.name === slot)!;
          const focused = activeRoute === slot;
          return (
            <TouchableOpacity
              key={slot}
              style={bar.tab}
              onPress={() => navigation.navigate(slot)}
              activeOpacity={0.7}
            >
              <TabIcon
                name={focused ? cfg.on : cfg.off}
                focused={focused}
                label={cfg.label}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Floating SCAN button — absolutely centred, above bar ── */}
      <View
        style={[
          bar.scanWrap,
          // bottomOffset: position button so its CENTRE sits at bar top + SCAN_LIFT
          { bottom: safeBottom + BAR_H - SCAN_D / 2 + SCAN_LIFT },
        ]}
        pointerEvents="box-none"
      >
        <ScanButton onPress={() => navigation.navigate("scan")} />
      </View>
    </View>
  );
}

const bar = StyleSheet.create({
  bg: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    overflow: "hidden",
  },
  solid: {
    borderTopWidth: 0.8, borderTopColor: "rgba(0,119,182,0.12)",
  },
  topLine: {
    position: "absolute", top: 0, left: 32, right: 32,
    height: 1, backgroundColor: "rgba(255,255,255,0.9)",
  },
  row: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row",
  },
  tab: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingTop: 8,
  },
  scanWrap: {
    position: "absolute", left: 0, right: 0,
    alignItems: "center",
  },
});

// ── Root ─────────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* Visible tabs — order: Home | Exercise | Scan | Medical | Profile */}
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="exercise"  />
      <Tabs.Screen name="scan"      />
      <Tabs.Screen name="medicine"  />
      <Tabs.Screen name="profile"   />

      {/* Hidden — accessible via router.push */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="food"  options={{ href: null }} />
      <Tabs.Screen name="diet"  options={{ href: null }} />
    </Tabs>
  );
}
