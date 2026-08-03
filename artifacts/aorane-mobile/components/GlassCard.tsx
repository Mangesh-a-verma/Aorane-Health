import React from "react";
import { View, ViewStyle, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useColors } from "@/hooks/useColors";
import {} from "react-native";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  strong?: boolean;
};

export function GlassCard({ children, style, intensity = 40, strong = false }: Props) {
  const colors = useColors();

  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={intensity}
        tint={"light"}
        style={[
          styles.base,
          {
            borderColor: colors.glassBorder,
            backgroundColor: strong ? colors.glassStrong : colors.glass,
          },
          style,
        ]}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: strong ? colors.glassStrong : colors.glass,
          borderColor: colors.glassBorder,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
});
