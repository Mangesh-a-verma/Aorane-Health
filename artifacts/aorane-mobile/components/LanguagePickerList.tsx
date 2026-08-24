import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LANGUAGE_NAMES, SUPPORTED_LANGS, type LangCode } from "@/lib/translations";

export const ENGLISH_LABEL: Record<LangCode, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  mr: "Marathi",
  te: "Telugu",
  ta: "Tamil",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
};

export function LanguagePickerList({
  selected,
  onSelect,
}: {
  selected: LangCode;
  onSelect: (code: LangCode) => void;
}) {
  return (
    <>
      {SUPPORTED_LANGS.map((code) => {
        const isSelected = selected === code;
        return (
          <TouchableOpacity
            key={code}
            activeOpacity={0.75}
            onPress={() => { Haptics.selectionAsync(); onSelect(code); }}
            style={[
              styles.card,
              {
                backgroundColor: "#FFFFFF",
                borderColor: isSelected ? "#0077B6" : ("#E2E8F0"),
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={`${ENGLISH_LABEL[code]} — ${LANGUAGE_NAMES[code]}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.nativeName, { color: "#0F172A" }]}>
                {LANGUAGE_NAMES[code]}
              </Text>
              <Text style={[styles.englishName, { color: "#94A3B8" }]}>
                {ENGLISH_LABEL[code]}
              </Text>
            </View>
            {isSelected && (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  nativeName: { fontSize: 17, fontFamily: "Inter_700Bold" },
  englishName: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#0077B6",
    alignItems: "center", justifyContent: "center",
  },
});
