import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Modal, Platform, Dimensions, Image } from "react-native";
import { BlurView } from "expo-blur";
import { DS } from "@/lib/theme";
import { ScanLine } from "lucide-react-native";

const { height: H, width: W } = Dimensions.get("window");

type Props = {
  visible: boolean;
  imageUri?: string | null;
};

export function ScanningOverlay({ visible, imageUri }: Props) {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scanAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanAnim.stopAnimation();
    }
  }, [visible]);

  if (!visible) return null;

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 150],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.85)" }]} />
        )}

        {imageUri && (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.3)" }]} />
          </View>
        )}

        <View style={styles.scannerBox}>
          <ScanLine size={80} color="rgba(255,255,255,0.2)" strokeWidth={1} />
          <Animated.View style={[styles.laser, { transform: [{ translateY }] }]} />
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageWrapper: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: -1,
  },
  image: { width: "100%", height: "100%", opacity: 0.5 },
  scannerBox: {
    width: 250, height: 250,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 30,
    overflow: "hidden",
  },
  laser: {
    position: "absolute",
    width: "100%", height: 3,
    backgroundColor: DS.color.primary,
    shadowColor: DS.color.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
});
