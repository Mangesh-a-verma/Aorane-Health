import { Tabs } from "expo-router";
import React, { useRef, useEffect } from "react";
import {
  Platform, StyleSheet, View, Text,
  TouchableOpacity, Animated, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
type BottomTabBarProps = { state: { routes: Array<{ name: string }>; index: number }; navigation: { navigate: (name: string) => void } };
import { Home, Dumbbell, ScanLine, Pill, User } from "lucide-react-native";
import { DS } from "@/lib/theme";

const INACTIVE  = DS.color.muted;
const BAR_H     = 64;
const SCAN_D    = 54;

// ── Tab Icon ──────────────────────────────────────────────────────────────────
function TabIcon({ Icon, focused, label }: {
  Icon: React.FC<{ size?: number; color?: string; strokeWidth?: number }>;
  focused: boolean; label: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1.1 : 1, useNativeDriver: Platform.OS !== "web", damping: 14 }).start();
  }, [focused]);

  return (
    <View style={ti.wrap}>
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <Icon
          size={23}
          color={focused ? DS.color.primary : INACTIVE}
          strokeWidth={focused ? 2.2 : 1.7}
        />
      </Animated.View>
      {focused ? (
        <Text style={ti.label}>{label}</Text>
      ) : null}
    </View>
  );
}

const ti = StyleSheet.create({
  wrap:  { alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: DS.color.primary, letterSpacing: 0.2 },
});

// ── SCAN Button ───────────────────────────────────────────────────────────────
function ScanButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 1300, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 1.00, duration: 1300, useNativeDriver: Platform.OS !== "web" }),
      ])
    ).start();
  }, []);

  return (
    <Pressable
      onPressIn ={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: Platform.OS !== "web", damping: 10 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1.00, useNativeDriver: Platform.OS !== "web", damping: 8  }).start()}
      onPress={onPress}
      hitSlop={14}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <Animated.View style={[sb.pulse, { transform: [{ scale: pulse }] }]} />
        <LinearGradient
          colors={["#E8622A", "#F5A623"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={sb.circle}
        >
          <ScanLine size={25} color="#FFF" strokeWidth={2.2} />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const sb = StyleSheet.create({
  pulse: {
    position: "absolute",
    width: SCAN_D + 16, height: SCAN_D + 16,
    borderRadius: (SCAN_D + 16) / 2,
    backgroundColor: DS.color.primarySoft,
    top: -8, left: -8,
  },
  circle: {
    width: SCAN_D, height: SCAN_D,
    borderRadius: SCAN_D / 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#FFF",
    shadowColor: DS.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10,
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

const SLOTS: Array<"dashboard" | "exercise" | "scan" | "medicine" | "profile"> =
  ["dashboard", "exercise", "scan", "medicine", "profile"];

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets     = useSafeAreaInsets();
  const safeBottom = insets.bottom;
  const totalH     = BAR_H + safeBottom;
  const active     = state.routes[state.index]?.name ?? "";

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: totalH + SCAN_D / 2 }} pointerEvents="box-none">

      {/* Background bar */}
      <View style={[bar.bg, { height: totalH }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, bar.fill]} />
        <View style={bar.topLine} />
      </View>

      {/* Tab row */}
      <View style={[bar.row, { height: BAR_H, bottom: safeBottom }]}>
        {SLOTS.map((slot) => {
          if (slot === "scan") {
            return (
              <View key="scan" style={bar.scanSlot}>
                <ScanButton onPress={() => navigation.navigate("scan")} />
              </View>
            );
          }
          const cfg     = TABS.find((t) => t.name === slot)!;
          const focused = active === slot;
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
  );
}

const bar = StyleSheet.create({
  bg: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    overflow: "hidden",
    shadowColor: "#594139",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 14,
    elevation: 14,
  },
  fill: {
    backgroundColor: Platform.OS === "ios" ? "rgba(255,252,249,0.85)" : "#FFFCF9",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  topLine: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 1, backgroundColor: "rgba(232,98,42,0.10)",
  },
  row: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
  },
  tabBtn: {
    flex: 1, height: BAR_H,
    alignItems: "center", justifyContent: "center",
  },
  scanSlot: {
    width: SCAN_D + 32,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
    marginTop: -(SCAN_D / 2),
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
      <Tabs.Screen name="food"  options={{ href: null }} />
    </Tabs>
  );
}
