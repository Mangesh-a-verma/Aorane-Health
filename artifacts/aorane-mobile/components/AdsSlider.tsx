/**
 * AdsSlider — Paytm-style horizontal banner slider
 * Compact landscape size, auto-scroll every 4s, manual swipe, dot indicators
 * Admin controls which ads appear here via Admin Panel
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, Image, TouchableOpacity,
  Dimensions, StyleSheet, Linking, ActivityIndicator,
} from "react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const { width: W } = Dimensions.get("window");
const SLIDER_H = 154;
const SIDE_PAD = 18;
const SLIDE_W = W - SIDE_PAD * 2;
const AUTO_SCROLL_MS = 4000;

type Ad = {
  id: string;
  title: string;
  bannerUrl: string | null;
  linkUrl: string | null;
  adType: "google" | "direct";
  slidePosition: number | null;
};

const PLACEHOLDER_ADS: Ad[] = [
  {
    id: "ph1",
    title: "AORANE Premium — 3 Mahine Free!",
    bannerUrl: null,
    linkUrl: null,
    adType: "direct",
    slidePosition: 1,
  },
  {
    id: "ph2",
    title: "Family Health Plan — Poore ghar ke liye",
    bannerUrl: null,
    linkUrl: null,
    adType: "direct",
    slidePosition: 2,
  },
];

const PLACEHOLDER_GRADIENTS = [
  ["#0077B6", "#00B896"],
  ["#7C3AED", "#A855F7"],
  ["#DC2626", "#F87171"],
  ["#D97706", "#FBBF24"],
  ["#059669", "#10B981"],
];

const PLACEHOLDER_EMOJIS = ["🏆", "👨‍👩‍👧‍👦", "💊", "🥗", "❤️"];

function PlaceholderSlide({ ad, index }: { ad: Ad; index: number }) {
  const grad = PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];
  const emoji = PLACEHOLDER_EMOJIS[index % PLACEHOLDER_EMOJIS.length];
  return (
    <View style={[slides.placeholder, { width: SLIDE_W, backgroundColor: grad[0] }]}>
      <View style={[slides.placeholderOverlay, { backgroundColor: grad[1] + "55" }]} />
      <View style={slides.placeholderContent}>
        <Text style={slides.placeholderEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={slides.placeholderTitle} numberOfLines={2}>{ad.title}</Text>
          <Text style={slides.placeholderSub}>Tap to know more →</Text>
        </View>
      </View>
    </View>
  );
}

function AdSlide({ ad, index, onImpression }: { ad: Ad; index: number; onImpression: (id: string) => void }) {
  useEffect(() => { onImpression(ad.id); }, []);

  const handlePress = async () => {
    if (ad.linkUrl) {
      try { await Linking.openURL(ad.linkUrl); } catch { }
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={ad.linkUrl ? 0.9 : 1} style={{ width: SLIDE_W }}>
      {ad.bannerUrl ? (
        <Image
          source={{ uri: ad.bannerUrl }}
          style={slides.image}
          resizeMode="cover"
        />
      ) : (
        <PlaceholderSlide ad={ad} index={index} />
      )}
    </TouchableOpacity>
  );
}

const slides = StyleSheet.create({
  image: { width: SLIDE_W, height: SLIDER_H, borderRadius: 14 },
  placeholder: { width: SLIDE_W, height: SLIDER_H, borderRadius: 14, overflow: "hidden", justifyContent: "center", padding: 20 },
  placeholderOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  placeholderContent: { flexDirection: "row", alignItems: "center", gap: 16 },
  placeholderEmoji: { fontSize: 42 },
  placeholderTitle: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 22 },
  placeholderSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },
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
    if (!token) return;
    try {
      const res = await api.getActiveAds("dashboard");
      const fetched = (res.ads as Ad[]) || [];
      setAds(fetched.length > 0 ? fetched : PLACEHOLDER_ADS);
    } catch {
      setAds(PLACEHOLDER_ADS);
    }
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
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SLIDE_W}
        decelerationRate="fast"
        snapToAlignment="center"
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item, index }) => (
          <AdSlide ad={item} index={index} onImpression={handleImpression} />
        )}
        style={st.list}
        contentContainerStyle={{ gap: 0 }}
        getItemLayout={(_, i) => ({ length: SLIDE_W, offset: SLIDE_W * i, index: i })}
      />

      {/* Dot indicators — Paytm style */}
      {ads.length > 1 && (
        <View style={st.dots}>
          {ads.map((_, i) => (
            <View
              key={i}
              style={[
                st.dot,
                i === activeIndex ? st.dotActive : st.dotInactive,
              ]}
            />
          ))}
        </View>
      )}

      {/* "Ad" label — subtle, like Paytm */}
      <View style={st.adLabel}>
        <Text style={st.adLabelText}>Ad</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrapper: { width: SLIDE_W, position: "relative" },
  container: { width: SLIDE_W, height: SLIDER_H, borderRadius: 14, backgroundColor: "#EEF3F7" },
  list: { borderRadius: 14, overflow: "hidden" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  dot: { borderRadius: 4, height: 4 },
  dotActive: { width: 20, backgroundColor: "#0077B6" },
  dotInactive: { width: 6, backgroundColor: "#C9D8E5" },
  adLabel: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adLabelText: { color: "#FFF", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
});
