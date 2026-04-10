import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

type Props = {
  current: number;
  goal: number;
  onAdd: () => void;
};

export function WaterTracker({ current, goal, onAdd }: Props) {
  const colors = useColors();

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="water" size={18} color="#60A5FA" />
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Water
          </Text>
        </View>
        <TouchableOpacity onPress={handleAdd} style={[styles.addBtn, { backgroundColor: "#1D4ED820" }]}>
          <Ionicons name="add" size={18} color="#60A5FA" />
        </TouchableOpacity>
      </View>
      <View style={styles.glassRow}>
        {Array.from({ length: goal }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.glass,
              {
                backgroundColor: i < current ? "#60A5FA" : colors.muted,
                opacity: i < current ? 1 : 0.3,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.count, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {current} / {goal} glasses · {current * 250}ml
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 14,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  glassRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
  },
  glass: {
    width: 16,
    height: 20,
    borderRadius: 4,
  },
  count: {
    fontSize: 12,
  },
});
