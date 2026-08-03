import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Animated, Platform, Alert, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";

type Quality = "poor" | "fair" | "good" | "excellent";

const QUALITY_OPTIONS: { key: Quality; label: string; emoji: string; color: string }[] = [
  { key: "poor",      label: "Poor",      emoji: "😴", color: "#EF4444" },
  { key: "fair",      label: "Fair",      emoji: "😐", color: "#F59E0B" },
  { key: "good",      label: "Good",      emoji: "😊", color: "#3B82F6" },
  { key: "excellent", label: "Excellent", emoji: "🌟", color: "#10B981" },
];

function qualityColor(q: Quality | null): string {
  const opt = QUALITY_OPTIONS.find(o => o.key === q);
  return opt?.color ?? "#8B5CF6";
}

function hoursLabel(h: number): string {
  if (h < 5) return "Too little sleep 😔";
  if (h < 7) return "Below recommended";
  if (h <= 9) return "Great amount! 🎉";
  return "More than average";
}

function hoursColor(h: number): string {
  if (h < 5) return "#EF4444";
  if (h < 7) return "#F59E0B";
  if (h <= 9) return "#10B981";
  return "#3B82F6";
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Sleep arc visual ──────────────────────────────────────────────────────────
function SleepArc({ hours, maxHours = 10 }: { hours: number; maxHours?: number }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const pct = Math.min(1, hours / maxHours);

  useEffect(() => {
    Animated.timing(animVal, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct]);

  const barWidth = animVal.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={{ alignItems: "center", marginVertical: 8 }}>
      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 52, lineHeight: 60 }}>
        {hours.toFixed(1)}
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium", fontSize: 14, marginBottom: 16 }}>
        hours of sleep
      </Text>
      <View style={{ width: "100%", height: 10, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 5, overflow: "hidden" }}>
        <Animated.View style={{ height: "100%", width: barWidth, backgroundColor: "#FFF", borderRadius: 5 }} />
      </View>
      <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 10 }}>
        {hoursLabel(hours)}
      </Text>
    </View>
  );
}

