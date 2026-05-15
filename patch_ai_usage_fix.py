import re

with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'export function AIUsageIndicator({ used, limit, label = "scans", iconName = "scan-outline", compact = false }: Props) {\n  if (limit >= 999) return null;',
    'export function AIUsageIndicator({ used, limit, label = "scans", iconName = "scan-outline", compact = false }: Props) {\n  const { t } = useLanguage();\n  if (limit >= 999) return null;'
)

content = content.replace(
    '{t(\\\"aiUsageRemaining\\\")?.replace(\\\"{remaining}\\\", remaining.toString()).replace(\\\"{limit}\\\", limit.toString()).replace(\\\"{feature}\\\", label)}',
    '{t("aiUsageRemaining")?.replace("{remaining}", remaining.toString()).replace("{limit}", limit.toString()).replace("{feature}", label)}'
)

with open('artifacts/aorane-mobile/components/AIUsageIndicator.tsx', 'w') as f:
    f.write(content)
