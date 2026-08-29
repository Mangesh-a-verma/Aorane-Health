import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Dimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { api, cachedGet } from "@/lib/api";
import { DS } from "@/lib/theme";
import {
  ChevronLeft, X, Search, Minus, Plus, Timer, Flame, Trophy,
  TrendingUp, MessageSquare, Trash2, Pencil,
} from "lucide-react-native";
import { useOfflineLog } from "@/hooks/useOfflineLog";
import {
  EXERCISE_LIST, CATEGORIES, INTENSITIES, STEPS_EXERCISES, STRENGTH_EXERCISES,
  DURATION_PRESETS, Category, todayDate, uid,
} from "@/lib/exerciseData";

const P = DS.color.primary;
const G = DS.color.green;

// ── Grid geometry ──────────────────────────────────────────────────────────────
// Measured off the approved reference: 4 columns, chips sized so every one of
// the 35 labels stays fully readable. A fixed minHeight keeps the grid on one
// baseline whether a label runs to one line or wraps to two.
const SCREEN_PAD = 14;
const CARD_PAD   = 10;
const GRID_GAP   = 4;
const GRID_COLS  = 4;
const { width: SCREEN_W } = Dimensions.get("window");
const EX_CHIP_W = (SCREEN_W - SCREEN_PAD * 2 - CARD_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// React Native renders one shadow direction per view — there is no dual-tone
// light+dark neumorphic shadow, so this is a single soft drop shadow.
const NEU = Platform.select({
  ios:     { shadowColor: "#8FA6C2", shadowOffset: { width: 3, height: 4 }, shadowOpacity: 0.26, shadowRadius: 9 },
  android: { elevation: 4 },
  default: { shadowColor: "#8FA6C2", shadowOffset: { width: 3, height: 4 }, shadowOpacity: 0.26, shadowRadius: 9 },
}) as object;
const NEU_SM = Platform.select({
  ios:     { shadowColor: "#8FA6C2", shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.22, shadowRadius: 5 },
  android: { elevation: 2 },
  default: { shadowColor: "#8FA6C2", shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.22, shadowRadius: 5 },
}) as object;

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

  // ── Today's stats — same endpoint and shape the Exercise tab reads ──
  const [logs, setLogs] = useState<ExerciseLog[]>([]);

  const loadLogs = useCallback(async () => {
    try {
      const { data } = await cachedGet<{ logs: Array<Record<string, unknown>> }>(`/health/exercise?date=${todayDate()}`);
      setLogs(data.logs as ExerciseLog[]);
    } catch { /* keep last-known stats rather than blanking the card */ }
  }, []);
  useFocusEffect(useCallback(() => { loadLogs(); }, [loadLogs]));

  const totalMin = logs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const totalCal = logs.reduce((sum, l) => sum + Number(l.caloriesBurned || 0), 0);
  const goalPct  = Math.min(1, totalMin / 60);

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
  const activeIntensity = INTENSITIES.find((i) => i.value === intensity) ?? INTENSITIES[1];

  // Debounced live estimate — server owns the MET maths, weight and gender
  // factor, so the number here always matches what gets stored.
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
    setDuration((prev) => String(Math.max(5, (parseInt(prev, 10) || 0) + delta)));
  };

  const selectExercise = (name: string) => {
    Haptics.selectionAsync();
    // Sets/reps/steps belong to the previous exercise — clear them so a
    // strength entry can't carry its reps over onto a cardio one.
    setSelectedExercise(name); setSets(""); setReps(""); setSteps("");
  };

  const handleAddToSession = () => {
    const mins = parseInt(duration, 10);
    if (!selectedExercise || !mins || mins < 1) {
      Alert.alert("Required", "Select an exercise and enter a duration."); return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession((prev) => [...prev, {
      id: uid(), exerciseType: selectedExercise, duration, intensity,
      estimatedCalories: liveEstimate?.calories ?? null, met: liveEstimate?.met ?? null,
      sets: sets || undefined, reps: reps || undefined, steps: steps || undefined, notes: notes || undefined,
    }]);
    resetForm();
  };

  const removeFromSession = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession((prev) => prev.filter((e) => e.id !== id));
  };

  const sessionTotalCal = session.reduce((sum, e) => sum + (e.estimatedCalories ?? 0), 0);

  const handleLogAll = async () => {
    const toLog: SessionEntry[] = session.length > 0
      ? session
      : selectedExercise && duration
        ? [{
            id: uid(), exerciseType: selectedExercise, duration, intensity,
            estimatedCalories: liveEstimate?.calories ?? null, met: liveEstimate?.met ?? null,
            sets: sets || undefined, reps: reps || undefined, steps: steps || undefined, notes: notes || undefined,
          }]
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
            sets:  e.sets  ? parseInt(e.sets, 10)  : undefined,
            reps:  e.reps  ? parseInt(e.reps, 10)  : undefined,
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
      // The Exercise tab reloads on focus, so going back is enough to show it.
      router.back();
    } catch {
      Alert.alert("Error", "Could not log exercises. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExercises = useMemo(() => {
    const byCategory = activeCategory === "All"
      ? EXERCISE_LIST
      : EXERCISE_LIST.filter((e) => e.category === activeCategory);
    const q = search.trim().toLowerCase();
    return q ? byCategory.filter((e) => e.name.toLowerCase().includes(q)) : byCategory;
  }, [activeCategory, search]);

  const canSubmit = session.length > 0 || (!!selectedExercise && !!duration);

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 88 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.roundBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <ChevronLeft size={19} color={DS.color.text} strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Log Exercise 🏃</Text>
            <Text style={s.subtitle}>Track your activity. Build a healthier you.</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={s.roundBtn} accessibilityLabel="Close" accessibilityRole="button">
            <X size={18} color={DS.color.text} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* ── Today's stats ── */}
        <View style={[s.card, s.statsCard]}>
          <View style={s.statsRow}>
            {[
              { Icon: Timer,  label: "Minutes",  value: `${totalMin}`,             color: G,              bg: DS.color.greenSoft },
              { Icon: Flame,  label: "Calories", value: `${Math.round(totalCal)}`, color: DS.color.orange, bg: DS.color.orangeSoft },
              { Icon: Trophy, label: "Sessions", value: `${logs.length}`,          color: P,              bg: DS.color.primarySoft },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={s.statItem}>
                  <View style={[s.statIcon, { backgroundColor: item.bg }]}>
                    <item.Icon size={17} color={item.color} strokeWidth={2} />
                  </View>
                  <Text style={[s.statNum, { color: item.color }]}>{item.value}</Text>
                  <Text style={s.statLabel}>{item.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.statDiv} />}
              </React.Fragment>
            ))}
          </View>
          <View style={s.barTrack}>
            <LinearGradient
              colors={[G, P]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.barFill, { width: `${goalPct * 100}%` as `${number}%` }]}
            />
          </View>
          <Text style={s.goalTxt}>Daily goal: 60 min · {Math.round(goalPct * 100)}% complete</Text>
        </View>

        {/* ── Session queue — only once something has been added ── */}
        {session.length > 0 && (
          <View style={[s.card, { padding: CARD_PAD, gap: 8 }]}>
            <View style={s.rowBetween}>
              <Text style={s.sectionTitle}>Session ({session.length} exercise{session.length > 1 ? "s" : ""})</Text>
              <Text style={[s.sessionCal, { color: DS.color.orange }]}>~{sessionTotalCal} kcal total</Text>
            </View>
            {session.map((entry) => {
              const ex = EXERCISE_LIST.find((e) => e.name === entry.exerciseType);
              const detail = [
                `${entry.duration} min`, entry.intensity,
                entry.sets  ? `${entry.sets} sets` : null,
                entry.reps  ? `${entry.reps} reps` : null,
                entry.steps ? `${parseInt(entry.steps, 10).toLocaleString()} steps` : null,
                entry.estimatedCalories ? `~${entry.estimatedCalories} kcal` : null,
              ].filter(Boolean).join(" · ");
              return (
                <View key={entry.id} style={s.sessionEntry}>
                  <View style={[s.sessionIcon, { backgroundColor: (ex?.color || P) + "18" }]}>
                    <MaterialCommunityIcons name={(ex?.icon || "run-fast") as keyof typeof MaterialCommunityIcons.glyphMap} size={15} color={ex?.color || P} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionName}>{entry.exerciseType}</Text>
                    <Text style={s.sessionDetail}>{detail}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFromSession(entry.id)} style={{ padding: 4 }} accessibilityLabel={`Remove ${entry.exerciseType}`} accessibilityRole="button">
                    <Trash2 size={14} color={DS.color.red} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Exercise Type — title, search, category tabs and grid all live
             inside this one card, matching the reference. ── */}
        <View style={[s.card, { padding: CARD_PAD, gap: 7 }]}>
          <View style={s.rowBetween}>
            <Text style={s.sectionTitle}>{session.length > 0 ? "Add Another" : "Exercise Type"}</Text>
            <View style={s.searchBox}>
              <TextInput
                style={s.searchInput}
                placeholder="Search exercise..."
                placeholderTextColor={DS.color.muted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              <Search size={13} color={DS.color.muted} strokeWidth={2.2} />
            </View>
          </View>

          {/* Tabs hug their own labels — they are not equal columns. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 1 }}>
            {CATEGORIES.map((cat) => {
              const on = activeCategory === cat.key;
              return (
                <TouchableOpacity key={cat.key} onPress={() => setActiveCategory(cat.key)} activeOpacity={0.8}>
                  <View style={[s.catChip, on ? s.catChipOn : s.catChipOff]}>
                    <MaterialCommunityIcons
                      name={cat.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={12} color={on ? P : DS.color.muted}
                    />
                    <Text style={[s.catLabel, { color: on ? P : DS.color.muted }]}>{cat.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.exGrid}>
            {filteredExercises.map((ex) => {
              const on = selectedExercise === ex.name;
              return (
                <TouchableOpacity key={ex.name} onPress={() => selectExercise(ex.name)} activeOpacity={0.8} style={{ width: EX_CHIP_W }}>
                  {on ? (
                    <LinearGradient colors={[ex.color, ex.color + "CC"]} style={s.exChip}>
                      <MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={11} color="#FFF" />
                      <Text style={[s.exName, { color: "#FFF" }]} numberOfLines={2}>{ex.name}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[s.exChip, s.exChipOff]}>
                      <MaterialCommunityIcons name={ex.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={11} color={ex.color} />
                      <Text style={[s.exName, { color: DS.color.text }]} numberOfLines={2}>{ex.name}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {filteredExercises.length === 0 && (
              <Text style={s.noMatch}>No exercise matches “{search.trim()}”.</Text>
            )}
          </View>
        </View>

        {/* ── Duration | Intensity — one card, split by a divider ── */}
        <View style={[s.card, s.diCard]}>
          <View style={s.diHalf}>
            <View style={s.diHead}>
              <Timer size={13} color={P} strokeWidth={2} />
              <Text style={s.diTitle}>Duration (minutes)</Text>
            </View>
            <View style={s.stepper}>
              <TouchableOpacity onPress={() => adjustDuration(-5)} style={s.stepBtn} accessibilityLabel="Decrease duration" accessibilityRole="button">
                <Minus size={14} color={DS.color.textSub} strokeWidth={2.6} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={s.durNum}>{parseInt(duration, 10) || 0}</Text>
                <Text style={s.durUnit}>min</Text>
              </View>
              <TouchableOpacity onPress={() => adjustDuration(5)} style={s.stepBtn} accessibilityLabel="Increase duration" accessibilityRole="button">
                <Plus size={14} color={DS.color.textSub} strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
            <View style={s.presetRow}>
              {DURATION_PRESETS.map((preset) => {
                const on = parseInt(duration, 10) === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => { Haptics.selectionAsync(); setDuration(String(preset)); }}
                    style={[s.preset, on && s.presetOn]}
                    accessibilityRole="button"
                  >
                    <Text style={[s.presetTxt, on && { color: P }]}>{preset === 90 ? "90+" : preset}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.diRule} />

          <View style={s.diHalf}>
            <View style={s.diHead}>
              <TrendingUp size={13} color={P} strokeWidth={2} />
              <Text style={s.diTitle}>Intensity</Text>
            </View>
            <View style={s.intRow}>
              {INTENSITIES.map((item) => {
                const on = intensity === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    onPress={() => { Haptics.selectionAsync(); setIntensity(item.value); }}
                    activeOpacity={0.8}
                    style={{ flex: item.flex }}
                  >
                    <View style={[
                      s.intBtn,
                      on ? { backgroundColor: DS.color.primarySoft, borderColor: P }
                         : { backgroundColor: item.softBg, borderColor: "transparent" },
                    ]}>
                      <Text style={[s.intTxt, { color: on ? P : item.softColor }]} numberOfLines={1}>
                        {item.name} {item.emoji}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.hintBox}>
              <Text style={s.hintEmoji}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.hintTitle}>{activeIntensity.name} intensity</Text>
                <Text style={s.hintSub}>{activeIntensity.hint}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Sets & Reps — strength exercises only ── */}
        {isStrength && (
          <View style={[s.card, { padding: CARD_PAD }]}>
            <Text style={s.sectionTitle}>Sets &amp; Reps <Text style={s.optional}>(optional)</Text></Text>
            <View style={s.twoCol}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Sets  e.g. 3" placeholderTextColor={DS.color.muted} keyboardType="numeric" value={sets} onChangeText={setSets} />
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Reps  e.g. 12" placeholderTextColor={DS.color.muted} keyboardType="numeric" value={reps} onChangeText={setReps} />
            </View>
          </View>
        )}

        {/* ── Steps — walking / running / treadmill / stairs only ── */}
        {isStepsBased && (
          <View style={[s.card, { padding: CARD_PAD }]}>
            <Text style={s.sectionTitle}>Steps <Text style={s.optional}>(optional)</Text></Text>
            <TextInput style={s.input} placeholder="e.g. 8000" placeholderTextColor={DS.color.muted} keyboardType="numeric" value={steps} onChangeText={setSteps} />
          </View>
        )}

        {/* ── Live calorie estimate ── */}
        {(isCalculating || liveEstimate) && (
          <View style={[s.card, { padding: CARD_PAD, gap: 8 }]}>
            {isCalculating ? (
              <ActivityIndicator color={P} />
            ) : liveEstimate ? (
              <>
                <View style={s.rowBetween}>
                  <View>
                    <Text style={s.estLabel}>Calorie estimate (this exercise)</Text>
                    <Text style={[s.estCal, { color: DS.color.orange }]}>~{liveEstimate.calories} kcal</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.estMet, { color: G }]}>MET {liveEstimate.met.toFixed(1)}</Text>
                    <Text style={s.estProfile}>{liveEstimate.weightKg}kg · {liveEstimate.gender}</Text>
                  </View>
                </View>
                {isStrength && (sets || reps) && (
                  <View style={[s.formulaBox, { backgroundColor: "#5856D618" }]}>
                    <Text style={[s.formulaTxt, { color: "#5856D6" }]}>
                      💪 {sets ? `${sets} sets` : ""}{sets && reps ? " × " : ""}{reps ? `${reps} reps` : ""}
                      {sets && reps ? `  =  ${parseInt(sets || "0", 10) * parseInt(reps || "0", 10)} total reps` : ""}
                    </Text>
                  </View>
                )}
                {isStepsBased && !!steps && (
                  <View style={[s.formulaBox, { backgroundColor: G + "18" }]}>
                    <Text style={[s.formulaTxt, { color: G }]}>
                      👣 {parseInt(steps, 10).toLocaleString()} steps  ≈  {Math.round(parseInt(steps, 10) * 0.04)} cal (avg)
                    </Text>
                  </View>
                )}
                <View style={s.formulaBox}>
                  <Text style={s.formulaTxt}>📐 {liveEstimate.formula}</Text>
                </View>
              </>
            ) : null}
          </View>
        )}

        {/* ── Notes ── */}
        <View style={[s.card, { padding: CARD_PAD }]}>
          <View style={s.diHead}>
            <MessageSquare size={13} color={P} strokeWidth={2} />
            <Text style={s.diTitle}>Notes <Text style={s.optional}>(optional)</Text></Text>
          </View>
          <View style={s.notesRow}>
            <TextInput
              ref={notesRef}
              style={s.notesInput}
              placeholder="How did your workout feel?"
              placeholderTextColor={DS.color.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <TouchableOpacity onPress={() => notesRef.current?.focus()} style={s.notesBtn} accessibilityLabel="Edit notes" accessibilityRole="button">
              <Pencil size={13} color={DS.color.muted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Queue another exercise into the same session ── */}
        {!!selectedExercise && !!duration && (
          <TouchableOpacity onPress={handleAddToSession} activeOpacity={0.85} style={s.addMoreBtn}>
            <Plus size={15} color={P} strokeWidth={2.5} />
            <Text style={s.addMoreTxt}>Add to Session</Text>
          </TouchableOpacity>
        )}

        {session.length > 0 && (
          <Text style={s.sessionHint}>
            {session.length} exercise{session.length > 1 ? "s" : ""} queued · ~{sessionTotalCal + (liveEstimate?.calories ?? 0)} kcal total
          </Text>
        )}
      </ScrollView>

      {/* ── Fixed footer CTA ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity onPress={handleLogAll} disabled={isSubmitting || !canSubmit} activeOpacity={0.85} accessibilityRole="button">
          <LinearGradient
            colors={(isSubmitting || !canSubmit) ? ["#CBD5E1", "#94A3B8"] : ["#197DED", "#18A1D0", "#38BE95"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.saveBtn}
          >
            {isSubmitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={s.saveTxt}>{session.length > 1 ? `Log All ${session.length} Exercises ✓` : "Log Exercise ✓"}</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: DS.color.bgSoft },
  scroll: { paddingHorizontal: SCREEN_PAD, gap: 8 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  roundBtn:  { width: 34, height: 34, borderRadius: 17, backgroundColor: DS.color.bg, alignItems: "center", justifyContent: "center", ...NEU_SM },
  title:     { fontSize: 16.5, fontFamily: "Inter_700Bold", color: DS.color.text },
  subtitle:  { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },

  card: { backgroundColor: DS.color.bg, borderRadius: 18, ...NEU },

  statsCard: { paddingHorizontal: 12, paddingVertical: 9 },
  statsRow:  { flexDirection: "row", alignItems: "center" },
  statItem:  { flex: 1, alignItems: "center", gap: 3 },
  statIcon:  { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  statNum:   { fontSize: 19, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9.5, fontFamily: "Inter_400Regular", color: DS.color.muted },
  statDiv:   { width: 1, height: 42, backgroundColor: DS.color.divider },
  barTrack:  { height: 4, borderRadius: 2, backgroundColor: DS.color.bgSoft, overflow: "hidden", marginTop: 8, marginBottom: 5 },
  barFill:   { height: 4, borderRadius: 2 },
  goalTxt:   { fontSize: 9.5, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center" },

  rowBetween:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: DS.color.text },
  optional:     { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted },

  searchBox:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: DS.color.bgSoft, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 6, flexShrink: 1 },
  searchInput: { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.text, minWidth: 84, padding: 0 },

  catChip:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, borderWidth: 1.3 },
  catChipOn:  { backgroundColor: DS.color.primarySoft, borderColor: P },
  catChipOff: { backgroundColor: DS.color.bgCard, borderColor: DS.color.border },
  catLabel:   { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  exGrid:    { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  exChip:    { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 3, paddingVertical: 4, borderRadius: 11, minHeight: 28 },
  exChipOff: { backgroundColor: DS.color.bgCard, ...NEU_SM },
  exName:    { flex: 1, fontSize: 9.5, lineHeight: 11, fontFamily: "Inter_500Medium", letterSpacing: -0.2 },
  noMatch:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, paddingVertical: 10, textAlign: "center", width: "100%" },

  diCard: { flexDirection: "row", alignItems: "stretch" },
  diHalf: { flex: 1, minWidth: 0, padding: CARD_PAD },
  diRule: { width: 1, backgroundColor: DS.color.divider, marginVertical: CARD_PAD },
  diHead: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 9 },
  diTitle:{ fontSize: 11.5, fontFamily: "Inter_700Bold", color: DS.color.text },

  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: DS.color.bgSoft, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 7 },
  stepBtn: { width: 27, height: 27, borderRadius: 14, backgroundColor: DS.color.bg, alignItems: "center", justifyContent: "center", ...NEU_SM },
  durNum:  { fontSize: 21, fontFamily: "Inter_700Bold", color: DS.color.text },
  durUnit: { fontSize: 9, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: -1 },

  presetRow: { flexDirection: "row", gap: 4, marginTop: 9 },
  preset:    { flex: 1, alignItems: "center", paddingVertical: 4, borderRadius: 9, backgroundColor: DS.color.bgSoft, borderWidth: 1.3, borderColor: "transparent" },
  presetOn:  { backgroundColor: DS.color.primarySoft, borderColor: P },
  presetTxt: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: DS.color.muted },

  intRow:  { flexDirection: "row", gap: 3 },
  intBtn:  { alignItems: "center", paddingVertical: 9, paddingHorizontal: 1, borderRadius: 12, borderWidth: 1.4 },
  intTxt:  { fontSize: 8, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },

  hintBox:   { flexDirection: "row", gap: 5, alignItems: "flex-start", backgroundColor: DS.color.bgSoft, borderRadius: 10, padding: 7, marginTop: 9 },
  hintEmoji: { fontSize: 10 },
  hintTitle: { fontSize: 9, fontFamily: "Inter_700Bold", color: DS.color.textSub },
  hintSub:   { fontSize: 8.5, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },

  input:  { borderWidth: 1, borderColor: DS.color.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginTop: 7, fontSize: 14, fontFamily: "Inter_400Regular", color: DS.color.text, backgroundColor: DS.color.bgCard },
  twoCol: { flexDirection: "row", gap: 10 },

  notesRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  notesInput: { flex: 1, backgroundColor: DS.color.bgSoft, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.text, minHeight: 38, textAlignVertical: "top" },
  notesBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: DS.color.bg, alignItems: "center", justifyContent: "center", ...NEU_SM },

  estLabel:   { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.muted },
  estCal:     { fontSize: 22, fontFamily: "Inter_700Bold" },
  estMet:     { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  estProfile: { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.muted },
  formulaBox: { backgroundColor: DS.color.bgSoft, borderRadius: 10, padding: 9 },
  formulaTxt: { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.muted, lineHeight: 15 },

  sessionCal:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sessionEntry:  { flexDirection: "row", alignItems: "center", gap: 9 },
  sessionIcon:   { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  sessionName:   { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  sessionDetail: { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },
  sessionHint:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center" },

  addMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: P, borderStyle: "dashed" },
  addMoreTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: P },

  footer:  { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: SCREEN_PAD, paddingTop: 10, backgroundColor: DS.color.bgSoft, borderTopWidth: 1, borderTopColor: DS.color.border },
  saveBtn: { borderRadius: 20, paddingVertical: 15, alignItems: "center" },
  saveTxt: { color: "#FFF", fontSize: 15, fontFamily: "Inter_700Bold" },
});
