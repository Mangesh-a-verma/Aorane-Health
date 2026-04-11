import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import {
  Platform, StyleSheet, View, Text,
  TouchableOpacity, Animated, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W } = Dimensions.get("window");
const PRIMARY = "#0077B6";
const SKY = "#0EA5E9";
const ACCENT = "#00B896";
const INACTIVE = "rgba(13,31,51,0.32)";
const BAR_HEIGHT = 72;
const SCAN_SIZE = 62;
const SCAN_LIFT = 22;

function TabIcon({ name, focused, label }: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: focused ? 1.15 : 1, useNativeDriver: true, damping: 14 }),
      Animated.timing(dotAnim, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  return (
    <View style={ti.wrap}>
      <Animated.View style={[ti.iconWrap, focused && ti.activeIconWrap, { transform: [{ scale: scaleAnim }] }]}>
        {focused && (
          <LinearGradient
            colors={["rgba(0,119,182,0.12)", "rgba(14,165,233,0.08)"]}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Ionicons name={name} size={22} color={focused ? PRIMARY : INACTIVE} />
      </Animated.View>
      <Animated.Text style={[ti.label, { color: focused ? PRIMARY : INACTIVE, opacity: Animated.add(0.55, Animated.multiply(dotAnim, 0.45)) }]}>
        {label}
      </Animated.Text>
      {focused && (
        <Animated.View style={[ti.activeDot, { opacity: dotAnim }]} />
      )}
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: { alignItems: "center", gap: 2, paddingTop: 6 },
  iconWrap: {
    width: 46, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  activeIconWrap: { borderRadius: 15 },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  activeDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: PRIMARY, marginTop: 1,
  },
});

function ScanTabButton(props: BottomTabBarButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  function handlePressIn() {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, damping: 12 }).start();
  }
  function handlePressOut() {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 10 }).start();
  }

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <View style={scan.container} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={props.onPress ?? undefined}
        style={scan.touch}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {/* Outer glow ring */}
          <Animated.View style={[scan.glowRing, { opacity: glowOpacity }]} />
          <LinearGradient
            colors={[PRIMARY, SKY, ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={scan.btn}
          >
            <Ionicons name="scan-outline" size={28} color="#FFF" />
          </LinearGradient>
        </Animated.View>
        <Text style={scan.label}>SCAN</Text>
      </TouchableOpacity>
    </View>
  );
}

const scan = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center",
    justifyContent: "flex-start",
    top: -(SCAN_LIFT),
    height: BAR_HEIGHT + SCAN_LIFT,
  },
  touch: { alignItems: "center", gap: 4 },
  glowRing: {
    position: "absolute",
    width: SCAN_SIZE + 16, height: SCAN_SIZE + 16,
    borderRadius: (SCAN_SIZE + 16) / 2,
    backgroundColor: SKY,
    top: -8, left: -8,
    opacity: 0.25,
  },
  btn: {
    width: SCAN_SIZE, height: SCAN_SIZE,
    borderRadius: SCAN_SIZE / 2,
    alignItems: "center", justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 14,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.88)",
  },
  label: {
    fontSize: 9.5, fontFamily: "Inter_700Bold",
    color: PRIMARY, letterSpacing: 1,
  },
});

function TabBarBg() {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={85} tint="extraLight" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: Platform.OS === "ios"
            ? "rgba(255,255,255,0.6)"
            : "rgba(255,255,255,0.97)",
          borderTopWidth: 0.8,
          borderTopColor: "rgba(0,119,182,0.12)",
        }
      ]} />
      {/* Top highlight line */}
      <View style={{
        position: "absolute", top: 0, left: 32, right: 32,
        height: 1, backgroundColor: "rgba(255,255,255,0.9)",
      }} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          position: "absolute",
          height: BAR_HEIGHT,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => <TabBarBg />,
        tabBarShowLabel: false,
        tabBarItemStyle: { paddingTop: 0 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} focused={focused} label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "pulse" : "pulse-outline"} focused={focused} label="Activity" />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          tabBarButton: (props) => <ScanTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "person-circle" : "person-circle-outline"} focused={focused} label="Profile" />
          ),
        }}
      />

      {/* Hidden tabs — accessible via router.push */}
      <Tabs.Screen name="food" options={{ href: null }} />
      <Tabs.Screen name="exercise" options={{ href: null }} />
      <Tabs.Screen name="medicine" options={{ href: null }} />
      <Tabs.Screen name="diet" options={{ href: null }} />
    </Tabs>
  );
}
