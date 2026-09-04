# Samsung Health Data SDK — vendored AAR

`samsung-health-data-api-1.1.0.aar`
sha256 `f5d3d83cf00b97d0bb1b1db4da076e861eb1c3e6e704d89a34e68909d2f38654`

## Why it is committed

Samsung does not publish this SDK to Maven Central, JitPack or any other
repository. The only distribution channel is a zip downloaded by hand from a
signed-in Samsung Developer account, so there is nothing for Gradle to resolve
and the binary has to live in the repo. `plugins/with-samsung-health.js` copies
it into `android/app/libs/` during prebuild (`android/` is gitignored).

## What it is

The **Samsung Health Data SDK**, successor to the Samsung Health SDK that was
deprecated on 31 July 2025. Verified by decompiling the AAR rather than trusting
the docs (which ship as redirect stubs to developer.samsung.com):

- Entry point `HealthDataService.getStore(context)` -> `HealthDataStore`
- Kotlin `suspend` API plus Java-friendly `*Async` variants returning
  `AsyncSingleFuture`
- 25 data types, of which these are **not available through Health Connect**
  and are the reason this integration exists at all:
  `SLEEP.SESSIONS` (per-interval Awake/Light/Deep/REM stages) and
  `SLEEP.SLEEP_SCORE`, `SLEEP_APNEA`,
  `IRREGULAR_HEART_RHYTHM_NOTIFICATION`, `SKIN_TEMPERATURE`,
  `BODY_COMPOSITION`, `ENERGY_SCORE`, `FLOORS_CLIMBED`
- Health Connect already gives us plain heart rate and total sleep duration,
  and has since lib/health/types.ts was written — Samsung adds granularity,
  not those metrics.

## Constraints this imposes

1. **`minSdkVersion 29`** in the AAR's own manifest, against the app's 26.
   The config plugin sets `tools:overrideLibrary` so the merge succeeds, and
   the SDK is gated at runtime instead — Android 8/9 users keep the app, they
   just never see Samsung Health offered.
2. **Runtime dependency on the Samsung Health app.** The SDK binds to
   `com.sec.android.app.shealth` over the `com.samsung.android.sdk.health.data.BIND`
   service and verifies Samsung Health's signing certificate. If the app is
   missing, disabled, or too old to expose that service, every call throws
   before any data is read.
3. **No transitive dependencies.** A flat-file AAR carries no POM, so anything
   it needs — Kotlin coroutines — must be declared by us.

## Updating

Download the new zip from the Samsung Developer portal, replace the AAR,
update the filename in `plugins/with-samsung-health.js` and the hash above.

## Status: parked, not in the build

The plugin exists, is tested, and is **deliberately not registered in
`app.json`**. Nothing here is abandoned — it is waiting on Samsung.

**Why.** A production release needs Samsung partner approval (package name +
the release key's SHA-256 registered in Samsung's system), and Samsung's
Partner Apps Program was reported as not accepting applications when this was
built, with no published timeline. Registering the plugin meanwhile would ship
a ~500KB AAR and the Kotlin coroutines runtime into every APK with no native
module to use them, and would put an untested Gradle dependency into the next
EAS build for no user-visible gain.

**What already ships without any of this.** Health Connect gives us heart rate
and total sleep duration today, and `lib/health/aggregate.ts`'s
`resolveDataSource()` credits Samsung Health by name when a Galaxy Watch is
what wrote the records. What is still missing is only the granularity the
Samsung SDK adds: sleep stages, sleep score, apnea and IHRN.

## Re-enabling

Two edits to `artifacts/aorane-mobile/app.json`. Both are needed — the second
is easy to forget, and forgetting it produces a release build that works in
debug and fails at run time.

1. Add `"./plugins/with-samsung-health.js"` to `expo.plugins`, next to
   `"./plugins/with-health-connect.js"`.

2. Append these to `expo-build-properties` -> `android.extraProguardRules`.
   `enableMinifyInReleaseBuilds` is true, and Gradle does **not** apply a flat
   AAR's bundled consumer ProGuard rules, so without them R8 renames classes
   the SDK resolves by name across its AIDL boundary to Samsung Health:

   ```
   -keep public class com.samsung.android.sdk.health.data.** { public protected *; }
   -keep public class com.samsung.android.sdk.health.data.data.entries.** { <fields>; public protected *; }
   -keep public class com.samsung.android.sdk.health.data.request.** { <fields>; public protected *; }
   -keep @interface com.samsung.android.sdk.health.data.internal.annotation.ApiVersion
   -keepclassmembers class * {
       @com.samsung.android.sdk.health.data.internal.annotation.ApiVersion <methods>;
   }
   -dontwarn com.samsung.android.sdk.health.data.**
   ```

Then continue from S3 (the native Kotlin module) — S1 and S2 are done.

## Testing before approval arrives

Approval gates **distribution**, not development. Samsung Health's developer
mode grants **read** access with no partner request and no access code, which
is all this app needs — we never write to Samsung Health. On a Galaxy device:
Samsung Health -> ⋮ -> Settings -> About Samsung Health -> tap the version line
10+ times -> enable "Developer Mode for Data Read".

`tool/DataViewer_1.1.0.apk` in Samsung's zip is their own test client; running
it on the device confirms developer mode works before any of our code is
written.
