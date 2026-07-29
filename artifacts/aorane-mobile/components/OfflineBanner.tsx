/**
 * AORANE — Offline Banner
 *
 * Shows a persistent banner when the app is offline.
 * Shows a brief "syncing" indicator when pending entries are being uploaded.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
};

export default function OfflineBanner({ isOnline, pendingCount, syncing }: Props) {
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const wasOffline = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const shouldShow = !isOnline || pendingCount > 0;

    if (shouldShow) {
      wasOffline.current = true;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: Platform.OS !== "web", tension: 80, friction: 10 }).start();
    } else if (wasOffline.current) {
      // Was offline, now back online — show briefly then hide
      hideTimer.current = setTimeout(() => {
        Animated.timing(slideAnim, { toValue: -60, duration: 400, useNativeDriver: Platform.OS !== "web" }).start();
        wasOffline.current = false;
      }, 2000);
    }

    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [isOnline, pendingCount, slideAnim]);

  const bg     = !isOnline ? "#D1281C" : syncing ? "#E8622A" : "#16A34A";
  const icon   = !isOnline ? "cloud-offline-outline" : syncing ? "sync-outline" : "cloud-done-outline";
  const label  = !isOnline
    ? `Offline${pendingCount > 0 ? ` · ${pendingCount} entry pending sync` : " · Entries saved locally"}`
    : syncing
    ? `Syncing ${pendingCount} entr${pendingCount === 1 ? "y" : "ies"}…`
    : "Back online · All entries synced ✓";

  return (
    <Animated.View style={[s.banner, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={14} color="#FFF" />
      <Text style={s.label}>{label}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    zIndex: 999,
  },
  label: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
});
