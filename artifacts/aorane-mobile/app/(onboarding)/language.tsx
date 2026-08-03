import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "@/context/LanguageContext";
import { type LangCode } from "@/lib/translations";
import { LanguagePickerList } from "@/components/LanguagePickerList";
import { logSilentError } from "@/lib/silentCatch";

export default function LanguageSelectScreen() {
  const insets = useSafeAreaInsets();
  const { lang, setLang, isLoaded } = useLanguage();
  const [selected, setSelected] = useState<LangCode>(lang);
  const [saving, setSaving] = useState(false);

  const handleSelect = (code: LangCode) => {
    Haptics.selectionAsync();
    setSelected(code);
  };

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      await setLang(selected);
      await AsyncStorage.setItem("hasSelectedLanguage", "true");
      router.replace("/(onboarding)/intro" as never);
    } catch (e) {
      logSilentError("language-onboarding-continue", e);
      // Even if saving the preference failed, don't trap the user here —
      // the app defaults to English and they can change it later in Settings.
      router.replace("/(onboarding)/intro" as never);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#E0F2FE", "#EFF9FF", "#ECFDF5"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={[styles.title, { color: "#0F172A" }]}>
          Choose your language
        </Text>
        <Text style={[styles.subtitle, { color: "#64748B" }]}>
          अपनी भाषा चुनें • आपकी भाषा में AORANE
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {isLoaded && (
          <LanguagePickerList selected={selected} onSelect={handleSelect} />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={saving}
          onPress={handleContinue}
          style={styles.continueBtn}
        >
          <LinearGradient
            colors={["#0077B6", "#1B998B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueGradient}
          >
            <Text style={styles.continueText}>{saving ? "…" : "Continue"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, fontWeight: "500" },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  nativeName: { fontSize: 17, fontWeight: "700" },
  englishName: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#0077B6",
    alignItems: "center", justifyContent: "center",
  },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  continueBtn: { borderRadius: 16, overflow: "hidden" },
  continueGradient: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  continueText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
