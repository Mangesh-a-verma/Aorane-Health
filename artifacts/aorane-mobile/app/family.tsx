import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform, useColorScheme, Alert, Dimensions,
  Modal, ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

const RELATIONS = ["spouse", "child", "parent", "sibling", "grandparent", "other"];
const RELATION_EMOJI: Record<string, string> = {
  spouse: "💑", child: "👶", parent: "👴", sibling: "🧑‍🤝‍🧑",
  grandparent: "👵", other: "👤", self: "🧑",
};
const PERMISSION_INFO: Record<string, { label: string; desc: string; color: string }> = {
  full:  { label: "Full Access",  desc: "Admin sees all your health data",  color: "#10B981" },
  basic: { label: "Basic Only",   desc: "Admin sees your health score only", color: "#F59E0B" },
  none:  { label: "Private",      desc: "Admin cannot see your data",        color: "#DC2626" },
};

type Member = {
  userId: string; name: string; healthScore: number; role: string;
  phone?: string; relation: string; isMinor: boolean;
  healthSharePermission: string; age?: number; lastActive?: string;
};
type Group = { id: string; inviteCode: string; ownerId?: string; maxMembers?: number };
type FamilyAlert = { memberId: string; memberName: string; type: string; message: string; severity: string };
type ScoreRow = {
  date: string; healthScore: number; foodScore: number; exerciseScore: number;
  waterScore: number; medicineScore: number; calories?: number; exerciseMinutes: number;
};

