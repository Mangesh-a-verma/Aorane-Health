// lib/wearableProviders.ts
//
// SINGLE SOURCE OF TRUTH for every wearable data source the app knows about:
// how it's named, how it's coloured, which platform it belongs to, and
// whether it is shipping yet.
//
// This replaces the PROVIDER_META map + ALLOWED_PROVIDERS list that used to
// live inside app/wearable.tsx, where turning a provider on meant editing two
// separate places that could drift apart.
//
// TO SHIP A PROVIDER LATER: flip its `status` to "live" and add its native
// module. Nothing else in the UI needs touching — the connect sheet, the
// device cards and the metric attribution all read from this list, so it
// renders exactly the same way Health Connect does today. The backend list in
// routes/modules/wearable.ts carries the same `status` field and must be
// flipped alongside it.

import { Platform } from "react-native";

export type ProviderId = "health_connect" | "apple_healthkit" | "samsung_health";
export type ProviderStatus = "live" | "planned";

export type WearableProvider = {
  /** A `ProviderId` for anything in the list below; for an unrecognised
   *  source (a "manual" row, or a provider added server-side before the app
   *  ships its entry) this is the raw id as stored, never a real provider's. */
  id: string;
  /** Full name, used in the connect sheet. */
  name: string;
  /** Compact name, used on device cards and metric attribution chips. */
  shortName: string;
  description: string;
  emoji: string;
  /** Brand colour for icons and accents. */
  color: string;
  /** Pale tint of `color`, for icon backgrounds. */
  soft: string;
  /** Two-stop gradient for the provider's icon tile. */
  grad: [string, string];
  platform: "android" | "ios";
  status: ProviderStatus;
  /** Minimum Android API level this provider's SDK can run on. Omitted when
   *  the provider works everywhere the app does.
   *
   *  This is not cosmetic. The Samsung Health Data SDK's AAR declares
   *  minSdkVersion 29 while this app ships minSdkVersion 26, and
   *  plugins/with-samsung-health.js uses tools:overrideLibrary to let the two
   *  merge — which means Gradle no longer protects us. Loading a
   *  com.samsung.android.sdk.health class below API 29 is a hard crash, so
   *  keeping those users away from it is now entirely this check's job. */
  minAndroidApi?: number;
};

export const WEARABLE_PROVIDERS: WearableProvider[] = [
  {
    id: "health_connect",
    name: "Health Connect",
    shortName: "Health Connect",
    description: "Steps, heart rate, sleep, SpO2 and calories from any Android wearable",
    emoji: "🤖",
    color: "#0B6E4F",
    soft: "#E6F4EF",
    grad: ["#0B6E4F", "#1B998B"],
    platform: "android",
    status: "live",
  },
  {
    id: "samsung_health",
    name: "Samsung Health",
    shortName: "Samsung Health",
    description: "Galaxy Watch and Galaxy Fit",
    emoji: "💙",
    color: "#1428A0",
    soft: "#E4EAF8",
    grad: ["#00A8E0", "#1428A0"],
    platform: "android",
    status: "planned",
    // Samsung Health Data SDK 1.1.0 — see native-libs/samsung-health/README.md.
    minAndroidApi: 29,
  },
  {
    id: "apple_healthkit",
    name: "Apple Health",
    shortName: "Apple Health",
    description: "Apple Watch and every iOS health app, via HealthKit",
    emoji: "❤️",
    color: "#FF3B30",
    soft: "#FEE9E8",
    grad: ["#FF3B30", "#FF6B6B"],
    platform: "ios",
    status: "planned",
  },
];

const FALLBACK: WearableProvider = {
  id: "unknown",
  name: "Unknown source",
  shortName: "Unknown",
  description: "",
  emoji: "📱",
  color: "#0B84D6",
  soft: "#DBF0FB",
  grad: ["#0B84D6", "#38B6FF"],
  platform: "android",
  status: "planned",
};

/** Metadata for a provider id, including ids not in the list (e.g. "manual"
 *  rows written by hand). Never returns undefined. */
export function providerMeta(id: string): WearableProvider {
  // Carry the requested id through, so an unknown source is never silently
  // relabelled as whichever provider the fallback happened to be built from.
  return WEARABLE_PROVIDERS.find((p) => p.id === id) ?? { ...FALLBACK, id, shortName: id, name: id };
}

/** True if this device's OS is new enough for the provider's SDK.
 *  Android reports Platform.Version as the numeric API level; iOS reports a
 *  version string, and no iOS provider declares a minimum, so it never
 *  applies there. An unreadable version is treated as too old — refusing to
 *  offer a provider is recoverable, crashing on an unsupported device is not. */
export function meetsOsRequirement(p: WearableProvider): boolean {
  if (p.minAndroidApi === undefined) return true;
  if (Platform.OS !== "android") return false;
  const api = typeof Platform.Version === "number" ? Platform.Version : Number(Platform.Version);
  return Number.isFinite(api) && api >= p.minAndroidApi;
}

/** Providers to actually render right now: shipping, for this platform, and
 *  supported by this device's OS version. Today that is Health Connect on
 *  Android and nothing on iOS — which is honest, rather than showing an Apple
 *  Health card that cannot connect. */
export function visibleProviders(): WearableProvider[] {
  return WEARABLE_PROVIDERS.filter(
    (p) => p.status === "live" && p.platform === Platform.OS && meetsOsRequirement(p)
  );
}

// ── Data-origin attribution ───────────────────────────────────────────────────
//
// On Android, Samsung Health (and Fitbit, Garmin, Mi Fitness…) write their
// data INTO Health Connect rather than exposing a separate sync API — which
// is why "connect Samsung Health" is mostly an attribution problem, not a
// second integration. Health Connect stamps every record with the package that
// wrote it (`metadata.dataOrigin`, a plain package-name string), so a reading
// can be credited to the app it really came from instead of a flat
// "Health Connect".
//
// Wired up: lib/health/aggregate.ts resolveDataSource() picks the dominant
// origin out of a sync batch, syncManager sends it, and the server stores it
// on wearable_data.source_package.
export const ORIGIN_PACKAGE_LABELS: Record<string, string> = {
  "com.sec.android.app.shealth": "Samsung Health",
  "com.fitbit.FitbitMobile": "Fitbit",
  "com.garmin.android.apps.connectmobile": "Garmin",
  "com.xiaomi.wearable": "Mi Fitness",
  "com.huawei.health": "Huawei Health",
  "com.google.android.apps.fitness": "Google Fit",
  // Health Connect itself is the origin on rows the user typed into the
  // Health Connect app by hand, rather than any wearable's app.
  "com.google.android.apps.healthdata": "Health Connect",
};

/** Human label for whichever app originally recorded a reading, falling back
 *  to the syncing provider's own name. */
export function originLabel(originPackage: string | null | undefined, fallbackProviderId: string): string {
  if (originPackage && ORIGIN_PACKAGE_LABELS[originPackage]) return ORIGIN_PACKAGE_LABELS[originPackage];
  return providerMeta(fallbackProviderId).shortName;
}
