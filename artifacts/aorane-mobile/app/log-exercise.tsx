import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Dimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { api, cachedGet } from "@/lib/api";
import { DS } from "@/lib/theme";
import {
  ChevronLeft, X, Search, Minus, Plus, Timer, TrendingUp,
  MessageSquare, Trash2, Pencil,
} from "lucide-react-native";
import { useOfflineLog } from "@/hooks/useOfflineLog";
import {
  EXERCISE_LIST, CATEGORIES, INTENSITIES, STEPS_EXERCISES, STRENGTH_EXERCISES,
  DURATION_PRESETS, Category, todayDate, uid,
} from "@/lib/exerciseData";

const P = DS.color.primary;
const G = DS.color.green;

const SCREEN_PAD = 16;
const GRID_GAP = 8;
const GRID_COLS = 5;
const { width: SCREEN_W } = Dimensions.get("window");
const EX_CHIP_W = (SCREEN_W - SCREEN_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type ExerciseLog = {
  id: string; exerciseType: string; durationMinutes: number;
  intensity: string; caloriesBurned?: string; metValue?: string;
};

type SessionEntry = {
  id: string; exerciseType: string; duration: string; intensity: string;
  estimatedCalories: number | null; met: number | null;
  sets?: string; reps?: string; steps?: string; notes?: string;
};

export default function LogExerciseScreen() {
  const insets = useSafeAreaInsets();
  const { logEntry } = useOfflineLog();
  const notesRef = useRef<TextInput>(null);

  // ── Today's stats (same source/shape as the Exercise tab) ──
  const [logs, setLogs] = useState<ExerciseLog[]>([]);

  const loadLogs = useCallback(async () => {
    try {
      const { data } = await cachedGet<{ logs: Array<Record<string, unknown>> }>(`/health/exercise?date=${todayDate()}`);
      setLogs(data.logs as ExerciseLog[]);
    } catch { /* keep last-known stats on failure */ }
  }, []);
  useFocusEffect(useCallback(() => { loadLogs(); }, [loadLogs]));

  const totalMin = logs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalCal = logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0);
  const ringPct  = Math.min(1, totalMin / 60);

  // ── Form state ──
  const [activeCategory,   setActiveCategory]   = useState<Category>("All");
  const [search,           setSearch]           = useState("");
  const [session,          setSession]          = useState<SessionEntry[]>([]);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [duration,         setDuration]         = useState("30");
  const [intensity,        setIntensity]        = useState("moderate");
  const [sets,             setSets]             = useState("");
  const [reps,             setReps]             = useState("");
  const [steps,            setSteps]            = useState("");
  const [notes,            setNotes]            = useState("");
  const [isCalculating,    setIsCalculating]    = useState(false);
  const [liveEstimate,     setLiveEstimate]     = useState<{ calories: number; met: number; formula: string; weightKg: number; gender: string } | null>(null);
  const [isSubmitting,     setIsSubmitting]     = useState(false);

  const isStrength   = STRENGTH_EXERCISES.has(selectedExercise);
  const isStepsBased = STEPS_EXERCISES.has(selectedExercise);
  const selectedIntensity = INTENSITIES.find(i => i.value === intensity) ?? INTENSITIES[1];

  useEffect(() => {
    const mins = parseInt(duration, 10);
    if (!selectedExercise || !mins || mins < 1) { setLiveEstimate(null); return; }
    const timeout = setTimeout(async () => {
      setIsCalculating(true);
      try {
        const result = await api.calculateExercise({ exerciseType: selectedExercise, durationMinutes: mins, intensity });
        setLiveEstimate({ calories: result.caloriesBurned, met: result.metValue, formula: result.formula, weightKg: result.weightKg, gender: result.gender });
      } catch { setLiveEstimate(null); }
      setIsCalculating(false);
    }, 600);
    return () => clearTimeout(timeout);
  }, [selectedExercise, duration, intensity]);

  const resetForm = () => {
    setSelectedExercise(""); setLiveEstimate(null);
    setSets(""); setReps(""); setSteps(""); setNotes("");
  };

  const adjustDuration = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDuration(prev => String(Math.max(5, (parseInt(prev, 10) || 0) + delta)));
  };

  const handleAddToSession = () => {
    const mins = parseInt(duration, 10);
    if (!selectedExercise || !mins || mins < 1) {
      Alert.alert("Required", "Select exercise and enter duration"); return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession(prev => [...prev, {
      id: uid(), exerciseType: selectedExercise, duration, intensity,
      estimatedCalories: liveEstimate?.calories ?? null, met: liveEstimate?.met ?? null,
      sets: sets || undefined, reps: reps || undefined, steps: steps || undefined, notes: notes || undefined,
    }]);
    resetForm();
  };

  const removeFromSession = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession(prev => prev.filter(e => e.id !== id));
  };

  const sessionTotalCal = session.reduce((s, e) => s + (e.estimatedCalories ?? 0), 0);

  const handleLogAll = async () => {
    const toLog = session.length > 0
      ? session
      : selectedExercise && duration
        ? [{ id: uid(), exerciseType: selectedExercise, duration, intensity, estimatedCalories: liveEstimate?.calories ?? null, met: liveEstimate?.met ?? null, sets: sets || undefined, reps: reps || undefined, steps: steps || undefined, notes: notes || undefined }]
        : [];

    if (toLog.length === 0) { Alert.alert("Nothing to log", "Add at least one exercise."); return; }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      for (const e of toLog) {
        await logEntry({
          path: "/health/exercise",
          body: {
            exerciseType: e.exerciseType,
            durationMinutes: parseInt(e.duration, 10),
            intensity: e.intensity,
            sets: e.sets ? parseInt(e.sets, 10) : undefined,
            reps: e.reps ? parseInt(e.reps, 10) : undefined,
            steps: e.steps ? parseInt(e.steps, 10) : undefined,
            notes: e.notes || undefined,
          },
          category: "exercise",
          onSynced: loadLogs,
          onOptimistic: () => {
            setLogs((prev) => [...prev, {
              id: "offline-" + e.id, exerciseType: e.exerciseType,
              durationMinutes: parseInt(e.duration, 10), intensity: e.intensity,
              caloriesBurned: String(e.estimatedCalories ?? 0),
            }]);
          },
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Could not log exercises. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExercises = useMemo(() => {
    const byCategory = activeCategory === "All" ? EXERCISE_LIST : EXERCISE_LIST.filter(e => e.category === activeCategory);
    const q = search.trim().toLowerCase();
    return q ? byCategory.filter(e => e.name.toLowerCase().includes(q)) : byCategory;
  }, [activeCategory, search]);

  const canSubmit = session.length > 0 || (!!selectedExercise && !!duration);

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 110, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.roundBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <ChevronLeft size={20} color={DS.color.text} strokeWidth={2.2} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Log Exercise 🏃</Text>
            <Text style={s.subtitle}>Track your activity. Build a healthier you.</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={s.roundBtn} accessibilityLabel="Close" accessibilityRole="button">
            <X size={20} color={DS.color.text} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* ── Stats card ── */}
        <View style={s.card}>
          <View style={s.statsRow}>
            {[
              { icon: "timer-outline",  label: "Minutes",  value: `${totalMin}`,             color: G,             bg: DS.color.greenSoft },
              { icon: "fire",           label: "Calories", value: `${Math.round(totalCal)}`, color: DS.color.orange, bg: DS.color.orangeSoft },
              { icon: "trophy-outline", label: "Sessions", value: `${logs.length}`,           color: P,             bg: DS.color.primarySoft },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={s.statItem}>
                  <View style={[s.statIcon, { backgroundColor: item.bg }]}>
                    <MaterialCommunityIcons name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={item.color} />
                  </View>
                  <Text style={[s.statNum, { color: item.color }]}>{item.value}</Text>
                  <Text style={s.statLabel}>{item.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.statDiv} />}
              </React.Fragment>
            ))}
          </View>
          <View style={s.progressTrack}>
            <LinearGradient colors={[G, P]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.progressFill, { width: `${ringPct * 100}%` as `${number}%` }]} />
          </View>
          <Text style={s.progressText}>Daily goal: 60 min · {Math.round(ringPct * 100)}% complete</Text>
        </View>

        {/* ── Session list (multi-exercise batching, preserved) ── */}
        {session.length > 0 && (
          <View style={s.sessionBox}>
            <View style={s.sessionHeader}>
              <Text style={s.sessionTitle}>Session ({session.length} exercise{session.length > 1 ? "s" : ""})</Text>
              <Text style={[s.sessionCal, { color: DS.color.orange }]}>~{sessionTotalCal} kcal total</Text>
            </View>
            {session.map((entry) => {
              const ex = EXERCISE_LIST.find(e => e.name === entry.exerciseType);
              const detailParts = [
                `${entry.duration} min`, entry.intensity,
                entry.sets ? `${entry.sets} sets` : null,
                entry.reps ? `${entry.reps} reps` : null,
                entry.steps ? `${parseInt(entry.steps, 10).toLocaleString()} steps` : null,
                entry.estimatedCalories ? `~${entry.estimatedCalories} kcal` : null,
              ].filter(Boolean).join(" · ");
              return (
                <View key={entry.id} style={s.sessionEntry}>
                  <View style={[s.sessionEntryIcon, { backgroundColor: (ex?.color || P) + "18" }]}>
                    <MaterialCommunityIcons name={(ex?.icon || "run-fast") as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color={ex?.color || P} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionEntryName}>{entry.exerciseType}</Text>
                    <Text style={s.sessionEntryDetail}>{detailParts}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFromSession(entry.id)} style={{ padding: 4 }} accessibilityLabel={`Remove ${entry.exerciseType}`} accessibilityRole="button">
                    <Trash2 size={15} color="#EF4444" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Exercise Type ── */}
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>{session.length > 0 ? "Add Another Exercise" : "Exercise Type"}</Text>
          <View style={s.searchBox}>
            <TextInput
              style={s.searchInput}
              placeholder="Search exercise..."
              placeholderTextColor={DS.color.muted}
              value={search}
              onChangeText={setSearch}
            />
            <Search size={15} color={DS.color.muted} strokeWidth={2} />
          </View>
        </View>

        <View style={s.catRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat.key} onPress={() => setActiveCategory(cat.key)} activeOpacity={0.8} style={{ flex: 1 }}>
              {activeCategory === cat.key ? (
                <View style={s.catChipActive}>
                  <MaterialCommunityIcons name={cat.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={13} color={P} />
                  <Text style={[s.catLabel, { color: P }]} numberOfLines={1}>{cat.label}</Text>
                </View>
              ) : (
                <View style={s.catChipOff}>
                  <MaterialCommunityIcons name={cat.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={13} color={DS.color.muted} />
                  <Text style={[s.catLabel, { color: DS.color.muted }]} numberOfLines={1}>{cat.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.exGrid}>
          {filteredExercises.map((ex) => (
            <TouchableOpacity key={ex.name} onPress={() => { setSelectedExercise(ex.name); setSets(""); setReps(""); setSteps(""); }} activeOpacity={0.8} style={{ width: EX_CHIP_W }}>
              {selectedExercise === ex.name ? (
                <LinearGradient colors={[ex.color, ex.color + "CC"]} style={s.exChip}>
                  <MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color="#FFF" />
                  <Text style={[s.exName, { color: "#FFF" }]} numberOfLines={2}>{ex.name}</Text>
                </LinearGradient>
              ) : (
                <View style={s.exChipOff}>
                  <MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color={ex.color} />
                  <Text style={[s.exName, { color: DS.color.text }]} numberOfLines={2}>{ex.name}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Duration + Intensity (side by side) ── */}
        <View style={s.twoColRow}>
          <View style={s.card}>
            <View style={s.cardLabelRow}>
              <Timer size={15} color={P} strokeWidth={2} />
              <Text style={s.cardLabel}>Duration (minutes)</Text>
            </View>
            <View style={s.stepperRow}>
              <TouchableOpacity onPress={() => adjustDuration(-5)} style={s.stepperBtn} accessibilityLabel="Decrease duration">
                <Minus size={16} color={DS.color.text} strokeWidth={2.4} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={s.durationNum}>{duration || 0}</Text>
                <Text style={s.durationUnit}>min</Text>
              </View>
              <TouchableOpacity onPress={() => adjustDuration(5)} style={s.stepperBtn} accessibilityLabel="Increase duration">
                <Plus size={16} color={DS.color.text} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
            <View style={s.presetRow}>
              {DURATION_PRESETS.map((p) => {
                const active = parseInt(duration, 10) === p;
                return (
                  <TouchableOpacity key={p} onPress={() => setDuration(String(p))} style={[s.presetChip, active && s.presetChipActive]}>
                    <Text style={[s.presetText, active && s.presetTextActive]}>{p === 90 ? "90+" : p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardLabelRow}>
              <TrendingUp size={15} color={P} strokeWidth={2} />
              <Text style={s.cardLabel}>Intensity</Text>
            </View>
            <View style={{ gap: 6 }}>
              {INTENSITIES.map((item) => {
                const selected = intensity === item.value;
                return (
                  <TouchableOpacity key={item.value} onPress={() => setIntensity(item.value)} activeOpacity={0.8}>
                    <View
                      style={[
                        s.intensityBtn,
                        selected
                          ? { backgroundColor: DS.color.primarySoft, borderWidth: 1.5, borderColor: P }
                          : { backgroundColor: item.softBg, borderWidth: 1.5, borderColor: "transparent" },
                      ]}
                    >
                      <Text style={[s.intensityText, { color: selected ? P : item.softColor }]}>{item.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.hintBox}>
              <Text style={s.hintText}>💡 {selectedIntensity.label.replace(/\s?[^\x00-\x7F]+/g, "")} intensity{"\n"}{selectedIntensity.hint}</Text>
            </View>
          </View>
        </View>

        {/* ── Sets & Reps (Strength only) ── */}
        {isStrength && (
          <View>
            <Text style={s.sectionTitle}>Sets & Reps <Text style={s.optionalText}>(optional)</Text></Text>
            <View style={s.twoCol}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Sets  e.g. 3" placeholderTextColor={DS.color.muted} keyboardType="numeric" value={sets} onChangeText={setSets} />
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Reps  e.g. 12" placeholderTextColor={DS.color.muted} keyboardType="numeric" value={reps} onChangeText={setReps} />
            </View>
          </View>
        )}

        {/* ── Steps (Walking / Running / Treadmill) ── */}
        {isStepsBased && (
          <View>
            <Text style={s.sectionTitle}>Steps <Text style={s.optionalText}>(optional)</Text></Text>
            <TextInput style={s.input} placeholder="e.g. 8000" placeholderTextColor={DS.color.muted} keyboardType="numeric" value={steps} onChangeText={setSteps} />
          </View>
        )}

        {/* ── Live calorie estimate ── */}
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
                {isStrength && (sets || reps) && (
                  <View style={[s.formulaBox, { backgroundColor: "#5856D618" }]}>
                    <Text style={[s.formulaText, { color: "#5856D6" }]}>
                      💪 {sets ? `${sets} sets` : ""}{sets && reps ? " × " : ""}{reps ? `${reps} reps` : ""}
                      {sets && reps ? `  =  ${parseInt(sets || "0", 10) * parseInt(reps || "0", 10)} total reps` : ""}
                    </Text>
                  </View>
                )}
                {isStepsBased && steps && (
                  <View style={[s.formulaBox, { backgroundColor: G + "18" }]}>
                    <Text style={[s.formulaText, { color: G }]}>
                      👣 {parseInt(steps, 10).toLocaleString()} steps  ≈  {Math.round(parseInt(steps, 10) * 0.04)} cal (avg)
                    </Text>
                  </View>
                )}
                <View style={s.formulaBox}>
                  <Text style={s.formulaText}>📐 {liveEstimate.formula}</Text>
                </View>
              </>
            ) : null}
          </View>
        )}

        {/* ── Notes ── */}
        <View style={[s.card, { position: "relative" }]}>
          <View style={s.cardLabelRow}>
            <MessageSquare size={15} color={P} strokeWidth={2} />
            <Text style={s.cardLabel}>Notes <Text style={s.optionalText}>(optional)</Text></Text>
          </View>
          <TextInput
            ref={notesRef}
            style={s.notesInput}
            placeholder="How did your workout feel?"
            placeholderTextColor={DS.color.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <TouchableOpacity onPress={() => notesRef.current?.focus()} style={s.notesEditBtn} accessibilityLabel="Edit notes">
            <Pencil size={13} color={DS.color.muted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Add to session ── */}
        {(selectedExercise && duration) && (
          <TouchableOpacity onPress={handleAddToSession} activeOpacity={0.85} style={s.addMoreBtn}>
            <Plus size={16} color={P} strokeWidth={2.5} />
            <Text style={s.addMoreText}>Add to Session</Text>
          </TouchableOpacity>
        )}

        {session.length > 0 && (
          <Text style={s.sessionHint}>
            {session.length} exercise{session.length > 1 ? "s" : ""} in session · ~{sessionTotalCal + (liveEstimate?.calories ?? 0)} kcal total
          </Text>
        )}
      </ScrollView>

      {/* ── Fixed footer CTA ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity onPress={handleLogAll} disabled={isSubmitting || !canSubmit} activeOpacity={0.85}>
          <LinearGradient
            colors={(isSubmitting || !canSubmit) ? ["#CBD5E1", "#94A3B8"] : [P, G]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.saveBtn}
          >
            {isSubmitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={s.saveText}>{session.length > 1 ? `Log All ${session.length} Exercises ✓` : "Log Exercise ✓"}</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.bgSoft },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  roundBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", ...DS.shadow.sm },
  title:     { fontSize: 20, fontFamily: "Inter_700Bold", color: DS.color.text },
  subtitle:  { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },

  card: { flex: 1, backgroundColor: "#FFF", borderRadius: DS.radius.xl, padding: 16, borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm },

  statsRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingBottom: 14 },
  statItem:    { alignItems: "center", gap: 6 },
  statIcon:    { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statNum:     { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  statDiv:     { width: 1, height: 50, backgroundColor: DS.color.borderLight },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: DS.color.bgSoft, overflow: "hidden", marginBottom: 6 },
  progressFill:  { height: 5, borderRadius: 3 },
  progressText:  { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center" },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 10 },
  sectionTitle:     { fontSize: 15, fontFamily: "Inter_700Bold", color: DS.color.text },
  optionalText:     { fontFamily: "Inter_400Regular", color: DS.color.muted, fontSize: 12 },

  searchBox:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: DS.color.border, paddingHorizontal: 10, paddingVertical: 7, flexShrink: 1 },
  searchInput: { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.text, minWidth: 90, padding: 0 },

  catRow:        { flexDirection: "row", gap: 8 },
  catChipActive: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 9, borderRadius: 20, backgroundColor: DS.color.primarySoft, borderWidth: 1, borderColor: P },
  catChipOff:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 9, borderRadius: 20, backgroundColor: "#FFF", borderWidth: 1, borderColor: DS.color.border },
  catLabel:      { fontSize: 11.5, fontFamily: "Inter_600SemiBold" },

  exGrid:    { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  exChip:    { flexDirection: "row", alignItems: "flex-start", gap: 4, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 16, minHeight: 58 },
  exChipOff: { flexDirection: "row", alignItems: "flex-start", gap: 4, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 16, minHeight: 58, backgroundColor: "#FFF", borderWidth: 1, borderColor: DS.color.border },
  exName:    { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 14 },

  twoColRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  cardLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  cardLabel:    { fontSize: 13, fontFamily: "Inter_700Bold", color: DS.color.text },

  stepperRow:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 12 },
  stepperBtn:  { width: 34, height: 34, borderRadius: 17, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center" },
  durationNum: { fontSize: 26, fontFamily: "Inter_700Bold", color: DS.color.text },
  durationUnit:{ fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: -2 },

  presetRow:   { flexDirection: "row", gap: 3, justifyContent: "space-between" },
  presetChip:  { flex: 1, alignItems: "center", paddingHorizontal: 4, paddingVertical: 4, borderRadius: 10, backgroundColor: DS.color.bgSoft, borderWidth: 1, borderColor: DS.color.border },
  presetChipActive: { backgroundColor: DS.color.primarySoft, borderColor: P },
  presetText:  { fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: DS.color.muted },
  presetTextActive: { color: P },

  intensityBtn: { paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  intensityText:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },
  hintBox:      { backgroundColor: DS.color.bgSoft, borderRadius: 10, padding: 9, marginTop: 10 },
  hintText:     { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 15 },

  input: {
    borderWidth: 1, borderColor: DS.color.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13, marginTop: 6,
    fontSize: 15, fontFamily: "Inter_400Regular", color: DS.color.text,
    backgroundColor: "#FFF",
  },
  twoCol: { flexDirection: "row", gap: 10 },

  notesInput: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: DS.color.text,
    minHeight: 56, textAlignVertical: "top", paddingRight: 28,
  },
  notesEditBtn: {
    position: "absolute", right: 14, bottom: 14,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center",
  },

  estimateCard: {
    backgroundColor: DS.color.bgSoft, borderRadius: DS.radius.lg,
    padding: 14, borderWidth: 1, borderColor: DS.color.border, gap: 8,
  },
  estimateLabel:  { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  estimateCal:    { fontSize: 24, fontFamily: "Inter_700Bold" },
  estimateMet:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  estimateProfile:{ fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted },
  formulaBox:     { backgroundColor: "rgba(0,119,182,0.07)", borderRadius: 10, padding: 10 },
  formulaText:    { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 16 },

  addMoreBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "center", paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: P, borderStyle: "dashed",
  },
  addMoreText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: P },

  sessionBox:       { backgroundColor: "#FFF", borderRadius: DS.radius.lg, padding: 14, borderWidth: 1, borderColor: DS.color.border, gap: 8 },
  sessionHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionTitle:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  sessionCal:       { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sessionEntry:     { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionEntryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sessionEntryName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  sessionEntryDetail:{ fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },

  sessionHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center" },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: DS.color.bgSoft,
    borderTopWidth: 1, borderTopColor: DS.color.border,
  },
  saveBtn:  { borderRadius: DS.radius.lg, paddingVertical: 16, alignItems: "center" },
  saveText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
