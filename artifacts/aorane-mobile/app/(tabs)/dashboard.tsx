import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image,
  RefreshControl, Platform, ActivityIndicator, Animated, Modal, StatusBar, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { PremiumScoreRing } from "../../components/PremiumScoreRing";
import { PremiumTrendCard } from "../../components/PremiumTrendCard";
import { AdsSlider } from "@/components/AdsSlider";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { DS } from "@/lib/theme";
import {
  Flame, Droplets, Dumbbell,
  Utensils, Pill, ScanLine, Brain, FileText,
  ChevronRight, Sparkles, Plus, Beef, Wheat, Bell, Info, Heart,
} from "lucide-react-native";

// Neumorphic soft-raised shadow — RN has no true dual-tone (light+dark)
// CSS box-shadow, so this is a single soft shadow approximation of the
// "raised card" look, matching the direction other screens are moving to.
const NEU_SHADOW = Platform.select({
  ios:     { shadowColor: "#8FA6C2", shadowOffset: { width: 5, height: 5 }, shadowOpacity: 0.28, shadowRadius: 10 },
  android: { elevation: 5 },
  default: { shadowColor: "#8FA6C2", shadowOffset: { width: 5, height: 5 }, shadowOpacity: 0.28, shadowRadius: 10 },
}) as object;
const NEU_SHADOW_SM = Platform.select({
  ios:     { shadowColor: "#8FA6C2", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6 },
  android: { elevation: 3 },
  default: { shadowColor: "#8FA6C2", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6 },
}) as object;

// ── WEATHER ─────────────────────────────────────────────────────────────────
type WeatherInfo = {
  temp: number; feelsLike: number; humidity: number;
  windspeed: number; emoji: string; description: string;
  city: string; healthTip: string; isDay: boolean;
};

function wmoEmoji(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code <= 2)  return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 55) return "🌦️";
  if (code <= 65) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}
function wmoDesc(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 2)  return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 55) return "Drizzle";
  if (code <= 65) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Rain showers";
  return "Thunderstorm";
}
function weatherHealthTip(code: number, temp: number, t: (key: keyof import("@/lib/translations").TranslationMap) => string): string {
  if (temp >= 38) return t("dashTipHeatAlert");
  if (temp >= 32) return t("dashTipStayHydrated");
  if (temp <= 12) return t("dashTipCold");
  if (code >= 51 && code <= 82) return t("dashTipRainy");
  if (code >= 95) return t("dashTipThunderstorm");
  return t("dashTipGreatWeather");
}

const DELHI = { lat: 28.6139, lon: 77.2090, city: "New Delhi" };