function useIsDark() { return useColorScheme() === "dark"; }

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const isDark = useIsDark();
  return (
    <LinearGradient
      colors={isDark ? ["rgba(56,189,248,0.15)","rgba(45,212,191,0.06)","rgba(255,255,255,0.02)"] : ["rgba(255,255,255,0.9)","rgba(186,230,253,0.4)","rgba(255,255,255,0.7)"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 20, padding: 1.5 }, style]}>
      <View style={{ borderRadius: 19, overflow: "hidden", backgroundColor: isDark ? "rgba(4,20,40,0.5)" : "rgba(255,255,255,0.5)" }}>
        {Platform.OS === "ios"
          ? <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(4,16,32,0.45)" : "rgba(255,255,255,0.45)" }]} />}
        {children}
      </View>
    </LinearGradient>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const isDark = useIsDark();
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
        <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,22,40,0.6)", fontSize: 11, fontFamily: "Inter_400Regular" }}>{label}</Text>
        <Text style={{ color, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{score}</Text>
      </View>
      <View style={{ height: 5, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", borderRadius: 3 }}>
        <View style={{ height: 5, width: `${Math.min(score, 100)}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function HealthScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "#10B981" : score >= 50 ? "#F59E0B" : "#DC2626";
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: color, backgroundColor: `${color}15` }}>
      <Text style={{ color, fontSize: 22, fontFamily: "Inter_700Bold" }}>{score}</Text>
    </View>
  );
}

function AlertBadge({ severity }: { severity: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    high:    { bg: "#DC262620", text: "#DC2626" },
    warning: { bg: "#F59E0B20", text: "#F59E0B" },
    info:    { bg: "#3B82F620", text: "#3B82F6" },
  };
  const c = cfg[severity] || cfg.info;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: c.bg }}>
      <Text style={{ color: c.text, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{severity.toUpperCase()}</Text>
    </View>
  );
}

function MemberDetailModal({ member, isOwner, onClose }: { member: Member; isOwner: boolean; onClose: () => void }) {
  const isDark = useIsDark();
  const [tab, setTab] = useState<"today" | "history">("today");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<ScoreRow[]>([]);
  const [historyPeriod, setHistoryPeriod] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reminderMsg, setReminderMsg] = useState("");
  const [showReminder, setShowReminder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await api.getMemberHealth(member.userId);
      setHealth(h);
    } catch { } finally { setLoading(false); }
  }, [member.userId]);

  const loadHistory = useCallback(async () => {
    try {
      const h = await api.getMemberHistory(member.userId, historyPeriod);
      setHistory(((h as { points?: ScoreRow[] }).points) || []);
    } catch { }
  }, [member.userId, historyPeriod]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab, historyPeriod, loadHistory]);

  const sendReminder = async () => {
    setSending(true);
    try {
      const r = await api.sendMemberReminder(member.userId, reminderMsg || undefined);
      Alert.alert("Reminder Sent! 💙", r.notified ? "Notification sent to their phone." : "They will see it on next login.");
      setShowReminder(false);
      setReminderMsg("");
    } catch { Alert.alert("Error", "Could not send reminder"); }
    finally { setSending(false); }
  };

  const today = health?.today as Record<string, unknown> | undefined;
  const food = health?.food as Record<string, unknown> | null | undefined;
  const medicine = health?.medicine as Record<string, unknown> | null | undefined;
  const exercise = health?.exercise as Record<string, unknown> | null | undefined;
  const water = health?.water as Record<string, unknown> | null | undefined;
  const alerts = (health?.alerts as FamilyAlert[] | undefined) || [];
  const permission = member.healthSharePermission;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: isDark ? "#010814" : "#F0F9FF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 18, paddingTop: Platform.OS === "ios" ? 54 : 22, borderBottomWidth: 1, borderBottomColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
          <TouchableOpacity onPress={onClose} style={{ marginRight: 14 }}>
            <Ionicons name="chevron-down" size={24} color={isDark ? "#fff" : "#0F172A"} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: isDark ? "#fff" : "#0F172A", fontSize: 17, fontFamily: "Inter_700Bold" }}>
              {RELATION_EMOJI[member.relation] || "👤"} {member.name}
            </Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.45)", fontSize: 12, fontFamily: "Inter_400Regular", textTransform: "capitalize" }}>
              {member.relation}{member.isMinor ? " • Minor" : ""}{member.age ? ` • ${member.age} yrs` : ""}
            </Text>
          </View>
          {isOwner && (
            <TouchableOpacity onPress={() => setShowReminder(true)} style={{ backgroundColor: "#0077B615", borderRadius: 10, padding: 8 }}>
              <Ionicons name="notifications-outline" size={20} color="#0077B6" />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
          {(["today", "history"] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: "center", backgroundColor: tab === t ? "#0077B6" : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)") }}>
              <Text style={{ color: tab === t ? "#fff" : (isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)"), fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {t === "today" ? "Today" : "History"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#0077B6" />
            <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)", marginTop: 12, fontFamily: "Inter_400Regular" }}>Loading health data...</Text>
          </View>
        ) : tab === "today" ? (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            {permission === "none" ? (
              <GlassCard>
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
                  <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_600SemiBold", fontSize: 16, marginBottom: 6 }}>Data is Private</Text>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.45)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" }}>
                    {member.name} has set their health data to private.
                  </Text>
                </View>
              </GlassCard>
            ) : (
              <>
                {alerts.length > 0 && (
                  <GlassCard style={{ marginBottom: 14 }}>
                    <View style={{ padding: 16 }}>
                      <Text style={{ color: "#DC2626", fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 10 }}>⚠️ Alerts</Text>
                      {alerts.map((a, i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: i < alerts.length - 1 ? 8 : 0 }}>
                          <Text style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, marginRight: 8 }}>{a.message}</Text>
                          <AlertBadge severity={a.severity} />
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                )}

                <GlassCard style={{ marginBottom: 14 }}>
                  <View style={{ padding: 18 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 18 }}>
                      <HealthScoreRing score={today?.healthScore as number || 0} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 3 }}>Today's Health</Text>
                        <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular" }}>
                          {today?.exerciseMinutes ? `${today.exerciseMinutes} min exercise` : "No exercise"}
                          {today?.waterGlasses ? ` • ${today.waterGlasses} 💧` : ""}
                        </Text>
                        {today?.totalCaloriesIn ? (
                          <Text style={{ color: "#F59E0B", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 }}>🔥 {Math.round(today.totalCaloriesIn as number)} cal</Text>
                        ) : null}
                      </View>
                    </View>
                    <ScoreBar label="Food" score={today?.foodScore as number || 0} color="#10B981" />
                    <ScoreBar label="Exercise" score={today?.exerciseScore as number || 0} color="#3B82F6" />
                    <ScoreBar label="Water" score={today?.waterScore as number || 0} color="#06B6D4" />
                    <ScoreBar label="Medicine" score={today?.medicineScore as number || 0} color="#8B5CF6" />
                    <ScoreBar label="Sleep" score={today?.sleepScore as number || 0} color="#F59E0B" />
                  </View>
                </GlassCard>

                {permission === "basic" && (
                  <GlassCard style={{ marginBottom: 14 }}>
                    <View style={{ padding: 18, alignItems: "center" }}>
                      <Ionicons name="eye-off-outline" size={28} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"} />
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.45)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 10, lineHeight: 20 }}>
                        {member.name} has shared basic access only.{"\n"}Detailed food, medicine & exercise data is hidden.
                      </Text>
                    </View>
                  </GlassCard>
                )}

                {permission === "full" && (
                  <>
                    {food && (
                      <GlassCard style={{ marginBottom: 14 }}>
                        <View style={{ padding: 16 }}>
                          <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 12 }}>🥗 Food Today</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                            {[
                              { label: "Calories", val: `${food.totalCalories} kcal`, icon: "🔥" },
                              { label: "Protein",  val: `${food.totalProteinG}g`, icon: "💪" },
                              { label: "Carbs",    val: `${food.totalCarbsG}g`, icon: "🌾" },
                              { label: "Fat",      val: `${food.totalFatG}g`, icon: "🫙" },
                            ].map(item => (
                              <View key={item.label} style={{ width: (W - 60) / 2 - 5, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", borderRadius: 12, padding: 10 }}>
                                <Text style={{ fontSize: 18, marginBottom: 2 }}>{item.icon}</Text>
                                <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 14 }}>{item.val}</Text>
                                <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" }}>{item.label}</Text>
                              </View>
                            ))}
                          </View>
                          {((food.meals as unknown[])?.length || 0) > 0 && (
                            <View style={{ marginTop: 12 }}>
                              <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.45)", fontSize: 10, fontFamily: "Inter_600SemiBold", marginBottom: 6, letterSpacing: 0.5 }}>MEALS</Text>
                              {(food.meals as Array<{ name: string; calories: number }>).map((m, i) => (
                                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
                                  <Text style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 }}>{m.name}</Text>
                                  <Text style={{ color: "#F59E0B", fontSize: 12, fontFamily: "Inter_500Medium" }}>{Math.round(m.calories)} cal</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </GlassCard>
                    )}

                    {medicine && (
                      <GlassCard style={{ marginBottom: 14 }}>
                        <View style={{ padding: 16 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 14 }}>💊 Medicine Today</Text>
                            {medicine.adherencePct !== null && medicine.adherencePct !== undefined && (
                              <View style={{ backgroundColor: Number(medicine.adherencePct) >= 80 ? "#10B98120" : "#DC262620", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ color: Number(medicine.adherencePct) >= 80 ? "#10B981" : "#DC2626", fontSize: 12, fontFamily: "Inter_700Bold" }}>
                                  {Math.round(Number(medicine.adherencePct))}%
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            {[
                              { label: "Taken", val: medicine.takenToday, color: "#10B981" },
                              { label: "Missed", val: medicine.missedToday, color: "#DC2626" },
                              { label: "Total", val: medicine.totalScheduled, color: "#3B82F6" },
                            ].map(item => (
                              <View key={item.label} style={{ flex: 1, backgroundColor: `${item.color}15`, borderRadius: 10, padding: 10, alignItems: "center" }}>
                                <Text style={{ color: item.color, fontFamily: "Inter_700Bold", fontSize: 22 }}>{item.val as number}</Text>
                                <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" }}>{item.label}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </GlassCard>
                    )}

                    {exercise && (
                      <GlassCard style={{ marginBottom: 14 }}>
                        <View style={{ padding: 16 }}>
                          <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 12 }}>🏃 Exercise Today</Text>
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            {[
                              { label: "Minutes",  val: exercise.totalMinutes, icon: "⏱️" },
                              { label: "Sessions", val: exercise.sessionsToday, icon: "🔄" },
                              { label: "Steps",    val: exercise.totalSteps || "—", icon: "👣" },
                            ].map(item => (
                              <View key={item.label} style={{ flex: 1, backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.07)", borderRadius: 10, padding: 10, alignItems: "center" }}>
                                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                                <Text style={{ color: "#3B82F6", fontFamily: "Inter_700Bold", fontSize: 16 }}>{item.val as string}</Text>
                                <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" }}>{item.label}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </GlassCard>
                    )}

                    {water && (
                      <GlassCard style={{ marginBottom: 14 }}>
                        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
                          <Text style={{ fontSize: 36 }}>💧</Text>
                          <View>
                            <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 16 }}>{water.glasses as number} glasses</Text>
                            <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{water.totalMl as number} ml total today</Text>
                          </View>
                        </View>
                      </GlassCard>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {(["week", "month"] as const).map(p => (
                <TouchableOpacity key={p} onPress={() => setHistoryPeriod(p)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: historyPeriod === p ? "#0077B6" : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)") }}>
                  <Text style={{ color: historyPeriod === p ? "#fff" : (isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)"), fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {p === "week" ? "7 Days" : "30 Days"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {history.length === 0 ? (
              <GlassCard>
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Text style={{ fontSize: 40, marginBottom: 10 }}>📊</Text>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.45)", fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
                    No health history available for this period.
                  </Text>
                </View>
              </GlassCard>
            ) : (
              <>
                <GlassCard style={{ marginBottom: 14 }}>
                  <View style={{ padding: 16 }}>
                    <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 14 }}>Health Score Trend</Text>
                    {history.slice(-14).map(point => {
                      const d = new Date(point.date);
                      const label = `${d.getDate()}/${d.getMonth() + 1}`;
                      const color = point.healthScore >= 75 ? "#10B981" : point.healthScore >= 50 ? "#F59E0B" : "#DC2626";
                      return (
                        <View key={point.date} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                          <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 10, fontFamily: "Inter_400Regular", width: 36 }}>{label}</Text>
                          <View style={{ flex: 1, height: 8, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", borderRadius: 4, marginHorizontal: 8 }}>
                            <View style={{ height: 8, width: `${Math.min(point.healthScore, 100)}%`, backgroundColor: color, borderRadius: 4 }} />
                          </View>
                          <Text style={{ color, fontSize: 11, fontFamily: "Inter_600SemiBold", width: 26, textAlign: "right" }}>{point.healthScore}</Text>
                        </View>
                      );
                    })}
                  </View>
                </GlassCard>

                <GlassCard>
                  <View style={{ padding: 16 }}>
                    <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 12 }}>Exercise Minutes</Text>
                    {history.filter(h => h.exerciseMinutes > 0).length === 0 ? (
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.35)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" }}>No exercise logged this period.</Text>
                    ) : history.filter(h => h.exerciseMinutes > 0).map(point => {
                      const d = new Date(point.date);
                      return (
                        <View key={point.date + "_ex"} style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
                          <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 10, width: 36 }}>{d.getDate()}/{d.getMonth() + 1}</Text>
                          <View style={{ flex: 1, height: 7, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", borderRadius: 4, marginHorizontal: 8 }}>
                            <View style={{ height: 7, width: `${Math.min((point.exerciseMinutes / 60) * 100, 100)}%`, backgroundColor: "#3B82F6", borderRadius: 4 }} />
                          </View>
                          <Text style={{ color: "#3B82F6", fontSize: 11, fontFamily: "Inter_600SemiBold", width: 32, textAlign: "right" }}>{point.exerciseMinutes}m</Text>
                        </View>
                      );
                    })}
                  </View>
                </GlassCard>
              </>
            )}
          </ScrollView>
        )}

        {showReminder && (
          <Modal visible animationType="fade" transparent onRequestClose={() => setShowReminder(false)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
              <View style={{ backgroundColor: isDark ? "#0D1B2A" : "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 }}>
                <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 16 }}>💙 Reminder to {member.name}</Text>
                <TextInput
                  value={reminderMsg} onChangeText={setReminderMsg}
                  placeholder="Please log your health data today! 💙"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"}
                  multiline numberOfLines={3}
                  style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", borderRadius: 12, padding: 14, color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 16, minHeight: 80, textAlignVertical: "top" }}
                />
                <TouchableOpacity onPress={sendReminder} disabled={sending} style={{ backgroundColor: "#0077B6", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 }}>
                  {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Send Reminder</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowReminder(false)} style={{ alignItems: "center", padding: 10 }}>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)", fontFamily: "Inter_400Regular" }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

function PermissionSheet({ current, onUpdate, onClose }: { current: string; onUpdate: (p: string) => void; onClose: () => void }) {
  const isDark = useIsDark();
  const [saving, setSaving] = useState(false);

  const update = async (p: "full" | "basic" | "none") => {
    setSaving(true);
    try {
      await api.updateMyPermission(p);
      onUpdate(p);
      onClose();
    } catch { Alert.alert("Error", "Could not update permission"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: isDark ? "#0D1B2A" : "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 }}>
          <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 6 }}>Health Data Sharing</Text>
          <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.45)", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20 }}>
            Choose what your family admin can see
          </Text>
          {(["full", "basic", "none"] as const).map(p => {
            const info = PERMISSION_INFO[p];
            const isSelected = current === p;
            return (
              <TouchableOpacity key={p} onPress={() => update(p)} disabled={saving}
                style={{ flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 2, borderColor: isSelected ? info.color : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"), backgroundColor: isSelected ? `${info.color}15` : "transparent" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: info.color, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 2 }}>{info.label}</Text>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.45)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{info.desc}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={info.color} />}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity onPress={onClose} style={{ alignItems: "center", padding: 12, marginTop: 4 }}>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)", fontFamily: "Inter_400Regular" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function FamilyScreen() {
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showPermission, setShowPermission] = useState(false);
  const [alerts, setAlerts] = useState<FamilyAlert[]>([]);
  const [joinRelation, setJoinRelation] = useState("other");
  const [joinIsMinor, setJoinIsMinor] = useState(false);
  const [myPermission, setMyPermission] = useState("basic");
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  const bg = isDark ? "#010814" : "#F0F9FF";

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getFamilyGroup();
      setNeedsUpgrade(false);
      setGroup(res.group as Group | null);
      const mList = (res.members || []) as Member[];
      setMembers(mList);
      setIsOwner(res.isOwner);
      if (res.group) {
        try { const al = await api.getFamilyAlerts(); setAlerts(al.alerts as FamilyAlert[]); } catch { }
      }
    } catch (e: unknown) {
      const msg = (e as Error)?.message || "";
      if (msg.includes("Family plan required")) {
        setNeedsUpgrade(true);
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const createGroup = async () => {
    setCreating(true);
    try {
      const res = await api.createFamilyGroup();
      Alert.alert("Family Group Created! 🎉", `Invite Code: ${res.inviteCode}\n\nShare this with your family!`);
      load();
    } catch (e: unknown) { Alert.alert("Error", (e as Error).message || "Failed"); }
    finally { setCreating(false); }
  };

  const joinGroup = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      await api.joinFamilyGroup(joinCode.trim().toUpperCase(), joinRelation, joinIsMinor);
      Alert.alert("Joined! 🎉", "You have joined the family group! Family plan is now active.");
      setJoinCode("");
      load();
    } catch (e: unknown) { Alert.alert("Error", (e as Error).message || "Invalid invite code"); }
    finally { setJoining(false); }
  };

  const leaveGroup = () => Alert.alert("Leave Group?", "Are you sure you want to leave?", [
    { text: "Cancel", style: "cancel" },
    { text: "Leave", style: "destructive", onPress: async () => {
      try { await api.leaveFamilyGroup(); load(); } catch (e: unknown) { Alert.alert("Error", (e as Error).message || "Failed"); }
    }},
  ]);

  const dissolveGroup = () => Alert.alert("Dissolve Group?", "This will remove ALL members and delete the group permanently.", [
    { text: "Cancel", style: "cancel" },
    { text: "Dissolve", style: "destructive", onPress: async () => {
      try { await api.dissolveFamilyGroup(); load(); } catch (e: unknown) { Alert.alert("Error", (e as Error).message || "Failed"); }
    }},
  ]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color="#0077B6" />
      <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)", marginTop: 12, fontFamily: "Inter_400Regular" }}>Loading family...</Text>
    </View>
  );

  if (needsUpgrade) return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={isDark ? ["#0077B620","transparent"] : ["#BAE6FD60","transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200 }} />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ color: isDark ? "#fff" : "#0F172A", fontSize: 24, fontFamily: "Inter_700Bold" }}>👨‍👩‍👧‍👦 Family</Text>
        <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Family health in one place</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }}>
        <GlassCard style={{ width: "100%" }}>
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>👨‍👩‍👧‍👦</Text>
            <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 20, marginBottom: 8, textAlign: "center" }}>
              Family Plan Required
            </Text>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 24 }}>
              Family Health feature ke liye Family Plan chahiye. Up to 4 members ki health ek hi jagah dekho.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
              {["4 Family Members", "Health Dashboard", "Shared Reports", "Reminders"].map(f => (
                <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={{ color: "#10B981", fontSize: 12, fontFamily: "Inter_500Medium" }}>{f}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => router.push("/upgrade" as never)}
              style={{ backgroundColor: "#F59E0B", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>₹399/month — Upgrade Karo</Text>
            </TouchableOpacity>
            <Text style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.35)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" }}>
              Ya invite code se kisi Family group mein join karo
            </Text>
          </View>
        </GlassCard>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={isDark ? ["#0077B620","transparent"] : ["#BAE6FD60","transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200 }} />

      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: isDark ? "#fff" : "#0F172A", fontSize: 24, fontFamily: "Inter_700Bold" }}>👨‍👩‍👧‍👦 Family</Text>
          <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>Family health in one place</Text>
        </View>
        {group && !isOwner && (
          <TouchableOpacity onPress={() => setShowPermission(true)} style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,119,182,0.1)", borderRadius: 10, padding: 10 }}>
            <Ionicons name="shield-outline" size={20} color="#0077B6" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0077B6" />}
        showsVerticalScrollIndicator={false}>

        {group ? (
          <>
            <GlassCard style={{ marginBottom: 16 }}>
              <View style={{ padding: 18 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_700Bold", fontSize: 15 }}>Invite Code</Text>
                  <View style={{ backgroundColor: "#0077B615", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: "#0077B6", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{members.length}/{group.maxMembers || 4} members</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: isDark ? "rgba(0,119,182,0.15)" : "rgba(0,119,182,0.08)", borderRadius: 12, padding: 14, alignItems: "center" }}>
                  <Text style={{ color: "#0077B6", fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: 5 }}>{group.inviteCode}</Text>
                </View>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 }}>Share with family members to join</Text>
              </View>
            </GlassCard>

            {alerts.length > 0 && (
              <GlassCard style={{ marginBottom: 16 }}>
                <View style={{ padding: 16 }}>
                  <Text style={{ color: "#DC2626", fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 10 }}>⚠️ Family Alerts ({alerts.length})</Text>
                  {alerts.slice(0, 5).map((a, i) => (
                    <TouchableOpacity key={i} onPress={() => { const m = members.find(x => x.userId === a.memberId); if (m) setSelectedMember(m); }}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: i < Math.min(alerts.length, 5) - 1 ? 1 : 0, borderBottomColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isDark ? "rgba(255,255,255,0.8)" : "rgba(10,22,40,0.8)", fontSize: 13, fontFamily: "Inter_500Medium" }}>{a.memberName}</Text>
                        <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.45)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{a.message}</Text>
                      </View>
                      <AlertBadge severity={a.severity} />
                    </TouchableOpacity>
                  ))}
                </View>
              </GlassCard>
            )}

            <Text style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,22,40,0.45)", fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 10, letterSpacing: 0.8 }}>
              MEMBERS — TAP TO VIEW HEALTH
            </Text>

            {members.map(m => {
              const scoreColor = m.healthScore >= 75 ? "#10B981" : m.healthScore >= 50 ? "#F59E0B" : "#DC2626";
              const hasHighAlert = alerts.some(a => a.memberId === m.userId && a.severity === "high");
              return (
                <TouchableOpacity key={m.userId} onPress={() => setSelectedMember(m)} activeOpacity={0.8} style={{ marginBottom: 10 }}>
                  <GlassCard>
                    <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isDark ? "rgba(0,119,182,0.2)" : "rgba(0,119,182,0.12)", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 22 }}>{RELATION_EMOJI[m.relation] || "👤"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ color: isDark ? "#fff" : "#0F172A", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{m.name}</Text>
                          {hasHighAlert && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#DC2626" }} />}
                        </View>
                        <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(10,22,40,0.4)", fontSize: 11, fontFamily: "Inter_400Regular", textTransform: "capitalize" }}>
                          {m.relation}{m.isMinor ? " • Minor" : ""}{m.age ? ` • ${m.age} yrs` : ""}{m.phone ? ` • ${m.phone}` : ""}
                        </Text>
                        <View style={{ flexDirection: "row", marginTop: 4 }}>
                          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${PERMISSION_INFO[m.healthSharePermission]?.color || "#999"}20` }}>
                            <Text style={{ color: PERMISSION_INFO[m.healthSharePermission]?.color || "#999", fontSize: 9, fontFamily: "Inter_600SemiBold" }}>
                              {PERMISSION_INFO[m.healthSharePermission]?.label || m.healthSharePermission}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 3 }}>
                        <Text style={{ color: scoreColor, fontFamily: "Inter_700Bold", fontSize: 22 }}>{m.healthScore}</Text>
                        <Text style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.3)", fontSize: 9, fontFamily: "Inter_400Regular" }}>Health Score</Text>
                        <Ionicons name="chevron-forward" size={14} color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} />
                      </View>
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              );
            })}

            <View style={{ marginTop: 8, gap: 10 }}>
              {!isOwner && (
                <TouchableOpacity onPress={() => setShowPermission(true)} style={{ backgroundColor: isDark ? "rgba(0,119,182,0.12)" : "rgba(0,119,182,0.08)", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Ionicons name="shield-outline" size={18} color="#0077B6" />
                  <Text style={{ color: "#0077B6", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Manage My Privacy</Text>
                </TouchableOpacity>
              )}
              {isOwner ? (
                <TouchableOpacity onPress={dissolveGroup} style={{ backgroundColor: isDark ? "rgba(220,38,38,0.12)" : "#FEF2F2", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: isDark ? "rgba(220,38,38,0.25)" : "#FECACA" }}>
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  <Text style={{ color: "#DC2626", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Dissolve Group</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={leaveGroup} style={{ backgroundColor: isDark ? "rgba(220,38,38,0.12)" : "#FEF2F2", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: isDark ? "rgba(220,38,38,0.25)" : "#FECACA" }}>
                  <Ionicons name="exit-outline" size={18} color="#DC2626" />
                  <Text style={{ color: "#DC2626", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Leave Group</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            <GlassCard style={{ marginBottom: 20 }}>
              <View style={{ padding: 32, alignItems: "center" }}>
                <Text style={{ fontSize: 64, marginBottom: 14 }}>👨‍👩‍👧‍👦</Text>
                <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 20, marginBottom: 10, textAlign: "center" }}>Family Health Group</Text>
                <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 }}>
                  Track your entire family's health.{"\n"}Food, medicine, exercise & alerts — all in one place.
                </Text>
              </View>
            </GlassCard>

            <TouchableOpacity onPress={createGroup} disabled={creating}
              style={{ backgroundColor: "#0077B6", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16 }}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>Create Family Group</Text>}
            </TouchableOpacity>

            <GlassCard>
              <View style={{ padding: 18 }}>
                <Text style={{ color: isDark ? "#F0F8FF" : "#1a1a2e", fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 14 }}>Join with Invite Code</Text>

                <TextInput
                  value={joinCode} onChangeText={setJoinCode}
                  placeholder="FAM123456" placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(10,22,40,0.3)"}
                  style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,119,182,0.06)", borderRadius: 12, padding: 14, color: isDark ? "#FFF" : "#1a1a2e", fontFamily: "Inter_500Medium", fontSize: 18, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,119,182,0.15)", marginBottom: 14, letterSpacing: 3, textAlign: "center", textTransform: "uppercase" }}
                  autoCapitalize="characters" maxLength={9}
                />

                <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(10,22,40,0.5)", fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 8, letterSpacing: 0.5 }}>YOUR RELATION IN FAMILY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {RELATIONS.map(r => (
                    <TouchableOpacity key={r} onPress={() => setJoinRelation(r)}
                      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 8, backgroundColor: joinRelation === r ? "#0077B6" : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)") }}>
                      <Text style={{ color: joinRelation === r ? "#fff" : (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)"), fontSize: 13, fontFamily: joinRelation === r ? "Inter_600SemiBold" : "Inter_400Regular", textTransform: "capitalize" }}>
                        {RELATION_EMOJI[r]} {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity onPress={() => setJoinIsMinor(!joinIsMinor)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: joinIsMinor ? "#0077B6" : (isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)"), backgroundColor: joinIsMinor ? "#0077B6" : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {joinIsMinor && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(10,22,40,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" }}>This member is a minor (under 18)</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={joinGroup} disabled={joining || !joinCode.trim()}
                  style={{ backgroundColor: joining || !joinCode.trim() ? (isDark ? "rgba(27,153,139,0.35)" : "#9DC8C4") : "#1B998B", borderRadius: 12, padding: 14, alignItems: "center" }}>
                  {joining ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>Join Group</Text>}
                </TouchableOpacity>
              </View>
            </GlassCard>
          </>
        )}
      </ScrollView>

      {selectedMember && (
        <MemberDetailModal member={selectedMember} isOwner={isOwner} onClose={() => setSelectedMember(null)} />
      )}

      {showPermission && (
        <PermissionSheet
          current={myPermission}
          onUpdate={(p) => { setMyPermission(p); load(true); }}
          onClose={() => setShowPermission(false)}
        />
      )}
    </View>
  );
}
