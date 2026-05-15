import re

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'r') as f:
    content = f.read()

# Make SummaryBanner memoized safely without changing styles
content = re.sub(
    r"function SummaryBanner\(\{ greeting, healthScore, calories, water, exerciseMin, activityPct, trends \}: \{(.*?)\}\) \{",
    r"const SummaryBanner = React.memo(function SummaryBanner({ greeting, healthScore, calories, water, exerciseMin, activityPct, trends }: {\1}) {",
    content,
    flags=re.DOTALL
)

# Replace the end of SummaryBanner
content = content.replace(
"""        ))}
      </View>
    </LinearGradient>
  );
}
const bn = StyleSheet.create({""",
"""        ))}
      </View>
    </LinearGradient>
  );
});
const bn = StyleSheet.create({"""
)

# Make WeatherPill memoized
content = re.sub(
    r"function WeatherPill\(\{(.*?)\}: \{(.*?)\}\) \{",
    r"const WeatherPill = React.memo(function WeatherPill({\1}: {\2}) {",
    content,
    flags=re.DOTALL
)

content = content.replace(
"""      <Text style={wp.pillEmoji}>{weather.emoji}</Text>
      <Text style={wp.pillTxt}>{weather.temp}°C · {weather.city}</Text>
    </TouchableOpacity>
  );
}

function WeatherModal""",
"""      <Text style={wp.pillEmoji}>{weather.emoji}</Text>
      <Text style={wp.pillTxt}>{weather.temp}°C · {weather.city}</Text>
    </TouchableOpacity>
  );
});

function WeatherModal"""
)

# Make WeatherModal memoized
content = re.sub(
    r"function WeatherModal\(\{(.*?)\}: \{(.*?)\}\) \{",
    r"const WeatherModal = React.memo(function WeatherModal({\1}: {\2}) {",
    content,
    flags=re.DOTALL
)

content = content.replace(
"""        </LinearGradient>
      </TouchableOpacity>
    </Modal>
  );
}

const wp = StyleSheet.create({""",
"""        </LinearGradient>
      </TouchableOpacity>
    </Modal>
  );
});

const wp = StyleSheet.create({"""
)


with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'w') as f:
    f.write(content)
