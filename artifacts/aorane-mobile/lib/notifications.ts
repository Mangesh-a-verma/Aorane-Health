/**
 * lib/notifications.ts — Aorane Advanced Notification System v3.1
 *
 * Android + iOS dono ke liye fully working.
 *
 * BUGS FIXED in this pass (v3.1):
 * 1. This is now the ONLY place that calls setNotificationHandler — the
 *    duplicate registration in app/_layout.tsx has been removed. Having two
 *    handlers meant one silently overrode the other with a different config.
 * 2. Dead "health_score" Android channel removed — nothing ever scheduled
 *    into it. "general" is KEPT because backend-triggered push notifications
 *    (family reminders etc.) rely on it as the app's defaultChannel.
 * 3. NEW: requestExactAlarmPermission() + requestIgnoreBatteryOptimizations()
 *    — Android 12+ (and MIUI/ColorOS/FuntouchOS OEMs in particular) will
 *    silently defer/batch scheduled local notifications unless the app is
 *    exempted from Doze/App-Standby and has exact-alarm scheduling rights.
 *    This is very likely why notifications "sabhi ek saath aa jaate the jab
 *    app open karte the" — the OS was holding pending alarms and flushing
 *    them together when the app came to foreground.
 *
 * BUGS FIXED vs old (v2.0) version:
 * 1. 24h cooldown removed — restoreAllNotifications ab har startup pe safe hai
 * 2. cancelAllScheduledNotifications REPLACED with atomic swap (cancel-then-schedule per type)
 * 3. cancelByType O(n) serial → Promise.allSettled parallel
 * 4. Per-medicine cancel by medicineId (not cancel-all)
 * 5. iOS: categoryIdentifier + action buttons registered
 * 6. parseTime() helper — safe HH:MM parsing with validation
 * 7. getScheduledNotificationSummary() — debug helper
 */

import { Platform, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";

// ─── GLOBAL FOREGROUND HANDLER ───────────────────────────────────────────────
// NOTE: This is the ONLY setNotificationHandler call in the whole app.
// Do NOT add another one in app/_layout.tsx or anywhere else — the last one
// registered silently wins and the other becomes dead code.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
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

/**
 * ONE-TIME MIGRATION CLEANUP — fixes existing users' accumulated duplicates.
 *
 * BUG BEING FIXED: medicine reminders used to be scheduled with a
 * *name-derived* id (e.g. "medicine_paracetamol") when a medicine was first
 * added, but cancelled/rescheduled everywhere else using the *backend* id
 * (e.g. "medicine_60f7a1..."). Since these never matched, the old name-based
 * notification was never cancelled — every app restart added a fresh
 * backend-id-based copy on top, without ever removing the earlier one(s).
 * Over days/weeks this is exactly what produced "40-50 notifications at once".
 *
 * This function removes any scheduled `medicine_reminder` notification whose
 * `medicineId` does NOT match one of the currently-valid backend-id-based
 * ids. It is safe to call on every restore — once cleaned, there is nothing
 * left to remove, so it becomes effectively a no-op.
 */
export async function cleanupOrphanMedicineNotifications(validMedicineIds: string[]): Promise<number> {
  const validSet = new Set(validMedicineIds);
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const orphans = all.filter((n) => {
    const d = n.content.data as Record<string, unknown>;
    return d?.type === "medicine_reminder" && !validSet.has(d?.medicineId as string);
  });
  if (orphans.length === 0) return 0;
  await Promise.allSettled(
    orphans.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  return orphans.length;
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

// ─── ANDROID DELIVERY RELIABILITY (Doze / OEM battery managers) ──────────────
//
// WHY THIS EXISTS:
// On stock Android 12+, and especially on MIUI (Xiaomi), ColorOS (Oppo),
// FuntouchOS (Vivo) and OriginOS/Realme UI, a scheduled local notification
// can be silently held by the OS's Doze/App-Standby power management and
// only delivered once the app is opened again — which looks exactly like
// "sab notifications ek saath aa gaye jab app open kiya". Two separate
// system permissions reduce this:
//   1. SCHEDULE_EXACT_ALARM (Android 12+) — lets our alarms fire at the
//      exact requested time instead of being bucketed into OS-controlled
//      maintenance windows.
//   2. Battery optimization exemption — stops the OS from freezing/killing
//      the app's scheduled work in the background.
// Both require an explicit user action via a system settings screen; they
// cannot be silently auto-granted. These helpers open the correct screen
// using RN's built-in Android intent support (no extra native module).

/** Returns true if we're on an Android version that gained SCHEDULE_EXACT_ALARM restrictions (API 31 / Android 12+). */
function isAndroid12Plus(): boolean {
  if (Platform.OS !== "android") return false;
  const v = Platform.Version; // numeric API level on Android
  return typeof v === "number" && v >= 31;
}

/**
 * Opens the system screen where the user can grant "Alarms & reminders"
 * (exact alarm) permission for this app. No-op on iOS / pre-Android-12.
 * Wrapped in try/catch — if the OEM doesn't support this intent, we fail
 * silently rather than crash.
 */
export async function requestExactAlarmPermission(): Promise<void> {
  if (!isAndroid12Plus()) return;
  try {
    await Linking.sendIntent?.("android.settings.REQUEST_SCHEDULE_EXACT_ALARM");
  } catch {
    // Some OEM ROMs don't support this intent — silently ignore.
  }
}

/**
 * Opens the system dialog asking the user to exempt Aorane from battery
 * optimization, so scheduled reminders aren't deferred by Doze/App-Standby.
 * No-op on iOS.
 */
export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Linking.sendIntent?.("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS");
  } catch {
    try {
      // Fallback: generic battery optimization list screen (works on more OEMs
      // than the direct per-app request intent).
      await Linking.sendIntent?.("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
    } catch {
      // Give up silently — worst case, reminders stay slightly less reliable
      // on that specific device, nothing crashes.
    }
  }
}

/**
 * Convenience: call both reliability prompts back-to-back. Intended to be
 * triggered from a clear, contextual user action (e.g. "Fix delayed
 * notifications" button in Settings, or right after adding the first
 * medicine) — NOT blindly during onboarding, since two system dialogs in a
 * row with no context is a fast way to get both denied.
 */
export async function improveAndroidNotificationReliability(): Promise<void> {
  if (Platform.OS !== "android") return;
  await requestExactAlarmPermission();
  await requestIgnoreBatteryOptimizations();
}