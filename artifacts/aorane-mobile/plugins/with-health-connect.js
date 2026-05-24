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

    // 1. Find MainActivity safely (prevent matching test activities)
    const activities = manifest.application?.[0]?.activity ?? [];
    const mainActivity = activities.find((a) => {
      const name = a.$?.["android:name"];
      return name && (name === ".MainActivity" || name.endsWith(".MainActivity"));
    }) ?? activities[0];

    if (mainActivity) {
      if (!mainActivity["intent-filter"]) {
        mainActivity["intent-filter"] = [];
      }

      const rationaleExists = mainActivity["intent-filter"].some((f) =>
        f.action?.some((a) => a.$?.["android:name"] === "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE")
      );

      if (!rationaleExists) {
        mainActivity["intent-filter"].push({
          action: [{ $: { "android:name": "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" } }],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        });
      }
    }

    // 2. Safe queries merge (prevent overwriting other plugins)
    if (!manifest.queries || !Array.isArray(manifest.queries)) {
      manifest.queries = [];
    }
    if (manifest.queries.length === 0) {
      manifest.queries.push({});
    }
    const q = manifest.queries[0];

    if (!Array.isArray(q.package)) q.package = [];
    ["com.google.android.apps.healthdata", "com.android.healthconnect.client"].forEach((pkg) => {
      if (!q.package.some((p) => p.$?.["android:name"] === pkg)) {
        q.package.push({ $: { "android:name": pkg } });
      }
    });

    if (!Array.isArray(q.intent)) q.intent = [];
    if (!q.intent.some((i) => i.data?.[0]?.$?.["android:scheme"] === "healthconnect")) {
      q.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": "healthconnect" } }],
      });
    }

    // 3. Permissions mapping (ensuring proper standard Android manifest names)
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

    HC_PERMISSIONS.forEach((perm) => {
      const androidPerm = permissionMap[perm];
      if (androidPerm && !manifest["uses-permission"].some((p) => p.$?.["android:name"] === androidPerm)) {
        manifest["uses-permission"].push({ $: { "android:name": androidPerm } });
      }
    });

    return config;
  });
};

module.exports = withHealthConnect;