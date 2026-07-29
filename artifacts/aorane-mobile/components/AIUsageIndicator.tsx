import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLanguage } from "@/context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  used: number;
  limit: number;
  label?: string;
  iconName?: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  compact?: boolean;
}

export function AIUsageIndicator({ used, limit, label = "scans", iconName = "scan-outline", compact = false }: Props) {
  const { t } = useLanguage();
  if (limit >= 999) return null;

  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(used / limit, 1) : 1;
  const color = remaining === 0 ? "#EF4444" : remaining <= 2 ? "#F59E0B" : "#00A693";

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <Ionicons name={iconName as "scan-outline"} size={11} color={color} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {t("aiUsageRemaining")?.replace("{remaining}", remaining.toString()).replace("{limit}", limit.toString()).replace("{feature}", label)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2EDF4",
    marginTop: 8,
    alignSelf: "center",
  },
  compact: { paddingVertical: 4, paddingHorizontal: 8 },
  text: { fontFamily: "Inter_600SemiBold", fontSize: 11, flex: 1 },
  track: { width: 44, height: 4, backgroundColor: "#E2EDF4", borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});
