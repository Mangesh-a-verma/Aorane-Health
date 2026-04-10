import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import Svg, { Circle } from "react-native-svg";

type Props = {
  eaten: number;
  goal: number;
  burned: number;
};

export function CalorieRing({ eaten, goal, burned }: Props) {
  const colors = useColors();
  const size = 90;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(eaten / (goal || 2000), 1);
  const offset = circ * (1 - pct);
  const remaining = Math.max(0, goal - eaten + burned);
  const overGoal = eaten > goal + burned;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
        Calories
      </Text>
      <View style={styles.ringContainer}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.muted} strokeWidth={8} />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={overGoal ? colors.destructive : colors.warning}
            strokeWidth={8}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.ringCenter}>
            <Text style={[styles.ringNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {remaining}
            </Text>
            <Text style={[styles.ringLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              left
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.warning, fontFamily: "Inter_600SemiBold" }]}>{eaten}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>eaten</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>{burned}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>burned</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  ringContainer: {
    width: 90,
    height: 90,
    position: "relative",
  },
  ringCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ringNum: {
    fontSize: 20,
  },
  ringLabel: {
    fontSize: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  stat: {
    alignItems: "center",
  },
  statNum: {
    fontSize: 14,
  },
  statLabel: {
    fontSize: 11,
  },
});
