import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function checkNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export interface MedicineReminderPayload {
  medicineId: string;
  medicineName: string;
  dosage?: string;
  times: string[];
  mealTiming?: string;
}

export async function scheduleMedicineReminders(
  medicine: MedicineReminderPayload
): Promise<string[]> {
  if (Platform.OS === "web") return [];
  const granted = await checkNotificationPermissions();
  if (!granted) return [];

  await cancelMedicineReminders(medicine.medicineId);

  const ids: string[] = [];
  for (const time of medicine.times) {
    const [hour, minute] = time.split(":").map(Number);
    if (isNaN(hour) || isNaN(minute)) continue;

    const mealHint =
      medicine.mealTiming === "before_meal"
        ? " (khaane se pehle)"
        : medicine.mealTiming === "after_meal"
        ? " (khaane ke baad)"
        : medicine.mealTiming === "with_meal"
        ? " (khaane ke saath)"
        : "";

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💊 Medicine Reminder",
        body: `Time to take ${medicine.medicineName}${medicine.dosage ? " " + medicine.dosage : ""}!${mealHint}`,
        sound: true,
        data: {
          medicineId: medicine.medicineId,
          type: "medicine_reminder",
          time,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    ids.push(id);
  }
  return ids;
}

export async function cancelMedicineReminders(medicineId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if ((n.content.data as Record<string, unknown>)?.medicineId === medicineId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch { }
}

export async function cancelAllMedicineReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if ((n.content.data as Record<string, unknown>)?.type === "medicine_reminder") {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch { }
}

// ─── Food / Meal Reminders ────────────────────────────────────────────────────
// Schedules breakfast, lunch, and dinner reminders.
export async function scheduleFoodReminders(
  wakeUpTime = "07:00",
  bedTime = "22:30",
): Promise<string[]> {
  if (Platform.OS === "web") return [];
  const granted = await checkNotificationPermissions();
  if (!granted) return [];

  await cancelByType("food_reminder");

  const [wakeH] = wakeUpTime.split(":").map(Number);
  // Derive meals from wake time; cap at sensible max hours
  const meals: Array<{ hour: number; minute: number; label: string; body: string }> = [
    { hour: Math.min(wakeH + 1, 10), minute: 0,  label: "🍳 Breakfast Time!",    body: "Time for a healthy breakfast — fuel your day right!" },
    { hour: 13,                      minute: 0,  label: "🍱 Lunch Time!",        body: "Noon meal reminder — log your food in Aorane after eating." },
    { hour: 19,                      minute: 30, label: "🌙 Dinner Time!",       body: "Evening reminder — eat light and healthy for better sleep." },
  ];

  const [bedH, bedM] = bedTime.split(":").map(Number);
  const bedTotalMins = bedH * 60 + bedM;

  const ids: string[] = [];
  for (const meal of meals) {
    if (meal.hour * 60 + meal.minute >= bedTotalMins) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: meal.label,
          body: meal.body,
          sound: true,
          data: { type: "food_reminder" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: meal.hour,
          minute: meal.minute,
        },
      });
      ids.push(id);
    } catch { }
  }
  return ids;
}

export async function cancelFoodReminders(): Promise<void> {
  await cancelByType("food_reminder");
}

export async function scheduleHealthTipNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await checkNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🌿 Aorane Daily Health Tip",
        body: "Tap to see today's health tip!",
        sound: true,
        data: { type: "health_tip" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });
  } catch { }
}

export async function sendImmediateNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await checkNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: data || {} },
      trigger: null,
    });
  } catch { }
}

export async function getAllScheduledMedicineReminders(): Promise<
  Array<{ id: string; medicineName: string; time: string }>
> {
  if (Platform.OS === "web") return [];
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all
      .filter((n) => (n.content.data as Record<string, unknown>)?.type === "medicine_reminder")
      .map((n) => ({
        id: n.identifier,
        medicineName: (n.content.data as Record<string, unknown>)?.medicineName as string || "",
        time: (n.content.data as Record<string, unknown>)?.time as string || "",
      }));
  } catch {
    return [];
  }
}

// ─── Cancel all notifications of a given type ─────────────────────────────────
async function cancelByType(type: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if ((n.content.data as Record<string, unknown>)?.type === type) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch { }
}

// ─── Water Reminders ──────────────────────────────────────────────────────────
// Schedules one notification every ~2 hours between wakeUpTime and bedTime.
export async function scheduleWaterReminders(
  wakeUpTime = "07:00",
  bedTime = "22:30",
  goalGlasses = 8,
): Promise<string[]> {
  if (Platform.OS === "web") return [];
  const granted = await checkNotificationPermissions();
  if (!granted) return [];

  await cancelByType("water_reminder");

  const [wakeH, wakeM] = wakeUpTime.split(":").map(Number);
  const [bedH, bedM] = bedTime.split(":").map(Number);
  const wakeMinutes = wakeH * 60 + wakeM;
  const bedMinutes = bedH * 60 + bedM;
  const spanMinutes = Math.max(bedMinutes - wakeMinutes, 60);

  const count = Math.min(Math.max(goalGlasses, 4), 12);
  const intervalMinutes = Math.floor(spanMinutes / count);

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const totalMins = wakeMinutes + intervalMinutes * i + 30;
    const hour = Math.floor(totalMins / 60) % 24;
    const minute = totalMins % 60;
    if (hour >= bedH) break;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "💧 Water Reminder",
          body: `Time to drink water! Stay hydrated — ${i + 1} of ${count} glasses today.`,
          sound: true,
          data: { type: "water_reminder", glass: i + 1 },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      ids.push(id);
    } catch { }
  }
  return ids;
}

export async function cancelWaterReminders(): Promise<void> {
  await cancelByType("water_reminder");
}

// ─── Period Reminders ─────────────────────────────────────────────────────────
// Schedules 3 one-time notifications: 2 days before, 1 day before, and on the predicted period date.
export async function schedulePeriodReminders(nextPeriodDateStr: string): Promise<string[]> {
  if (Platform.OS === "web") return [];
  const granted = await checkNotificationPermissions();
  if (!granted) return [];

  await cancelByType("period_reminder");

  const ids: string[] = [];
  const nextDate = new Date(nextPeriodDateStr + "T09:00:00");
  if (isNaN(nextDate.getTime())) return [];

  const alerts: Array<{ daysOffset: number; title: string; body: string }> = [
    { daysOffset: -2, title: "🌸 Period Expected Soon", body: "Your period is expected in 2 days. Stay comfortable and prepared." },
    { daysOffset: -1, title: "🌸 Period Expected Tomorrow", body: "Your period is likely starting tomorrow. Take care of yourself!" },
    { daysOffset:  0, title: "🌸 Period May Start Today",  body: "Your cycle may begin today. Remember to stay hydrated and rest well." },
  ];

  const now = new Date();
  for (const alert of alerts) {
    const fireDate = new Date(nextDate);
    fireDate.setDate(fireDate.getDate() + alert.daysOffset);
    if (fireDate <= now) continue;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: alert.title,
          body: alert.body,
          sound: true,
          data: { type: "period_reminder", daysOffset: alert.daysOffset },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
        },
      });
      ids.push(id);
    } catch { }
  }
  return ids;
}

export async function cancelPeriodReminders(): Promise<void> {
  await cancelByType("period_reminder");
}
