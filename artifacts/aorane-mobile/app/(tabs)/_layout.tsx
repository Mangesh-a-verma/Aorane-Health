import { Tabs } from "expo-router";
import React, { useRef, useEffect } from "react";
import {
  Platform, StyleSheet, View, Text,
  TouchableOpacity, Animated, Pressable, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, Dumbbell, ScanLine, Pill, User } from "lucide-react-native";
import { DS } from "@/lib/theme";

const { width: W } = Dimensions.get("window");

const INACTIVE = DS.color.muted;
const BAR_H    = 68;
const SCAN_D   = 52;
const SCAN_LIFT = -6;
const PILL_H   = 52;
const SIDE_PAD = 16;

// ── Animated Tab Icon ─────────────────────────────────────────────────────────
function TabIcon({
  Icon, focused, label,
}: {
  Icon: React.FC<{ size?: number; color?: string; strokeWidth?: number }>;
  focused: boolean;
  label: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const bgOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1.08 : 1, useNativeDriver: true, damping: 12 }),
      Animated.timing(bgOp,  { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  return (
    <View style={ti.wrap}>
      <Animated.View style={[ti.iconWrap, { transform: [{ scale }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, ti.activeBg, { opacity: bgOp }]} />
        <Icon
          size={22}
          color={focused ? DS.color.primary : INACTIVE}
          strokeWidth={focused ? 2.2 : 1.7}
        />
      </Animated.View>
      {focused && (
        <Text style={ti.label} numberOfLines={1}>{label}</Text>
      )}
    </View>
  );
}

const ti = StyleSheet.create({
  wrap:     { alignItems: "center", justifyContent: "center" },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  activeBg: {
    backgroundColor: DS.color.primarySoft,
    borderRadius: 20,
  },
  label: {
    fontSize: 10.5,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.primary,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});

// ── Floating SCAN Button ──────────────────────────────────────────────────────
function ScanButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Pressable
      onPressIn ={() => Animated.spring(scale, { toValue: 0.90, useNativeDriver: true, damping: 10 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, damping: 8  }).start()}
      onPress={onPress}
      hitSlop={14}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <Animated.View style={[sb.pulseRing, { transform: [{ scale: pulse }] }]} />
        <LinearGradient
          colors={[DS.color.headerStart, DS.color.headerEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={sb.circle}
        >
          <ScanLine size={24} color="#FFF" strokeWidth={2.2} />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const sb = StyleSheet.create({
  pulseRing: {
    position: "absolute",
    width: SCAN_D + 14, height: SCAN_D + 14,
    borderRadius: (SCAN_D + 14) / 2,
    backgroundColor: DS.color.primarySoft,
    top: -7, left: -7,
  },
  circle: {
    width: SCAN_D, height: SCAN_D,
    borderRadius: SCAN_D / 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#FFF",
    shadowColor: DS.color.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 12,
    elevation: 14,
  },
});

// ── Tab Config ────────────────────────────────────────────────────────────────
const TABS = [
  { name: "dashboard", Icon: Home,     label: "Home"    },
  { name: "exercise",  Icon: Dumbbell, label: "Fitness" },
  { name: "medicine",  Icon: Pill,     label: "Medicine"},
  { name: "profile",   Icon: User,     label: "Profile" },
] as const;

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets      = useSafeAreaInsets();
  const safeBottom  = insets.bottom;
  const wrapperH    = BAR_H + safeBottom + Math.abs(SCAN_LIFT) + SCAN_D / 2;
  const activeRoute = state.routes[state.index]?.name ?? "";

  const slots: Array<"dashboard" | "exercise" | "scan" | "medicine" | "profile"> =
    ["dashboard", "exercise", "scan", "medicine", "profile"];

  return (
    <View
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: wrapperH, overflow: "visible" }}
      pointerEvents="box-none"
    >
      {/* Pill bar background */}
      <View style={[bar.bg, { height: BAR_H + safeBottom, paddingBottom: safeBottom }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: Platform.OS === "ios"
            ? "rgba(255,252,248,0.72)"
            : "rgba(255,252,248,0.97)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }]} />
        <View style={bar.topBorder} />
      </View>

      {/* Pill row */}
      <View style={[bar.pillRow, { bottom: safeBottom + (BAR_H - PILL_H) / 2 }]}>
        <View style={bar.pill}>
          {slots.map((slot) => {
            if (slot === "scan") {
              return <View key="scan-gap" style={{ width: SCAN_D + 16 }} />;
            }
            const cfg     = TABS.find((t) => t.name === slot)!;
            const focused = activeRoute === slot;
            return (
              <TouchableOpacity
                key={slot}
                style={bar.tabBtn}
                onPress={() => navigation.navigate(slot)}
                activeOpacity={0.8}
              >
                <TabIcon Icon={cfg.Icon} focused={focused} label={cfg.label} />
              </TouchableOpacity>
            );
          })}
        </View>
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
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#E8622A",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
  },
  topBorder: {
    position: "absolute", top: 0, left: 24, right: 24,
    height: 1, backgroundColor: "rgba(232,98,42,0.10)",
  },
  pillRow: {
    position: "absolute", left: SIDE_PAD, right: SIDE_PAD,
    height: PILL_H,
  },
  pill: {
    flex: 1, height: PILL_H,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: PILL_H / 2,
    borderWidth: 1,
    borderColor: "rgba(232,98,42,0.10)",
    paddingHorizontal: 8,
    shadowColor: "#E8622A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBtn: {
    flex: 1, height: PILL_H,
    alignItems: "center", justifyContent: "center",
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
