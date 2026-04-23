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
import { useFocusEffect } from "expo-router";
import { api, cachedGet } from "@/lib/api";
import { DS } from "@/lib/theme";
import { Plus, Timer, Flame, Trophy, X, Dumbbell, Trash2, ChevronDown } from "lucide-react-native";
import { useOfflineLog } from "@/hooks/useOfflineLog";

const { width: W } = Dimensions.get("window");
const P = DS.color.primary;
const G = DS.color.green;

type ExerciseLog = {
  id: string; exerciseType: string; durationMinutes: number;
  intensity: string; caloriesBurned?: string; metValue?: string;
  sets?: number | null; reps?: number | null; steps?: number | null;
};

type SessionEntry = {
  id: string; exerciseType: string; duration: string; intensity: string;
  estimatedCalories: number | null; met: number | null;
  sets?: string; reps?: string; steps?: string;
};

// ── Exercise Categories ────────────────────────────────────────────────────────
type Category = "All" | "Cardio" | "Strength" | "Yoga" | "Sports";

const EXERCISE_LIST: { name: string; icon: string; color: string; category: Exclude<Category, "All"> }[] = [
  // ── Cardio ──
  { name: "Walking",       icon: "walk",               color: "#34C759", category: "Cardio"   },
  { name: "Running",       icon: "run-fast",            color: "#FF3B30", category: "Cardio"   },
  { name: "Cycling",       icon: "bike",                color: "#FF9500", category: "Cardio"   },
  { name: "Swimming",      icon: "swim",                color: "#32ADE6", category: "Cardio"   },
  { name: "Skipping",      icon: "jump-rope",           color: "#FF9500", category: "Cardio"   },
  { name: "HIIT",          icon: "fire",                color: "#FF3B30", category: "Cardio"   },
  { name: "Treadmill",     icon: "run",                 color: "#34C759", category: "Cardio"   },
  { name: "Elliptical",    icon: "skiing",              color: "#5856D6", category: "Cardio"   },
  { name: "Rowing",        icon: "rowing",              color: "#32ADE6", category: "Cardio"   },
  { name: "Stair Climbing",icon: "stairs",              color: "#FF6B35", category: "Cardio"   },
  { name: "Dancing",       icon: "dance-ballroom",      color: "#FF2D55", category: "Cardio"   },
  { name: "Zumba",         icon: "music",               color: "#FF2D55", category: "Cardio"   },
  // ── Strength / Gym ──
  { name: "Weight Training",icon: "weight-lifter",      color: "#5856D6", category: "Strength" },
  { name: "Bench Press",   icon: "dumbbell",            color: "#7C3AED", category: "Strength" },
  { name: "Squats",        icon: "human-handsdown",     color: "#EF4444", category: "Strength" },
  { name: "Deadlifts",     icon: "weight",              color: "#DC2626", category: "Strength" },
  { name: "Shoulder Press",icon: "arm-flex",            color: "#6366F1", category: "Strength" },
  { name: "Bicep Curls",   icon: "arm-flex-outline",    color: "#8B5CF6", category: "Strength" },
  { name: "Pull-ups",      icon: "human-handsup",       color: "#0284C7", category: "Strength" },
  { name: "Push-ups",      icon: "human",               color: "#0369A1", category: "Strength" },
  { name: "Lunges",        icon: "human-male",          color: "#7C3AED", category: "Strength" },
  { name: "Plank",         icon: "yoga",                color: "#059669", category: "Strength" },
  { name: "Leg Press",     icon: "seat",                color: "#DC2626", category: "Strength" },
  { name: "Lat Pulldown",  icon: "cable-data",          color: "#2563EB", category: "Strength" },
  { name: "Cable Rows",    icon: "weight-lifter",       color: "#1D4ED8", category: "Strength" },
  { name: "Tricep Dips",   icon: "arm-flex",            color: "#7C3AED", category: "Strength" },
  // ── Yoga / Flexibility ──
  { name: "Yoga",          icon: "yoga",                color: "#AF52DE", category: "Yoga"     },
  { name: "Pilates",       icon: "human-handsdown",     color: "#AF52DE", category: "Yoga"     },
  { name: "Surya Namaskar",icon: "weather-sunny",       color: "#FF9500", category: "Yoga"     },
  // ── Sports ──
  { name: "Cricket",       icon: "cricket",             color: "#34C759", category: "Sports"   },
  { name: "Badminton",     icon: "badminton",           color: P,          category: "Sports"   },
  { name: "Football",      icon: "soccer",              color: "#34C759", category: "Sports"   },
  { name: "Basketball",    icon: "basketball",          color: "#FF9500", category: "Sports"   },
  { name: "Volleyball",    icon: "volleyball",          color: "#F59E0B", category: "Sports"   },
  { name: "Climbing",      icon: "slope-uphill",        color: "#FF9500", category: "Sports"   },
];

