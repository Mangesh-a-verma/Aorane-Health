import re

with open('artifacts/aorane-mobile/lib/translations.ts', 'r') as f:
    content = f.read()

# Make sure we add these keys to other languages, or at least a subset so typescript doesn't complain
# TypeScript might complain if TranslationMap doesn't have it in ALL language records, since it's a strict type. Let's make sure it's added. Actually, since translations is a Record<LangCode, TranslationMap>, all objects must implement it.
# To avoid updating 10 languages manually here, let's use a dynamic getter in the components or make the TranslationMap properties optional?
# Wait, let's just make them optional in TranslationMap!

content = content.replace(
    "type TranslationMap = {",
    "type TranslationMap = {\n  limitWarningRemaining?: string;\n  limitWarningEmpty?: string;\n  aiUsageRemaining?: string;"
)

with open('artifacts/aorane-mobile/lib/translations.ts', 'w') as f:
    f.write(content)
