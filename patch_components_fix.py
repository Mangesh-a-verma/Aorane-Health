import re

# Update LimitWarningToast.tsx
with open('artifacts/aorane-mobile/components/LimitWarningToast.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'import React\nimport { useLanguage } from "@/context/LanguageContext";, { useEffect, useRef } from "react";',
    'import React, { useEffect, useRef } from "react";\nimport { useLanguage } from "@/context/LanguageContext";'
)

with open('artifacts/aorane-mobile/components/LimitWarningToast.tsx', 'w') as f:
    f.write(content)

# Update AIUsageIndicator.tsx
with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'import { View, Text, StyleSheet }\nimport { useLanguage } from "@/context/LanguageContext";',
    'import { View, Text, StyleSheet } from "react-native";\nimport { useLanguage } from "@/context/LanguageContext";'
)

content = content.replace(
    '{t("aiUsageRemaining").replace("{remaining}", remaining.toString()).replace("{limit}", limit.toString()).replace("{feature}", label)}',
    '{t("aiUsageRemaining")?.replace("{remaining}", remaining.toString()).replace("{limit}", limit.toString()).replace("{feature}", label)}'
)
content = content.replace(
    '{"aiUsageRemaining")',
    't("aiUsageRemaining")' # just in case regex messed up
)

with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'w') as f:
    f.write(content)
