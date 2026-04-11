import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

const PRIMARY = "#0077B6";
const SKY = "#0EA5E9";
const ACCENT = "#00B896";
const INACTIVE = "rgba(13,31,51,0.28)";
const BAR_HEIGHT = 68;
const SCAN_SIZE = 60;
const SCAN_LIFT = 24;

function TabIcon({
  name,
  focused,
  label,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
}) {
  return (
    <View style={ti.wrap}>
      <View style={[ti.iconWrap, focused && ti.activeIconWrap]}>
        <Ionicons
          name={name}
          size={22}
          color={focused ? PRIMARY : INACTIVE}
        />
      </View>
      <Text style={[ti.label, { color: focused ? PRIMARY : INACTIVE }]}>
        {label}
      </Text>
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: { alignItems: "center", gap: 2, paddingTop: 6 },
  iconWrap: { width: 44, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  activeIconWrap: { backgroundColor: "rgba(0,119,182,0.10)" },
  label: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

function ScanTabButton(props: BottomTabBarButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scaleAnim, {
      toValue: 0.91,
      useNativeDriver: true,
      damping: 12,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 10,
    }).start();
  }

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
          <LinearGradient
            colors={[PRIMARY, SKY, ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={scan.btn}
          >
            <Ionicons name="scan" size={26} color="#FFF" />
          </LinearGradient>
        </Animated.View>
        <Text style={scan.label}>SCAN</Text>
      </TouchableOpacity>
    </View>
  );
}

const scan = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    top: -(SCAN_LIFT),
    height: BAR_HEIGHT + SCAN_LIFT,
  },
  touch: { alignItems: "center", gap: 3 },
  btn: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderRadius: SCAN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    letterSpacing: 0.5,
  },
});

function GlassBackground() {
  const isIOS = Platform.OS === "ios";
  if (isIOS) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BlurView intensity={80} tint="extraLight" style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(255,255,255,0.55)",
              borderTopWidth: 0.8,
              borderTopColor: "rgba(0,119,182,0.15)",
            },
          ]}
        />
      </View>
    );
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: "rgba(255,255,255,0.96)",
          borderTopWidth: 0.8,
          borderTopColor: "rgba(0,119,182,0.15)",
        },
      ]}
    />
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
          backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(255,255,255,0.96)",
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: "#0077B6",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.10,
          shadowRadius: 18,
        },
        tabBarBackground: () => <GlassBackground />,
        tabBarShowLabel: false,
        tabBarItemStyle: { paddingTop: 0 },
      }}
    >
      <Tabs.Screen
        name="food"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "restaurant" : "restaurant-outline"}
              focused={focused}
              label="Food"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="exercise"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "barbell" : "barbell-outline"}
              focused={focused}
              label="Exercise"
            />
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
        name="medicine"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "medical" : "medical-outline"}
              focused={focused}
              label="Medical"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "person-circle" : "person-circle-outline"}
              focused={focused}
              label="Profile"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="diet"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
