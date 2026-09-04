const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require("expo/config-plugins");

// The vendored SDK. Samsung publishes it to no Maven repository at all — see
// native-libs/samsung-health/README.md — so it ships as a file in this repo
// and is copied into the (gitignored) android/ tree at prebuild.
const AAR_FILE = "samsung-health-data-api-1.1.0.aar";
const AAR_SOURCE = path.join("native-libs", "samsung-health", AAR_FILE);

// The AAR's own package name. Needed verbatim by tools:overrideLibrary below.
const SDK_PACKAGE = "com.samsung.android.sdk.health.data";

// Samsung Health itself, and its Wear companion. Android 11+ hides other
// installed packages unless they are declared here, and the SDK cannot even
// detect whether Samsung Health exists without this.
const SAMSUNG_PACKAGES = [
  "com.sec.android.app.shealth",
  "com.samsung.android.wear.shealth",
];

/** Copy the vendored AAR into android/app/libs/ on every prebuild. android/ is
 *  gitignored and regenerated, so this cannot be a one-off manual step. */
const copyAar = (config) =>
  withDangerousMod(config, [
    "android",
    (config) => {
      const source = path.join(config.modRequest.projectRoot, AAR_SOURCE);
      if (!fs.existsSync(source)) {
        // Fail loudly at prebuild rather than at link time with an
        // unresolved-symbol error thousands of lines into a Gradle log.
        throw new Error(
          `[with-samsung-health] Vendored SDK missing at ${AAR_SOURCE}. ` +
            `Restore it from the Samsung Developer portal zip — see ` +
            `native-libs/samsung-health/README.md.`
        );
      }
      const destDir = path.join(config.modRequest.platformProjectRoot, "app", "libs");
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(source, path.join(destDir, AAR_FILE));
      return config;
    },
  ]);

/** Declare the AAR as a dependency, plus the coroutines runtime it needs.
 *
 *  A flat-file AAR carries no POM, so Gradle resolves none of its transitive
 *  dependencies. The SDK's entire public API is Kotlin `suspend` functions, so
 *  without an explicit coroutines dependency it compiles and then throws
 *  NoClassDefFoundError on the first call. */
const addGradleDependency = (config) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        "[with-samsung-health] Expected a Groovy app/build.gradle; got " +
          config.modResults.language
      );
    }
    let contents = config.modResults.contents;

    const marker = "// samsung-health-data-sdk";
    if (contents.includes(marker)) return config;

    const block = `
dependencies {
    ${marker} — vendored, see native-libs/samsung-health/README.md
    implementation files("libs/${AAR_FILE}")
    // The AAR has no POM, so nothing pulls these in for us. The SDK's API is
    // entirely Kotlin suspend functions and it binds to Samsung Health over a
    // service, both of which need the coroutines runtime present at run time.
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1"
}
`;
    config.modResults.contents = contents + block;
    return config;
  });

const modifyManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // ── The minSdk conflict ────────────────────────────────────────────────
    // The AAR declares minSdkVersion 29; this app is 26. Without an override
    // the manifest merger aborts the whole build:
    //   "uses-sdk:minSdkVersion 26 cannot be smaller than version 29 declared
    //    in library [com.samsung.android.sdk.health.data]"
    //
    // Raising the app to 29 would drop every Android 8 and 9 user to ship a
    // Samsung-only feature, which is a bad trade. Overriding instead lets the
    // library merge into a lower-minSdk app; keeping those users safe is then
    // OUR job, at runtime — nothing may touch a com.samsung.android.sdk.health
    // class below API 29. lib/wearableProviders.ts enforces that before the
    // provider is ever offered, and the native module repeats the check.
    if (!manifest.$) manifest.$ = {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    if (!Array.isArray(manifest["uses-sdk"])) manifest["uses-sdk"] = [{ $: {} }];
    if (manifest["uses-sdk"].length === 0) manifest["uses-sdk"].push({ $: {} });
    const usesSdk = manifest["uses-sdk"][0];
    if (!usesSdk.$) usesSdk.$ = {};

    const existing = usesSdk.$["tools:overrideLibrary"];
    const overrides = new Set(
      (existing ? String(existing).split(",") : []).map((s) => s.trim()).filter(Boolean)
    );
    overrides.add(SDK_PACKAGE);
    usesSdk.$["tools:overrideLibrary"] = [...overrides].join(",");

    // ── Package visibility ────────────────────────────────────────────────
    // Merged into the same <queries> block with-health-connect.js writes,
    // rather than replacing it — both plugins run and neither owns the block.
    if (!Array.isArray(manifest.queries)) manifest.queries = [];
    if (manifest.queries.length === 0) manifest.queries.push({});
    const q = manifest.queries[0];

    if (!Array.isArray(q.package)) q.package = [];
    for (const pkg of SAMSUNG_PACKAGES) {
      if (!q.package.some((p) => p.$?.["android:name"] === pkg)) {
        q.package.push({ $: { "android:name": pkg } });
      }
    }

    return config;
  });

const withSamsungHealth = (config) => {
  config = copyAar(config);
  config = addGradleDependency(config);
  config = modifyManifest(config);
  return config;
};

module.exports = withSamsungHealth;
