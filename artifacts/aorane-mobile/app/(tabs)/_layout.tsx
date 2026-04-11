import { Tabs } from "expo-router";
import React, { useRef, useEffect } from "react";
import {
  Platform, StyleSheet, View, Text,
  TouchableOpacity, Animated, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, Dumbbell, ScanLine, Pill, User } from "lucide-react-native";
import { DS } from "@/lib/theme";

const P       = DS.color.primary;
const INACTIVE= DS.color.muted;
const BAR_H   = 64;
const SCAN_D  = 54;
const SCAN_LIFT = -14;

// ── Animated tab icon ────────────────────────────────────────────────────────
function TabIcon({
  Icon,
  focused,
  label,
}: {
  Icon: React.FC<{ size?: number; color?: string; strokeWidth?: number }>;
  focused: boolean;
  label: string;
}) {
  const scale  = useRef(new Animated.Value(1)).current;
  const dot    = useRef(new Animated.Value(0)).current;
  const pillW  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1.1 : 1, useNativeDriver: true, damping: 14 }),
      Animated.timing(dot,   { toValue: focused ? 1 : 0, duration: 160, useNativeDriver: true }),
      Animated.spring(pillW, { toValue: focused ? 1 : 0, useNativeDriver: true, damping: 12 }),
    ]).start();
  }, [focused]);

  return (
    <View style={ti.wrap}>
      <Animated.View style={[ti.iconBox, { transform: [{ scale }] }]}>
        {focused && (
          <View style={[StyleSheet.absoluteFill, ti.activeBg]} />
        )}
        <Icon
          size={22}
          color={focused ? P : INACTIVE}
          strokeWidth={focused ? 2.2 : 1.8}
        />
      </Animated.View>
      <Text style={[ti.label, { color: focused ? P : INACTIVE }]}>{label}</Text>
      <Animated.View style={[ti.dot, { opacity: dot, backgroundColor: P }]} />
    </View>
  );
}

const ti = StyleSheet.create({
  wrap:     { alignItems: "center", gap: 2 },
  iconBox:  {
    width: 44, height: 30, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  activeBg: {
    backgroundColor: DS.color.primarySoft,
    borderRadius: 14,
  },
  label:    { fontSize: DS.font.xs, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  dot:      { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
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

  const glowOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

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
          colors={[DS.color.primary, "#32ADE6", DS.color.green]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={sb.circle}
        >
          <ScanLine size={26} color="#FFF" strokeWidth={2} />
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
    backgroundColor: DS.color.primary,
    top: -9, left: -9,
  },
  circle: {
    width: SCAN_D, height: SCAN_D,
    borderRadius: SCAN_D / 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.95)",
    shadowColor: DS.color.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14,
    elevation: 16,
  },
  label: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: DS.color.primary, letterSpacing: 1.2, marginTop: 3,
  },
});

// ── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { name: "dashboard", Icon: Home,     label: "Home"     },
  { name: "exercise",  Icon: Dumbbell, label: "Exercise" },
  { name: "medicine",  Icon: Pill,     label: "Medical"  },
  { name: "profile",   Icon: User,     label: "Profile"  },
] as const;

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets    = useSafeAreaInsets();
  const safeBottom = insets.bottom;
  const wrapperH  = BAR_H + safeBottom + SCAN_LIFT + SCAN_D / 2;
  const activeRoute = state.routes[state.index]?.name ?? "";

  const slots: Array<"dashboard" | "exercise" | "scan" | "medicine" | "profile"> =
    ["dashboard", "exercise", "scan", "medicine", "profile"];

  return (
    <View
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: wrapperH, overflow: "visible" }}
      pointerEvents="box-none"
    >
      {/* Bar background */}
      <View style={[bar.bg, { height: BAR_H + safeBottom }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={95} tint="extraLight" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: Platform.OS === "ios"
            ? "rgba(255,255,255,0.60)"
            : "rgba(255,255,255,0.97)",
        }]} />
        <View style={bar.topLine} />
      </View>

      {/* Tab row */}
      <View style={[bar.row, { height: BAR_H, bottom: safeBottom }]}>
        {slots.map((slot) => {
          if (slot === "scan") {
            return <View key="scan-slot" style={{ flex: 1 }} pointerEvents="none" />;
          }
          const cfg     = TABS.find((t) => t.name === slot)!;
          const focused = activeRoute === slot;
          return (
            <TouchableOpacity
              key={slot}
              style={bar.tab}
              onPress={() => navigation.navigate(slot)}
              activeOpacity={0.75}
            >
              <TabIcon Icon={cfg.Icon} focused={focused} label={cfg.label} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Floating SCAN button */}
      <View
        style={[bar.scanWrap, { bottom: safeBottom + BAR_H - SCAN_D / 2 + SCAN_LIFT }]}
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 14,
  },
  topLine: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 0.5, backgroundColor: "rgba(0,0,0,0.08)",
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

// ── Root ──────────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="exercise"  />
      <Tabs.Screen name="scan"      />
      <Tabs.Screen name="medicine"  />
      <Tabs.Screen name="profile"   />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="food"  options={{ href: null }} />
      <Tabs.Screen name="diet"  options={{ href: null }} />
    </Tabs>
  );
}
