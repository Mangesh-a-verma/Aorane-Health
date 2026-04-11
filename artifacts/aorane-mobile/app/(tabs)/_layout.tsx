import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useEffect, useCallback } from "react";
import {
  Platform, StyleSheet, View, Text,
  TouchableOpacity, Animated, Dimensions, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const PRIMARY  = "#0077B6";
const SKY      = "#0EA5E9";
const ACCENT   = "#00B896";
const INACTIVE = "rgba(13,31,51,0.30)";
const BAR_H    = 64;   // tab bar height (above safe area)
const SCAN_D   = 60;   // scan button diameter
const SCAN_LIFT = 20;  // how much it floats above the bar

// ── Individual icon + label ──────────────────────────────────────────────────
function TabIcon({
  name, focused, label,
}: { name: keyof typeof Ionicons.glyphMap; focused: boolean; label: string }) {
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
  wrap:  { alignItems: "center", gap: 2, paddingTop: 4 },
  icon:  { width: 44, height: 30, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  dot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: PRIMARY, marginTop: 1 },
});

// ── Floating SCAN button (rendered outside the tab row) ──────────────────────
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

  const glowOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, damping: 12 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 10 }).start()}
      onPress={onPress}
      style={sb.wrapper}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        {/* Glow halo */}
        <Animated.View style={[sb.glow, { opacity: glowOp }]} />
        {/* Button */}
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
  wrapper: { alignItems: "center", justifyContent: "flex-end" },
  glow: {
    position: "absolute",
    width: SCAN_D + 20, height: SCAN_D + 20,
    borderRadius: (SCAN_D + 20) / 2,
    backgroundColor: SKY,
    top: -10, left: -10,
  },
  circle: {
    width: SCAN_D, height: SCAN_D,
    borderRadius: SCAN_D / 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 16,
  },
  label: { fontSize: 9, fontFamily: "Inter_700Bold", color: PRIMARY, letterSpacing: 1, marginTop: 3 },
});

// ── ROUTE CONFIG ─────────────────────────────────────────────────────────────
const ROUTES = [
  { name: "dashboard", iconOn: "home"           as const, iconOff: "home-outline"            as const, label: "Home"     },
  { name: "index",     iconOn: "pulse"          as const, iconOff: "pulse-outline"           as const, label: "Activity" },
  { name: "scan",      iconOn: "scan"           as const, iconOff: "scan-outline"            as const, label: "Scan"     }, // centre
  { name: "profile",   iconOn: "person-circle"  as const, iconOff: "person-circle-outline"   as const, label: "Profile"  },
];

// ── CUSTOM TAB BAR (overflow: visible — the REAL fix for floating button) ─────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const totalHeight = BAR_H + insets.bottom;

  const activeRoute = state.routes[state.index]?.name;

  return (
    // Outer container: overflow visible so the floating button can escape the bar bounds
    <View style={[ctb.outerWrap, { height: totalHeight + SCAN_LIFT }]} pointerEvents="box-none">

      {/* ── Background card (solid, at bottom) ─────────────────────── */}
      <View style={[ctb.bar, { height: totalHeight }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={85} tint="extraLight" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: Platform.OS === "ios" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.97)",
          borderTopWidth: 0.8,
          borderTopColor: "rgba(0,119,182,0.12)",
        }]} />
        {/* top highlight */}
        <View style={ctb.topLine} />
      </View>

      {/* ── Tab row ─────────────────────────────────────────────────── */}
      <View style={[ctb.row, { height: BAR_H, bottom: insets.bottom }]}>
        {ROUTES.map((r) => {
          const isFocused = activeRoute === r.name;

          // ── Centre SCAN button ─────────────────────────────────
          if (r.name === "scan") {
            return (
              <View key="scan" style={ctb.scanSlot} pointerEvents="box-none">
                <View style={[ctb.scanFloat, { bottom: BAR_H - (SCAN_D / 2) - SCAN_LIFT }]}>
                  <ScanButton onPress={() => navigation.navigate("scan")} />
                </View>
              </View>
            );
          }

          // ── Regular tab ───────────────────────────────────────
          return (
            <TouchableOpacity
              key={r.name}
              style={ctb.tabItem}
              onPress={() => navigation.navigate(r.name)}
              activeOpacity={0.75}
            >
              <TabIcon
                name={isFocused ? r.iconOn : r.iconOff}
                focused={isFocused}
                label={r.label}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const ctb = StyleSheet.create({
  outerWrap: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    // overflow VISIBLE is the critical fix — allows scan btn to float above bar
    overflow: "visible",
  },
  bar: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    overflow: "hidden",
  },
  topLine: {
    position: "absolute", top: 0, left: 32, right: 32,
    height: 1, backgroundColor: "rgba(255,255,255,0.85)",
  },
  row: {
    position: "absolute",
    left: 0, right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    overflow: "visible",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
  },
  scanSlot: {
    flex: 1,
    alignItems: "center",
    overflow: "visible",
  },
  scanFloat: {
    position: "absolute",
    alignItems: "center",
  },
});

// ── ROOT LAYOUT ──────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" }, // hide default bar — we use custom
      }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="index"     />
      <Tabs.Screen name="scan"      />
      <Tabs.Screen name="profile"   />

      {/* Hidden sub-screens — not shown in tab bar */}
      <Tabs.Screen name="food"     options={{ href: null }} />
      <Tabs.Screen name="exercise" options={{ href: null }} />
      <Tabs.Screen name="medicine" options={{ href: null }} />
      <Tabs.Screen name="diet"     options={{ href: null }} />
    </Tabs>
  );
}
