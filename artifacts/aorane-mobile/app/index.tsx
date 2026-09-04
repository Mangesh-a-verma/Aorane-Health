import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { MULTI_LANGUAGE_ENABLED } from "@/constants/features";
import { View, StyleSheet, Dimensions, Animated, Platform } from "react-native";
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AoraneLogo from "@/components/AoraneLogo";

const { width: W } = Dimensions.get("window");

function SplashScreen() {
  const logoAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoAnim, { toValue: 1, friction: 7, tension: 45, useNativeDriver: Platform.OS !== "web" }),
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
        <AoraneLogo width={280} />
      </Animated.View>
    </View>
  );
}

export default function Index() {
  const { isLoading, isAuthenticated, isOnboardingDone, isPinSet, needsPinVerification } = useAuth();
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(null);
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState<boolean | null>(null);

  useEffect(() => {
    // ✅ FIX: Read hasSeenIntro immediately without waiting for a re-render.
    // Previously this was a regular async function which required one full
    // React render cycle (and a re-render) before routing could happen.
    // Now we use a synchronous-ish read with immediate state set.
    AsyncStorage.getItem("hasSeenIntro")
      .then((v) => setHasSeenIntro(v === "true"))
      .catch(() => setHasSeenIntro(false));
    AsyncStorage.getItem("hasSelectedLanguage")
      .then((v) => setHasSelectedLanguage(v === "true"))
      .catch(() => setHasSelectedLanguage(false));
  }, []);

  // 1. Wait until authentication state and local storage are both loaded
  if (isLoading || hasSeenIntro === null || hasSelectedLanguage === null) return <SplashScreen />;

  // 2. Language picker used to be the very first thing a fresh install saw.
  // While multi-language is off there is nothing to pick, so the step is
  // skipped and the user lands on the intro instead. The flag guards the
  // redirect rather than the screen being deleted — see constants/features.ts.
  if (MULTI_LANGUAGE_ENABLED && !hasSelectedLanguage) {
    return <Redirect href={"/(onboarding)/language" as never} />;
  }

  // 3. First-time user must see the Introduction / Terms screen
  if (!hasSeenIntro) return <Redirect href={"/(onboarding)/intro" as never} />;

  // 4. Intro completed, but user is not authenticated -> Route to Login
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  // 5. Authenticated, but profile setup (Onboarding) is incomplete
  if (!isOnboardingDone) return <Redirect href="/(onboarding)" />;

  // 6. Profile complete, but security PIN is missing
  if (!isPinSet) return <Redirect href="/(auth)/setup-pin" />;

  // 7. Security PIN requires verification for the current session
  if (needsPinVerification) return <Redirect href={"/(auth)/verify-pin" as never} />;

  // 8. All checks passed -> Proceed to Dashboard
  return <Redirect href="/(tabs)/dashboard" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0FAFB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  orb1: { position: "absolute", width: 400, height: 400, borderRadius: 200, top: -150, right: -130, opacity: 0.25, backgroundColor: "#BAE6FD" },
  orb2: { position: "absolute", width: 300, height: 300, borderRadius: 150, bottom: 40, left: -100, opacity: 0.2, backgroundColor: "#A7F3D0" },
  glowBehind: { position: "absolute", alignSelf: "center" },
  glowCircle: { width: W * 1.1, height: 400, borderRadius: 200 },
  logo: { width: W - 80, height: 70 },
});