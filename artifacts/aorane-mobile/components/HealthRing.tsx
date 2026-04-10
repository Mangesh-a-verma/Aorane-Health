import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, useColorScheme } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";

type Props = {
  score: number;
  confidence: number;
  size?: number;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function HealthRing({ score, confidence, size = 160 }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const strokeWidth = 10;
  const gap = 6;
  const outerR = (size - strokeWidth) / 2;
  const innerR = outerR - strokeWidth - gap;
  const outerCirc = 2 * Math.PI * outerR;
  const innerCirc = 2 * Math.PI * innerR;

  const scoreAnim = useRef(new Animated.Value(0)).current;
  const confidenceAnim = useRef(new Animated.Value(0)).current;
  const displayScore = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scoreAnim, { toValue: score / 100, duration: 1400, useNativeDriver: false }),
      Animated.timing(confidenceAnim, { toValue: confidence / 100, duration: 1600, useNativeDriver: false }),
      Animated.timing(displayScore, { toValue: score, duration: 1400, useNativeDriver: false }),
    ]).start();
  }, [score, confidence]);

  const outerOffset = scoreAnim.interpolate({ inputRange: [0, 1], outputRange: [outerCirc, 0] });
  const innerOffset = confidenceAnim.interpolate({ inputRange: [0, 1], outputRange: [innerCirc, 0] });

  const getLabel = () => {
    if (score >= 85) return { text: "Excellent", color: "#10B981" };
    if (score >= 70) return { text: "Good", color: "#38BDF8" };
    if (score >= 50) return { text: "Fair", color: "#F59E0B" };
    return { text: "Low", color: "#F87171" };
  };
  const label = getLabel();

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#0EA5E9" />
            <Stop offset="50%" stopColor="#0077B6" />
            <Stop offset="100%" stopColor="#1B998B" />
          </SvgGradient>
          <SvgGradient id="confGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#2DD4BF" />
            <Stop offset="100%" stopColor="#059669" />
          </SvgGradient>
        </Defs>

        {/* Outer track */}
        <Circle
          cx={size / 2} cy={size / 2} r={outerR} fill="none"
          stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.08)"}
          strokeWidth={strokeWidth}
        />
        {/* Outer progress */}
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={outerR} fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={outerCirc}
          strokeDashoffset={outerOffset as unknown as number}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />

        {/* Inner track */}
        <Circle
          cx={size / 2} cy={size / 2} r={innerR} fill="none"
          stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(27,153,139,0.07)"}
          strokeWidth={strokeWidth - 2}
        />
        {/* Inner progress (confidence) */}
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={innerR} fill="none"
          stroke="url(#confGrad)"
          strokeWidth={strokeWidth - 2}
          strokeDasharray={innerCirc}
          strokeDashoffset={innerOffset as unknown as number}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
          opacity={0.6}
        />
      </Svg>

      {/* Center content */}
      <View style={styles.center}>
        <AnimatedScore value={displayScore} color={label.color} />
        <Text style={[styles.label, { color: label.color, fontFamily: "Inter_600SemiBold" }]}>
          {label.text}
        </Text>
        <View style={[styles.confBadge, { backgroundColor: isDark ? "rgba(45,212,191,0.1)" : "rgba(27,153,139,0.08)" }]}>
          <View style={[styles.confDot, { backgroundColor: "#2DD4BF" }]} />
          <Text style={[styles.confText, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontFamily: "Inter_400Regular" }]}>
            {Math.round(confidence)}% data
          </Text>
        </View>
      </View>
    </View>
  );
}

function AnimatedScore({ value, color }: { value: Animated.Value; color: string }) {
  const [display, setDisplay] = React.useState(0);
  useEffect(() => {
    const id = value.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => value.removeListener(id);
  }, [value]);
  return <Text style={[styles.score, { color, fontFamily: "Inter_700Bold" }]}>{display}</Text>;
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center" },
  score: { fontSize: 36, lineHeight: 40 },
  label: { fontSize: 12, marginTop: 2 },
  confBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 5 },
  confDot: { width: 5, height: 5, borderRadius: 2.5 },
  confText: { fontSize: 10 },
});
