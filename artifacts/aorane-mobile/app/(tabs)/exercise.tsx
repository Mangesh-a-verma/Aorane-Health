import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator, Platform, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { DS } from "@/lib/theme";
import { Plus, Timer, Flame, Trophy, X, Dumbbell, Trash2 } from "lucide-react-native";

const { width: W } = Dimensions.get("window");
const P = DS.color.primary;
const G = DS.color.green;

type ExerciseLog = {
  id: string; exerciseType: string; durationMinutes: number;
  intensity: string; caloriesBurned?: string; metValue?: string;
};

type SessionEntry = {
  id: string;
  exerciseType: string;
  duration: string;
  intensity: string;
  estimatedCalories: number | null;
  met: number | null;
};

const EXERCISES = [
  { name: "Walking",         icon: "walk",           color: "#34C759" },
  { name: "Running",         icon: "run-fast",       color: "#FF3B30" },
  { name: "Yoga",            icon: "yoga",           color: "#AF52DE" },
  { name: "Cycling",         icon: "bike",           color: "#FF9500" },
  { name: "Swimming",        icon: "swim",           color: "#32ADE6" },
  { name: "Weight Training", icon: "weight-lifter",  color: "#5856D6" },
  { name: "Dancing",         icon: "dance-ballroom", color: "#FF2D55" },
  { name: "Cricket",         icon: "cricket",        color: "#34C759" },
  { name: "Badminton",       icon: "badminton",      color: P },
  { name: "Skipping",        icon: "jump-rope",      color: "#FF9500" },
  { name: "HIIT",            icon: "fire",           color: "#FF3B30" },
  { name: "Zumba",           icon: "music",          color: "#FF2D55" },
  { name: "Pilates",         icon: "human-handsdown", color: "#AF52DE" },
  { name: "Climbing",        icon: "slope-uphill",   color: "#FF9500" },
  { name: "Football",        icon: "soccer",         color: "#34C759" },
  { name: "Basketball",      icon: "basketball",     color: "#FF9500" },
];

const INTENSITIES = [
  { value: "light",    label: "Light 🚶",    grad: [G, "#059669"]              as [string, string] },
  { value: "moderate", label: "Moderate 🚴", grad: [DS.color.orange, "#D97706"] as [string, string] },
  { value: "intense",  label: "Intense 🔥",  grad: ["#FF3B30", "#AF52DE"]      as [string, string] },
];

function todayDate() { return new Date().toISOString().slice(0, 10); }
function uid() { return Math.random().toString(36).slice(2, 9); }

