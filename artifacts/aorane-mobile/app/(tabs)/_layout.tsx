import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

const PRIMARY = "#0077B6";
const ACCENT = "#00B896";
const INACTIVE = "rgba(13,31,51,0.3)";

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <View style={ti.wrap}>
      {focused ? (
        <LinearGradient colors={[PRIMARY, ACCENT]} style={ti.activeBox}>
          <Ionicons name={name} size={18} color="#FFF" />
        </LinearGradient>
      ) : (
        <View style={ti.inactiveBox}>
          <Ionicons name={name} size={20} color={INACTIVE} />
        </View>
      )}
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  activeBox: { width: 46, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  inactiveBox: { width: 46, height: 30, alignItems: "center", justifyContent: "center" },
});

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          position: "absolute",
          height: Platform.OS === "web" ? 68 : 76,
          backgroundColor: isIOS ? "transparent" : "rgba(255,255,255,0.97)",
          borderTopWidth: 1,
          borderTopColor: "#E2EFF5",
          elevation: 0,
          shadowColor: "#0077B6",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
        },
        tabBarBackground: () =>
          isIOS ? (
            <View style={{ flex: 1 }}>
              <BlurView intensity={90} tint="extraLight" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { borderTopWidth: 1, borderTopColor: "rgba(0,119,182,0.12)" }]} />
            </View>
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingTop: 8,
        },
        tabBarIcon: () => null,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "grid" : "grid-outline"} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: "Food",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "restaurant" : "restaurant-outline"} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="exercise"
        options={{
          title: "Exercise",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "barbell" : "barbell-outline"} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="medicine"
        options={{
          title: "Medicine",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "medical" : "medical-outline"} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diet"
        options={{
          title: "AI Coach",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "sparkles" : "sparkles-outline"} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "person" : "person-outline"} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
