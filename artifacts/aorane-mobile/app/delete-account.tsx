/**
 * Delete Account Screen — Aorane
 *
 * Flow:
 *  1. Warning modal (what gets deleted)
 *  2. Subscription notice (if active plan)
 *  3. OTP verification (send to user's phone / email)
 *  4. Backend soft-delete  →  local session cleared  →  navigate to /login
 *
 * Architecture:
 *  - Soft delete: sets users.deleted_at, users.is_active = false
 *  - Hard data purge is done server-side (cascade + storage cleanup)
 *  - No duplicate auth; reuses existing OTP system
 */

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertTriangle,
  ChevronLeft,
  Shield,
  Trash2,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
} from "lucide-react-native";
import { DS } from "@/lib/theme";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/storage";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "warning" | "subscription" | "verify" | "deleting" | "done";

interface DeletionState {
  step: Step;
  otp: string;
  otpSent: boolean;
  otpLoading: boolean;
  resendCountdown: number;
  deleteLoading: boolean;
  error: string | null;
  hasActiveSub: boolean;
  subChecked: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_TO_DELETE = [
  "Profile & personal information",
  "Health data & daily logs",
  "Medical reports & scans",
  "Food tracking history",
  "Exercise & activity records",
  "Reminders & schedules",
  "AI-generated health insights",
  "Account preferences",
];

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

// ─── Helper: OTP Input ───────────────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(OTP_LENGTH, " ").split("");

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => inputRef.current?.focus()}
      style={otp.row}
    >
      {digits.map((d, i) => (
        <View
          key={i}
          style={[
            otp.box,
            d.trim() && otp.boxFilled,
            i === value.length && otp.boxActive,
          ]}
        >
          <Text style={otp.digit}>{d.trim()}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        style={otp.hidden}
        editable={!disabled}
        autoFocus
      />
    </TouchableOpacity>
  );
}

const otp = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, justifyContent: "center", marginVertical: 20 },
  box: {
    width: 46, height: 54,
    borderRadius: DS.radius.sm,
    borderWidth: 1.5,
    borderColor: DS.color.border,
    backgroundColor: DS.color.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  boxFilled: { borderColor: DS.color.red, backgroundColor: DS.color.redSoft },
  boxActive: { borderColor: DS.color.red, borderWidth: 2 },
  digit: { fontSize: DS.font.xl, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [state, setState] = useState<DeletionState>({
    step: "warning",
    otp: "",
    otpSent: false,
    otpLoading: false,
    resendCountdown: 0,
    deleteLoading: false,
    error: null,
    hasActiveSub: false,
    subChecked: false,
  });

  const update = useCallback((patch: Partial<DeletionState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const transitionTo = useCallback(
    (step: Step) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        update({ step, error: null });
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim, update]
  );

  // ── Step 1: Check subscription & advance ─────────────────────────────────

  const handleProceedFromWarning = useCallback(async () => {
    // Check if user has active paid plan
    const plan = (user?.plan ?? "free").toLowerCase();
    const hasActiveSub = plan !== "free";
    update({ hasActiveSub, subChecked: true });

    if (hasActiveSub) {
      transitionTo("subscription");
    } else {
      transitionTo("verify");
    }
  }, [user, transitionTo, update]);

  // ── Step 2: Subscription acknowledged ────────────────────────────────────

  const handleProceedFromSub = useCallback(() => {
    transitionTo("verify");
  }, [transitionTo]);

  // ── Step 3: Send OTP ──────────────────────────────────────────────────────

  const sendOtp = useCallback(async () => {
    update({ otpLoading: true, error: null });
    try {
      const phone = user?.phone;
      const email = user?.email;

      if (phone) {
        await api.sendOtp(phone);
      } else if (email) {
        await api.sendEmailOtp(email);
      } else {
        update({ error: "No phone or email found for verification.", otpLoading: false });
        return;
      }

      // Start resend countdown
      update({ otpSent: true, otpLoading: false, resendCountdown: RESEND_SECONDS });
      const interval = setInterval(() => {
        setState((s) => {
          if (s.resendCountdown <= 1) {
            clearInterval(interval);
            return { ...s, resendCountdown: 0 };
          }
          return { ...s, resendCountdown: s.resendCountdown - 1 };
        });
      }, 1000);
    } catch {
      update({ error: "Failed to send OTP. Please try again.", otpLoading: false });
    }
  }, [user, update]);

  // ── Step 3: Verify OTP & delete ──────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (state.otp.length !== OTP_LENGTH) {
      update({ error: "Please enter the 6-digit code." });
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === "web") {
        resolve(window.confirm("This is permanent and cannot be undone. Delete your account?"));
      } else {
        Alert.alert(
          "Final Confirmation",
          "This is permanent and cannot be undone. Your account and all health data will be deleted.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Delete Forever", style: "destructive", onPress: () => resolve(true) },
          ]
        );
      }
    });

    if (!confirmed) return;

    transitionTo("deleting");

    try {
      // Call delete-account API with OTP verification
      await api.deleteAccount({ otp: state.otp });

      transitionTo("done");

      // After 2.5s, clear local state and redirect
      setTimeout(async () => {
        await logout();
        await storage.clearTokens();
        router.replace("/(auth)/login" as never);
      }, 2500);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ??
        "Deletion failed. Please check your OTP and try again.";
      setState((s) => ({ ...s, step: "verify", error: msg }));
    }
  }, [state.otp, transitionTo, logout]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const identifier = user?.phone
    ? `+91 ${user.phone}`
    : user?.email ?? "your registered contact";

  const renderWarning = () => (
    <View style={s.card}>
      <View style={[s.iconCircle, { backgroundColor: DS.color.redSoft }]}>
        <Trash2 size={28} color={DS.color.red} strokeWidth={2} />
      </View>
      <Text style={s.cardTitle}>Delete Account</Text>
      <Text style={s.cardSubtitle}>
        Permanently removes your account and all associated data.
        {"\n"}
        <Text style={{ color: DS.color.red, fontFamily: "Inter_600SemiBold" }}>
          This action cannot be undone.
        </Text>
      </Text>

      <View style={s.listBox}>
        <Text style={s.listHead}>The following will be permanently deleted:</Text>
        {ITEMS_TO_DELETE.map((item) => (
          <View key={item} style={s.listRow}>
            <View style={s.listDot} />
            <Text style={s.listItem}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleProceedFromWarning}
        style={[s.btnDanger]}
        activeOpacity={0.85}
      >
        <Text style={s.btnDangerText}>Continue to Delete</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={s.btnGhost}>
        <Text style={s.btnGhostText}>Cancel, keep my account</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSubscription = () => (
    <View style={s.card}>
      <View style={[s.iconCircle, { backgroundColor: DS.color.orangeSoft }]}>
        <AlertTriangle size={28} color={DS.color.orange} strokeWidth={2} />
      </View>
      <Text style={s.cardTitle}>Active Subscription</Text>
      <Text style={s.cardSubtitle}>
        You currently have an active{" "}
        <Text style={{ fontFamily: "Inter_700Bold", color: DS.color.orange }}>
          {(user?.plan ?? "").toUpperCase()} Plan
        </Text>
        .
      </Text>

      <View style={[s.listBox, { backgroundColor: DS.color.orangeSoft, borderColor: "rgba(240,136,42,0.2)" }]}>
        <Text style={[s.listHead, { color: DS.color.orange }]}>Please note:</Text>
        <Text style={[s.listItem, { marginTop: 4 }]}>
          • Deleting your account will immediately cancel your subscription benefits.
        </Text>
        <Text style={[s.listItem, { marginTop: 6 }]}>
          • No refund will be issued for the unused portion.
        </Text>
        <Text style={[s.listItem, { marginTop: 6 }]}>
          • Contact support at{" "}
          <Text style={{ color: DS.color.primary, fontFamily: "Inter_600SemiBold" }}>
            support@aorane.com
          </Text>{" "}
          if you believe a refund is applicable.
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleProceedFromSub}
        style={s.btnDanger}
        activeOpacity={0.85}
      >
        <Text style={s.btnDangerText}>I Understand, Proceed</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={s.btnGhost}>
        <Text style={s.btnGhostText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderVerify = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={s.card}>
        <View style={[s.iconCircle, { backgroundColor: DS.color.primarySoft }]}>
          <Shield size={28} color={DS.color.primary} strokeWidth={2} />
        </View>
        <Text style={s.cardTitle}>Verify Your Identity</Text>
        <Text style={s.cardSubtitle}>
          For security, we need to verify it's you before deleting your account.
        </Text>

        {!state.otpSent ? (
          <>
            <View style={s.identifierBox}>
              <MessageSquare size={16} color={DS.color.textSub} strokeWidth={2} />
              <Text style={s.identifierText}>
                An OTP will be sent to{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold", color: DS.color.text }}>
                  {identifier}
                </Text>
              </Text>
            </View>

            {state.error ? (
              <Text style={s.errorText}>{state.error}</Text>
            ) : null}

            <TouchableOpacity
              onPress={sendOtp}
              style={s.btnPrimary}
              activeOpacity={0.85}
              disabled={state.otpLoading}
            >
              {state.otpLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnPrimaryText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.otpPrompt}>
              Enter the 6-digit code sent to{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>{identifier}</Text>
            </Text>

            <OtpInput
              value={state.otp}
              onChange={(v) => update({ otp: v, error: null })}
              disabled={state.deleteLoading}
            />

            {state.error ? (
              <Text style={s.errorText}>{state.error}</Text>
            ) : null}

            {/* Resend */}
            <TouchableOpacity
              onPress={state.resendCountdown > 0 ? undefined : sendOtp}
              style={s.resendRow}
              activeOpacity={state.resendCountdown > 0 ? 1 : 0.7}
              disabled={state.otpLoading || state.resendCountdown > 0}
            >
              <RotateCcw
                size={14}
                color={state.resendCountdown > 0 ? DS.color.muted : DS.color.primary}
                strokeWidth={2}
              />
              <Text
                style={[
                  s.resendText,
                  { color: state.resendCountdown > 0 ? DS.color.muted : DS.color.primary },
                ]}
              >
                {state.resendCountdown > 0
                  ? `Resend in ${state.resendCountdown}s`
                  : "Resend code"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              style={[
                s.btnDanger,
                state.otp.length !== OTP_LENGTH && { opacity: 0.5 },
              ]}
              activeOpacity={0.85}
              disabled={state.otp.length !== OTP_LENGTH}
            >
              <Trash2 size={16} color="#fff" strokeWidth={2} />
              <Text style={s.btnDangerText}>Delete My Account</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => router.back()} style={s.btnGhost}>
          <Text style={s.btnGhostText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderDeleting = () => (
    <View style={[s.card, { alignItems: "center", paddingVertical: 48 }]}>
      <ActivityIndicator size="large" color={DS.color.red} />
      <Text style={[s.cardTitle, { marginTop: 20 }]}>Deleting Account…</Text>
      <Text style={s.cardSubtitle}>
        Removing your data securely. Please do not close the app.
      </Text>
    </View>
  );

  const renderDone = () => (
    <View style={[s.card, { alignItems: "center", paddingVertical: 48 }]}>
      <View style={[s.iconCircle, { backgroundColor: DS.color.greenSoft }]}>
        <CheckCircle2 size={32} color={DS.color.green} strokeWidth={2} />
      </View>
      <Text style={[s.cardTitle, { marginTop: 20 }]}>Account Deleted</Text>
      <Text style={s.cardSubtitle}>
        Your account and data have been scheduled for deletion. You will be
        redirected shortly.
      </Text>
    </View>
  );

  const stepContent: Record<Step, React.ReactNode> = {
    warning: renderWarning(),
    subscription: renderSubscription(),
    verify: renderVerify(),
    deleting: renderDeleting(),
    done: renderDone(),
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={12}
          disabled={state.step === "deleting" || state.step === "done"}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={22} color={DS.color.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Account Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {stepContent[state.step]}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.bgSoft },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: DS.color.divider,
    backgroundColor: DS.color.bgCard,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: DS.radius.sm,
    backgroundColor: DS.color.bgSoft,
  },
  headerTitle: {
    fontSize: DS.font.md,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.text,
  },

  scroll: { padding: 16 },

  card: {
    backgroundColor: DS.color.bgCard,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.divider,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14 },
      android: { elevation: 4 },
    }),
  },

  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },

  cardTitle: {
    fontSize: DS.font.lg,
    fontFamily: "Inter_700Bold",
    color: DS.color.text,
    textAlign: "center",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: DS.font.base,
    fontFamily: "Inter_400Regular",
    color: DS.color.textSub,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  listBox: {
    backgroundColor: DS.color.redSoft,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: "rgba(217,64,64,0.15)",
    padding: 16,
    marginBottom: 24,
  },
  listHead: {
    fontSize: DS.font.sm,
    fontFamily: "Inter_600SemiBold",
    color: DS.color.red,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  listDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: DS.color.red,
    marginTop: 6,
  },
  listItem: {
    flex: 1,
    fontSize: DS.font.base,
    fontFamily: "Inter_400Regular",
    color: DS.color.text,
    lineHeight: 18,
  },

  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: DS.color.red,
    borderRadius: DS.radius.md,
    paddingVertical: 14,
    marginBottom: 12,
  },
  btnDangerText: {
    fontSize: DS.font.md,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  btnPrimary: {
    backgroundColor: DS.color.primary,
    borderRadius: DS.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  btnPrimaryText: {
    fontSize: DS.font.md,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  btnGhost: {
    alignItems: "center",
    paddingVertical: 12,
  },
  btnGhostText: {
    fontSize: DS.font.base,
    fontFamily: "Inter_500Medium",
    color: DS.color.textSub,
  },

  identifierBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: DS.color.bgSoft,
    borderRadius: DS.radius.md,
    padding: 14,
    marginBottom: 16,
  },
  identifierText: {
    flex: 1,
    fontSize: DS.font.base,
    fontFamily: "Inter_400Regular",
    color: DS.color.textSub,
    lineHeight: 20,
  },

  otpPrompt: {
    fontSize: DS.font.base,
    fontFamily: "Inter_400Regular",
    color: DS.color.textSub,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 4,
  },

  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  resendText: {
    fontSize: DS.font.sm,
    fontFamily: "Inter_500Medium",
  },

  errorText: {
    fontSize: DS.font.sm,
    fontFamily: "Inter_400Regular",
    color: DS.color.red,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 18,
  },
});