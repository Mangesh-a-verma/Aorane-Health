import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { DS } from "@/lib/theme";

interface Props {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
  unit?: string;
}

export default function StatPill({ icon, label, value, color, bg, unit }: Props) {
  return (
    <View style={[s.card, { borderTopColor: color, borderTopWidth: 2.5 }]}>
      <View style={[s.iconBox, { backgroundColor: bg }]}>
        {icon}
      </View>
      <Text style={s.val} numberOfLines={1}>{value}<Text style={[s.unit, { color }]}>{unit ? ` ${unit}` : ""}</Text></Text>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: DS.radius.md,
    padding: 10,
    alignItems: "center",
    gap: 4,
    ...DS.shadow.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  val: {
    fontSize: DS.font.md,
    fontFamily: "Inter_700Bold",
    color: DS.color.text,
    marginTop: 2,
  },
  unit: {
    fontSize: DS.font.xs,
    fontFamily: "Inter_600SemiBold",
  },
  label: {
    fontSize: DS.font.xs,
    fontFamily: "Inter_500Medium",
    color: DS.color.muted,
  },
});