const STEPS_EXERCISES = new Set(["Walking", "Running", "Treadmill", "Stair Climbing"]);
const STRENGTH_EXERCISES = new Set([
  "Weight Training","Bench Press","Squats","Deadlifts","Shoulder Press",
  "Bicep Curls","Pull-ups","Push-ups","Lunges","Plank","Leg Press",
  "Lat Pulldown","Cable Rows","Tricep Dips",
]);

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "All",      label: "All",      icon: "all-inclusive"   },
  { key: "Cardio",   label: "Cardio",   icon: "run-fast"        },
  { key: "Strength", label: "Gym",      icon: "dumbbell"        },
  { key: "Yoga",     label: "Yoga",     icon: "yoga"            },
  { key: "Sports",   label: "Sports",   icon: "soccer"          },
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
  const [activeCategory,   setActiveCategory]   = useState<Category>("All");

  const [session,          setSession]          = useState<SessionEntry[]>([]);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [duration,         setDuration]         = useState("");
  const [intensity,        setIntensity]        = useState("moderate");
  const [sets,             setSets]             = useState("");
  const [reps,             setReps]             = useState("");
  const [steps,            setSteps]            = useState("");
  const [isCalculating,    setIsCalculating]    = useState(false);
  const [liveEstimate,     setLiveEstimate]     = useState<{ calories: number; met: number; formula: string; weightKg: number; gender: string } | null>(null);
  const [isSubmitting,     setIsSubmitting]     = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const { logEntry, onSync } = useOfflineLog();

  const loadLogs = useCallback(async () => {
    try {
      const { data } = await cachedGet<{ logs: Array<Record<string, unknown>> }>(`/health/exercise?date=${todayDate()}`);
      setLogs(data.logs as ExerciseLog[]);
    } catch { }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => onSync(loadLogs), [onSync, loadLogs]);

  const totalMin = logs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalCal = logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0);

  const isStrength = STRENGTH_EXERCISES.has(selectedExercise);
  const isStepsBased = STEPS_EXERCISES.has(selectedExercise);

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

  const resetForm = () => {
    setSelectedExercise(""); setDuration(""); setLiveEstimate(null);
    setIntensity("moderate"); setSets(""); setReps(""); setSteps("");
  };

  const handleAddToSession = () => {
    if (!selectedExercise || !duration || parseInt(duration) < 1) {
      Alert.alert("Required", "Select exercise and enter duration"); return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession(prev => [...prev, {
      id: uid(), exerciseType: selectedExercise, duration, intensity,
      estimatedCalories: liveEstimate?.calories ?? null, met: liveEstimate?.met ?? null,
      sets: sets || undefined, reps: reps || undefined, steps: steps || undefined,
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
        ? [{ id: uid(), exerciseType: selectedExercise, duration, intensity, estimatedCalories: liveEstimate?.calories ?? null, met: liveEstimate?.met ?? null, sets: sets || undefined, reps: reps || undefined, steps: steps || undefined }]
        : [];

    if (toLog.length === 0) { Alert.alert("Nothing to log", "Add at least one exercise."); return; }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let anyOffline = false;
      for (const e of toLog) {
        const result = await logEntry({
          path: "/health/exercise",
          body: {
            exerciseType: e.exerciseType,
            durationMinutes: parseInt(e.duration),
            intensity: e.intensity,
            sets: e.sets ? parseInt(e.sets) : undefined,
            reps: e.reps ? parseInt(e.reps) : undefined,
            steps: e.steps ? parseInt(e.steps) : undefined,
          },
          category: "exercise",
          onSynced: loadLogs,
          onOptimistic: () => {
            setLogs((prev) => [...prev, {
              id: "offline-" + e.id, exerciseType: e.exerciseType,
              durationMinutes: parseInt(e.duration), intensity: e.intensity,
              caloriesBurned: String(e.estimatedCalories ?? 0),
              sets: e.sets ? parseInt(e.sets) : null,
              reps: e.reps ? parseInt(e.reps) : null,
              steps: e.steps ? parseInt(e.steps) : null,
            }]);
          },
        });
        if (result.offline) anyOffline = true;
      }
      setShowModal(false); setSession([]); resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!anyOffline) loadLogs();
    } catch {
      Alert.alert("Error", "Could not log exercises. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => { setShowModal(false); setSession([]); resetForm(); };

  useFocusEffect(useCallback(() => {
    loadLogs();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  const topPad = insets.top;
  const ringPct = Math.min(1, totalMin / 60);

  const filteredExercises = activeCategory === "All"
    ? EXERCISE_LIST
    : EXERCISE_LIST.filter(e => e.category === activeCategory);

  return (
    <View style={s.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: DS.color.bgSoft }]} />

      {/* ── Header ── */}
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
              { Icon: Timer,  label: "Minutes",  value: `${totalMin}`,             color: G },
              { Icon: Flame,  label: "Calories", value: `${Math.round(totalCal)}`, color: DS.color.orange },
              { Icon: Trophy, label: "Sessions", value: `${logs.length}`,           color: P },
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
            <Text style={s.emptyDesc}>Cardio, Gym, Yoga, Sports — sab ek jagah</Text>
            <Text style={s.emptyFormula}>Formula: MET × Weight × Time × Gender factor</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
              <LinearGradient colors={[P, G]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtnGrad}>
                <Text style={s.emptyBtnText}>Add Exercise</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          logs.map((log) => {
            const ex  = EXERCISE_LIST.find((e) => e.name === log.exerciseType);
            const clr = ex?.color || P;
            const ico = ex?.icon || "run-fast";
            const hasStrengthDetails = log.sets || log.reps;
            const hasSteps = log.steps && Number(log.steps) > 0;
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
                  {hasStrengthDetails && (
                    <View style={s.detailPills}>
                      {log.sets ? (
                        <View style={s.pill}>
                          <Text style={s.pillText}>{log.sets} sets</Text>
                        </View>
                      ) : null}
                      {log.reps ? (
                        <View style={s.pill}>
                          <Text style={s.pillText}>{log.reps} reps</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                  {hasSteps && (
                    <View style={s.detailPills}>
                      <View style={[s.pill, { backgroundColor: G + "18" }]}>
                        <Text style={[s.pillText, { color: G }]}>👣 {Number(log.steps).toLocaleString()} steps</Text>
                      </View>
                    </View>
                  )}
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

            {/* ── Session list ── */}
            {session.length > 0 && (
              <View style={s.sessionBox}>
                <View style={s.sessionHeader}>
                  <Text style={s.sessionTitle}>Session ({session.length} exercise{session.length > 1 ? "s" : ""})</Text>
                  <Text style={[s.sessionCal, { color: DS.color.orange }]}>~{sessionTotalCal} kcal total</Text>
                </View>
                {session.map((entry) => {
                  const ex = EXERCISE_LIST.find(e => e.name === entry.exerciseType);
                  const detailParts = [
                    `${entry.duration} min`,
                    entry.intensity,
                    entry.sets ? `${entry.sets} sets` : null,
                    entry.reps ? `${entry.reps} reps` : null,
                    entry.steps ? `${parseInt(entry.steps).toLocaleString()} steps` : null,
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
                      <TouchableOpacity onPress={() => removeFromSession(entry.id)} style={s.removeBtn}>
                        <Trash2 size={15} color="#EF4444" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Category Tabs ── */}
            <Text style={s.modalLabel}>{session.length > 0 ? "Add Another Exercise" : "Exercise Type"}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  activeOpacity={0.8}
                >
                  {activeCategory === cat.key ? (
                    <LinearGradient colors={[P, G]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.catChipActive}>
                      <MaterialCommunityIcons name={cat.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={13} color="#FFF" />
                      <Text style={[s.catLabel, { color: "#FFF" }]}>{cat.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={s.catChipOff}>
                      <MaterialCommunityIcons name={cat.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={13} color={DS.color.muted} />
                      <Text style={[s.catLabel, { color: DS.color.muted }]}>{cat.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Exercise Grid ── */}
            <View style={s.exGrid}>
              {filteredExercises.map((ex) => (
                <TouchableOpacity key={ex.name} onPress={() => { setSelectedExercise(ex.name); setSets(""); setReps(""); setSteps(""); }} activeOpacity={0.8}>
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

            {/* ── Sets + Reps (Strength only) ── */}
            {isStrength && (
              <>
                <Text style={s.modalLabel}>Sets & Reps <Text style={s.optionalText}>(optional)</Text></Text>
                <View style={s.twoCol}>
                  <View style={[s.input, s.twoColInput]}>
                    <TextInput
                      style={s.inlineInput}
                      placeholder="Sets  e.g. 3"
                      placeholderTextColor={DS.color.muted}
                      keyboardType="numeric"
                      value={sets}
                      onChangeText={setSets}
                    />
                  </View>
                  <View style={[s.input, s.twoColInput]}>
                    <TextInput
                      style={s.inlineInput}
                      placeholder="Reps  e.g. 12"
                      placeholderTextColor={DS.color.muted}
                      keyboardType="numeric"
                      value={reps}
                      onChangeText={setReps}
                    />
                  </View>
                </View>
              </>
            )}

            {/* ── Steps (Walking / Running / Treadmill) ── */}
            {isStepsBased && (
              <>
                <Text style={s.modalLabel}>Steps <Text style={s.optionalText}>(optional)</Text></Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. 8000"
                  placeholderTextColor={DS.color.muted}
                  keyboardType="numeric"
                  value={steps}
                  onChangeText={setSteps}
                />
              </>
            )}

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
                          {sets && reps ? `  =  ${parseInt(sets || "0") * parseInt(reps || "0")} total reps` : ""}
                        </Text>
                      </View>
                    )}
                    {isStepsBased && steps && (
                      <View style={[s.formulaBox, { backgroundColor: G + "18" }]}>
                        <Text style={[s.formulaText, { color: G }]}>
                          👣 {parseInt(steps).toLocaleString()} steps  ≈  {Math.round(parseInt(steps) * 0.04)} cal (avg)
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

            {/* ── Add to session ── */}
            {(selectedExercise && duration) && (
              <TouchableOpacity onPress={handleAddToSession} activeOpacity={0.85} style={s.addMoreBtn}>
                <Plus size={16} color={P} strokeWidth={2.5} />
                <Text style={s.addMoreText}>Add to Session</Text>
              </TouchableOpacity>
            )}

            <View style={s.divider} />

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
    padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 14,
    borderWidth: 1, borderColor: DS.color.border, ...DS.shadow.sm,
  },
  logIcon:    { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  logName:    { fontSize: 15, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  logDetails: { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 2 },
  logCal:     { alignItems: "flex-end" },
  logCalNum:  { fontSize: 18, fontFamily: "Inter_700Bold" },
  logCalUnit: { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted },

  detailPills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  pill: {
    backgroundColor: "#5856D618", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#5856D6" },

  modalRoot:   { flex: 1, backgroundColor: "#FFF" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: DS.color.borderLight },
  modalTitle:  { fontSize: 18, fontFamily: "Inter_700Bold", color: DS.color.text },
  closeBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: DS.color.bgSoft, alignItems: "center", justifyContent: "center" },
  modalBody:   { padding: 16, gap: 8, paddingBottom: 48 },
  modalLabel:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginTop: 6, marginBottom: 2 },
  optionalText:{ fontFamily: "Inter_400Regular", color: DS.color.muted, fontSize: 12 },

  catChipActive: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  catChipOff:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: DS.color.bgSoft, borderWidth: 1, borderColor: DS.color.border },
  catLabel:      { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  exGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  exChip:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  exChipOff: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: DS.color.bgSoft, borderWidth: 1, borderColor: DS.color.border },
  exName:    { fontSize: 12, fontFamily: "Inter_500Medium" },

  input: {
    borderWidth: 1, borderColor: DS.color.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: "Inter_400Regular", color: DS.color.text,
    backgroundColor: "#FFF",
  },
  twoCol:      { flexDirection: "row", gap: 10 },
  twoColInput: { flex: 1, paddingVertical: 0 },
  inlineInput: { fontSize: 15, fontFamily: "Inter_400Regular", color: DS.color.text, paddingVertical: 13 },

  intensityRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  intensityBtn: { paddingVertical: 12, alignItems: "center", borderRadius: 14 },
  intensityOff: { backgroundColor: DS.color.bgSoft, borderWidth: 1, borderColor: DS.color.border },
  intensityText:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },

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
    borderRadius: 14, borderWidth: 1.5, borderColor: P,
    borderStyle: "dashed",
  },
  addMoreText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: P },

  divider: { height: 1, backgroundColor: DS.color.borderLight, marginVertical: 4 },

  saveBtn:  { borderRadius: DS.radius.lg, paddingVertical: 16, alignItems: "center" },
  saveText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  sessionBox:       { backgroundColor: DS.color.bgSoft, borderRadius: DS.radius.lg, padding: 14, borderWidth: 1, borderColor: DS.color.border, gap: 8 },
  sessionHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionTitle:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  sessionCal:       { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sessionEntry:     { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionEntryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sessionEntryName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  sessionEntryDetail:{ fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },
  removeBtn:        { padding: 4 },

  sessionHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center", marginTop: 4 },
});
