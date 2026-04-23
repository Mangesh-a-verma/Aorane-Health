/**
 * AdsSlider — 5-slide horizontal banner slider with peek effect
 * Narrow cards so next slide peeks in (like Paytm/PhonePe)
 * Auto-scroll every 4s, manual swipe, dot indicators
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, Image, TouchableOpacity,
  Dimensions, StyleSheet, Linking, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const { width: W } = Dimensions.get("window");
const SLIDER_H = 118;
const SIDE_PAD = 18;
const PEEK = 28;
const SLIDE_W = W - SIDE_PAD * 2 - PEEK;
const AUTO_SCROLL_MS = 3500;

type Ad = {
  id: string;
  title: string;
  bannerUrl: string | null;
  linkUrl: string | null;
  adType: "google" | "direct";
  slidePosition: number | null;
};

const SITE_URL = "https://aorane.in";
const PLACEHOLDER_ADS: Ad[] = [
  { id: "ph1", title: "Aorane Premium — 3 Months Free! 🏆", bannerUrl: null, linkUrl: SITE_URL, adType: "direct", slidePosition: 1 },
  { id: "ph2", title: "Family Health Plan — For your entire family 👨‍👩‍👧‍👦", bannerUrl: null, linkUrl: SITE_URL, adType: "direct", slidePosition: 2 },
  { id: "ph3", title: "AI Food Scan — Know your meal calories with AI 🥗", bannerUrl: null, linkUrl: SITE_URL, adType: "direct", slidePosition: 3 },
  { id: "ph4", title: "Medicine Reminder — Never miss your medicines 💊", bannerUrl: null, linkUrl: SITE_URL, adType: "direct", slidePosition: 4 },
  { id: "ph5", title: "Health Score — Score 100%, stay fit ❤️", bannerUrl: null, linkUrl: SITE_URL, adType: "direct", slidePosition: 5 },
];

const PLACEHOLDER_GRADIENTS: [string, string][] = [
  ["#0077B6", "#00B896"],
  ["#0EA5E9", "#38BDF8"],
  ["#059669", "#10B981"],
  ["#0369A1", "#0284C7"],
  ["#00B896", "#34D399"],
];

const PLACEHOLDER_EMOJIS = ["🏆", "👨‍👩‍👧‍👦", "🥗", "💊", "❤️"];
const PLACEHOLDER_SUBS = [
  "Upgrade now →",
  "Add family members →",
  "Try AI scan today →",
  "Set reminders →",
  "See your score →",
];

function PlaceholderSlide({ ad, index }: { ad: Ad; index: number }) {
  const [c1, c2] = PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];
  const emoji = PLACEHOLDER_EMOJIS[index % PLACEHOLDER_EMOJIS.length];
  const sub = PLACEHOLDER_SUBS[index % PLACEHOLDER_SUBS.length];
  return (
    <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[slides.placeholder, { width: SLIDE_W }]}>
      <View style={slides.glassOverlay} />
      <View style={slides.placeholderContent}>
        <View style={slides.emojiBox}>
          <Text style={slides.placeholderEmoji}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={slides.placeholderTitle} numberOfLines={2}>{ad.title}</Text>
          <View style={slides.subRow}>
            <Text style={slides.placeholderSub}>{sub}</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function AdSlide({ ad, index, onImpression }: { ad: Ad; index: number; onImpression: (id: string) => void }) {
  useEffect(() => { onImpression(ad.id); }, []);
  const isPlaceholder = ad.id.startsWith("ph");
  const handlePress = async () => {
    if (isPlaceholder) {
      if (ad.linkUrl) { try { await Linking.openURL(ad.linkUrl); } catch { } }
      return;
    }
    try {
      const res = await api.recordAdClick(ad.id);
      const url = res.linkUrl || ad.linkUrl;
      if (url) await Linking.openURL(url);
    } catch {
      if (ad.linkUrl) { try { await Linking.openURL(ad.linkUrl); } catch { } }
    }
  };
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.88} style={{ width: SLIDE_W }}>
      {ad.bannerUrl ? (
        <Image source={{ uri: ad.bannerUrl }} style={slides.image} resizeMode="cover" />
      ) : (
        <PlaceholderSlide ad={ad} index={index} />
      )}
    </TouchableOpacity>
  );
}

const slides = StyleSheet.create({
  image: { width: SLIDE_W, height: SLIDER_H, borderRadius: 16 },
  placeholder: { width: SLIDE_W, height: SLIDER_H, borderRadius: 16, overflow: "hidden", justifyContent: "center", padding: 16 },
  glassOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16 },
  placeholderContent: { flexDirection: "row", alignItems: "center", gap: 14 },
  emojiBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  placeholderEmoji: { fontSize: 28 },
  placeholderTitle: { color: "#FFF", fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 20, flex: 1 },
  subRow: { marginTop: 6, flexDirection: "row" },
  placeholderSub: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontFamily: "Inter_500Medium", backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
});

export function AdsSlider() {
  const { token } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const impressionsSent = useRef<Set<string>>(new Set());

  const loadAds = useCallback(async () => {
    if (!token) { setAds(PLACEHOLDER_ADS); setLoading(false); return; }
    try {
      const res = await api.getActiveAds("dashboard");
      const fetched = (res.ads as Ad[]) || [];
      setAds(fetched.length >= 2 ? fetched : PLACEHOLDER_ADS);
    } catch { setAds(PLACEHOLDER_ADS); }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadAds(); }, [loadAds]);

  const startAutoScroll = useCallback((count: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % count;
        flatRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_SCROLL_MS);
  }, []);

  useEffect(() => {
    startAutoScroll(ads.length);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ads.length, startAutoScroll]);

  const handleImpression = useCallback(async (id: string) => {
    if (impressionsSent.current.has(id) || id.startsWith("ph")) return;
    impressionsSent.current.add(id);
    try { await api.recordAdImpression(id); } catch { }
  }, []);

  const handleMomentumEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    setActiveIndex(idx);
    startAutoScroll(ads.length);
  };

  if (loading) {
    return (
      <View style={[st.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="small" color="#0077B6" />
      </View>
    );
  }

  return (
    <View style={st.wrapper}>
      <FlatList
        ref={flatRef}
        data={ads}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SLIDE_W + 10}
        decelerationRate="fast"
        snapToAlignment="start"
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item, index }) => (
          <View style={{ paddingRight: 10 }}>
            <AdSlide ad={item} index={index} onImpression={handleImpression} />
          </View>
        )}
        style={st.list}
        contentContainerStyle={{ paddingRight: PEEK }}
        getItemLayout={(_, i) => ({ length: SLIDE_W + 10, offset: (SLIDE_W + 10) * i, index: i })}
      />

      {ads.length > 1 && (
        <View style={st.dots}>
          {ads.map((_, i) => (
            <View key={i} style={[st.dot, i === activeIndex ? st.dotActive : st.dotInactive]} />
          ))}
        </View>
      )}

      <View style={st.adLabel}>
        <Text style={st.adLabelText}>Ad</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrapper: { position: "relative", marginHorizontal: -18, paddingHorizontal: 18, overflow: "hidden" },
  container: { height: SLIDER_H, borderRadius: 16, backgroundColor: "#EEF3F7" },
  list: { overflow: "visible" },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 8 },
  dot: { borderRadius: 4, height: 4 },
  dotActive: { width: 18, backgroundColor: "#0077B6" },
  dotInactive: { width: 5, backgroundColor: "#C9D8E5" },
  adLabel: { position: "absolute", top: 8, right: 26, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  adLabelText: { color: "#FFF", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
});
