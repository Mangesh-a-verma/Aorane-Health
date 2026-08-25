import { useEffect, useState } from "react";

/**
 * Chart palette — single source of truth for every recharts surface.
 *
 * These are the exact steps declared as --chart-1..6 in index.css, mirrored
 * here as literal hex because recharts writes colours into SVG presentation
 * attributes and internal tooltip payloads, where a raw `var(--x)` is not
 * reliably resolved.
 *
 * Both rows were checked with the dataviz palette validator (lightness band,
 * chroma floor, adjacent-pair CVD separation, normal-vision floor, contrast
 * vs surface) against their own theme's surface and pass on every check.
 * The ORDER is part of what passes: adjacent slots are the pairs that were
 * verified as distinguishable, so append at the end rather than re-ordering,
 * and re-run the validator if a step is ever changed.
 */
const LIGHT = ["#C2410C", "#1D4ED8", "#047857", "#6D28D9", "#B45309", "#A21CAF"] as const;
const DARK  = ["#DD6B20", "#3B82F6", "#059669", "#8B5CF6", "#D97706", "#C026D3"] as const;

export type ChartColors = {
  series: readonly string[];
  /** Plan tiers get fixed slots so a tier keeps its colour across every page. */
  plan: Record<string, string>;
  grid: string;
  axis: string;
  /** Neutral for "no value"/free-tier bars — deliberately not a series hue. */
  neutral: string;
  isDark: boolean;
};

function build(isDark: boolean): ChartColors {
  const s = isDark ? DARK : LIGHT;
  return {
    series: s,
    plan: { free: isDark ? "#64748B" : "#64748B", pro: s[0], max: s[4], family: s[3] },
    grid: isDark ? "rgba(190, 205, 230, 0.14)" : "rgba(120, 138, 165, 0.22)",
    axis: isDark ? "#8A96AC" : "#5A6478",
    neutral: "#64748B",
    isDark,
  };
}

function readIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/**
 * Re-reads the palette whenever the theme toggle flips the `dark` class on
 * <html>, so charts repaint with the theme instead of keeping light-mode
 * hues on a dark surface.
 */
export function useChartColors(): ChartColors {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    setIsDark(el.classList.contains("dark"));
    return () => obs.disconnect();
  }, []);

  return build(isDark);
}