function useWeather() {
  const { t } = useLanguage();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [wLoading, setWLoading] = useState(true);

  useEffect(() => { fetchW(); }, []);

  const fetchW = async () => {
    setWLoading(true);
    // Cross-platform fetch with timeout (AbortSignal.timeout not available on all RN versions)
    const fetchWithTimeout = (url: string, ms: number) => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
    };
    try {
      let lat = DELHI.lat, lon = DELHI.lon, city = DELHI.city;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          lat = loc.coords.latitude; lon = loc.coords.longitude;
          try {
            const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
            city = geo?.city || geo?.subregion || geo?.region || city;
          } catch { /* geocode failed, keep coords */ }
        } else {
          try {
            const ip = await fetchWithTimeout("https://ipapi.co/json/", 4000);
            const ipd = await ip.json() as { latitude: number; longitude: number; city: string };
            if (ipd.latitude) { lat = ipd.latitude; lon = ipd.longitude; city = ipd.city || city; }
          } catch { /* use Delhi fallback */ }
        }
      } catch { /* location error — use Delhi fallback */ }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current_weather=true&hourly=relativehumidity_2m,apparent_temperature&forecast_days=1&timezone=auto`;
      const res = await fetchWithTimeout(url, 10000);
      const d = await res.json() as {
        current_weather: { temperature: number; windspeed: number; weathercode: number; is_day: number };
        hourly: { relativehumidity_2m: number[]; apparent_temperature: number[] };
      };
      const hr = new Date().getHours();
      const temp = Math.round(d.current_weather.temperature);
      const code = d.current_weather.weathercode;
      const isDay = d.current_weather.is_day === 1;
      setWeather({
        temp,
        feelsLike: Math.round(d.hourly.apparent_temperature[hr] ?? temp),
        humidity: d.hourly.relativehumidity_2m[hr] ?? 0,
        windspeed: Math.round(d.current_weather.windspeed),
        emoji: wmoEmoji(code, isDay),
        description: wmoDesc(code),
        city,
        healthTip: weatherHealthTip(code, temp, t),
        isDay,
      });
    } catch { }
    setWLoading(false);
  };

  return { weather, wLoading, refetchWeather: fetchW };
}

const WeatherPill = React.memo(function WeatherPill({
  weather, loading, onPress,
}: { weather: WeatherInfo | null; loading: boolean; onPress: () => void }) {
  const { t } = useLanguage();
  if (loading) {
    return (
      <TouchableOpacity style={wp.pill} onPress={onPress} activeOpacity={0.85}>
        <ActivityIndicator size="small" color="#FFF" style={{ width: 16, height: 16 }} />
        <Text style={wp.pillTxt}>{t("dashLoadingWeather")}</Text>
      </TouchableOpacity>
    );
  }
  if (!weather) {
    return (
      <TouchableOpacity style={[wp.pill, { backgroundColor: "rgba(0,0,0,0.35)" }]} onPress={onPress} activeOpacity={0.85}>
        <Text style={wp.pillEmoji}>🌤️</Text>
        <Text style={wp.pillTxt}>{t("dashWeatherTapHint")}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={wp.pill} onPress={onPress} activeOpacity={0.85}>
      <Text style={wp.pillEmoji}>{weather.emoji}</Text>
      <Text style={wp.pillTxt}>{weather.temp}°C · {weather.city}</Text>
    </TouchableOpacity>
  );
});

const WeatherModal = React.memo(function WeatherModal({
  weather, visible, onClose,
}: { weather: WeatherInfo | null; visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  if (!weather) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={wp.overlay} activeOpacity={1} onPress={onClose}>
        <LinearGradient
          colors={weather.isDay ? ["#1565C0", "#0D47A1"] : ["#1A237E", "#283593"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={wp.modal}
        >
          <Text style={wp.mCity}>📍 {weather.city}</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 }}>
            <Text style={{ fontSize: 40 }}>{weather.emoji}</Text>
            <Text style={wp.mTemp}>{weather.temp}°C</Text>
            <Text style={wp.mDesc}>{weather.description}</Text>
          </View>
          <View style={wp.mStats}>
            <Text style={wp.mStat}>🌡️ {t("dashFeelsLike")} {weather.feelsLike}°C</Text>
            <Text style={wp.mStat}>💧 {t("dashHumidity")} {weather.humidity}%</Text>
            <Text style={wp.mStat}>🌬️ {t("dashWindLabel")} {weather.windspeed} km/h</Text>
          </View>
          <View style={wp.tipRow}>
            <Text style={wp.tip}>{weather.healthTip}</Text>
          </View>
          <Text style={wp.mClose}>{t("dashTapToClose")}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Modal>
  );
});

const wp = StyleSheet.create({
  pill:      {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(21,101,192,0.88)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    shadowColor: "#1565C0", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 5,
  },
  pillEmoji: { fontSize: 16 },
  pillTxt:   { fontSize: 13, color: "#FFF", fontFamily: "Inter_600SemiBold" },
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", padding: 16 },
  modal:     { borderRadius: 22, padding: 20, marginBottom: 90 },
  mCity:     { fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium" },
  mTemp:     { fontSize: 42, color: "#FFF", fontFamily: "Inter_700Bold", lineHeight: 48 },
  mDesc:     { fontSize: 14, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", paddingBottom: 6 },
  mStats:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  mStat:     { fontSize: 13, color: "rgba(255,255,255,0.9)", fontFamily: "Inter_500Medium" },
  tipRow:    { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)" },
  tip:       { fontSize: 13, color: "#FFF", fontFamily: "Inter_400Regular", lineHeight: 20 },
  mClose:    { marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center", fontFamily: "Inter_400Regular" },
});

function todayDate() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); }

function getGreeting(t: (key: any) => string) {
  const h = new Date().getHours();
  if (h < 5)  return t("dashGreetingNight");
  if (h < 12) return t("dashGreetingMorning");
  if (h < 17) return t("dashGreetingAfternoon");
  return t("dashGreetingEvening");
}

// ── HEADER ─────────────────────────────────────────────────────────────────────
const DashboardHeader = React.memo(function DashboardHeader({
  greeting, userName, onBellPress,
}: { greeting: string; userName: string; onBellPress: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={hd.row}>
      <View style={hd.left}>
        <View style={hd.logoBadge}>
          <Image source={require("../../assets/images/icon.png")} style={hd.logoImg} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={hd.title} numberOfLines={1}>{greeting}{userName ? `, ${userName}` : ""}</Text>
          <Text style={hd.sub}>{t("dashOverviewSub")}</Text>
        </View>
      </View>
      <TouchableOpacity style={hd.bellBtn} onPress={onBellPress} activeOpacity={0.8} accessibilityLabel="Notification settings">
        <Bell size={19} color={DS.color.textSub} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
});
const hd = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 4 },
  left:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 12 },
  logoBadge:{ width: 50, height: 50, borderRadius: 18, backgroundColor: DS.color.bg, alignItems: "center", justifyContent: "center", ...NEU_SHADOW_SM },
  logoImg:  { width: 26, height: 26 },
  title:    { fontSize: 17, fontFamily: "Inter_700Bold", color: DS.color.text },
  sub:      { fontSize: 12, fontFamily: "Inter_400Regular", color: DS.color.textSub, marginTop: 2 },
  bellBtn:  { width: 42, height: 42, borderRadius: 15, backgroundColor: DS.color.bg, alignItems: "center", justifyContent: "center", ...NEU_SHADOW_SM },
});

// ── HEALTH SCORE CARD ────────────────────────────────────────────────────────
const HealthScoreCard = React.memo(function HealthScoreCard({
  healthScore, calories, water, exerciseMin,
}: {
  healthScore: number;
  calories: { eaten: number; burned: number };
  water: { current: number; goal: number };
  exerciseMin: number;
}) {
  const { t } = useLanguage();
  const status = healthScore >= 76 ? t("dashScoreGreat") : healthScore >= 50 ? t("dashScoreOk") : t("dashScoreLow");
  const metrics = [
    { Icon: Utensils, val: String(calories.eaten),  unit: "kcal", lbl: t("dashCalories") },
    { Icon: Flame,    val: String(calories.burned), unit: "kcal", lbl: t("dashBurned")   },
    { Icon: Droplets, val: `${water.current}/${water.goal}`, unit: "cups", lbl: t("dashWater") },
    { Icon: Dumbbell, val: `${exerciseMin}m`, unit: "min", lbl: t("dashActiveTime") },
  ];
  return (
    <LinearGradient colors={["#0668AD", "#0B84D6", "#38B6FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={hc.card}>
      <View style={hc.wave} pointerEvents="none" />
      <View style={hc.top}>
        <View style={{ flex: 1 }}>
          <View style={hc.titleRow}>
            <Text style={hc.title}>{t("dashHealthScore")}</Text>
            <Info size={13} color="rgba(255,255,255,0.75)" strokeWidth={2} />
          </View>
          {/* The score itself lives in the ring on the right — PremiumScoreRing
              renders the number inside it. A second copy here printed the
              same figure twice in one card. */}
          <Text style={hc.status}>{status}</Text>
        </View>
        <View style={hc.ringWrap}>
          <PremiumScoreRing score={healthScore} size={92} strokeWidth={9} textColor="white" subLabel="/100" />
          <View style={hc.heartOverlay} pointerEvents="none">
            <Heart size={13} color="#fff" fill="#fff" strokeWidth={0} />
          </View>
        </View>
      </View>
      <View style={hc.divider} />
      <View style={hc.metricRow}>
        {metrics.map((m, i) => (
          <View key={i} style={hc.metric}>
            <View style={hc.metricIcon}>
              <m.Icon size={14} color="#fff" strokeWidth={2} />
            </View>
            <Text style={hc.metricVal}>{m.val}</Text>
            <Text style={hc.metricUnit}>{m.unit}</Text>
            <Text style={hc.metricLbl}>{m.lbl}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
});
const hc = StyleSheet.create({
  card:        { borderRadius: 24, padding: 18, overflow: "hidden" },
  wave:        { position: "absolute", top: -30, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.07)" },
  top:         { flexDirection: "row", alignItems: "center", gap: 12 },
  titleRow:    { flexDirection: "row", alignItems: "center", gap: 5 },
  title:       { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  status:      { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.92)", marginTop: 6 },
  ringWrap:    { position: "relative" },
  heartOverlay:{ position: "absolute", top: 25, left: 0, right: 0, alignItems: "center" },
  divider:     { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 16, marginBottom: 14 },
  metricRow:   { flexDirection: "row" },
  metric:      { flex: 1, alignItems: "center", gap: 3 },
  metricIcon:  { width: 28, height: 28, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 3 },
  metricVal:   { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  metricUnit:  { fontSize: 9, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.65)" },
  metricLbl:   { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.82)", marginTop: 1 },
});

// ── NUTRITION CARD ─────────────────────────────────────────────────────────────
function NutritionCard({ calories, protein, carbs, fat }: {
  calories: number; protein: number; carbs: number; fat: number;
}) {
  const { t } = useLanguage();
  const total = protein + carbs + fat || 1;
  const pctP = Math.round((protein / total) * 100);
  const pctC = Math.round((carbs / total) * 100);
  const pctF = 100 - pctP - pctC;

  const items = [
    { label: t("dashCalories"), value: `${calories}`, unit: "kcal", color: "#E8478C", bg: "#FDE7EF", icon: <Flame size={14} color="#E8478C" strokeWidth={2} />, pct: 100 },
    { label: t("dashProtein"),  value: `${protein}`,  unit: "g",    color: "#6366F1", bg: "#EAEAFD", icon: <Beef  size={14} color="#6366F1" strokeWidth={2} />, pct: pctP },
    { label: t("dashCarbs"),    value: `${carbs}`,    unit: "g",    color: "#10B981", bg: DS.color.greenSoft, icon: <Wheat size={14} color="#10B981" strokeWidth={2} />, pct: pctC },
    { label: t("dashFat"),      value: `${fat}`,      unit: "g",    color: "#F59E0B", bg: DS.color.orangeSoft, icon: <Droplets size={14} color="#F59E0B" strokeWidth={2} />, pct: pctF },
  ];

  return (
    <View style={nc.card}>
      <View style={nc.header}>
        <Text style={nc.title}>{t("dashTodaysNutrition")}</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/food" as never)}>
          <Text style={nc.viewAll}>{t("dashLogFood")}</Text>
        </TouchableOpacity>
      </View>
      <View style={nc.grid}>
        {items.map((item, i) => (
          <View key={i} style={nc.row}>
            <View style={[nc.iconCircle, { backgroundColor: item.bg }]}>{item.icon}</View>
            <View style={nc.labelCol}>
              <Text style={nc.itemVal} numberOfLines={1}>{item.value}<Text style={nc.itemUnit}> {item.unit}</Text></Text>
              <Text style={nc.itemLabel} numberOfLines={1}>{item.label}</Text>
            </View>
            <View style={nc.barBg}>
              <View style={[nc.barFill, { backgroundColor: item.color, width: `${item.pct}%` }]} />
            </View>
            <Text style={nc.pctTxt}>{item.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const nc = StyleSheet.create({
  card:      { backgroundColor: DS.color.bg, borderRadius: 20, padding: 16, ...NEU_SHADOW },
  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title:     { fontSize: 15, fontFamily: "Inter_700Bold", color: DS.color.text },
  viewAll:   { fontSize: 12, fontFamily: "Inter_600SemiBold", color: DS.color.primary },
  grid:      { gap: 12 },
  row:       { flexDirection: "row", alignItems: "center", gap: 9 },
  iconCircle:{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  labelCol:  { width: 62 },
  itemVal:   { fontSize: 13, fontFamily: "Inter_700Bold", color: DS.color.text },
  itemUnit:  { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted },
  itemLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: DS.color.muted },
  barBg:     { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#F1F5F9" },
  barFill:   { height: 6, borderRadius: 3 },
  pctTxt:    { width: 32, fontSize: 10, fontFamily: "Inter_600SemiBold", color: DS.color.muted, textAlign: "right" },
});

// ── SERVICE TILE ───────────────────────────────────────────────────────────────
function ServiceTile({ icon, label, color, softColor, onPress, badge }: {
  icon: React.ReactNode; label: string; color: string; softColor: string; onPress?: () => void; badge?: string;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      style={st.wrap} activeOpacity={1}
      onPressIn ={() => Animated.spring(sc, { toValue: 0.88, useNativeDriver: Platform.OS !== "web", damping: 10 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: Platform.OS !== "web", damping: 8  }).start()}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
    >
      <Animated.View style={[st.inner, { transform: [{ scale: sc }] }]}>
        <View style={[st.circle, { backgroundColor: softColor }, NEU_SHADOW_SM]}>
          {icon}
          {badge ? <View style={[st.badgeDot, { backgroundColor: color }]}><Text style={st.badgeT}>{badge}</Text></View> : null}
        </View>
        <Text style={st.lbl} numberOfLines={2}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const st = StyleSheet.create({
  wrap:     { width: "33.33%", alignItems: "center", paddingVertical: 6 },
  inner:    { alignItems: "center", gap: 7, width: 64 },
  circle:   { width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  lbl:      { fontSize: 11, fontFamily: "Inter_600SemiBold", color: DS.color.text, textAlign: "center", lineHeight: 14, height: 28 },
  badgeDot: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeT:   { fontSize: 8, fontFamily: "Inter_700Bold", color: "#FFF" },
});

// ── WATER MINI CARD (compact, for the 3-column row) ─────────────────────────────
function WaterMiniCard({ current, goal, onAdd }: { current: number; goal: number; onAdd: () => void }) {
  const { t } = useLanguage();
  const total = Math.max(goal, 6);
  const pct = Math.min(1, goal > 0 ? current / goal : 0);
  const r = 30, circ = 2 * Math.PI * r;
  return (
    <View style={wd.wrap}>
      <Text style={wd.title} numberOfLines={1}>💧 {t("dashWaterIntake")}</Text>
      <Text style={wd.sub} numberOfLines={2}>{current}/{goal} {t("dashCups")}</Text>
      <View style={wd.ringWrap}>
        <Svg width={70} height={70} viewBox="0 0 70 70">
          <Circle cx={35} cy={35} r={r} stroke={DS.color.skySoft} strokeWidth={7} fill="none" />
          <Circle
            cx={35} cy={35} r={r} stroke={DS.color.sky} strokeWidth={7} fill="none"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            transform="rotate(-90 35 35)"
          />
        </Svg>
        <View style={wd.ringCenter}>
          <Droplets size={20} color={DS.color.sky} strokeWidth={2} />
        </View>
      </View>
      <TouchableOpacity
        onPress={onAdd} disabled={current >= goal} activeOpacity={0.8}
        style={[wd.dotRow]}
      >
        {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
          <View key={i} style={[wd.dot, i < current ? { backgroundColor: DS.color.sky } : { backgroundColor: DS.color.skySoft }]} />
        ))}
      </TouchableOpacity>
    </View>
  );
}
const wd = StyleSheet.create({
  wrap:      { flex: 1, backgroundColor: DS.color.bg, borderRadius: 18, padding: 12, alignItems: "center", ...NEU_SHADOW_SM },
  title:     { fontSize: 11, fontFamily: "Inter_700Bold", color: DS.color.text, alignSelf: "flex-start" },
  sub:       { fontSize: 9.5, fontFamily: "Inter_400Regular", color: DS.color.muted, alignSelf: "flex-start", marginTop: 1, marginBottom: 6 },
  ringWrap:  { width: 70, height: 70, alignItems: "center", justifyContent: "center" },
  ringCenter:{ position: "absolute" },
  dotRow:    { flexDirection: "row", gap: 3, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  dot:       { width: 9, height: 9, borderRadius: 2 },
});

// ── MEDICINE MINI CARD (compact, for the 3-column row) ──────────────────────────
function MedicineMiniCard({ medicines, onPress }: {
  medicines: Array<{ id: string; medicineName: string; dosage?: string; reminderTimes: string[] }>;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const first = medicines[0];
  return (
    <TouchableOpacity style={mm.wrap} onPress={onPress} activeOpacity={0.85}>
      <Text style={mm.title} numberOfLines={1}>💊 {t("dashTodaysMedicines")}</Text>
      {medicines.length === 0 ? (
        <>
          <View style={mm.illusRow}>
            <View style={mm.illusBottle}>
              <Pill size={22} color={DS.color.primary} strokeWidth={2} />
            </View>
          </View>
          <Text style={mm.emptyTxt} numberOfLines={2}>{t("dashAddMedicineShort")}</Text>
        </>
      ) : (
        <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
          <Text style={mm.count}>{medicines.length}</Text>
          <Text style={mm.countLbl} numberOfLines={1}>{first.medicineName}</Text>
          {first.reminderTimes[0] ? <Text style={mm.time}>{first.reminderTimes[0]}</Text> : null}
        </View>
      )}
      <View style={mm.addBtn}>
        <Plus size={12} color="#FFF" strokeWidth={2.5} />
        <Text style={mm.addBtnTxt}>{medicines.length === 0 ? t("dashAddMedicine") : t("dashViewAll")}</Text>
      </View>
    </TouchableOpacity>
  );
}
const mm = StyleSheet.create({
  wrap:      { flex: 1, backgroundColor: DS.color.bg, borderRadius: 18, padding: 12, ...NEU_SHADOW_SM },
  title:     { fontSize: 11, fontFamily: "Inter_700Bold", color: DS.color.text, marginBottom: 6 },
  illusRow:  { alignItems: "center", justifyContent: "center", height: 40 },
  illusBottle:{ width: 44, height: 44, borderRadius: 22, backgroundColor: DS.color.primarySoft, alignItems: "center", justifyContent: "center" },
  emptyTxt:  { fontSize: 9.5, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center", marginTop: 4, minHeight: 26 },
  count:     { fontSize: 22, fontFamily: "Inter_800ExtraBold", color: DS.color.primary, textAlign: "center" },
  countLbl:  { fontSize: 10, fontFamily: "Inter_600SemiBold", color: DS.color.text, textAlign: "center" },
  time:      { fontSize: 9, fontFamily: "Inter_400Regular", color: DS.color.muted, textAlign: "center" },
  addBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: DS.color.primary, borderRadius: 10, paddingVertical: 7, marginTop: 8 },
  addBtnTxt: { fontSize: 9.5, fontFamily: "Inter_700Bold", color: "#FFF" },
});

// ── HEALTH TIP CARD (compact, for the 3-column row) — real data from
// api.getHealthTip(), an existing endpoint no screen was calling before. ────────
type HealthTip = { tip: string; tipHindi: string; category: string; emoji: string };
function HealthTipCard({ tip }: { tip: HealthTip | null }) {
  const { t, lang } = useLanguage();
  if (!tip) return null;
  const text = lang === "hi" && tip.tipHindi ? tip.tipHindi : tip.tip;
  return (
    <View style={ht.wrap}>
      <Text style={ht.title} numberOfLines={1}>{tip.emoji || "🌿"} {t("dashHealthTip")}</Text>
      <Text style={ht.body} numberOfLines={5}>{text}</Text>
    </View>
  );
}
const ht = StyleSheet.create({
  wrap:  { flex: 1, backgroundColor: DS.color.bg, borderRadius: 18, padding: 12, ...NEU_SHADOW_SM },
  title: { fontSize: 11, fontFamily: "Inter_700Bold", color: DS.color.text, marginBottom: 6 },
  body:  { fontSize: 10.5, fontFamily: "Inter_400Regular", color: DS.color.textSub, lineHeight: 15 },
});

// ── STRESS CARD ────────────────────────────────────────────────────────────────
type StressToday = { checkedIn: boolean; latestScore: number | null; avgScore: number | null; count: number; latestMood: string | null; burnoutRisk: boolean };

function stressScoreColor(s: number): string {
  if (s < 26) return DS.color.green;
  if (s < 51) return "#F59E0B";
  if (s < 76) return "#F97316";
  return "#EF4444";
}
function stressScoreLabel(s: number, t: (key: any) => string): string {
  if (s < 26) return t("dashStressLow");
  if (s < 51) return t("dashStressModerate");
  if (s < 76) return t("dashStressElevated");
  return t("dashStressHighRisk");
}

function StressCard({ data, onPress }: { data: StressToday | null; onPress: () => void }) {
  const { t } = useLanguage();
  const hasScore = data?.checkedIn && data.latestScore !== null;
  const score    = data?.latestScore ?? 0;
  const col      = hasScore ? stressScoreColor(score) : "#8B5CF6";
  const label    = hasScore ? stressScoreLabel(score, t) : t("dashNotCheckedIn");

  const gradColors: [string, string] = hasScore
    ? (score < 26  ? ["#10B981", "#059669"]
      : score < 51 ? ["#F59E0B", "#D97706"]
      : score < 76 ? ["#F97316", "#EA580C"]
      : ["#EF4444", "#DC2626"])
    : ["#7C3AED", "#6D28D9"];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ borderRadius: 20, overflow: "hidden" }}>
      <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sc.wrap}>
        <View style={sc.shine1} />
        <View style={sc.shine2} />
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={sc.badge}>
            <Brain size={12} color="#FFF" strokeWidth={2.5} />
            <Text style={sc.badgeTxt}> {t("dashMentalWellness")}</Text>
          </View>
          {data?.burnoutRisk && (
            <View style={sc.burnoutBadge}>
              <Text style={sc.burnoutTxt}>{t("dashBurnoutRisk")}</Text>
            </View>
          )}
        </View>
        {/* Content row */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={sc.title}>{t("dashStressCheckIn")}</Text>
            <Text style={sc.status}>
              {hasScore ? `${label} · ${data!.count} check-in${data!.count !== 1 ? "s" : ""} today` : t("dashTapToLogStressShort")}
            </Text>
          </View>
          {hasScore ? (
            <View style={sc.ring}>
              <Text style={sc.ringNum}>{score}</Text>
              <Text style={sc.ringLabel}>/100</Text>
            </View>
          ) : (
            <View style={sc.addBtn}>
              <Plus size={20} color="#FFF" strokeWidth={2.5} />
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const sc = StyleSheet.create({
  wrap:        { borderRadius: 20, padding: 16, overflow: "hidden", minHeight: 100 },
  shine1:      { position: "absolute", top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.1)" },
  shine2:      { position: "absolute", bottom: -20, left: -10, width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.06)" },
  badge:       { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  badgeTxt:    { color: "#FFF", fontSize: 8.5, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  burnoutBadge:{ backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  burnoutTxt:  { color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" },
  title:       { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 3 },
  status:      { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  ring:        { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  ringNum:     { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 18 },
  ringLabel:   { fontSize: 8, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  addBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
});

// ── QUICK STRESS MODAL ─────────────────────────────────────────────────────────
function getQuickMoods(t: (key: any) => string) {
  return [
    { score: 10, emoji: "😄", label: t("dashMoodGreat"),     value: "great",     color: "#10B981" },
    { score: 30, emoji: "🙂", label: t("dashMoodGood"),      value: "good",      color: "#34D399" },
    { score: 50, emoji: "😐", label: t("dashMoodOkay"),      value: "okay",      color: "#F59E0B" },
    { score: 70, emoji: "😟", label: t("dashMoodStressed"),  value: "stressed",  color: "#F97316" },
    { score: 90, emoji: "😰", label: t("dashMoodVeryHigh"),  value: "very high", color: "#EF4444" },
  ];
}

function QuickStressModal({
  visible, onClose, onSaved,
}: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const QUICK_MOODS = getQuickMoods(t);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (score: number) => {
    setSelected(score);
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.logStress({ stressScore: score, stressType: "quick_checkin", mood: QUICK_MOODS.find(m => m.score === score)?.value || "okay" });
      onSaved();
      onClose();
    } catch (e: unknown) {
      Alert.alert("Failed to save stress check-in", (e as Error)?.message || "Please try again.");
    } finally { setSaving(false); setSelected(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={qm.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={qm.sheet} onPress={() => {}}>
          <View style={qm.handle} />
          <Text style={qm.title}>How are you feeling? 💭</Text>
          <Text style={qm.sub}>{t("dashStressLogHint")}</Text>
          <View style={qm.moodRow}>
            {QUICK_MOODS.map((m) => (
              <TouchableOpacity
                key={m.score}
                style={[qm.moodBtn, selected === m.score && { backgroundColor: m.color + "22", borderColor: m.color }]}
                onPress={() => handleSelect(m.score)}
                disabled={saving}
              >
                {saving && selected === m.score
                  ? <ActivityIndicator size="small" color={m.color} />
                  : <Text style={qm.emoji}>{m.emoji}</Text>
                }
                <Text style={[qm.label, { color: m.color }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={qm.detailBtn} onPress={() => { onClose(); router.push("/stress" as never); }}>
            <Text style={qm.detailTxt}>Detailed Check-in →</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const qm = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: "#FFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle:    { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  title:     { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1F2937", textAlign: "center", marginBottom: 6 },
  sub:       { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", marginBottom: 22 },
  moodRow:   { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  moodBtn:   { flex: 1, alignItems: "center", gap: 6, padding: 10, borderRadius: 16, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" },
  emoji:     { fontSize: 28 },
  label:     { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  detailBtn: { marginTop: 20, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB" },
  detailTxt: { color: "#7C3AED", fontFamily: "Inter_600SemiBold", fontSize: 13 },
});

// ── MEDICINE ROW ───────────────────────────────────────────────────────────────
const mealColors: Record<string, string> = {
  before_meal: DS.color.orange, after_meal: DS.color.green, with_meal: DS.color.sky, anytime: DS.color.purple,
};
const mealLabels: Record<string, string> = {
  before_meal: "Before Breakfast", after_meal: "After Breakfast", with_meal: "With Meal", anytime: "Anytime",
};

// ── MAIN SCREEN ────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { weather, wLoading, refetchWeather } = useWeather();
  const [showWeatherModal, setShowWeatherModal] = useState(false);

  const [healthScore, setHealthScore] = useState(0);
  const [trends, setTrends] = useState<any>(null);
  const [water,       setWater]       = useState({ current: 0, goal: 8 });
  const [calories,    setCalories]    = useState({ eaten: 0, burned: 0 });
  const [nutrition,   setNutrition]   = useState({ protein: 0, carbs: 0, fat: 0 });
  const [exerciseMin, setExerciseMin] = useState(0);
  const [activityPct, setActivityPct] = useState(0);
  const [stressToday, setStressToday] = useState<StressToday | null>(null);
  const [showStressModal, setShowStressModal] = useState(false);
  const [healthTip, setHealthTip] = useState<HealthTip | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isOffline,   setIsOffline]   = useState(false);
  const [userName,    setUserName]    = useState("");
  const [userGender,  setUserGender]  = useState("");
  const [medicines,   setMedicines]   = useState<Array<{
    id: string; medicineName: string; dosage?: string;
    mealTiming: string; reminderTimes: string[]; isActive: boolean;
  }>>([]);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scrollRef = useRef<ScrollView>(null);

  const greeting = getGreeting(t);

  const loadData = useCallback(async () => {
    try {
      const date = todayDate();
      const [scoreRes, waterRes, foodRes, exerciseRes, profileRes, medRes, activityRes, stressRes] = await Promise.allSettled([
        api.getHealthScore(date), api.getWaterLog(date), api.getFoodSummary(date),
        api.getExerciseLogs(date), api.getProfile(), api.getMedicineSchedules(),
        api.getActivePercent(), api.getStressToday(),
      ]);

      const results = [scoreRes, waterRes, foodRes, exerciseRes, profileRes, medRes, activityRes, stressRes];
      const allFailed = results.every((r) => r.status === "rejected");
      if (allFailed) {
        const firstErr = (results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined)?.reason as Error | undefined;
        const msg = (firstErr?.message || "").toLowerCase();
        const isNetErr = msg.includes("network") || msg.includes("fetch") || msg.includes("internet") || msg.includes("starting up") || firstErr?.name === "TypeError";
        setIsOffline(isNetErr);
      } else {
        setIsOffline(false);
      }
      if (waterRes.status === "fulfilled")
        setWater({ current: waterRes.value.totalGlasses || 0, goal: waterRes.value.goal || 8 });
      if (foodRes.status === "fulfilled") {
        const summ = foodRes.value.summary as Record<string, number>;
        setCalories((c) => ({ ...c, eaten: Math.round(summ.totalCalories || 0) }));
        setNutrition({
          protein: Math.round(Number(summ.totalProteinG || 0)),
          carbs:   Math.round(Number(summ.totalCarbsG   || 0)),
          fat:     Math.round(Number(summ.totalFatG     || 0)),
        });
      }
      if (exerciseRes.status === "fulfilled") {
        const logs = exerciseRes.value.logs as Array<{ durationMinutes: number; caloriesBurned?: string }>;
        setExerciseMin(logs.reduce((s, l) => s + l.durationMinutes, 0));
        setCalories((c) => ({ ...c, burned: Math.round(logs.reduce((s, l) => s + Number(l.caloriesBurned || 0), 0)) }));
      }
      if (scoreRes.status === "fulfilled") {
        const sc = scoreRes.value.score as Record<string, number>;
        setHealthScore(sc.healthScore ?? 0);
        setTrends(sc.trends ?? null);
      }
      if (activityRes.status === "fulfilled") {
        setActivityPct(activityRes.value.pct ?? 0);
      }
      if (profileRes.status === "fulfilled") {
        const p = profileRes.value.profile as Record<string, string>;
        const name = p?.full_name || p?.fullName || "";
        setUserName(name.split(" ")[0] || "");
        setUserGender(p?.gender || "");
      }
      if (medRes.status === "fulfilled") {
        setMedicines(
          (medRes.value.schedules as typeof medicines).filter((m) => m.isActive)
        );
      }
      if (stressRes.status === "fulfilled") {
        setStressToday(stressRes.value as StressToday);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Dashboard] Data load error:", err);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 460, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18,   useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, []);

  useEffect(() => { loadData(); }, []);

  // Best-effort, once per screen mount — a stale/missing tip should never
  // block or affect the rest of the dashboard.
  useEffect(() => {
    api.getHealthTip().then(setHealthTip).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [loadData]));

  const handleAddWater = async () => {
    if (water.current >= water.goal) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.logWater({ glassesCount: 1 });
      setWater((w) => ({ ...w, current: Math.min(w.current + 1, w.goal) }));
    } catch (e: unknown) {
      Alert.alert("Failed to log water", (e as Error)?.message || "Please check your network and try again.");
    }
  };

  const topPad = insets.top;

  if (isLoading) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F9FF" />
        <ActivityIndicator size="large" color={DS.color.primary} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F9FF" translucent={false} />
      <LinearGradient
        colors={["#F5F9FF", "#EAF3FC", "#F5F9FF"]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── OFFLINE BANNER ── */}
      {isOffline && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineTxt}>📶 No internet connection — unable to load data. Please refresh once online.</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100, paddingTop: topPad + 12 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={DS.color.primary} colors={[DS.color.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── BODY ── */}
        <Animated.View style={[s.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* 1. HEADER + HEALTH SCORE */}
          <DashboardHeader
            greeting={greeting}
            userName={userName}
            onBellPress={() => router.push("/notification-settings" as never)}
          />
          {trends && <PremiumTrendCard currentStreak={trends.currentStreak} rolling7Day={trends.rolling7Day} rolling30Day={trends.rolling30Day} />}
          <HealthScoreCard
            healthScore={healthScore}
            calories={calories}
            water={water}
            exerciseMin={exerciseMin}
          />


          {/* 2. QUICK ACTIONS */}
          <View style={s.surfaceCard}>
            <Text style={s.secTitle}>{t("dashQuickServices")}</Text>
            <View style={s.grid}>
              {[
                { icon: <Utensils size={22} color={DS.color.green} strokeWidth={2.2} />, label: t("dashMealLog"),  color: DS.color.green,     soft: DS.color.greenSoft,     route: "/(tabs)/food" },
                { icon: <Dumbbell size={22} color={DS.color.secondary} strokeWidth={2.2} />, label: t("dashExercise"),  color: DS.color.secondary, soft: DS.color.secondarySoft, route: "/(tabs)/exercise" },
                { icon: <Pill     size={22} color={DS.color.primary} strokeWidth={2.2} />, label: t("dashMedicine"),  color: DS.color.primary,  soft: DS.color.primarySoft,   route: "/(tabs)/medicine",
                  badge: medicines.length > 0 ? String(medicines.length) : undefined },
                { icon: <ScanLine size={22} color={DS.color.primary} strokeWidth={2.2} />, label: t("dashAiScan"),   color: DS.color.primary,  soft: DS.color.primarySoft,   route: "/(tabs)/scan" },
                { icon: <Brain    size={22} color={DS.color.purple} strokeWidth={2.2} />, label: t("dashAiCoach"),  color: DS.color.purple,   soft: DS.color.purpleSoft,    route: "/suggestions" },
                { icon: <FileText size={22} color={DS.color.orange} strokeWidth={2.2} />, label: t("dashReports"),   color: DS.color.orange,   soft: DS.color.orangeSoft,    route: "/health-report" },
              ].map((svc, i) => (
                <ServiceTile
                  key={i} icon={svc.icon} label={svc.label} color={svc.color} softColor={svc.soft}
                  badge={(svc as { badge?: string }).badge}
                  onPress={() => router.push(svc.route as never)}
                />
              ))}
            </View>
          </View>

          {/* 3. WATER / MEDICINE / HEALTH TIP — 3-column row */}
          <View style={s.miniRow}>
            <WaterMiniCard current={water.current} goal={Math.max(water.goal, 6)} onAdd={handleAddWater} />
            <MedicineMiniCard medicines={medicines} onPress={() => router.push("/(tabs)/medicine" as never)} />
            <HealthTipCard tip={healthTip} />
          </View>

          {/* 3b. FULL MEDICINE LIST — shown only when there's more than the
              mini-card can summarize, same data source as above. */}
          {medicines.length > 1 && (
            <View style={s.surfaceCard}>
              <View style={s.cardHeader}>
                <Text style={s.secTitle}>{t("dashTodaysMedicines")}</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/medicine" as never)}>
                  <Text style={s.viewAll}>{t("dashViewAll")}</Text>
                </TouchableOpacity>
              </View>
              {medicines.slice(0, 3).map((med, idx) => (
                <View
                  key={med.id}
                  style={[s.medRow, idx === Math.min(medicines.length, 3) - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={[s.medIcon, { backgroundColor: (mealColors[med.mealTiming] || DS.color.purple) + "18" }]}>
                    <Pill size={15} color={mealColors[med.mealTiming] || DS.color.purple} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.medName}>{med.medicineName}{med.dosage ? ` · ${med.dosage}` : ""}</Text>
                    <Text style={s.medSub}>{med.reminderTimes[0] || ""} • {mealLabels[med.mealTiming] || "Anytime"}</Text>
                  </View>
                  <ChevronRight size={14} color={DS.color.muted} strokeWidth={1.5} />
                </View>
              ))}
            </View>
          )}

          {/* 5. NUTRITION CARD */}
          <NutritionCard
            calories={calories.eaten}
            protein={nutrition.protein}
            carbs={nutrition.carbs}
            fat={nutrition.fat}
          />

          {/* 7. ADS SLIDER */}
          <AdsSlider />

          {/* 8. HEALTH TOOLS — clean light grid */}
          <View style={s.surfaceCard}>
            <Text style={s.secTitle}>{t("dashHealthTools")}</Text>
            {[
              [
                { emoji: "🪪", label: t("dashHealthID"),  sub: t("dashYourCard"),      route: "/scorecard",        iconBg: "#EDE9FE" },
                { emoji: "⌚", label: t("dashWearables"),   sub: t("dashDeviceSync"),    route: "/wearable",          iconBg: "#DCFCE7" },
                { emoji: "💧", label: t("dashWater"),       sub: t("dashHydration"),      route: "/water",             iconBg: "#E0F2FE" },
                { emoji: "🧘", label: t("dashStress"),      sub: t("dashMoodCheck"),     route: "/stress",            iconBg: "#F3E8FF" },
              ],
              [
                { emoji: "😴", label: t("dashSleep"),       sub: t("dashRestTracker"),   route: "/sleep",             iconBg: "#EDE9FE" },
                { emoji: "🏃", label: t("dashExercise"),    sub: t("dashWorkouts"),       route: "/(tabs)/exercise",   iconBg: "#FEF3C7" },
                { emoji: "💊", label: t("dashMedicine"),    sub: t("dashReminders"),      route: "/(tabs)/medicine",   iconBg: "#DBEAFE" },
                { emoji: "📊", label: t("dashReports"),     sub: t("dashHealthReport"),  route: "/health-report",     iconBg: "#F1F5F9" },
              ],
              [
                { emoji: "🩺", label: t("dashVitals"),      sub: t("dashBpSugar"),        route: "/vitals",            iconBg: "#FEE2E2" },
                ...(userGender === "female" ? [
                  { emoji: "🌸", label: t("dashPeriod"), sub: t("dashCycleTracker"), route: "/period", iconBg: "#FCE7F3" },
                ] : []),
              ],
            ].map((row, ri) => (
              <View key={ri} style={[s.toolGrid, ri > 0 && { marginTop: 8 }]}>
                {row.map((tool) => (
                  <TouchableOpacity key={tool.label} style={{ flex: 1 }} onPress={() => router.push(tool.route as never)} activeOpacity={0.85}>
                    <View style={s.toolCard}>
                      <View style={[s.toolIconBg, { backgroundColor: tool.iconBg }]}>
                        <Text style={{ fontSize: 19 }}>{tool.emoji}</Text>
                      </View>
                      <Text style={s.toolLabel} numberOfLines={1}>{tool.label}</Text>
                      <Text style={s.toolSub} numberOfLines={1}>{tool.sub}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* 9. AI FEATURES — clean white cards with accent icons */}
          <View style={s.aiRow}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push("/suggestions" as never)} activeOpacity={0.85}>
              <View style={s.aiCleanCard}>
                <View style={[s.aiCleanIcon, { backgroundColor: "#E8F1FB" }]}>
                  <Sparkles size={16} color="#0B84D6" strokeWidth={2} />
                </View>
                <View style={[s.aiCleanBadge, { backgroundColor: "#E8F1FB" }]}>
                  <Text style={[s.aiCleanBadgeTxt, { color: "#0B84D6" }]}>AI</Text>
                </View>
                <Text style={s.aiCleanTitle}>{t("dashDailyCoach")}</Text>
                <Text style={s.aiCleanSub}>{t("dashAiNutrition")}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push("/intelligence" as never)} activeOpacity={0.85}>
              <View style={s.aiCleanCard}>
                <View style={[s.aiCleanIcon, { backgroundColor: "#F0EBFA" }]}>
                  <Brain size={16} color="#6B4FA0" strokeWidth={2} />
                </View>
                <View style={[s.aiCleanBadge, { backgroundColor: "#F0EBFA" }]}>
                  <Text style={[s.aiCleanBadgeTxt, { color: "#6B4FA0" }]}>AI</Text>
                </View>
                <Text style={s.aiCleanTitle}>{t("dashIntelligence")}</Text>
                <Text style={s.aiCleanSub}>{t("dashDeepAnalysis")}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowStressModal(true)} activeOpacity={0.85}>
              <View style={s.aiCleanCard}>
                <View style={[s.aiCleanIcon, { backgroundColor: "#E5F6F4" }]}>
                  <Brain size={16} color="#00A693" strokeWidth={2} />
                </View>
                <View style={[s.aiCleanBadge, { backgroundColor: "#E5F6F4" }]}>
                  <Text style={[s.aiCleanBadgeTxt, { color: "#00A693" }]}>Zen</Text>
                </View>
                <Text style={s.aiCleanTitle}>{t("dashStress")}</Text>
                <Text style={s.aiCleanSub}>{t("dashMoodAndBreathe")}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push("/blood" as never)} activeOpacity={0.85}>
              <View style={s.aiCleanCard}>
                <View style={[s.aiCleanIcon, { backgroundColor: "#FDEAEA" }]}>
                  <Text style={{ fontSize: 16 }}>🩸</Text>
                </View>
                <View style={[s.aiCleanBadge, { backgroundColor: "#FDEAEA" }]}>
                  <Text style={[s.aiCleanBadgeTxt, { color: "#D94040" }]}>SOS</Text>
                </View>
                <Text style={s.aiCleanTitle}>{t("dashBloodSOS")}</Text>
                <Text style={s.aiCleanSub}>{t("dashFindDonors")}</Text>
              </View>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      <QuickStressModal
        visible={showStressModal}
        onClose={() => setShowStressModal(false)}
        onSaved={() => { loadData(); }}
      />

      {/* FLOATING WEATHER PILL — always visible above tab bar */}
      <View style={{
        position: "absolute", bottom: insets.bottom + 68,
        alignSelf: "center", zIndex: 99,
      }}>
        <WeatherPill
          weather={weather}
          loading={wLoading}
          onPress={() => { if (weather) setShowWeatherModal(true); else refetchWeather(); }}
        />
      </View>

      <WeatherModal
        weather={weather}
        visible={showWeatherModal}
        onClose={() => setShowWeatherModal(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { gap: 0 },
  offlineBanner: {
    backgroundColor: "#FFF3CD", borderBottomWidth: 1, borderBottomColor: "#FBBF24",
    paddingHorizontal: 14, paddingVertical: 9,
  },
  offlineTxt: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: "#92400E", textAlign: "center",
  },

  body:     { paddingHorizontal: 14, paddingTop: 0, gap: 12 },

  surfaceCard: { backgroundColor: DS.color.bg, borderRadius: 20, padding: 16, ...NEU_SHADOW },
  miniRow:     { flexDirection: "row", gap: 8 },
  cardHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  secTitle:    { fontSize: 15, fontFamily: "Inter_700Bold", color: DS.color.text, marginBottom: 14 },
  viewAll:     { fontSize: 12, fontFamily: "Inter_600SemiBold", color: DS.color.primary },

  grid: { flexDirection: "row", flexWrap: "wrap" },

  medRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#E4ECF4" },
  medIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  medName:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text },
  medSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: DS.color.muted, marginTop: 1 },

  aiGrid:    { flexDirection: "row", gap: 6 },
  aiCard:    { flex: 1, borderRadius: 16, padding: 9, minHeight: 96, overflow: "hidden", gap: 4 },
  aiShine:   { position: "absolute", top: -18, right: -18, width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.1)" },
  aiBadge:   { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 5, paddingVertical: 2, alignSelf: "flex-start" },
  aiBadgeTxt:{ color: "#FFF", fontSize: 7.5, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  aiIconBox: { width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  aiTitle:   { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 15 },
  aiSub:     { fontSize: 9, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.82)", lineHeight: 12 },

  // ── Clean Health Tools (Airtel-style) ──────────────────────
  toolGrid:       { flexDirection: "row", gap: 7 },
  toolCard:       { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, backgroundColor: "#FFFFFF", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#E4ECF4" },
  toolIconBg:     { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  toolLabel:      { fontSize: 11, fontFamily: "Inter_700Bold", color: "#0D1B2A", textAlign: "center" },
  toolSub:        { fontSize: 9, fontFamily: "Inter_400Regular", color: "#8FA3BC", textAlign: "center" },

  // ── Clean AI Row ───────────────────────────────────────────
  aiRow:          { flexDirection: "row", gap: 7 },
  aiCleanCard:    { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, backgroundColor: "#FFFFFF", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#E4ECF4" },
  aiCleanIcon:    { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  aiCleanBadge:   { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "center" },
  aiCleanBadgeTxt:{ fontSize: 7.5, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  aiCleanTitle:   { fontSize: 11, fontFamily: "Inter_700Bold", color: "#0D1B2A", textAlign: "center" },
  aiCleanSub:     { fontSize: 8.5, fontFamily: "Inter_400Regular", color: "#8FA3BC", textAlign: "center" },
});
