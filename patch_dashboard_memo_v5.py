import re

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'r') as f:
    content = f.read()

# Make SummaryBanner memoized
content = re.sub(
    r"function SummaryBanner\(\{ greeting, healthScore, calories, water, exerciseMin, activityPct, trends \}: \{(.*?)\}\) \{",
    r"const SummaryBanner = React.memo(function SummaryBanner({ greeting, healthScore, calories, water, exerciseMin, activityPct, trends }: {\1}) {",
    content,
    flags=re.DOTALL
)
# Close it
content = content.replace(
    '          <Text style={sb.tVal}>{trends.healthScore.amount > 0 ? "+" : ""}{trends.healthScore.amount} pts</Text>\n        </View>\n      )}</View>\n    </View>\n  );\n}',
    '          <Text style={sb.tVal}>{trends.healthScore.amount > 0 ? "+" : ""}{trends.healthScore.amount} pts</Text>\n        </View>\n      )}</View>\n    </View>\n  );\n});'
)


with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'w') as f:
    f.write(content)
