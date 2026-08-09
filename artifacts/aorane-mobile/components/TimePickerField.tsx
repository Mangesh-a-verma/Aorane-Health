/**
 * components/TimePickerField.tsx
 *
 * AUDIT FIX (Phase 0 — root cause #1):
 * The medicine "reminder time" field used to be a free-text TextInput
 * (placeholder "08:00") with zero validation anywhere in the chain. A user
 * typing "8am", "8", "25:99" etc. would save fine to the backend, but
 * lib/notifications.ts's parseTime() would silently refuse to schedule that
 * time — with the app still showing "✅ Reminder set!". This was the most
 * likely cause of "notification kabhi aaya hi nahi" reports.
 *
 * This component replaces the free-text field with a proper scroll-wheel
 * time picker (hour 00–23, minute in 5-min steps) that can ONLY ever produce
 * a valid "HH:MM" 24-hour string — there is no code path to an invalid value.
 *
 * Deliberately built with plain React Native primitives (View/ScrollView/
 * TouchableOpacity/Modal) instead of a native picker library — no new native
 * dependency, so no EAS rebuild / native-module compatibility risk.
 */
import React, { useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DS } from "@/lib/theme";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00,05,...,55

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Strict 24h "HH:MM" check — the single source of truth for validity here. */
export function isValidHHMM(t: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);
}

function Wheel({
  values, selected, onSelect, formatter,
}: {
  values: number[]; selected: number; onSelect: (v: number) => void; formatter: (v: number) => string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const initialIndex = Math.max(0, values.indexOf(selected));

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.min(values.length - 1, Math.max(0, Math.round(y / ITEM_HEIGHT)));
    onSelect(values[index]);
  };

  return (
    <View style={{ height: WHEEL_HEIGHT, width: 90 }}>
      {/* Selection highlight band */}
      <View pointerEvents="none" style={[styles.selectionBand, { top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }]} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }}
        contentOffset={{ x: 0, y: initialIndex * ITEM_HEIGHT }}
      >
        {values.map((v) => (
          <TouchableOpacity
            key={v}
            style={{ height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" }}
            activeOpacity={0.6}
            onPress={() => {
              const index = values.indexOf(v);
              scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
              onSelect(v);
            }}
          >
            <Text style={[styles.wheelText, v === selected && styles.wheelTextSelected]}>
              {formatter(v)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function TimePickerField({
  label, value, onChange, accentColor,
}: {
  label: string;
  /** Must always be a valid "HH:MM" 24h string, e.g. "08:00" */
  value: string;
  onChange: (next: string) => void;
  accentColor?: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);

  const safeValue = isValidHHMM(value) ? value : "08:00";
  const [h, m] = useMemo(() => safeValue.split(":").map(Number), [safeValue]);

  // Snap minute selection to nearest 5-min step for the wheel (display only —
  // does not silently corrupt a value the user picked outside this UI).
  const nearestMinuteStep = MINUTES.reduce((best, cur) =>
    Math.abs(cur - m) < Math.abs(best - m) ? cur : best, MINUTES[0]);

  const [draftHour, setDraftHour] = useState(h);
  const [draftMinute, setDraftMinute] = useState(nearestMinuteStep);

  const open = () => {
    setDraftHour(h);
    setDraftMinute(nearestMinuteStep);
    setModalVisible(true);
  };

  const confirm = () => {
    const next = `${pad2(draftHour)}:${pad2(draftMinute)}`;
    // Defense in depth — this can never actually be false given the wheel
    // values above, but we never want a code path that can call onChange
    // with something scheduleMedicineReminders() can't parse.
    if (isValidHHMM(next)) onChange(next);
    setModalVisible(false);
  };

  const accent = accentColor ?? DS.color.primary;

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={open} activeOpacity={0.8}>
        <Ionicons name="time-outline" size={18} color={accent} />
        <Text style={styles.fieldValue}>{safeValue}</Text>
        <Ionicons name="chevron-forward" size={16} color={DS.color.muted} />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4 }}>
              <Wheel values={HOURS} selected={draftHour} onSelect={setDraftHour} formatter={pad2} />
              <Text style={styles.colon}>:</Text>
              <Wheel values={MINUTES} selected={draftMinute} onSelect={setDraftMinute} formatter={pad2} />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: accent }]} onPress={confirm}>
                <Text style={styles.btnText}>Set Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 6, marginTop: 4 },
  field: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: DS.color.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: DS.color.bgCard,
  },
  fieldValue: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: DS.color.text },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  sheet: { backgroundColor: "#FFF", borderRadius: 20, padding: 20, width: 280, alignItems: "center" },
  sheetTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: DS.color.text, marginBottom: 12 },
  selectionBand: {
    position: "absolute", left: 0, right: 0, height: ITEM_HEIGHT,
    backgroundColor: DS.color.bgSoft, borderRadius: 10,
  },
  wheelText: { fontSize: 18, fontFamily: "Inter_400Regular", color: DS.color.muted },
  wheelTextSelected: { fontFamily: "Inter_700Bold", color: DS.color.text, fontSize: 20 },
  colon: { fontSize: 20, fontFamily: "Inter_700Bold", color: DS.color.text, marginHorizontal: 2 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: DS.color.bgSoft },
  btnGhostText: { fontFamily: "Inter_600SemiBold", color: DS.color.textSub, fontSize: 14 },
  btnText: { fontFamily: "Inter_700Bold", color: "#FFF", fontSize: 14 },
});
