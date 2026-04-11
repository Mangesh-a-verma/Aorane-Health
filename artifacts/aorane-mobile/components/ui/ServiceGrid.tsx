import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { DS } from "@/lib/theme";

export interface ServiceItem {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  onPress?: () => void;
  badge?: string;
}

interface Props {
  items: ServiceItem[];
  columns?: number;
}

export default function ServiceGrid({ items, columns = 3 }: Props) {
  const rows: ServiceItem[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }

  return (
    <View style={s.wrap}>
      {rows.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((item, ci) => (
            <TouchableOpacity
              key={ci}
              style={s.item}
              onPress={item.onPress}
              activeOpacity={0.75}
            >
              <View style={[s.iconCircle, { backgroundColor: item.bg }]}>
                {item.icon}
                {item.badge ? (
                  <View style={[s.badge, { backgroundColor: item.color }]}>
                    <Text style={s.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.label} numberOfLines={2}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          {row.length < columns &&
            Array.from({ length: columns - row.length }).map((_, ei) => (
              <View key={`empty-${ei}`} style={s.item} />
            ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { gap: 4 },
  row:        { flexDirection: "row" },
  item:       { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, gap: 8 },
  iconCircle: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  label:      { fontSize: DS.font.xs, fontFamily: "Inter_600SemiBold", color: DS.color.text, textAlign: "center", lineHeight: 14 },
  badge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText:  { fontSize: 9, fontFamily: "Inter_700Bold", color: "#FFF" },
});
