import React from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  children: React.ReactNode;
  style?: object;
};

export function GradientBackground({ children, style }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  if (isDark) {
    return (
      <View style={[styles.root, style]}>
        <LinearGradient
          colors={["#040D1C", "#062040", "#063330"]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.orb1, styles.orbBlue]} />
        <View style={[styles.orb2, styles.orbTeal]} />
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={["#E0F2FE", "#F0FDF9", "#ECFDF5"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, styles.orbBlueLight]} />
      <View style={[styles.orb2, styles.orbTealLight]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  orb1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -80,
    right: -80,
    opacity: 0.35,
  },
  orb2: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    bottom: 60,
    left: -60,
    opacity: 0.25,
  },
  orbBlue: { backgroundColor: "#0369A1" },
  orbTeal: { backgroundColor: "#0D9488" },
  orbBlueLight: { backgroundColor: "#BAE6FD" },
  orbTealLight: { backgroundColor: "#99F6E4" },
});
