import re

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'r') as f:
    content = f.read()

# Make WeatherPill memoized
replacement_wp = """const WeatherPill = React.memo(function WeatherPill({
  weather, loading, onPress,
}: { weather: WeatherInfo | null; loading: boolean; onPress: () => void }) {
  if (loading) {
    return (
      <TouchableOpacity style={wp.pill} onPress={onPress} activeOpacity={0.85}>
        <ActivityIndicator size="small" color="#FFF" style={{ width: 16, height: 16 }} />
        <Text style={wp.pillTxt}>Loading weather…</Text>
      </TouchableOpacity>
    );
  }
  if (!weather) {
    return (
      <TouchableOpacity style={[wp.pill, { backgroundColor: "rgba(0,0,0,0.35)" }]} onPress={onPress} activeOpacity={0.85}>
        <Text style={wp.pillEmoji}>🌤️</Text>
        <Text style={wp.pillTxt}>Tap for weather</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={wp.pill} onPress={onPress} activeOpacity={0.85}>
      <Text style={wp.pillEmoji}>{weather.emoji}</Text>
      <Text style={wp.pillTxt}>{weather.temp}°C · {weather.city}</Text>
    </TouchableOpacity>
  );
});"""
content = re.sub(
    r"function WeatherPill\(\{\n  weather, loading, onPress,\n\}: \{ weather: WeatherInfo \| null; loading: boolean; onPress: \(\) => void \}\) \{.*?  \);\n\}",
    replacement_wp,
    content,
    flags=re.DOTALL
)

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'w') as f:
    f.write(content)
