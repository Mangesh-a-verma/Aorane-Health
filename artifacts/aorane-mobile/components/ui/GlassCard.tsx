import React from "react";
import { View, StyleSheet, Platform, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { DS } from "@/lib/theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  pad?: number;
}

export default function GlassCard({ children, style, intensity = 60, pad = 16 }: Props) {
  return (
    <View style={[s.outer, style]}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.androidFill]} />
      )}
      <View style={[s.inner, { padding: pad }]}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: {
    backgroundColor: DS.color.glass,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.glassBorder,
    overflow: "hidden",
    ...DS.shadow.md,
  },
  androidFill: {
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  inner: {
    flex: 1,
  },
});
