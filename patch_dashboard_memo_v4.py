import re

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'r') as f:
    content = f.read()

replacement_wm = """const WeatherModal = React.memo(function WeatherModal({
  weather, visible, onClose,
}: { weather: WeatherInfo | null; visible: boolean; onClose: () => void }) {
  if (!weather) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={wm.overlay} activeOpacity={1} onPress={onClose}>
        <View style={wm.card} onStartShouldSetResponder={() => true}>
          <TouchableOpacity style={wm.close} onPress={onClose}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          <Text style={wm.emoji}>{weather.emoji}</Text>
          <Text style={wm.temp}>{weather.temp}°C</Text>
          <Text style={wm.desc}>{weather.description} in {weather.city}</Text>
          <View style={wm.grid}>
            <View style={wm.cell}><Text style={wm.cLbl}>Feels Like</Text><Text style={wm.cVal}>{weather.feelsLike}°C</Text></View>
            <View style={wm.cell}><Text style={wm.cLbl}>Humidity</Text><Text style={wm.cVal}>{weather.humidity}%</Text></View>
            <View style={wm.cell}><Text style={wm.cLbl}>Wind</Text><Text style={wm.cVal}>{weather.windspeed} km/h</Text></View>
          </View>
          <View style={wm.tipWrap}>
            <Text style={wm.tipLbl}>💡 Health Tip</Text>
            <Text style={wm.tipTxt}>{weather.healthTip}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});"""
content = re.sub(
    r"function WeatherModal\(\{\n  weather, visible, onClose,\n\}: \{ weather: WeatherInfo \| null; visible: boolean; onClose: \(\) => void \}\) \{.*?  \);\n\}",
    replacement_wm,
    content,
    flags=re.DOTALL
)

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'w') as f:
    f.write(content)
