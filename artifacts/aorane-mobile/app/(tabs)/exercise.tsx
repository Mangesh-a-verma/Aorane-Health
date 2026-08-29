import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, FlatList, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { cachedGet } from "@/lib/api";
import { DS } from "@/lib/theme";
import { Plus, Timer, Flame, Trophy, Dumbbell } from "lucide-react-native";
import { EXERCISE_LIST, todayDate } from "@/lib/exerciseData";

const P = DS.color.primary;
const G = DS.color.green;

type ExerciseLog = {
  id: string; exerciseType: string; durationMinutes: number;
  intensity: string; caloriesBurned?: string; metValue?: string;
  sets?: number | null; reps?: number | null; steps?: number | null;
};

export default function ExerciseScreen() {
  const insets = useSafeAreaInsets();
  const [logs,       setLogs]       = useState<ExerciseLog[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadLogs = useCallback(async () => {
    try {
      const { data } = await cachedGet<{ logs: Array<Record<string, unknown>> }>(`/health/exercise?date=${todayDate()}`);
      setLogs(data.logs as ExerciseLog[]);
    } catch { }
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadLogs();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [loadLogs]));

  const totalMin = logs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalCal = logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0);
  const topPad = insets.top;
  const ringPct = Math.min(1, totalMin / 60);

  const goToLogExercise = () => router.push("/log-exercise" as never);

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
          <TouchableOpacity onPress={goToLogExercise} activeOpacity={0.85} style={s.addBtn}>
            <Plus size={22} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <View style={s.headerBorder} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLogs(); }} tintColor={P} colors={[P]} />
        }
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
            <TouchableOpacity style={s.emptyBtn} onPress={goToLogExercise} activeOpacity={0.85}>
              <LinearGradient colors={[P, G]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtnGrad}>
                <Text style={s.emptyBtnText}>Add Exercise</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={log => String(log.id)}
            initialNumToRender={5}
            scrollEnabled={false}
            renderItem={({ item: log }) => {
              const ex  = EXERCISE_LIST.find((e) => e.name === log.exerciseType);
              const clr = ex?.color || P;
              const ico = ex?.icon || "run-fast";
              const hasStrengthDetails = log.sets || log.reps;
              const hasSteps = log.steps && Number(log.steps) > 0;
              return (
                <View style={s.logCard}>
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
            }}
          />
        )}
      </ScrollView>
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
});
