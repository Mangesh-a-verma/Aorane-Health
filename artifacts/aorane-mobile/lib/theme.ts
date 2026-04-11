import { Platform, StyleSheet } from "react-native";

export const DS = {
  color: {
    bg:          "#FFFFFF",
    bgSoft:      "#F5F8FF",
    bgCard:      "#FFFFFF",
    primary:     "#007AFF",
    primarySoft: "#EAF3FF",
    green:       "#34C759",
    greenSoft:   "#E8F9ED",
    orange:      "#FF9500",
    orangeSoft:  "#FFF3E0",
    red:         "#FF3B30",
    redSoft:     "#FFE8E7",
    purple:      "#AF52DE",
    purpleSoft:  "#F5EEFF",
    sky:         "#32ADE6",
    skySoft:     "#E5F5FF",
    yellow:      "#FFCC00",
    text:        "#1C1C1E",
    textSub:     "#48484A",
    muted:       "#8E8E93",
    border:      "rgba(0,0,0,0.08)",
    borderLight: "rgba(0,0,0,0.04)",
    glass:       "rgba(255,255,255,0.78)",
    glassBorder: "rgba(255,255,255,0.95)",
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
      ios:     { shadowColor: "#007AFF", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
      default: { shadowColor: "#007AFF", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
    }),
    md: Platform.select({
      ios:     { shadowColor: "#007AFF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 6 },
      default: { shadowColor: "#007AFF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
    }),
    lg: Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20 },
      android: { elevation: 10 },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20 },
    }),
  },
} as const;

export const BASE_CARD = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
}).card;
