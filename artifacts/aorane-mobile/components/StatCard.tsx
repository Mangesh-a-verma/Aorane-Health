import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

type Props = {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color?: string;
};

export function StatCard({ icon, label, value, subValue, color }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: color ? `${color}20` : colors.muted }]}>
        {icon}
      </View>
      <Text style={[styles.value, { color: color || colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
      {subValue && (
        <Text style={[styles.subValue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {subValue}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
  },
  label: {
    fontSize: 12,
    textAlign: "center",
  },
  subValue: {
    fontSize: 11,
  },
});
