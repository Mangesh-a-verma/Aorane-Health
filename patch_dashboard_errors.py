import re

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'r') as f:
    content = f.read()

# Add Alert to imports if missing
content = content.replace("ActivityIndicator, Animated, Modal, StatusBar,", "ActivityIndicator, Animated, Modal, StatusBar, Alert,")

# Replace empty catch block in addWater
content = content.replace(
"""    try {
      await api.logWater({ glassesCount: 1 });
      setWater((w) => ({ ...w, current: Math.min(w.current + 1, w.goal) }));
    } catch { }""",
"""    try {
      await api.logWater({ glassesCount: 1 });
      setWater((w) => ({ ...w, current: Math.min(w.current + 1, w.goal) }));
    } catch (e: unknown) {
      Alert.alert("Failed to log water", (e as Error)?.message || "Please check your network and try again.");
    }"""
)

# Replace empty catch in stress
content = content.replace(
"""    try {
      await api.logStress({ stressScore: score, stressType: "quick_checkin", mood: QUICK_MOODS.find(m => m.score === score)?.label?.toLowerCase() || "okay" });
      onSaved();
      onClose();
    } catch { } finally { setSaving(false); setSelected(null); }""",
"""    try {
      await api.logStress({ stressScore: score, stressType: "quick_checkin", mood: QUICK_MOODS.find(m => m.score === score)?.label?.toLowerCase() || "okay" });
      onSaved();
      onClose();
    } catch (e: unknown) {
      Alert.alert("Failed to save stress check-in", (e as Error)?.message || "Please try again.");
    } finally { setSaving(false); setSelected(null); }"""
)

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'w') as f:
    f.write(content)
