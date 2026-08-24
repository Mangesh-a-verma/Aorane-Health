import React from "react";
import {
  View, Text, TouchableOpacity, 
  ActivityIndicator, StyleSheet
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHealthConnect } from "../hooks/useHealthConnect";

export function HealthConnectButton() {
  const { status, isLoading, permissionDenied, openInstall, openUpdate, requestPermissions } =
    useHealthConnect();

  // Still checking
  if (status === "checking") {
    return (
      <View style={s.row}>
        <ActivityIndicator size="small" color="#0077B6" />
        <Text style={s.checkingText}>Health Connect check kar rahe hain...</Text>
      </View>
    );
  }

  // Not supported (old Android)
  if (status === "not_supported") {
    return (
      <View style={[s.card, s.grayCard]}>
        <Ionicons name="phone-portrait-outline" size={20} color="#9CA3AF" />
        <View style={{ flex: 1 }}>
          <Text style={s.titleGray}>Wearable Sync</Text>
          <Text style={s.subGray}>
            Android 9+ required for Health Connect
          </Text>
        </View>
        <View style={s.comingSoonBadge}>
          <Text style={s.comingSoonText}>N/A</Text>
        </View>
      </View>
    );
  }

  // Not installed
  if (status === "not_installed") {
    return (
      <View style={s.card}>
        <View style={s.iconWrap}>
          <Ionicons name="heart-circle-outline" size={24} color="#0077B6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Health Connect</Text>
          <Text style={s.sub}>
            Steps, calories, sleep sync karne ke liye install karein
          </Text>
        </View>
        <TouchableOpacity
          style={s.installBtn}
          onPress={openInstall}
          activeOpacity={0.85}
        >
          <Text style={s.installBtnText}>Install</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Needs update
  if (status === "needs_update") {
    return (
      <View style={s.card}>
        <View style={[s.iconWrap, { backgroundColor: "#FEF3C7" }]}>
          <Ionicons name="refresh-circle-outline" size={24} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Health Connect Update</Text>
          <Text style={s.sub}>New version required hai</Text>
        </View>
        <TouchableOpacity
          style={[s.installBtn, { backgroundColor: "#F59E0B" }]}
          onPress={openUpdate}
          activeOpacity={0.85}
        >
          <Text style={s.installBtnText}>Update</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Available, but the user declined the permission dialog last time —
  // show that clearly instead of silently reverting to the same "Ready"
  // state, which previously gave zero indication that sync wasn't working.
  if (status === "available" && permissionDenied && !isLoading) {
    return (
      <TouchableOpacity
        style={[s.card, s.grayCard]}
        onPress={requestPermissions}
        activeOpacity={0.85}
      >
        <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
        <View style={{ flex: 1 }}>
          <Text style={s.titleGray}>Health Connect</Text>
          <Text style={[s.subGray, { color: "#EF4444" }]}>
            Permission denied — data sync nahi hoga. Tap to try again.
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Available — request permissions
  if (status === "available") {
    return (
      <TouchableOpacity
        style={[s.card, s.activeCard]}
        onPress={requestPermissions}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        <View style={[s.iconWrap, { backgroundColor: "#D1FAE5" }]}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#10B981" />
          ) : (
            <Ionicons name="heart-circle" size={24} color="#10B981" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: "#065F46" }]}>
            Health Connect Ready ✅
          </Text>
          <Text style={[s.sub, { color: "#047857" }]}>
            {isLoading ? "Permission maang rahe hain..." : "Tap to connect and sync data"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#10B981" />
      </TouchableOpacity>
    );
  }

  // Error fallback
  return (
    <View style={[s.card, s.grayCard]}>
      <Ionicons name="warning-outline" size={20} color="#EF4444" />
      <View style={{ flex: 1 }}>
        <Text style={s.titleGray}>Health Connect</Text>
        <Text style={[s.subGray, { color: "#EF4444" }]}>
          Kuch gadbad hui. App restart karein.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  checkingText: { fontSize: 13, color: "#9CA3AF" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFD",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5EFF7",
  },
  activeCard: {
    borderColor: "#D1FAE5",
    backgroundColor: "#F0FDF4",
  },
  grayCard: {
    borderColor: "#F3F4F6",
    backgroundColor: "#FAFAFA",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EBF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0D1F33",
  },
  titleGray: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  sub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  subGray: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  installBtn: {
    backgroundColor: "#0077B6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  installBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  comingSoonBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  comingSoonText: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "700",
  },
});