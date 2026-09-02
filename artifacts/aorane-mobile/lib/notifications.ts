/**
 * lib/notifications.ts — Aorane Notification System v4.0
 *
 * READ THIS BEFORE CHANGING A TRIGGER (v4.0):
 *
 * Every recurring reminder in this app was dead on Android for months, and no
 * log line ever said so. The cause was one enum:
 *
 *   SchedulableTriggerInputTypes.CALENDAR is iOS-ONLY.
 *
 * The Android native module's trigger decoder handles exactly
 * timeInterval / date / daily / weekly / monthly / yearly / channel, and ends
 * with `else -> throw InvalidArgumentException("Trigger of type: $type is not
 * supported on Android.")`. So every scheduleNotificationAsync() call using
 * CALENDAR rejected — medicine, water and food, all three — while
 * Promise.allSettled and a few empty catch blocks swallowed the rejection.
 * Nothing crashed, nothing was logged, and two previous fix passes went to
 * other parts of this file without touching the line that mattered.
 *
 * For a daily repeating reminder use DAILY ({ type, hour, minute, channelId }).
 * hour and minute MUST be numbers (a string throws), 0-23 and 0-59. DAILY has
 * no `repeats` field; it repeats by definition.
 *
 * The rejections are now reported through logSilentError (see
 * reportSettled in app/_layout.tsx), so this cannot go quiet again.
 *
 * BUGS FIXED in the earlier pass (v3.1):
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

// ─── DIAGNOSTICS (Phase 0 — "is a notification actually going to fire?") ────
//
// Root-cause verification for "notification on time nahi aata": knowing the
// scheduling *code* ran is not the same as knowing the OS will actually fire
// it at the right time. This combines getAllScheduledNotificationsAsync()
// (what's currently scheduled) with getNextTriggerDateAsync() (when the OS
// will actually next fire each one) so a real answer — not a guess — can be
// given for "kab aayega" / "aaya kyun nahi".
export type NotificationDiagnosticEntry = {
  id: string;
  type: string;
  title: string;
  channelId?: string;
  /** Epoch ms of the next OS-scheduled fire time, or null if the OS couldn't resolve it (a strong signal something is wrong with that trigger). */
  nextTriggerAt: number | null;
  nextTriggerAtLabel: string;
};

export async function getNotificationDiagnostics(): Promise<{
  permissionGranted: boolean;
  entries: NotificationDiagnosticEntry[];
}> {
  const { status } = await Notifications.getPermissionsAsync();
  const permissionGranted = status === "granted";

  const all = await Notifications.getAllScheduledNotificationsAsync();
  const entries: NotificationDiagnosticEntry[] = await Promise.all(
    all.map(async (n) => {
      const data = n.content.data as Record<string, unknown>;
      let nextTriggerAt: number | null = null;
      try {
        // NotificationRequest.trigger (resolved) is a structural superset of
        // SchedulableNotificationTriggerInput for CALENDAR/DATE triggers —
        // cast defensively since this is read-only diagnostic code.
        nextTriggerAt = await Notifications.getNextTriggerDateAsync(
          n.trigger as unknown as Parameters<typeof Notifications.getNextTriggerDateAsync>[0]
        );
      } catch {
        nextTriggerAt = null;
      }
      return {
        id: n.identifier,
        type: (data?.type as string) ?? "unknown",
        title: n.content.title ?? "(no title)",
        channelId: (n.trigger as unknown as { channelId?: string })?.channelId,
        nextTriggerAt,
        nextTriggerAtLabel: nextTriggerAt
          ? new Date(nextTriggerAt).toLocaleString()
          : "⚠️ Could not resolve — OS may not fire this reliably",
      };
    })
  );

  entries.sort((a, b) => (a.nextTriggerAt ?? Infinity) - (b.nextTriggerAt ?? Infinity));
  return { permissionGranted, entries };
}

// ─── TIME HELPERS ─────────────────────────────────────────────────────────────
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const parts = timeStr.split(":").map(Number);
  if (parts.length !== 2) return null;
  const [hour, minute] = parts;
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** "07:30,12:30,19:30" → [{hour,minute},…]. Invalid entries are dropped, and a
 *  list with nothing valid in it returns [] so the caller can fall back to its
 *  derived times rather than scheduling nothing. */
