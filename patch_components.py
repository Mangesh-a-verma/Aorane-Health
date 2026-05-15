import re

# Update LimitWarningToast.tsx
with open('artifacts/aorane-mobile/components/LimitWarningToast.tsx', 'r') as f:
    content = f.read()

content = content.replace('import React', 'import React\nimport { useLanguage } from "@/context/LanguageContext";')
content = content.replace(
    '  return (',
    '  const { t } = useLanguage();\n  return ('
)
content = content.replace(
    '`⚠️ Sirf ${remaining} ${featureLabel} baaki aaj!`;',
    't("limitWarningRemaining").replace("{remaining}", remaining.toString()).replace("{feature}", featureLabel);'
)
content = content.replace(
    '`⚠️ Aapke aaj ke saare ${featureLabel} khatam ho gaye!`;',
    't("limitWarningEmpty").replace("{feature}", featureLabel);'
)

with open('artifacts/aorane-mobile/components/LimitWarningToast.tsx', 'w') as f:
    f.write(content)

# Update AIUsageIndicator.tsx
with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'r') as f:
    content = f.read()

content = content.replace('import { View, Text, StyleSheet }', 'import { View, Text, StyleSheet }\nimport { useLanguage } from "@/context/LanguageContext";')
content = content.replace(
    'export function AIUsageIndicator({ used, limit, label = "AI Scans" }: { used: number; limit: number; label?: string }) {',
    'export function AIUsageIndicator({ used, limit, label = "AI Scans" }: { used: number; limit: number; label?: string }) {\n  const { t } = useLanguage();'
)

# Replace the text
content = re.sub(
    r"\{remaining\}/\{limit\} \{label\} baaki aaj",
    r"{t(\"aiUsageRemaining\").replace(\"{remaining}\", remaining.toString()).replace(\"{limit}\", limit.toString()).replace(\"{feature}\", label)}",
    content
)

with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'w') as f:
    f.write(content)
