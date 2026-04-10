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
        body: `${medicine.medicineName}${medicine.dosage ? " " + medicine.dosage : ""} lene ka waqt ho gaya!${mealHint}`,
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

export async function scheduleHealthTipNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await checkNotificationPermissions();
  if (!granted) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🌿 AORANE Daily Health Tip",
        body: "Aaj ka health tip dekhne ke liye tap karein!",
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
