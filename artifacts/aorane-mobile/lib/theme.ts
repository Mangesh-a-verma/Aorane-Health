import { Platform, StyleSheet } from "react-native";

export const DS = {
  color: {
    // Warm gradient palette
    bg:          "#FFF8F3",
    bgSoft:      "#FFF2E8",
    bgCard:      "#FFFFFF",
    primary:     "#E8622A",      // warm saffron-orange
    primarySoft: "#FDEEE6",
    secondary:   "#F5A623",      // golden yellow
    secondarySoft: "#FEF6E4",
    green:       "#27AE60",
    greenSoft:   "#E8F8EF",
    orange:      "#F5A623",
    orangeSoft:  "#FEF6E4",
    red:         "#E74C3C",
    redSoft:     "#FDEDEC",
    purple:      "#8E44AD",
    purpleSoft:  "#F4ECF7",
    sky:         "#2980B9",
    skySoft:     "#EAF4FB",
    yellow:      "#F39C12",
    // Text
    text:        "#1A1A2E",
    textSub:     "#4A4A6A",
    muted:       "#9B9BB0",
    // Borders / glass
    border:      "rgba(232,98,42,0.12)",
    borderLight: "rgba(232,98,42,0.06)",
    glass:       "rgba(255,255,255,0.82)",
    glassBorder: "rgba(255,255,255,0.95)",
    // Gradient stops
    gradStart:   "#FFF8F3",
    gradEnd:     "#FFE5D0",
    headerStart: "#E8622A",
    headerEnd:   "#F5A623",
  },
  radius: {
    xs:  8,
    sm:  12,
    md:  16,
    lg:  20,
    xl:  24,
    xxl: 32,
  },
  font: {
    xs:   9.5,
    sm:   11,
    base: 13,
    md:   15,
    lg:   17,
    xl:   20,
    xxl:  24,
    h1:   30,
  },
  space: {
    xs:  4,
    sm:  8,
    md:  12,
    lg:  16,
    xl:  20,
    xxl: 28,
  },
  shadow: {
    sm: Platform.select({
      ios:     { shadowColor: "#E8622A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8 },
      android: { elevation: 3 },
      default: { shadowColor: "#E8622A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8 },
    }),
    md: Platform.select({
      ios:     { shadowColor: "#E8622A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 14 },
      android: { elevation: 6 },
      default: { shadowColor: "#E8622A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 14 },
    }),
    lg: Platform.select({
      ios:     { shadowColor: "#C0392B", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20 },
      android: { elevation: 10 },
      default: { shadowColor: "#C0392B", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20 },
    }),
  },
} as const;

export const BASE_CARD = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(232,98,42,0.08)",
    overflow: "hidden",
  },
}).card;
