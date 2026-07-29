/**
 * lib/notifications.ts — Aorane Advanced Notification System v2.0
 *
 * Android + iOS dono ke liye fully working.
 *
 * BUGS FIXED vs old version:
 * 1. 24h cooldown removed — restoreAllNotifications ab har startup pe safe hai
 * 2. cancelAllScheduledNotifications REPLACED with atomic swap (cancel-then-schedule per type)
 * 3. cancelByType O(n) serial → Promise.allSettled parallel
 * 4. Per-medicine cancel by medicineId (not cancel-all)
 * 5. iOS: categoryIdentifier + action buttons registered
 * 6. parseTime() helper — safe HH:MM parsing with validation
 * 7. getScheduledNotificationSummary() — debug helper
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";

// ─── GLOBAL FOREGROUND HANDLER ───────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// ─── ANDROID CHANNELS ────────────────────────────────────────────────────────
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Promise.allSettled([
    Notifications.setNotificationChannelAsync("medicine", {
      name: "Medicine Reminders",
      description: "Daily medicine and dosage reminders",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    }),
    Notifications.setNotificationChannelAsync("water", {
      name: "Water Reminders",
      description: "Hydration reminders throughout the day",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      enableVibrate: true,
    }),
    Notifications.setNotificationChannelAsync("food", {
      name: "Meal Reminders",
      description: "Breakfast, lunch and dinner reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      enableVibrate: true,
    }),
    Notifications.setNotificationChannelAsync("period", {
      name: "Period Tracker",
      description: "Period cycle prediction alerts",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }),
    Notifications.setNotificationChannelAsync("general", {
      name: "General",
      description: "Health tips and general app notifications",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("health_score", {
      name: "Health Score",
      description: "Daily health score and achievement alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    }),
  ]);
}

// ─── PERMISSIONS ─────────────────────────────────────────────────────────────
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: false,
      provideAppNotificationSettings: true,
    },
  });
  return status === "granted";
}

export async function checkNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  return requestNotificationPermissions();
}

// ─── CANCEL HELPERS — Parallel ───────────────────────────────────────────────
async function cancelByType(type: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => (n.content.data as Record<string, unknown>)?.type === type);
  if (toCancel.length === 0) return;
  await Promise.allSettled(
    toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

async function cancelMedicineById(medicineId: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => {
    const d = n.content.data as Record<string, unknown>;
    return d?.type === "medicine_reminder" && d?.medicineId === medicineId;
  });
  if (toCancel.length === 0) return;
  await Promise.allSettled(
    toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

export const cancelWaterReminders    = () => cancelByType("water_reminder");
export const cancelFoodReminders     = () => cancelByType("food_reminder");
export const cancelPeriodReminders   = () => cancelByType("period_reminder");
export const cancelMedicineReminders = () => cancelByType("medicine_reminder");
export { cancelMedicineById };
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotificationSummary(): Promise<Record<string, number>> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const summary: Record<string, number> = {};
  for (const n of all) {
    const type = ((n.content.data as Record<string, unknown>)?.type as string) ?? "unknown";
    summary[type] = (summary[type] ?? 0) + 1;
  }
  return summary;
}

// ─── TIME HELPERS ─────────────────────────────────────────────────────────────
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const parts = timeStr.split(":").map(Number);
  if (parts.length !== 2) return null;
  const [hour, minute] = parts;
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// ─── MEDICINE REMINDERS ───────────────────────────────────────────────────────
export async function scheduleMedicineReminders(medicine: {
  medicineId: string;
  medicineName: string;
  dosage?: string;
  times: string[];
  mealTiming?: string;
}): Promise<string[]> {
  if (!(await ensurePermission())) return [];

  await cancelMedicineById(medicine.medicineId);

  const mealHintMap: Record<string, string> = {
    before_meal:   " (before meal)",
    after_meal:    " (after meal)",
    with_meal:     " (with meal)",
    empty_stomach: " (empty stomach)",
    bedtime:       " (at bedtime)",
  };
  const mealHint = medicine.mealTiming ? (mealHintMap[medicine.mealTiming] ?? "") : "";
  const scheduledIds: string[] = [];

  for (const timeStr of medicine.times) {
    const parsed = parseTime(timeStr);
    if (!parsed) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💊 Medicine Reminder",
        body:  `Time to take ${medicine.medicineName}${medicine.dosage ? " " + medicine.dosage : ""}!${mealHint}`,
        sound: true,
        ...(Platform.OS === "ios" ? { categoryIdentifier: "MEDICINE_REMINDER" } : {}),
        data: {
          type:       "medicine_reminder",
          medicineId: medicine.medicineId,
          screen:     "/(tabs)/medicine",
        },
      },
      trigger: {
        type:    SchedulableTriggerInputTypes.CALENDAR,
        hour:    parsed.hour,
        minute:  parsed.minute,
        repeats: true,
        ...(Platform.OS === "android" ? { channelId: "medicine" } : {}),
      },
    });

    scheduledIds.push(id);
  }

  return scheduledIds;
}

// ─── WATER REMINDERS ─────────────────────────────────────────────────────────
export async function scheduleWaterReminders(
  wakeUp  = "07:00",
  bedTime = "22:30",
  glasses = 8
): Promise<string[]> {
  if (!(await ensurePermission())) return [];

  await cancelWaterReminders();

  const wake = parseTime(wakeUp) ?? { hour: 7, minute: 0 };
  const bed  = parseTime(bedTime) ?? { hour: 22, minute: 30 };

  const wakeMinutes = wake.hour * 60 + wake.minute;
  const bedMinutes  = bed.hour  * 60 + bed.minute;
  const totalWindow = bedMinutes - wakeMinutes;

  if (totalWindow <= 0 || glasses <= 0) return [];

  const intervalMin  = Math.floor(totalWindow / glasses);
  const scheduledIds: string[] = [];

  for (let i = 0; i < glasses; i++) {
    const totalMin = wakeMinutes + intervalMin * i + Math.floor(intervalMin / 2);
    const hour     = Math.floor(totalMin / 60) % 24;
    const minute   = totalMin % 60;

    if (hour < 0 || hour > 23) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💧 Water Reminder",
        body:  `Drink a glass of water! (${i + 1}/${glasses} today)`,
        sound: true,
        data:  { type: "water_reminder", glass: i + 1, screen: "/(tabs)/dashboard" },
      },
      trigger: {
        type:    SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
        ...(Platform.OS === "android" ? { channelId: "water" } : {}),
      },
    });

    scheduledIds.push(id);
  }

  return scheduledIds;
}

// ─── FOOD / MEAL REMINDERS ───────────────────────────────────────────────────
export async function scheduleFoodReminders(
  wakeUp  = "07:00",
  _bedTime = "22:30"
): Promise<string[]> {
  if (!(await ensurePermission())) return [];

  await cancelFoodReminders();

  const wake      = parseTime(wakeUp) ?? { hour: 7, minute: 0 };
  const bfMinutes = Math.min(wake.hour * 60 + wake.minute + 60, 10 * 60);

  const meals = [
    { hour: Math.floor(bfMinutes / 60), minute: bfMinutes % 60, title: "🍳 Breakfast Time!", body: "Start your day right — have a healthy breakfast." },
    { hour: 13, minute: 0,  title: "🍱 Lunch Time!",  body: "Time for lunch — don't skip your midday meal."  },
    { hour: 19, minute: 30, title: "🌙 Dinner Time!", body: "Evening meal time — eat light and healthy."     },
  ];

  const scheduledIds: string[] = [];
  for (const meal of meals) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: meal.title,
        body:  meal.body,
        sound: true,
        data:  { type: "food_reminder", screen: "/(tabs)/food" },
      },
      trigger: {
        type:    SchedulableTriggerInputTypes.CALENDAR,
        hour:    meal.hour,
        minute:  meal.minute,
        repeats: true,
        ...(Platform.OS === "android" ? { channelId: "food" } : {}),
      },
    });
    scheduledIds.push(id);
  }

  return scheduledIds;
}

// ─── PERIOD REMINDERS ────────────────────────────────────────────────────────
export async function schedulePeriodReminders(dateStr: string): Promise<void> {
  if (!(await ensurePermission())) return;

  await cancelPeriodReminders();

  const [y, m, d] = dateStr.split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return;

  const base = new Date(y, m - 1, d, 9, 0, 0);
  const alerts = [
    { offset: -2, body: "Your period is expected in 2 days. Be prepared! 🌸" },
    { offset: -1, body: "Your period is expected tomorrow. Take care! 💕"    },
    { offset:  0, body: "Your period is expected today. Stay comfortable 💜"  },
  ];

  const now = Date.now();
  await Promise.allSettled(
    alerts.map(async ({ offset, body }) => {
      const fireDate = new Date(base);
      fireDate.setDate(fireDate.getDate() + offset);
      if (fireDate.getTime() <= now) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🌸 Period Reminder",
          body,
          sound: true,
          data:  { type: "period_reminder", screen: "/sleep" },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: fireDate,
          ...(Platform.OS === "android" ? { channelId: "period" } : {}),
        },
      });
    })
  );
}

// ─── iOS ACTION CATEGORIES ───────────────────────────────────────────────────
export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS !== "ios") return;
  await Notifications.setNotificationCategoryAsync("MEDICINE_REMINDER", [
    {
      identifier: "MARK_TAKEN",
      buttonTitle: "✅ Mark as Taken",
      options: { opensAppToForeground: false },
    },
    {
      identifier: "SNOOZE_15",
      buttonTitle: "⏰ Snooze 15 min",
      options: { opensAppToForeground: false },
    },
  ]);
}