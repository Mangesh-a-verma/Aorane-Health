import re

# Update LimitWarningToast.tsx
with open('artifacts/aorane-mobile/components/LimitWarningToast.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'const timer = setTimeout(onDismiss, 4000);\n      const { t } = useLanguage();\n  return () => clearTimeout(timer);',
    'const timer = setTimeout(onDismiss, 4000);\n      return () => clearTimeout(timer);'
)

content = content.replace(
    'export function LimitWarningToast({ visible, remaining, featureLabel = "scan", onDismiss }: Props) {',
    'export function LimitWarningToast({ visible, remaining, featureLabel = "scan", onDismiss }: Props) {\n  const { t } = useLanguage();'
)

content = content.replace(
    '  const { t } = useLanguage();\n  return (',
    '  return ('
)

# Fix remaining manual hardcodes in message
content = content.replace(
    '`⚠️ Aakhri ${featureLabel}! Upgrade karo`',
    't("limitWarningEmpty")?.replace("{feature}", featureLabel)'
)
content = content.replace(
    't("limitWarningRemaining").replace("{remaining}", remaining.toString()).replace("{feature}", featureLabel);',
    't("limitWarningRemaining")?.replace("{remaining}", remaining.toString()).replace("{feature}", featureLabel);'
)

with open('artifacts/aorane-mobile/components/LimitWarningToast.tsx', 'w') as f:
    f.write(content)

# AIUsageIndicator.tsx
with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'r') as f:
    content = f.read()

# Let's completely rewrite the AIUsageIndicator.tsx since regex might have made it weird
content_ai = """import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLanguage } from "@/context/LanguageContext";

export function AIUsageIndicator({ used, limit, label = "AI Scans" }: { used: number; limit: number; label?: string }) {
  const { t } = useLanguage();
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(100, (used / limit) * 100);

  let color = "#10B981"; // Green
  if (pct > 75) color = "#F59E0B"; // Yellow
  if (pct >= 100) color = "#EF4444"; // Red

  return (
    <View style={s.wrap}>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={s.textRow}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.count}>
          {t("aiUsageRemaining")?.replace("{remaining}", remaining.toString()).replace("{limit}", limit.toString()).replace("{feature}", label)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 12 },
  track: { height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, overflow: "hidden", marginBottom: 6 },
  fill: { height: "100%", borderRadius: 2 },
  textRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748B", textTransform: "uppercase" },
  count: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B" },
});
"""

with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'w') as f:
    f.write(content_ai)
