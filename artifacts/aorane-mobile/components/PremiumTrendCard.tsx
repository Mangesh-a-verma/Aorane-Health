import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface PremiumTrendCardProps {
  currentStreak: number;
  rolling7Day: number | null;
  rolling30Day: number | null;
}

export function PremiumTrendCard({ currentStreak, rolling7Day, rolling30Day }: PremiumTrendCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="analytics" size={18} color="#FFF" />
        <Text style={styles.title}>AI Health Trends</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.item}>
          <Text style={styles.value}>{currentStreak > 0 ? currentStreak : '-'}</Text>
          <Text style={styles.label}>Day Streak</Text>
          {currentStreak > 2 && <Text style={styles.flame}>🔥</Text>}
        </View>
        <View style={styles.item}>
          <Text style={styles.value}>{rolling7Day ?? '-'}</Text>
          <Text style={styles.label}>7-Day Avg</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.value}>{rolling30Day ?? '-'}</Text>
          <Text style={styles.label}>30-Day Avg</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  title: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  item: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  value: {
    color: "#FFF",
    fontSize: 22,
    fontFamily: "Inter_800ExtraBold",
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  flame: {
    position: "absolute",
    top: -8,
    right: 12,
    fontSize: 14,
  }
});