function parseTimeList(list?: string | null): { hour: number; minute: number }[] {
  if (typeof list !== "string" || !list.trim()) return [];
  return list.split(",")
    .map((part) => parseTime(part.trim()))
    .filter((t): t is { hour: number; minute: number } => t !== null)
    .sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
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
        type:   SchedulableTriggerInputTypes.DAILY,
        hour:   parsed.hour,
        minute: parsed.minute,
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
  glasses = 8,
  /** The user's own reminder times, from user_preferences.water_reminder_times.
   *  That column has existed (and been editable through the API) since the
   *  beginning, but nothing on the device ever read it — the app always spread
   *  reminders evenly instead. When it is set, it wins. */
  explicitTimes?: string | null,
): Promise<string[]> {
  if (!(await ensurePermission())) return [];

  await cancelWaterReminders();

  const chosen = parseTimeList(explicitTimes);

  let slots: { hour: number; minute: number }[];
  if (chosen.length > 0) {
    slots = chosen;
  } else {
    // No stored times — keep the original evenly-spread behaviour.
    const wake = parseTime(wakeUp) ?? { hour: 7, minute: 0 };
    const bed  = parseTime(bedTime) ?? { hour: 22, minute: 30 };
    const wakeMinutes = wake.hour * 60 + wake.minute;
    const bedMinutes  = bed.hour  * 60 + bed.minute;
    const totalWindow = bedMinutes - wakeMinutes;
    if (totalWindow <= 0 || glasses <= 0) return [];

    const intervalMin = Math.floor(totalWindow / glasses);
    slots = [];
    for (let i = 0; i < glasses; i++) {
      const totalMin = wakeMinutes + intervalMin * i + Math.floor(intervalMin / 2);
      slots.push({ hour: Math.floor(totalMin / 60) % 24, minute: totalMin % 60 });
    }
  }

  // Only the evenly-spread path has one reminder per glass, so only there can
  // the body honestly count "3/8". With the user's own times the two numbers
  // are unrelated, and claiming otherwise would be wrong on every tap.
  const countsGlasses = chosen.length === 0;
  const scheduledIds: string[] = [];

  for (let i = 0; i < slots.length; i++) {
    const { hour, minute } = slots[i];
    if (hour < 0 || hour > 23) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💧 Water Reminder",
        body:  countsGlasses
          ? `Drink a glass of water! (${i + 1}/${glasses} today)`
          : `Time for a glass of water — today's goal is ${glasses} glasses.`,
        sound: true,
        data:  { type: "water_reminder", glass: i + 1, screen: "/(tabs)/dashboard" },
      },
      trigger: {
        type:   SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === "android" ? { channelId: "water" } : {}),
      },
    });

    scheduledIds.push(id);
  }

  return scheduledIds;
}

// ─── FOOD / MEAL REMINDERS ───────────────────────────────────────────────────
const MEAL_LABELS = [
  { title: "🍳 Breakfast Time!", body: "Start your day right — have a healthy breakfast." },
  { title: "🍱 Lunch Time!",     body: "Time for lunch — don't skip your midday meal."    },
  { title: "🌙 Dinner Time!",    body: "Evening meal time — eat light and healthy."       },
];

export async function scheduleFoodReminders(
  wakeUp  = "07:00",
  _bedTime = "22:30",
  /** The user's own meal times, from user_preferences.food_reminder_time.
   *  Nobody eats lunch at the same hour — this column has always been there
   *  and editable, but the app hardcoded lunch at 13:00 and dinner at 19:30
   *  and never looked at it. When it is set, it wins. */
  mealTimes?: string | null,
): Promise<string[]> {
  if (!(await ensurePermission())) return [];

  await cancelFoodReminders();

  const chosen = parseTimeList(mealTimes);

  let slots: { hour: number; minute: number }[];
  if (chosen.length > 0) {
    slots = chosen;
  } else {
    // No stored times — keep the original behaviour: breakfast an hour after
    // waking (never later than 10:00), then the old fixed lunch and dinner.
    const wake      = parseTime(wakeUp) ?? { hour: 7, minute: 0 };
    const bfMinutes = Math.min(wake.hour * 60 + wake.minute + 60, 10 * 60);
    slots = [
      { hour: Math.floor(bfMinutes / 60), minute: bfMinutes % 60 },
      { hour: 13, minute: 0 },
      { hour: 19, minute: 30 },
    ];
  }

  // Slots are sorted by time, so the first three are breakfast/lunch/dinner.
  // A user who wants a fourth (a night shift, a late supper) gets a neutral
  // label rather than a second "Dinner".
  const meals = slots.map((slot, i) => ({
    ...slot,
    ...(MEAL_LABELS[i] ?? { title: "🍽️ Meal Time!", body: "Time for your next meal." }),
  }));

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
        type:   SchedulableTriggerInputTypes.DAILY,
        hour:   meal.hour,
        minute: meal.minute,
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
 * Opens this app's page in the system Settings.
 *
 * This is the only way back once Android has stopped showing the permission
 * dialog. After two denials (or a "Don't allow" on Android 13+),
 * requestPermissionsAsync() returns "denied" immediately WITHOUT any dialog —
 * so an in-app "Allow notifications" button silently does nothing, forever.
 * The user has to flip the switch in Settings, and the app has to take them
 * there.
 */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Linking.openSettings();
  } catch {
    // Nothing else to try — the caller already tells the user the path.
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