import { Platform, StyleSheet } from "react-native";

/**
 * DS is the primary, actively-maintained design-token source (~15 screens
 * import it) — color/radius/font/space/shadow scales all in one place.
 *
 * There is a SECOND, separate token source: constants/colors.ts (a full
 * light+dark palette, reached via hooks/useColors.ts), currently consumed
 * by only 2 files — components/GlassCard.tsx and app/+not-found.tsx — plus
 * ~11 screens that define their own local, one-off `const C = {...}`
 * color objects instead of using either shared source.
 *
 * These are NOT reconciled yet: DS.color.primary (#0B84D6) and
 * colors.light.primary (#0077B6) are two different blues for the same
 * conceptual role, and several screens' local palettes diverge further
 * still. Deliberately NOT auto-merged here — picking which value "wins"
 * for each token, and migrating every consumer to it, changes what the
 * app visually looks like on every screen touched, which needs to be
 * verified against a running build (screenshots / a physical device),
 * not guessed at blind. Until that pass happens, treat DS as the source
 * for NEW code, and don't assume DS and colors.ts agree on any given
 * color today.
 */
export const DS = {
  color: {
    // ── Backgrounds ──────────────────────────────────────────
    bg:           "#F5F9FF",   // near-white with airy blue tint
    bgSoft:       "#EAF3FC",   // light sky wash
    bgCard:       "#FFFFFF",

    // ── Primary — Healthcare Sky Blue ─────────────────────────
    primary:      "#0B84D6",   // lighter, airier than before
    primarySoft:  "#DBF0FB",   // very pale sky
    primaryDark:  "#0668AD",

    // ── Secondary — Teal ─────────────────────────────────────
    secondary:    "#00A693",
    secondarySoft:"#DDF5F2",

    // ── Semantic ──────────────────────────────────────────────
    green:        "#2EAD6E",
    greenSoft:    "#E3F9EE",
    orange:       "#F0882A",
    orangeSoft:   "#FEF3E8",
    red:          "#D94040",
    redSoft:      "#FDEAEA",
    purple:       "#6B4FA0",
    purpleSoft:   "#F0EBFA",
    sky:          "#38B6FF",
    skySoft:      "#E5F5FF",
    yellow:       "#D4A017",

    // ── Text ──────────────────────────────────────────────────
    text:         "#1A2B3C",   // slightly softer than before
    textSub:      "#4E6577",
    muted:        "#90A4B5",

    // ── Borders / Dividers ────────────────────────────────────
    border:       "rgba(11,132,214,0.10)",
    borderLight:  "rgba(11,132,214,0.05)",
    divider:      "#E0EEF8",

    // ── Glass / Surface ───────────────────────────────────────
    glass:        "rgba(255,255,255,0.92)",
    glassBorder:  "rgba(255,255,255,0.98)",

    // ── Gradient stops ────────────────────────────────────────
    gradStart:    "#F5F9FF",
    gradEnd:      "#EAF3FC",

    // ── Header ───────────────────────────────────────────────
    headerStart:  "#0B84D6",
    headerEnd:    "#38B6FF",
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
      ios:     { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      default: { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
    }),
    md: Platform.select({
      ios:     { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14 },
      android: { elevation: 4 },
      default: { shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14 },
    }),
    lg: Platform.select({
      ios:     { shadowColor: "#0D1B2A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20 },
      android: { elevation: 8 },
      default: { shadowColor: "#0D1B2A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20 },
    }),
  },
} as const;

export const BASE_CARD = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0EEF8",
    overflow: "hidden",
  },
}).card;
