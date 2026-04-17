import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform, ActivityIndicator, Alert, KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";

const C = {
  bg: "#F5F8FF", card: "#FFFFFF", primary: "#C0392B",
  accent: "#E8622A", text: "#0D1F33", muted: "#7A90A4",
  border: "#E2EFF5", activeBg: "#FFF0EE", activeBorder: "#C0392B",
  green: "#10B981", amber: "#F59E0B",
};

// ─── Selector Component ────────────────────────────────────────────────────────
function Selector<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(opt.value); }}
            activeOpacity={0.8}
            style={[ss.chip, selected && ss.chipActive]}
          >
            {opt.icon ? <Text style={{ fontSize: 14 }}>{opt.icon}</Text> : null}
            <Text style={[ss.chipText, selected && ss.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Input Component ───────────────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType = "default",
  maxLength, unit,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: "default" | "numeric" | "decimal-pad";
  maxLength?: number; unit?: string;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={ss.label}>{label}</Text>
      <View style={ss.inputRow}>
        <TextInput
          style={ss.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          placeholderTextColor={C.muted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          returnKeyType="next"
        />
        {unit ? <Text style={ss.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

// ─── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={ss.card}>
      <View style={ss.cardHead}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
        <Text style={ss.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Personal
  const [fullName,       setFullName]       = useState("");
  const [gender,         setGender]         = useState("");
  const [dobDay,         setDobDay]         = useState("");
  const [dobMonth,       setDobMonth]       = useState("");
  const [dobYear,        setDobYear]        = useState("");

  // Physical
  const [heightCm,       setHeightCm]       = useState("");
  const [weightKg,       setWeightKg]       = useState("");
  const [bloodGroup,     setBloodGroup]     = useState("");

  // Location & Diet
  const [city,           setCity]           = useState("");
  const [state,          setState]          = useState("");
  const [foodPref,       setFoodPref]       = useState("");

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const res = await api.getProfile();
      const p = res.profile as Record<string, unknown>;
      // API returns snake_case from pool.query (full_name, height_cm, etc.)
      const fullNameVal = (p.full_name ?? p.fullName) as string | undefined;
      const genderVal = p.gender as string | undefined;
      const heightVal = (p.height_cm ?? p.heightCm) as string | undefined;
      const weightVal = (p.weight_kg ?? p.weightKg) as string | undefined;
      const bloodVal = (p.blood_group ?? p.bloodGroup) as string | undefined;
      const cityVal = p.city as string | undefined;
      const stateVal = p.state as string | undefined;
      const foodPrefVal = (p.food_preference ?? p.foodPreference) as string | undefined;
      const dobVal = (p.date_of_birth ?? p.dateOfBirth) as string | undefined;

      if (fullNameVal)  setFullName(fullNameVal);
      if (genderVal)    setGender(genderVal);
      if (heightVal)    setHeightCm(String(heightVal));
      if (weightVal)    setWeightKg(String(weightVal));
      if (bloodVal)     setBloodGroup(bloodVal);
      if (cityVal)      setCity(cityVal);
      if (stateVal)     setState(stateVal);
      if (foodPrefVal)  setFoodPref(foodPrefVal);
      if (dobVal) {
        const d = new Date(dobVal);
        if (!isNaN(d.getTime())) {
          setDobDay(String(d.getDate()).padStart(2, "0"));
          setDobMonth(String(d.getMonth() + 1).padStart(2, "0"));
          setDobYear(String(d.getFullYear()));
        }
      }
    } catch { }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Name Required", "Please enter your full name.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
      };
      if (gender)   payload.gender       = gender;
      if (heightCm) payload.heightCm     = Number(heightCm);
      if (weightKg) payload.weightKg     = Number(weightKg);
      if (bloodGroup) payload.bloodGroup = bloodGroup;
      if (city.trim()) payload.city      = city.trim();
      if (state.trim()) payload.state    = state.trim();
      if (foodPref) payload.foodPreference = foodPref;

      // Build DOB if all 3 parts provided
      if (dobDay && dobMonth && dobYear && dobYear.length === 4) {
        const dob = `${dobYear}-${dobMonth.padStart(2,"0")}-${dobDay.padStart(2,"0")}`;
        const d = new Date(dob);
        if (!isNaN(d.getTime()) && d < new Date()) {
          payload.dateOfBirth = dob;
        }
      }

      await api.updateProfile(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  const bmi = heightCm && weightKg
    ? (Number(weightKg) / Math.pow(Number(heightCm) / 100, 2)).toFixed(1)
    : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <LinearGradient
        colors={["#C0392B", "#E8622A"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[ss.header, { paddingTop: topPad + 10 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={ss.headerTitle}>Edit Profile</Text>
          <Text style={ss.headerSub}>Your personal health details</Text>
        </View>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={ss.saveBtn}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={ss.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 60, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── BMI Preview (if height+weight filled) ── */}
        {bmi && (
          <LinearGradient
            colors={["#C0392B20", "#E8622A10"]}
            style={{ borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#C0392B25" }}
          >
            <Text style={{ fontSize: 28 }}>⚖️</Text>
            <View>
              <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 16 }}>BMI: {bmi}</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                {Number(bmi) < 18.5 ? "Underweight — eat more nutritious food" :
                 Number(bmi) < 25   ? "Normal weight — great, keep it up! 🌟" :
                 Number(bmi) < 30   ? "Overweight — try daily 30 min walk" :
                                      "Obese — consult a doctor"}
              </Text>
            </View>
          </LinearGradient>
        )}

        {/* ── PERSONAL DETAILS ── */}
        <SectionCard title="Personal Details" icon="👤">
          <Field
            label="Full Name *"
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Rahul Sharma"
            maxLength={60}
          />

          <Text style={ss.label}>Gender</Text>
          <Selector
            value={gender}
            onChange={setGender}
            options={[
              { value: "male",   label: "Male",   icon: "👨" },
              { value: "female", label: "Female", icon: "👩" },
              { value: "other",  label: "Other",  icon: "🧑" },
            ]}
          />

          <View style={{ marginTop: 18 }}>
            <Text style={ss.label}>Date of Birth</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <View style={ss.inputRow}>
                  <TextInput
                    style={ss.input}
                    value={dobDay}
                    onChangeText={t => setDobDay(t.replace(/\D/g, "").slice(0, 2))}
                    placeholder="DD"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <Text style={ss.fieldHint}>Day</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={ss.inputRow}>
                  <TextInput
                    style={ss.input}
                    value={dobMonth}
                    onChangeText={t => setDobMonth(t.replace(/\D/g, "").slice(0, 2))}
                    placeholder="MM"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <Text style={ss.fieldHint}>Month</Text>
              </View>
              <View style={{ flex: 2 }}>
                <View style={ss.inputRow}>
                  <TextInput
                    style={ss.input}
                    value={dobYear}
                    onChangeText={t => setDobYear(t.replace(/\D/g, "").slice(0, 4))}
                    placeholder="YYYY"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
                <Text style={ss.fieldHint}>Year (e.g. 1990)</Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* ── PHYSICAL MEASUREMENTS ── */}
        <SectionCard title="Physical Measurements" icon="📏">
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Height"
                value={heightCm}
                onChangeText={t => setHeightCm(t.replace(/\D/g, ""))}
                placeholder="e.g. 170"
                keyboardType="numeric"
                maxLength={3}
                unit="cm"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Weight"
                value={weightKg}
                onChangeText={t => setWeightKg(t.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 68"
                keyboardType="decimal-pad"
                maxLength={5}
                unit="kg"
              />
            </View>
          </View>

          <Text style={ss.label}>Blood Group</Text>
          <Selector
            value={bloodGroup}
            onChange={setBloodGroup}
            options={[
              { value: "A+",  label: "A+" },
              { value: "A-",  label: "A-" },
              { value: "B+",  label: "B+" },
              { value: "B-",  label: "B-" },
              { value: "AB+", label: "AB+" },
              { value: "AB-", label: "AB-" },
              { value: "O+",  label: "O+" },
              { value: "O-",  label: "O-" },
            ]}
          />
          <Text style={{ color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8 }}>
            💡 Blood group is critical for emergency medical help — please fill this correctly
          </Text>
        </SectionCard>

        {/* ── LOCATION ── */}
        <SectionCard title="Location" icon="📍">
          <Field
            label="City"
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Mumbai"
            maxLength={50}
          />
          <Field
            label="State"
            value={state}
            onChangeText={setState}
            placeholder="e.g. Maharashtra"
            maxLength={50}
          />
        </SectionCard>

        {/* ── DIET PREFERENCE ── */}
        <SectionCard title="Diet Preference" icon="🥗">
          <Text style={{ color: C.muted, fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 }}>
            Used by AI to recommend meals and calculate calorie goals
          </Text>
          <Selector
            value={foodPref}
            onChange={setFoodPref}
            options={[
              { value: "veg",          label: "Vegetarian",   icon: "🥦" },
              { value: "nonveg",       label: "Non-Veg",      icon: "🍗" },
              { value: "vegan",        label: "Vegan",        icon: "🌱" },
              { value: "eggetarian",   label: "Eggetarian",   icon: "🥚" },
              { value: "jain",         label: "Jain",         icon: "🙏" },
            ]}
          />
        </SectionCard>

        <Text style={{ textAlign: "center", color: C.muted, fontSize: 11, fontFamily: "Inter_400Regular" }}>
          Your data is encrypted and stored securely. Only you can see it.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ss = StyleSheet.create({
  header:      { paddingHorizontal: 16, paddingBottom: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub:   { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular" },
  saveBtn:     { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 },

  card:      { backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, gap: 0 },
  cardHead:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },

  label:       { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 0 },
  fieldHint:   { fontSize: 10, color: C.muted, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" },

  inputRow:    { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: C.border, borderRadius: 12, backgroundColor: "#FAFCFF", marginTop: 8, overflow: "hidden" },
  input:       { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  unit:        { paddingHorizontal: 12, fontSize: 13, fontFamily: "Inter_700Bold", color: C.muted, backgroundColor: "#F0F4F8", alignSelf: "stretch", textAlignVertical: "center", paddingVertical: 13, borderLeftWidth: 1, borderLeftColor: C.border },

  chip:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, borderWidth: 1.5, borderColor: C.border, backgroundColor: "#FAFCFF" },
  chipActive:  { borderColor: C.primary, backgroundColor: C.activeBg },
  chipText:    { fontSize: 13, fontFamily: "Inter_500Medium", color: C.muted },
  chipTextActive: { color: C.primary, fontFamily: "Inter_700Bold" },

  saveBlock:     { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  saveBlockText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 17 },
});
