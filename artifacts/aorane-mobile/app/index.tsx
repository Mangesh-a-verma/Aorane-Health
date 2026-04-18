import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, Image, StyleSheet, Dimensions, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";

const { width: W } = Dimensions.get("window");

function SplashScreen() {
  const logoAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoAnim, { toValue: 1, friction: 7, tension: 45, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
    ]).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#E0F2FE", "#EFF9FF", "#ECFDF5"]} style={StyleSheet.absoluteFill} />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <Animated.View style={[styles.center, {
        opacity: logoAnim,
        transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }],
      }]}>
        <Animated.View style={[styles.glowBehind, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={["rgba(0,119,182,0.7)", "rgba(27,153,139,0.4)", "transparent"]}
            style={styles.glowCircle}
          />
        </Animated.View>
        <Image
          source={require("../assets/images/aorane-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

export default function Index() {
  const { isLoading, isAuthenticated, isOnboardingDone, isPinSet, needsPinVerification } = useAuth();

  if (isLoading) return <SplashScreen />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!isOnboardingDone) return <Redirect href={"/(onboarding)/" as never} />;
  if (!isPinSet) return <Redirect href="/(auth)/setup-pin" />;
  if (needsPinVerification) return <Redirect href={"/(auth)/verify-pin" as never} />;
  return <Redirect href="/(tabs)/dashboard" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0FAFB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  orb1: { position: "absolute", width: 400, height: 400, borderRadius: 200, top: -150, right: -130, opacity: 0.25, backgroundColor: "#BAE6FD" },
  orb2: { position: "absolute", width: 300, height: 300, borderRadius: 150, bottom: 40, left: -100, opacity: 0.2, backgroundColor: "#A7F3D0" },
  glowBehind: { position: "absolute", alignSelf: "center" },
  glowCircle: { width: W * 1.1, height: 400, borderRadius: 200 },
  logo: { width: W - 10, height: 250 },
});
