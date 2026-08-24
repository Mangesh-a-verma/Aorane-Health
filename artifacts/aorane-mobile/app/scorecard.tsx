import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Dimensions, ActivityIndicator, Modal, Image, Share
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PremiumScoreRing } from "../components/PremiumScoreRing";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import ViewShot, { captureRef } from "react-native-view-shot";
import { api } from "@/lib/api";
import QRCode from "react-native-qrcode-svg";
import AoraneLogo from "@/components/AoraneLogo";

const { width: W } = Dimensions.get("window");
const CARD_W = Math.min(W - 32, 380);
const CARD_H = Math.round(CARD_W / 1.586);
const AORANE_URL = "https://aorane.com";

const AVATARS = [
  { id: "avatar_1", emoji: "🦁", bg: ["#F59E0B", "#D97706"] },
  { id: "avatar_2", emoji: "🐯", bg: ["#EF4444", "#DC2626"] },
  { id: "avatar_3", emoji: "🦊", bg: ["#F97316", "#EA580C"] },
  { id: "avatar_4", emoji: "🐻", bg: ["#8B5CF6", "#7C3AED"] },
  { id: "avatar_5", emoji: "🦅", bg: ["#0077B6", "#0369A1"] },
  { id: "avatar_6", emoji: "🌸", bg: ["#EC4899", "#DB2777"] },
  { id: "avatar_7", emoji: "🌿", bg: ["#10B981", "#059669"] },
  { id: "avatar_8", emoji: "⚡", bg: ["#06B6D4", "#0891B2"] },
];

type ActivePercent = { overall: number; todayPct: number; weekPct: number; daysTracked: number; trend: string; };
type Scorecard = {
  aoraneId: string; name: string; bloodGroup: string; bmi: string;
  bmiCategory: string; plan: string; gender: string; age: number | null;
  memberSince: string; city: string | null; state: string | null;
  workProfile: string | null; profilePhotoUrl?: string | null;
  healthScore?: number; activePercent: ActivePercent;
};
type CompanySettings = {
  companyName: string; companyLogoUrl: string | null; tagline: string | null;
  primaryColor: string; accentColor: string; scorecardBgGradientFrom: string; scorecardBgGradientTo: string;
};
const DEFAULT_COMPANY: CompanySettings = {
  companyName: "Aorane Health", companyLogoUrl: null, tagline: "Your health, in your hands",
  primaryColor: "#0077B6", accentColor: "#00B896", scorecardBgGradientFrom: "#023E8A", scorecardBgGradientTo: "#1B998B",
};

const PLAN_COLORS: Record<string, string> = { free: "#6B7280", pro: "#0077B6", max: "#8B5CF6", family: "#10B981" };
const PLAN_LABELS: Record<string, string> = { free: "FREE", pro: "PRO", max: "MAX", family: "FAMILY" };

function formatId(id: string): string {
  if (!id) return "———";
  return id.toUpperCase().match(/.{1,4}/g)?.join("  ") ?? id.toUpperCase();
}

function formatCardDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, " ");
}

