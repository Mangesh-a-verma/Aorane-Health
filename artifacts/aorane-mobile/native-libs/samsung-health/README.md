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
