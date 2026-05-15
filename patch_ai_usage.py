import re

with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'r') as f:
    content = f.read()

# Just replace the specific hardcoded text safely
content = content.replace('import { View, Text, StyleSheet } from "react-native";', 'import { View, Text, StyleSheet } from "react-native";\nimport { useLanguage } from "@/context/LanguageContext";')
content = content.replace(
    'export function AIUsageIndicator({ used, limit, label = "AI Scans", iconName = "sparkles", compact = false }: { used: number; limit: number; label?: string; iconName?: keyof typeof Ionicons.glyphMap; compact?: boolean }) {',
    'export function AIUsageIndicator({ used, limit, label = "AI Scans", iconName = "sparkles", compact = false }: { used: number; limit: number; label?: string; iconName?: keyof typeof Ionicons.glyphMap; compact?: boolean }) {\n  const { t } = useLanguage();'
)

# In the actual component text rendering
content = re.sub(
    r"\{remaining\}/\{limit\} \{label\} baaki aaj",
    r"{t(\"aiUsageRemaining\")?.replace(\"{remaining}\", remaining.toString()).replace(\"{limit}\", limit.toString()).replace(\"{feature}\", label)}",
    content
)

with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'w') as f:
    f.write(content)
