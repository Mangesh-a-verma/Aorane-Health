const { withAndroidManifest } = require("@expo/config-plugins");

const HC_PERMISSIONS = [
  "Steps",
  "HeartRate", 
  "TotalCaloriesBurned",
  "ActiveCaloriesBurned",
  "SleepSession",
  "OxygenSaturation",
  "Distance",
  "ExerciseSession",
];

const withHealthConnect = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // FIX 1: Find MAIN activity correctly
    const activities = manifest.application?.[0]?.activity ?? [];
    
    // Find MainActivity specifically
    const mainActivity = activities.find((a) =>
      a.$?.["android:name"]?.includes("MainActivity") ||
      a["intent-filter"]?.some((f) =>
        f.action?.some(
          (a) => a.$?.["android:name"] === "android.intent.action.MAIN"
        )
      )
    ) ?? activities[0];

    if (mainActivity) {
      if (!mainActivity["intent-filter"]) {
        mainActivity["intent-filter"] = [];
      }

      // Add Health Connect permission rationale
      const alreadyAdded = mainActivity["intent-filter"].some((f) =>
        f.action?.some(
          (a) =>
            a.$?.["android:name"] ===
            "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"
        )
      );

      if (!alreadyAdded) {
        mainActivity["intent-filter"].push({
          action: [
            {
              $: {
                "android:name":
                  "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE",
              },
            },
          ],
        });
      }
    }

    // FIX 2: Queries block — safe merge
    if (!Array.isArray(manifest.queries)) {
      manifest.queries = [{}];
    }
    if (!manifest.queries[0]) manifest.queries[0] = {};
    const q = manifest.queries[0];

    // Packages
    if (!Array.isArray(q.package)) q.package = [];
    [
      "com.google.android.apps.healthdata",
      "com.android.healthconnect.client",
    ].forEach((pkg) => {
      if (!q.package.some((p) => p.$?.["android:name"] === pkg)) {
        q.package.push({ $: { "android:name": pkg } });
      }
    });

    // Intent scheme
    if (!Array.isArray(q.intent)) q.intent = [];
    if (!q.intent.some((i) => i.data?.[0]?.$?.["android:scheme"] === "healthconnect")) {
      q.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": "healthconnect" } }],
      });
    }

    // FIX 3: Permissions — use correct tag
    if (!Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = [];
    }

    const permissionMap = {
      Steps: "android.permission.health.READ_STEPS",
      HeartRate: "android.permission.health.READ_HEART_RATE",
      TotalCaloriesBurned: "android.permission.health.READ_TOTAL_CALORIES_BURNED",
      ActiveCaloriesBurned: "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
      SleepSession: "android.permission.health.READ_SLEEP",
      OxygenSaturation: "android.permission.health.READ_OXYGEN_SATURATION",
      Distance: "android.permission.health.READ_DISTANCE",
      ExerciseSession: "android.permission.health.READ_EXERCISE",
    };

    for (const perm of HC_PERMISSIONS) {
      const androidPerm = permissionMap[perm];
      if (!androidPerm) continue;
      if (!manifest["uses-permission"].some(
        (p) => p.$?.["android:name"] === androidPerm
      )) {
        manifest["uses-permission"].push({
          $: { "android:name": androidPerm },
        });
      }
    }

    return config;
  });
};

module.exports = withHealthConnect;