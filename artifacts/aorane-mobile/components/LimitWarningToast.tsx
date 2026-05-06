import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

interface Props {
  visible: boolean;
  remaining: number;
  featureLabel?: string;
  onDismiss: () => void;
}

export function LimitWarningToast({ visible, remaining, featureLabel = "scan", onDismiss }: Props) {
  const slideAnim = useRef(new Animated.Value(-90)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 11, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -90, duration: 180, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const isLast = remaining === 0;
  const color = isLast ? "#EF4444" : "#F59E0B";
  const bgColor = isLast ? "#FEF2F2" : "#FFFBEB";
  const borderColor = isLast ? "#FCA5A5" : "#FCD34D";
  const message = isLast
    ? `⚠️ Aakhri ${featureLabel}! Upgrade karo`
    : `⚠️ Sirf ${remaining} ${featureLabel} baaki aaj!`;

  return (
    <Animated.View
      style={[
        styles.toast,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim, backgroundColor: bgColor, borderLeftColor: color, borderColor: borderColor },
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Ionicons name="warning-outline" size={15} color={color} />
      <Text style={[styles.msg, { color: "#1A2B3C" }]} numberOfLines={1}>
        {message}
      </Text>
      {isLast && (
        <TouchableOpacity
          onPress={() => {
            onDismiss();
            try { router.push("/subscription" as never); } catch { }
          }}
          style={[styles.upgradeBtn, { borderColor: color }]}
          activeOpacity={0.75}
        >
          <Text style={[styles.upgradeTxt, { color }]}>Upgrade</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
        <Ionicons name="close" size={14} color="#90A4B5" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 8,
    left: 12,
    right: 12,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 7,
    borderLeftWidth: 4,
    borderWidth: 1,
    zIndex: 9999,
  },
  msg: { fontFamily: "Inter_600SemiBold", fontSize: 12, flex: 1 },
  upgradeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  upgradeTxt: { fontFamily: "Inter_700Bold", fontSize: 11 },
  closeBtn: { padding: 2 },
});
