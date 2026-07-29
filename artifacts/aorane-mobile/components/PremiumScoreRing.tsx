import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  interpolateColor
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface PremiumScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subLabel?: string;
  textColor?: "dynamic" | "white" | "black";
}

export function PremiumScoreRing({ score, size = 120, strokeWidth = 10, label, subLabel, textColor = "dynamic" }: PremiumScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score, {
      duration: 1500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (progress.value / 100) * circumference;
    const stroke = interpolateColor(
      progress.value,
      [0, 50, 75, 90, 100],
      ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"] // Critical(Red), Moderate(Orange), Good(Green), Very Good(Blue), Excellent(Purple)
    );
    return {
      strokeDashoffset,
      stroke,
    };
  });

  const staticColor = score >= 90 ? "#8b5cf6" : score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const resolvedTextColor = textColor === "white" ? "#FFFFFF" : textColor === "black" ? "#000000" : staticColor;
  const resolvedSubTextColor = textColor === "white" ? "rgba(255,255,255,0.8)" : textColor === "black" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)";

  // Text sizes were previously fixed regardless of `size`, which only
  // looked right at the default size=120 — anywhere this component was
  // used smaller (dashboard/family at 80, scorecard at 50), the score
  // number was wider/taller than the circle and got visually clipped.
  // Scale proportionally instead, relative to that original 120 baseline.
  const scale = size / 120;
  const scoreFontSize = Math.max(14, Math.round(32 * scale));
  const labelFontSize = Math.max(7, Math.round(10 * scale));
  const subLabelFontSize = Math.max(7, Math.round(11 * scale));

  return (
    <View style={[{ width: size, height: size }, styles.container]}>
      <Svg width={size} height={size}>
        <Circle
          stroke={textColor === "black" ? "rgba(0,0,0,0.08)" : textColor === "white" ? "rgba(255,255,255,0.15)" : "#E8F0F8"}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={[styles.innerContent, StyleSheet.absoluteFillObject]}>
        {label && <Text style={[styles.label, { color: resolvedTextColor, fontSize: labelFontSize }]} numberOfLines={1}>{label}</Text>}
        <Text style={[styles.score, { color: resolvedTextColor, fontSize: scoreFontSize }]} numberOfLines={1} adjustsFontSizeToFit>{Math.round(score)}</Text>
        {subLabel && <Text style={[styles.subLabel, { color: resolvedSubTextColor, fontSize: subLabelFontSize }]} numberOfLines={1}>{subLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  innerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  score: {
    fontSize: 32,
    fontFamily: "Inter_800ExtraBold",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    marginBottom: -4,
  },
  subLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});