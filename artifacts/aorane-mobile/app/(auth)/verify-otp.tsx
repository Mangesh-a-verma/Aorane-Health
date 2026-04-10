import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function VerifyOtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();
  const { phone, lang = "hi" } = useLocalSearchParams<{ phone: string; lang: string }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setResendTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text.slice(-1);
    setOtp(newOtp);
    if (text && index < 5) inputs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpValue: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await api.verifyOtp(phone || "", otpValue, lang as string);
      await loginWithToken(res.accessToken, res.refreshToken, res.user, res.isNewUser);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid OTP";
      Alert.alert("Error", msg);
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await api.sendOtp(phone || "");
      setResendTimer(30);
      Alert.alert("Sent!", "New OTP sent to your number");
    } catch { }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.tealLight }]}>
          <Ionicons name="chatbubble-ellipses" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          OTP Enter Karein
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          +91 {phone} pe bheja gaya hai
        </Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              style={[
                styles.otpBox,
                {
                  backgroundColor: colors.card,
                  borderColor: digit ? colors.primary : colors.border,
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                },
              ]}
              keyboardType="numeric"
              maxLength={1}
              value={digit}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        {isLoading && (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 24 }} />
        )}

        <TouchableOpacity
          onPress={handleResend}
          disabled={resendTimer > 0}
          style={{ marginTop: 24 }}
        >
          <Text style={[styles.resend, { color: resendTimer > 0 ? colors.mutedForeground : colors.primary, fontFamily: "Inter_500Medium" }]}>
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : "OTP Dobara Bhejein"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 32 },
  content: { alignItems: "center" },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 26, marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 36, textAlign: "center" },
  otpRow: { flexDirection: "row", gap: 10 },
  otpBox: {
    width: 48, height: 56, borderRadius: 12, borderWidth: 2,
    textAlign: "center", fontSize: 22,
  },
  resend: { fontSize: 15 },
});