// ── History bar chart ─────────────────────────────────────────────────────────
function HistoryBar({ log, maxHours }: { log: Record<string, unknown>; maxHours: number }) {
  const hours = Number(log.sleep_hours ?? log.sleepHours ?? 0);
  const date = String(log.sleep_date ?? log.sleepDate ?? "");
  const quality = (log.quality as Quality | null) ?? null;
  const pct = maxHours > 0 ? Math.min(1, hours / maxHours) : 0;
  const color = hoursColor(hours);
  const isToday = date === todayStr();

  const animVal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animVal, { toValue: pct, duration: 700, useNativeDriver: false }).start();
  }, [pct]);

  const barH = animVal.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const dayLabel = date ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }) : "?";

  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ color: "rgba(10,22,40,0.5)", fontSize: 10, fontFamily: "Inter_500Medium", marginBottom: 4 }}>
        {hours > 0 ? `${hours.toFixed(1)}h` : "—"}
      </Text>
      <View style={{ height: 60, justifyContent: "flex-end", width: 24 }}>
        <Animated.View style={{ height: barH, width: 24, borderRadius: 6, backgroundColor: color, opacity: 0.85 }} />
      </View>
      <Text style={{ color: isToday ? color : ("rgba(10,22,40,0.4)"), fontSize: 9, fontFamily: isToday ? "Inter_700Bold" : "Inter_400Regular", marginTop: 4 }}>
        {isToday ? "Today" : dayLabel}
      </Text>
      {quality && (
        <Text style={{ fontSize: 10, marginTop: 2 }}>{QUALITY_OPTIONS.find(q => q.key === quality)?.emoji ?? ""}</Text>
      )}
    </View>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={["rgba(255,255,255,0.9)", "rgba(237,233,254,0.45)"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 20, padding: 1.5, marginBottom: 14 }}
    >
      <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.55)", padding: 18 }}>
        {Platform.OS === "ios"
          ? <BlurView intensity={60} tint={"light"} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.45)" }]} />
        }
        {children}
      </View>
    </LinearGradient>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SleepScreen() {
  const insets = useSafeAreaInsets();
  const bg = "#F5F3FF";

  const today = todayStr();

  // Today's log state
  const [isLogged, setIsLogged]         = useState(false);
  const [existingLog, setExistingLog]   = useState<Record<string, unknown> | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);

  // History
  const [history, setHistory]     = useState<Array<Record<string, unknown>>>([]);
  const [avgHours, setAvgHours]   = useState<number | null>(null);
  const [loadingHist, setLoadingHist] = useState(true);

  // Form state
  const [sleepHours, setSleepHours] = useState("7.5");
  const [bedtime,    setBedtime]    = useState("22:30");
  const [wakeTime,   setWakeTime]   = useState("06:00");
  const [quality,    setQuality]    = useState<Quality>("good");
  const [notes,      setNotes]      = useState("");
  const [saving,     setSaving]     = useState(false);

  const loadToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const res = await api.getSleepLog(today);
      setIsLogged(res.isLogged);
      if (res.isLogged && res.log) {
        const log = res.log as Record<string, unknown>;
        setExistingLog(log);
        setSleepHours(String(res.sleepHours ?? log.sleep_hours ?? "7.5"));
        setBedtime(String(log.bedtime ?? log.bed_time ?? "22:30"));
        setWakeTime(String(log.wake_time ?? log.wakeTime ?? "06:00"));
        setQuality((log.quality as Quality) || "good");
        setNotes(String(log.notes ?? ""));
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingToday(false);
    }
  }, [today]);

  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const res = await api.getSleepHistory(7);
      setHistory(res.logs ?? []);
      setAvgHours(res.avgHours);
    } catch {
      // silently ignore
    } finally {
      setLoadingHist(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadToday();
    loadHistory();
  }, [loadToday, loadHistory]));

  const handleSave = async () => {
    const hours = parseFloat(sleepHours);
    if (isNaN(hours) || hours < 0 || hours > 24) {
      Alert.alert("Invalid hours", "Please enter a valid number of sleep hours (0–24).");
      return;
    }

    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const payload = {
        sleepHours: hours,
        bedtime:    bedtime.trim() || undefined,
        wakeTime:   wakeTime.trim() || undefined,
        quality,
        notes:      notes.trim() || undefined,
      };

      if (isLogged) {
        await api.updateSleepLog(today, payload);
      } else {
        await api.logSleep({ sleepDate: today, ...payload });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadToday();
      await loadHistory();
      Alert.alert("Saved", isLogged ? "Sleep log updated!" : "Sleep logged successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const qColor = qualityColor(quality);
  const hoursNum = parseFloat(sleepHours) || 0;
  const maxHistHours = Math.max(...history.map(l => Number(l.sleep_hours ?? l.sleepHours ?? 0)), 10);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        <LinearGradient
          colors={["#EDE9FE", "#DDD6FE", "#F5F3FF"]}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 110, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(139,92,246,0.12)", alignItems: "center", justifyContent: "center", marginRight: 12 }}
            >
              <Ionicons name="arrow-back" size={20} color={"#7C3AED"} />
            </TouchableOpacity>
            <View>
              <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 22 }}>
                Sleep Tracker 😴
              </Text>
              <Text style={{ color: "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                Adults need 7–9 hours of quality sleep
              </Text>
            </View>
          </View>

          {/* Hero Card — today's summary if logged */}
          <LinearGradient
            colors={["#6D28D9", "#8B5CF6", "#7C3AED"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 22, padding: 24, marginBottom: 16 }}
          >
            {loadingToday ? (
              <ActivityIndicator color="#FFF" />
            ) : isLogged ? (
              <>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 }}>
                  Tonight's Sleep
                </Text>
                <SleepArc hours={parseFloat(String(existingLog?.sleep_hours ?? existingLog?.sleepHours ?? 0))} />
                <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 16 }}>
                  {existingLog?.bedtime || existingLog?.bed_time ? (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular" }}>Bedtime</Text>
                      <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                        {String(existingLog?.bedtime ?? existingLog?.bed_time ?? "")}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular" }}>Quality</Text>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15, textTransform: "capitalize" }}>
                      {existingLog?.quality as string ?? "—"}
                    </Text>
                  </View>
                  {existingLog?.wake_time || existingLog?.wakeTime ? (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular" }}>Wake up</Text>
                      <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                        {String(existingLog?.wake_time ?? existingLog?.wakeTime ?? "")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <Text style={{ fontSize: 48 }}>🌙</Text>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 8 }}>No sleep logged yet</Text>
                <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4, textAlign: "center" }}>
                  Log your sleep below to track rest quality
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* Log / Edit Form */}
          <Card>
            <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 16 }}>
              {isLogged ? "✏️ Update Today's Sleep" : "📝 Log Today's Sleep"}
            </Text>

            {/* Sleep Hours */}
            <Text style={[lbl()]}>Sleep Hours</Text>
            <View style={inputRow()}>
              <Ionicons name="moon" size={18} color="#8B5CF6" style={{ marginRight: 8 }} />
              <TextInput
                value={sleepHours}
                onChangeText={setSleepHours}
                keyboardType="decimal-pad"
                placeholder="e.g. 7.5"
                placeholderTextColor={"rgba(0,0,0,0.3)"}
                style={{ flex: 1, color: "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 15 }}
              />
              <Text style={{ color: "rgba(0,0,0,0.4)", fontFamily: "Inter_400Regular", fontSize: 13 }}>
                hrs
              </Text>
            </View>
            {hoursNum > 0 && (
              <Text style={{ color: hoursColor(hoursNum), fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                {hoursLabel(hoursNum)}
              </Text>
            )}

            {/* Bedtime & Wake time */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[lbl()]}>Bedtime</Text>
                <View style={inputRow()}>
                  <Ionicons name="bed" size={16} color="#8B5CF6" style={{ marginRight: 6 }} />
                  <TextInput
                    value={bedtime}
                    onChangeText={setBedtime}
                    placeholder="22:30"
                    placeholderTextColor={"rgba(0,0,0,0.3)"}
                    style={{ flex: 1, color: "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 14 }}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[lbl()]}>Wake Time</Text>
                <View style={inputRow()}>
                  <Ionicons name="sunny" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                  <TextInput
                    value={wakeTime}
                    onChangeText={setWakeTime}
                    placeholder="06:00"
                    placeholderTextColor={"rgba(0,0,0,0.3)"}
                    style={{ flex: 1, color: "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 14 }}
                  />
                </View>
              </View>
            </View>

            {/* Quality Selector */}
            <Text style={[lbl(), { marginTop: 12 }]}>Sleep Quality</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              {QUALITY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => { setQuality(opt.key); Haptics.selectionAsync(); }}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 10,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: quality === opt.key ? opt.color : "transparent",
                    backgroundColor: quality === opt.key ? opt.color + "20" : ("rgba(139,92,246,0.06)"),
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 2 }}>{opt.emoji}</Text>
                  <Text style={{ color: quality === opt.key ? opt.color : ("rgba(10,22,40,0.55)"), fontFamily: "Inter_500Medium", fontSize: 10 }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={[lbl(), { marginTop: 8 }]}>Notes (optional)</Text>
            <View style={[inputRow(), { alignItems: "flex-start", paddingVertical: 10, minHeight: 72 }]}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. woke up twice, vivid dreams..."
                placeholderTextColor={"rgba(0,0,0,0.3)"}
                multiline
                style={{ flex: 1, color: "#1a1a2e", fontFamily: "Inter_400Regular", fontSize: 14, textAlignVertical: "top" }}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{ marginTop: 16, borderRadius: 14, overflow: "hidden" }}
            >
              <LinearGradient
                colors={["#7C3AED", "#8B5CF6"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" />
                  : <>
                    <Ionicons name="save" size={20} color="#FFF" />
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {isLogged ? "Update Sleep Log" : "Save Sleep Log"}
                    </Text>
                  </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </Card>

          {/* Sleep History */}
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                Last 7 Days
              </Text>
              {avgHours !== null && (
                <View style={{ backgroundColor: "#7C3AED20", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#7C3AED", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                    Avg {avgHours.toFixed(1)}h
                  </Text>
                </View>
              )}
            </View>

            {loadingHist ? (
              <ActivityIndicator color="#8B5CF6" />
            ) : history.length === 0 ? (
              <Text style={{ color: "rgba(10,22,40,0.4)", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
                No sleep history yet — start logging tonight!
              </Text>
            ) : (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 4 }}>
                  {history.map((log, i) => (
                    <HistoryBar key={i} log={log} maxHours={maxHistHours} />
                  ))}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  {history.filter(l => Number(l.sleep_hours ?? l.sleepHours ?? 0) > 0).slice(0, 7).map((log, i) => {
                    const h = Number(log.sleep_hours ?? log.sleepHours ?? 0);
                    const d = String(log.sleep_date ?? log.sleepDate ?? "");
                    const q = log.quality as Quality | null;
                    const qOpt = QUALITY_OPTIONS.find(o => o.key === q);
                    return (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(139,92,246,0.06)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ fontSize: 14 }}>{qOpt?.emoji ?? "😴"}</Text>
                        <View>
                          <Text style={{ color: "#1a1a2e", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{h.toFixed(1)}h</Text>
                          <Text style={{ color: "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" }}>{d ? formatDate(d) : "—"}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </Card>

          {/* Sleep Tips */}
          <Card>
            <Text style={{ color: "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 12 }}>
              💡 Sleep Tips
            </Text>
            {[
              { icon: "📵", tip: "Avoid screens 1 hour before bed" },
              { icon: "🌡️", tip: "Keep your bedroom cool (65–68°F / 18–20°C)" },
              { icon: "⏰", tip: "Stick to a consistent sleep schedule" },
              { icon: "☕", tip: "Avoid caffeine after 2 PM" },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: "rgba(139,92,246,0.08)" }}>
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                <Text style={{ flex: 1, color: "rgba(10,22,40,0.7)", fontFamily: "Inter_400Regular", fontSize: 13 }}>
                  {item.tip}
                </Text>
              </View>
            ))}
          </Card>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function lbl() {
  return {
    color: "rgba(10,22,40,0.55)",
    fontFamily: "Inter_600SemiBold" as const,
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  };
}

function inputRow() {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(139,92,246,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    marginBottom: 8,
  };
}