export default function ExerciseScreen() {
  const insets = useSafeAreaInsets();
  const [logs,             setLogs]             = useState<ExerciseLog[]>([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [showModal,        setShowModal]        = useState(false);

  // ── Session: multiple exercises ──────────────────────────────────────────
  const [session,          setSession]          = useState<SessionEntry[]>([]);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [duration,         setDuration]         = useState("");
  const [intensity,        setIntensity]        = useState("moderate");
  const [isCalculating,    setIsCalculating]    = useState(false);
  const [liveEstimate,     setLiveEstimate]     = useState<{ calories: number; met: number; formula: string; weightKg: number; gender: string } | null>(null);
  const [isSubmitting,     setIsSubmitting]     = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = useCallback(async () => {
    try { const res = await api.getExerciseLogs(todayDate()); setLogs(res.logs as ExerciseLog[]); } catch { }
    setIsLoading(false);
  }, []);

  const totalMin = logs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalCal = logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0);

  // Live calorie estimate for the current input
  useEffect(() => {
    if (!selectedExercise || !duration || parseInt(duration) < 1) { setLiveEstimate(null); return; }
    const timeout = setTimeout(async () => {
      setIsCalculating(true);
      try {
        const result = await api.calculateExercise({
          exerciseType: selectedExercise,
          durationMinutes: parseInt(duration),
          intensity,
        });
        setLiveEstimate({ calories: result.caloriesBurned, met: result.metValue, formula: result.formula, weightKg: result.weightKg, gender: result.gender });
      } catch { setLiveEstimate(null); }
      setIsCalculating(false);
    }, 600);
    return () => clearTimeout(timeout);
  }, [selectedExercise, duration, intensity]);

  // Add current entry to session list
  const handleAddToSession = () => {
    if (!selectedExercise || !duration || parseInt(duration) < 1) {
      Alert.alert("Required", "Select exercise and enter duration"); return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession(prev => [...prev, {
      id: uid(),
      exerciseType: selectedExercise,
      duration,
      intensity,
      estimatedCalories: liveEstimate?.calories ?? null,
      met: liveEstimate?.met ?? null,
    }]);
    // Reset form for next entry
    setSelectedExercise(""); setDuration(""); setLiveEstimate(null); setIntensity("moderate");
  };

  const removeFromSession = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession(prev => prev.filter(e => e.id !== id));
  };

  const sessionTotalCal = session.reduce((s, e) => s + (e.estimatedCalories ?? 0), 0);

  // Log all exercises in the session
  const handleLogAll = async () => {
    const toLog = session.length > 0
      ? session
      : selectedExercise && duration
        ? [{ id: uid(), exerciseType: selectedExercise, duration, intensity, estimatedCalories: liveEstimate?.calories ?? null, met: liveEstimate?.met ?? null }]
        : [];

    if (toLog.length === 0) { Alert.alert("Nothing to log", "Add at least one exercise."); return; }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Promise.all(toLog.map(e =>
        api.logExercise({ exerciseType: e.exerciseType, durationMinutes: parseInt(e.duration), intensity: e.intensity })
      ));
      setShowModal(false);
      setSession([]); setSelectedExercise(""); setDuration(""); setLiveEstimate(null); setIntensity("moderate");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadLogs();
    } catch {
      Alert.alert("Error", "Could not log exercises. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false); setSession([]); setSelectedExercise(""); setDuration(""); setLiveEstimate(null); setIntensity("moderate");
  };

  useFocusEffect(useCallback(() => {
    loadLogs();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const ringPct = Math.min(1, totalMin / 60);

  return (
    <View style={s.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: DS.color.bgSoft }]} />

      {/* ── Glass Header ── */}
      <View style={[s.headerWrap, { paddingTop: topPad }]}>
        {Platform.OS === "ios"
          ? <BlurView intensity={80} tint="extraLight" style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.96)" }]} />
        }
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>Exercise 💪</Text>
            <Text style={s.subtitle}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.85} style={s.addBtn}>
            <Plus size={22} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <View style={s.headerBorder} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats card ── */}
        <View style={s.card}>
          <View style={s.statsRow}>
            {[
              { Icon: Timer,  label: "Minutes",  value: `${totalMin}`,          color: G },
              { Icon: Flame,  label: "Calories", value: `${Math.round(totalCal)}`, color: DS.color.orange },
              { Icon: Trophy, label: "Sessions", value: `${logs.length}`,        color: P },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={s.statItem}>
                  <View style={[s.statIcon, { backgroundColor: item.color + "18" }]}>
                    <item.Icon size={20} color={item.color} strokeWidth={2} />
                  </View>
                  <Text style={[s.statNum, { color: item.color }]}>{item.value}</Text>
                  <Text style={s.statLabel}>{item.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.statDiv} />}
              </React.Fragment>
            ))}
          </View>
          <View style={s.progressTrack}>
            <LinearGradient
              colors={[G, P]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.progressFill, { width: `${ringPct * 100}%` as `${number}%` }]}
            />
          </View>
          <Text style={s.progressText}>Daily goal: 60 min · {Math.round(ringPct * 100)}% complete</Text>
        </View>

        {/* ── Logs ── */}
        {isLoading ? (
          <ActivityIndicator color={P} size="large" style={{ marginTop: 40 }} />
        ) : logs.length === 0 ? (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: DS.color.greenSoft }]}>
              <Dumbbell size={42} color={G} strokeWidth={1.5} />
            </View>
            <Text style={s.emptyTitle}>Log your exercises today</Text>
            <Text style={s.emptyDesc}>You can log multiple exercises at once</Text>
            <Text style={s.emptyFormula}>Formula: MET × Weight × Time × Gender factor</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
              <LinearGradient colors={[P, G]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtnGrad}>
                <Text style={s.emptyBtnText}>Add Exercise</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          logs.map((log) => {
            const ex  = EXERCISES.find((e) => e.name === log.exerciseType);
            const clr = ex?.color || P;
            const ico = ex?.icon || "run-fast";
            return (
              <View key={log.id} style={s.logCard}>
                <View style={[s.logIcon, { backgroundColor: clr + "18" }]}>
                  <MaterialCommunityIcons name={ico as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={clr} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.logName}>{log.exerciseType}</Text>
                  <Text style={s.logDetails}>
                    {log.durationMinutes} min · {log.intensity}
                    {log.metValue ? ` · MET ${Number(log.metValue).toFixed(1)}` : ""}
                  </Text>
                </View>
                <View style={s.logCal}>
                  <Text style={[s.logCalNum, { color: DS.color.orange }]}>{Math.round(Number(log.caloriesBurned || 0))}</Text>
                  <Text style={s.logCalUnit}>kcal</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Add Exercise Modal ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Log Exercise Session 🏃</Text>
            <TouchableOpacity onPress={closeModal} style={s.closeBtn}>
              <X size={20} color={DS.color.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* ── Session list (exercises added so far) ── */}
            {session.length > 0 && (
              <View style={s.sessionBox}>
                <View style={s.sessionHeader}>
                  <Text style={s.sessionTitle}>Session ({session.length} exercise{session.length > 1 ? "s" : ""})</Text>
                  <Text style={[s.sessionCal, { color: DS.color.orange }]}>~{sessionTotalCal} kcal total</Text>
                </View>
                {session.map((entry) => {
                  const ex = EXERCISES.find(e => e.name === entry.exerciseType);
                  return (
                    <View key={entry.id} style={s.sessionEntry}>
                      <View style={[s.sessionEntryIcon, { backgroundColor: (ex?.color || P) + "18" }]}>
                        <MaterialCommunityIcons name={(ex?.icon || "run-fast") as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color={ex?.color || P} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.sessionEntryName}>{entry.exerciseType}</Text>
                        <Text style={s.sessionEntryDetail}>{entry.duration} min · {entry.intensity}{entry.estimatedCalories ? ` · ~${entry.estimatedCalories} kcal` : ""}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFromSession(entry.id)} style={s.removeBtn}>
                        <Trash2 size={15} color="#EF4444" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Add another exercise ── */}
            <Text style={s.modalLabel}>{session.length > 0 ? "Add Another Exercise" : "Exercise Type"}</Text>
            <View style={s.exGrid}>
              {EXERCISES.map((ex) => (
                <TouchableOpacity key={ex.name} onPress={() => setSelectedExercise(ex.name)} activeOpacity={0.8}>
                  {selectedExercise === ex.name ? (
                    <LinearGradient colors={[ex.color, ex.color + "CC"]} style={s.exChip}>
                      <MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={14} color="#FFF" />
                      <Text style={[s.exName, { color: "#FFF" }]}>{ex.name}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={s.exChipOff}>
                      <MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={14} color={ex.color} />
                      <Text style={[s.exName, { color: DS.color.text }]}>{ex.name}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.modalLabel}>Duration (minutes)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 30"
              placeholderTextColor={DS.color.muted}
              keyboardType="numeric"
              value={duration}
              onChangeText={setDuration}
            />

            <Text style={s.modalLabel}>Intensity</Text>
            <View style={s.intensityRow}>
              {INTENSITIES.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setIntensity(item.value)}
                  activeOpacity={0.8}
                  style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}
                >
                  {intensity === item.value ? (
                    <LinearGradient colors={item.grad} style={s.intensityBtn}>
                      <Text style={[s.intensityText, { color: "#FFF" }]}>{item.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[s.intensityBtn, s.intensityOff]}>
                      <Text style={[s.intensityText, { color: DS.color.muted }]}>{item.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Live calorie estimate */}
            {(isCalculating || liveEstimate) && (
              <View style={s.estimateCard}>
                {isCalculating ? (
                  <ActivityIndicator color={P} />
                ) : liveEstimate ? (
                  <>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <View>
                        <Text style={s.estimateLabel}>Calorie Estimate (this exercise)</Text>
                        <Text style={[s.estimateCal, { color: DS.color.orange }]}>~{liveEstimate.calories} kcal</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[s.estimateMet, { color: G }]}>MET {liveEstimate.met.toFixed(1)}</Text>
                        <Text style={s.estimateProfile}>{liveEstimate.weightKg}kg · {liveEstimate.gender}</Text>
                      </View>
                    </View>
                    <View style={s.formulaBox}>
                      <Text style={s.formulaText}>📐 {liveEstimate.formula}</Text>
                    </View>
                  </>
                ) : null}
              </View>
            )}

            {/* Add to session button */}
            {(selectedExercise && duration) && (
              <TouchableOpacity onPress={handleAddToSession} activeOpacity={0.85} style={s.addMoreBtn}>
                <Plus size={16} color={P} strokeWidth={2.5} />
                <Text style={s.addMoreText}>Add to Session</Text>
              </TouchableOpacity>
            )}

            <View style={s.divider} />

            {/* Log all button */}
            <TouchableOpacity
              onPress={handleLogAll}
              disabled={isSubmitting || (session.length === 0 && !selectedExercise)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={(isSubmitting || (session.length === 0 && !selectedExercise)) ? ["#CBD5E1", "#94A3B8"] : [P, G]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.saveBtn}
              >
                {isSubmitting
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={s.saveText}>
                      {session.length > 1
                        ? `Log All ${session.length} Exercises ✓`
                        : "Log Exercise ✓"}
                    </Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {session.length > 0 && (
              <Text style={s.sessionHint}>
                {session.length} exercise{session.length > 1 ? "s" : ""} in session · ~{sessionTotalCal + (liveEstimate?.calories ?? 0)} kcal total
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.bgSoft },

  headerWrap: {
    overflow: "hidden",
    borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.07)",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 4 }, default: {} }),
  },
  headerRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  headerBorder: { position: "absolute", bottom: 0, left: 0, right: 0, height: 0.5, backgroundColor: "rgba(0,0,0,0.06)" },
  title:        { fontSize: 22, fontFamily: "Inter_700Bold", color: DS.color.text },
  subtitle:     { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  addBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: P, alignItems: "center", justifyContent: "center",
    ...DS.shadow.md,
  },

  content: { padding: 16, gap: 12 },

  card:        { backgroundColor: "#FFF", borderRadius: DS.radius.xl, padding: 16, borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm },
  statsRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingBottom: 14 },
  statItem:    { alignItems: "center", gap: 6 },
  statIcon:    { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statNum:     { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  statDiv:     { width: 1, height: 50, backgroundColor: DS.color.borderLight },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: DS.color.bgSoft, overflow: "hidden", marginBottom: 6 },
  progressFill:  { height: 5, borderRadius: 3 },
  progressText:  { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center" },

  empty:        { alignItems: "center", paddingTop: 48, paddingHorizontal: 32, gap: 10 },
  emptyIcon:    { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_600SemiBold", color: DS.color.text, textAlign: "center" },
  emptyDesc:    { fontSize: 13, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center" },
  emptyFormula: { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center", fontStyle: "italic" },
  emptyBtn:     { borderRadius: 16, overflow: "hidden", ...DS.shadow.md, marginTop: 4 },
  emptyBtnGrad: { paddingHorizontal: 28, paddingVertical: 14, alignItems: "center" },
  emptyBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  logCard: {
    backgroundColor: "#FFF", borderRadius: DS.radius.lg,
    padding: 14, flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm,
  },
  logIcon:    { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  logName:    { fontSize: 15, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 4 },
  logDetails: { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted },
  logCal:     { alignItems: "center" },
  logCalNum:  { fontSize: 18, fontFamily: "Inter_700Bold" },
  logCalUnit: { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted },

  // Modal
  modalRoot:   { flex: 1, backgroundColor: "#FFF" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, paddingTop: 56,
    borderBottomWidth: 1, borderBottomColor: DS.color.borderLight,
  },
  modalTitle:  { fontSize: 20, fontFamily: "Inter_700Bold", color: DS.color.text },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: DS.color.bgSoft,
    alignItems: "center", justifyContent: "center",
  },
  modalBody:   { padding: 20, paddingBottom: 60 },
  modalLabel:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 12 },

  // Session box
  sessionBox: {
    backgroundColor: "#F0FDF4", borderRadius: 14, padding: 14, marginBottom: 24,
    borderWidth: 1, borderColor: "#BBF7D0", gap: 10,
  },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionTitle:  { fontSize: 13, fontFamily: "Inter_700Bold", color: "#166534" },
  sessionCal:    { fontSize: 14, fontFamily: "Inter_700Bold" },
  sessionEntry:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF", borderRadius: 10, padding: 10 },
  sessionEntryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sessionEntryName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  sessionEntryDetail: { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  removeBtn: { padding: 4 },

  exGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  exChip:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  exChipOff:{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: DS.color.bgSoft, borderWidth: 1, borderColor: DS.color.border },
  exName:   { fontSize: 13, fontFamily: "Inter_500Medium" },

  input: {
    borderWidth: 1, borderRadius: 14, height: 52, paddingHorizontal: 16,
    fontSize: 16, fontFamily: "Inter_400Regular",
    backgroundColor: DS.color.bgSoft, borderColor: DS.color.border,
    color: DS.color.text, marginBottom: 24,
  },

  intensityRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  intensityBtn: { paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  intensityOff: { backgroundColor: DS.color.bgSoft, borderWidth: 1, borderColor: DS.color.border },
  intensityText:{ fontSize: 13, fontFamily: "Inter_600SemiBold" },

  estimateCard: {
    backgroundColor: DS.color.bgSoft, borderRadius: DS.radius.md,
    padding: 16, marginBottom: 16, gap: 12,
    borderWidth: 1, borderColor: DS.color.border,
  },
  estimateLabel:  { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, marginBottom: 4 },
  estimateCal:    { fontSize: 28, fontFamily: "Inter_700Bold" },
  estimateMet:    { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  estimateProfile:{ fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 4 },
  formulaBox: {
    borderWidth: 1, borderRadius: 10, padding: 10,
    backgroundColor: "#FFF", borderColor: DS.color.border,
  },
  formulaText:{ fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 16 },

  addMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: P, borderRadius: 14, paddingVertical: 13, marginBottom: 16,
    backgroundColor: "#FFF5F0",
  },
  addMoreText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: P },

  divider: { height: 1, backgroundColor: DS.color.borderLight, marginBottom: 16 },

  saveBtn:  { height: 56, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  saveText: { color: "#FFF", fontSize: 17, fontFamily: "Inter_700Bold" },

  sessionHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center", marginTop: 10 },
});
