import { Platform, StyleSheet } from "react-native";

export const DS = {
  color: {
    // ── Backgrounds ──────────────────────────────────────────
    bg:           "#F4F6FA",
    bgSoft:       "#EEF2F7",
    bgCard:       "#FFFFFF",

    // ── Primary — Medical Blue ────────────────────────────────
    primary:      "#1A73C8",
    primarySoft:  "#E8F1FB",
    primaryDark:  "#1358A5",

    // ── Secondary — Teal ─────────────────────────────────────
    secondary:    "#00A693",
    secondarySoft:"#E5F6F4",

    // ── Semantic ──────────────────────────────────────────────
    green:        "#2EAD6E",
    greenSoft:    "#E8F8F1",
    orange:       "#F0882A",
    orangeSoft:   "#FEF3E8",
    red:          "#D94040",
    redSoft:      "#FDEAEA",
    purple:       "#6B4FA0",
    purpleSoft:   "#F0EBFA",
    sky:          "#3B82C4",
    skySoft:      "#EBF3FB",
    yellow:       "#D4A017",

    // ── Text ──────────────────────────────────────────────────
    text:         "#0D1B2A",
    textSub:      "#4B607A",
    muted:        "#8FA3BC",

    // ── Borders / Dividers ────────────────────────────────────
    border:       "rgba(26,115,200,0.10)",
    borderLight:  "rgba(26,115,200,0.05)",
    divider:      "#E4ECF4",

    // ── Glass / Surface ───────────────────────────────────────
    glass:        "rgba(255,255,255,0.90)",
    glassBorder:  "rgba(255,255,255,0.98)",

    // ── Gradient stops ────────────────────────────────────────
    gradStart:    "#F4F6FA",
    gradEnd:      "#EEF2F7",

    // ── Header ───────────────────────────────────────────────
    headerStart:  "#1A73C8",
    headerEnd:    "#2D8DE8",
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
      ios:     { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
      default: { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
    }),
    md: Platform.select({
      ios:     { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14 },
      android: { elevation: 4 },
      default: { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14 },
    }),
    lg: Platform.select({
      ios:     { shadowColor: "#0D1B2A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20 },
      android: { elevation: 8 },
      default: { shadowColor: "#0D1B2A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20 },
    }),
  },
} as const;

export const BASE_CARD = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4ECF4",
    overflow: "hidden",
  },
}).card;
