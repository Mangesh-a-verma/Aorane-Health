import re

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'r') as f:
    content = f.read()

# Make WeatherPill and other sub-components memoized
content = content.replace(
    'function WeatherPill({',
    'const WeatherPill = React.memo(function WeatherPill({'
).replace(
    '}) {',
    '}) {'
)

# Wait, let's use regex to properly wrap WeatherPill, WeatherModal, QuickActionBtn
content = re.sub(
    r"function WeatherPill\(\{(.*?)\}: \{(.*?)\}\) \{",
    r"const WeatherPill = React.memo(function WeatherPill({\1}: {\2}) {",
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"function WeatherModal\(\{(.*?)\}: \{(.*?)\}\) \{",
    r"const WeatherModal = React.memo(function WeatherModal({\1}: {\2}) {",
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"function QuickActionBtn\(\{(.*?)\}: \{(.*?)\}\) \{",
    r"const QuickActionBtn = React.memo(function QuickActionBtn({\1}: {\2}) {",
    content,
    flags=re.DOTALL
)

# Fix closing parentheses for memo wraps by looking for the next function declaration or export default
# Actually, since it's a bit brittle to regex the end of a function, I will just do it safely via string replacements for specific known components.