export default function ScorecardScreen() {
  const insets = useSafeAreaInsets();
  const [card, setCard] = useState<Scorecard | null>(null);
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[4]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  const cardRef = useRef<View>(null); 

  useEffect(() => { loadCard(); loadCompany(); }, []);

  const loadCard = async () => {
    try {
      const d = await api.getScorecard();
      setCard(d as unknown as Scorecard);
    } catch { }
    setLoading(false);
  };

  const loadCompany = async () => {
    try {
      const d = await api.getCompanySettings();
      setCompany({ ...DEFAULT_COMPANY, ...d.settings });
    } catch { }
  };

  // ─── NATIVE APP: CAPTURE & SAVE PNG TO GALLERY ───
  const handleDownload = async () => {
    if (!card) return;
    setProcessing(true);
    try {
      if (Platform.OS === "web") {
        Alert.alert("Web Note", "Download is optimized for the Mobile App.");
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert("Permission Required", "Please allow gallery access to save your card.");
          setProcessing(false); return;
        }
        const uri = await captureRef(cardRef, { format: "png", quality: 1 });
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert("Success! 🎉", "Your Aorane Health Card has been saved to your photo gallery.");
      }
    } catch (err) {
      Alert.alert("Error", "Could not save image. Please try again.");
    }
    setProcessing(false);
  };

  // ─── NATIVE APP: SHARE PNG IMAGE ───
  const handleShare = async () => {
    if (!card) return;
    setProcessing(true);
    try {
      if (Platform.OS === "web") {
        Alert.alert("Web Note", "Sharing is optimized for the Mobile App.");
      } else {
        const uri = await captureRef(cardRef, { format: "png", quality: 1 });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share Aorane Health Card" });
        }
      }
    } catch (err) {
      Alert.alert("Error", "Could not share image. Please try again.");
    }
    setProcessing(false);
  };

  const healthPct = Math.round(card?.activePercent?.overall ?? 0);
  const activePct = Math.round(card?.activePercent?.weekPct ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F9FF" }}>
      <LinearGradient colors={["#E0F2FE", "#BAE6FD", "#EFF6FF"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 100, paddingHorizontal: 16 }}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <AoraneLogo width={140} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,119,182,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="arrow-back" size={20} color="#0077B6" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#0D1F33", fontFamily: "Inter_700Bold", fontSize: 22 }}>Health Scorecard</Text>
            <Text style={{ color: "#7A90A4", fontSize: 12, fontFamily: "Inter_400Regular" }}>Your ATM-style Identity</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0077B6" style={{ marginTop: 80 }} />
        ) : card ? (
          <>
            <ViewShot ref={cardRef} options={{ format: "png", quality: 1 }} style={{ alignSelf: "center", backgroundColor: "transparent" }}>
              <View style={[styles.cardShell, { width: CARD_W, height: CARD_H }]}>
                <LinearGradient
                  colors={[company.scorecardBgGradientFrom || "#023E8A", company.primaryColor || "#0077B6", company.scorecardBgGradientTo || "#1B998B"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[styles.cardGrad, { height: CARD_H }]}
                >
                  <View style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)" }} />
                  <View style={{ position: "absolute", bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.04)" }} />

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {company.companyLogoUrl ? (
                        <Image source={{ uri: company.companyLogoUrl }} style={{ width: 20, height: 20, borderRadius: 4 }} resizeMode="contain" />
                      ) : (
                        <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#FFF", fontSize: 8, fontFamily: "Inter_700Bold" }}>A</Text>
                        </View>
                      )}
                      <Text style={{ color: "rgba(255,255,255,0.9)", fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 2 }}>{company.companyName.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.planBadge, { backgroundColor: PLAN_COLORS[card.plan] || "#6B7280" }]}>
                      <Text style={styles.planText}>{PLAN_LABELS[card.plan] || "FREE"}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", flex: 1, alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <LinearGradient colors={selectedAvatar.bg as [string, string]} style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 18 }}>{selectedAvatar.emoji}</Text>
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }} numberOfLines={1}>{card.name || "Aorane User"}</Text>
                          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontFamily: "Inter_400Regular" }}>
                            {card.age ? `Age ${card.age}` : ""} {card.age && card.gender ? " • " : ""} {card.gender === "male" ? "Male" : card.gender === "female" ? "Female" : ""}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 7, fontFamily: "Inter_500Medium", letterSpacing: 1.5, marginBottom: 1 }}>AORANE ID</Text>
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>{formatId(card.aoraneId)}</Text>

                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <View style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, alignItems: "center" }}>
                          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 6, fontFamily: "Inter_500Medium", letterSpacing: 0.8 }}>HEALTH</Text>
                          <PremiumScoreRing score={card.healthScore ?? healthPct} size={50} strokeWidth={5} />
                        </View>
                        <View style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, alignItems: "center" }}>
                          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 6, fontFamily: "Inter_500Medium", letterSpacing: 0.8 }}>THIS WEEK</Text>
                          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>{activePct}%</Text>
                        </View>
                        {card.bloodGroup && (
                          <View style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, alignItems: "center" }}>
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 6, fontFamily: "Inter_500Medium", letterSpacing: 0.8 }}>BLOOD</Text>
                            <Text style={{ color: "#FFA0A0", fontFamily: "Inter_700Bold", fontSize: 13 }}>{card.bloodGroup}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={{ alignItems: "center", marginLeft: 12 }}>
                      <View style={{ backgroundColor: "#FFF", borderRadius: 8, padding: 4 }}>
                        <QRCode value={AORANE_URL} size={58} color="#023E8A" backgroundColor="#FFF" />
                      </View>
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 7, marginTop: 3 }}>aorane.com</Text>
                    </View>
                  </View>

                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 6, marginTop: 6, letterSpacing: 0.5 }}>{formatCardDate(new Date())} • स्वास्थ्य ही धन</Text>
                </LinearGradient>
              </View>
            </ViewShot>

            <View style={{ gap: 12, marginTop: 20 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity activeOpacity={0.8} onPress={handleDownload} disabled={processing} style={[styles.actionBtn, { flex: 1, backgroundColor: "#0077B6" }]}>
                  {processing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="image-outline" size={20} color="#FFF" />}
                  <Text style={styles.actionBtnText}>{processing ? "Saving..." : "Save Image"}</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.8} onPress={handleShare} disabled={processing} style={[styles.actionBtn, { flex: 1, backgroundColor: "#00B896" }]}>
                  {processing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="share-social-outline" size={20} color="#FFF" />}
                  <Text style={styles.actionBtnText}>{processing ? "Sharing..." : "Share Card"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShell: { borderRadius: 22, shadowColor: "#0077B6", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 16, marginBottom: 4 },
  cardGrad: { borderRadius: 18, padding: 16, overflow: "hidden", flex: 1 },
  planBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  planText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.5 },
  actionBtn: { borderRadius: 14, padding: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 },
});