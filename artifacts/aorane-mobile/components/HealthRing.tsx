import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useColors } from "@/hooks/useColors";
import Svg, { Circle } from "react-native-svg";

type Props = {
  score: number;
  confidence: number;
  size?: number;
};

export function HealthRing({ score, confidence, size = 160 }: Props) {
  const colors = useColors();
  const r = (size - 24) / 2;
  const circumference = 2 * Math.PI * r;

  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: score / 100,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const getScoreColor = () => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.primary;
    if (score >= 40) return colors.warning;
    return colors.destructive;
  };

  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.muted}
          strokeWidth={12}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={getScoreColor()}
          strokeWidth={12}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset as unknown as number}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.score, { color: getScoreColor(), fontFamily: "Inter_700Bold" }]}>
          {score}
        </Text>
        <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Health Score
        </Text>
        <View style={[styles.confidenceBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.confidenceText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {Math.round(confidence)}% data
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 42,
    lineHeight: 48,
  },
  label: {
    fontSize: 12,
    marginTop: 2,
  },
  confidenceBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 11,
  },
});
