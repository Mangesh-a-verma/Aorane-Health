import re

with open('artifacts/aorane-mobile/lib/translations.ts', 'r') as f:
    content = f.read()

# Add a type mapping
if "limitWarningRemaining:" not in content:
    content = content.replace(
        "type TranslationMap = {",
        "type TranslationMap = {\n  limitWarningRemaining: string;\n  limitWarningEmpty: string;\n  aiUsageRemaining: string;"
    )

# Add to English dictionary
if "limitWarningRemaining:" not in content:
    content = content.replace(
        "en: {",
        "en: {\n    limitWarningRemaining: '⚠️ Only {remaining} {feature} remaining today!',\n    limitWarningEmpty: '⚠️ You have used all your {feature} today!',\n    aiUsageRemaining: '{remaining}/{limit} {feature} remaining today',"
    )

with open('artifacts/aorane-mobile/lib/translations.ts', 'w') as f:
    f.write(content)
