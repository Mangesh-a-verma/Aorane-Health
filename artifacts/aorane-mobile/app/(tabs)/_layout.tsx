import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, Text, useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

function TabIcon({ name, focused, label }: { name: keyof typeof Ionicons.glyphMap; focused: boolean; label: string }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return (
    <View style={tabIconStyles.wrap}>
      {focused ? (
        <LinearGradient colors={["#0077B6", "#1B998B"]} style={tabIconStyles.activeBox}>
          <Ionicons name={name} size={19} color="#FFF" />
        </LinearGradient>
      ) : (
        <View style={tabIconStyles.inactiveBox}>
          <Ionicons name={name} size={20} color={isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.35)"} />
        </View>
      )}
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  activeBox: { width: 46, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  inactiveBox: { width: 46, height: 30, alignItems: "center", justifyContent: "center" },
});

export default function TabLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? "#38BDF8" : "#0077B6",
        tabBarInactiveTintColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)",
        tabBarStyle: {
          position: "absolute",
          height: Platform.OS === "web" ? 68 : 76,
          backgroundColor: isIOS ? "transparent" : (isDark ? "rgba(4,20,40,0.95)" : "rgba(240,249,255,0.97)"),
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 16,
        },
        tabBarBackground: () =>
          isIOS ? (
            <View style={{ flex: 1 }}>
              <BlurView intensity={90} tint={isDark ? "dark" : "extraLight"} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { borderTopWidth: 1, borderTopColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,119,182,0.1)" }]} />
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
        tabBarIcon: ({ focused, name }: { focused: boolean; name: keyof typeof Ionicons.glyphMap }) =>
          null,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "grid" : "grid-outline"} focused={focused} label="Home" />,
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: "Food",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "restaurant" : "restaurant-outline"} focused={focused} label="Food" />,
        }}
      />
      <Tabs.Screen
        name="exercise"
        options={{
          title: "Exercise",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "barbell" : "barbell-outline"} focused={focused} label="Exercise" />,
        }}
      />
      <Tabs.Screen
        name="medicine"
        options={{
          title: "Medicine",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "medical" : "medical-outline"} focused={focused} label="Medicine" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "person" : "person-outline"} focused={focused} label="Profile" />,
        }}
      />
    </Tabs>
  );
}
