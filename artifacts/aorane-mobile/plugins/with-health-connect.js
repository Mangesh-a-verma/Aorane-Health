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

    // Add Health Connect intent-filter to main activity
    if (manifest.application?.[0]?.activity?.[0]) {
      const activity = manifest.application[0].activity[0];
      if (!activity["intent-filter"]) activity["intent-filter"] = [];

      const alreadyAdded = activity["intent-filter"].some((f) =>
        f.action?.some(
          (a) => a.$?.["android:name"] === "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"
        )
      );

      if (!alreadyAdded) {
        activity["intent-filter"].push({
          action: [
            {
              $: { "android:name": "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" },
            },
          ],
        });
      }
    }

    // Add Health Connect <queries> block for BOTH Android 13 and Android 14+
    if (!manifest.queries) manifest.queries = [];
    
    const hcPackages = [
      "com.google.android.apps.healthdata", // Android 13 and below
      "com.android.healthconnect.client"    // Android 14+
    ];

    hcPackages.forEach((pkgName) => {
      const queryExists = manifest.queries.some(
        (q) => q.package?.[0]?.$?.["android:name"] === pkgName
      );
      if (!queryExists) {
        manifest.queries.push({
          package: [{ $: { "android:name": pkgName } }],
          intent: [
            {
              action: [{ $: { "android:name": "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" } }],
            },
          ],
        });
      }
    });

    // Also add healthconnect:// scheme to queries so Linking.canOpenURL works
    const hcSchemeExists = manifest.queries.some(
      (q) => q.intent?.[0]?.data?.[0]?.$?.["android:scheme"] === "healthconnect"
    );
    if (!hcSchemeExists) {
      manifest.queries.push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
            data: [{ $: { "android:scheme": "healthconnect" } }],
          },
        ],
      });
    }

    // Add READ_* health permissions to manifest
    if (!manifest["uses-permission"]) manifest["uses-permission"] = [];
    const permissionMap = {
      Steps:                 "android.permission.health.READ_STEPS",
      HeartRate:             "android.permission.health.READ_HEART_RATE",
      TotalCaloriesBurned:   "android.permission.health.READ_TOTAL_CALORIES_BURNED",
      ActiveCaloriesBurned:  "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
      SleepSession:          "android.permission.health.READ_SLEEP",
      OxygenSaturation:      "android.permission.health.READ_OXYGEN_SATURATION",
      Distance:              "android.permission.health.READ_DISTANCE",
      ExerciseSession:       "android.permission.health.READ_EXERCISE",
    };

    for (const perm of HC_PERMISSIONS) {
      const androidPerm = permissionMap[perm];
      if (!androidPerm) continue;
      const exists = manifest["uses-permission"].some(
        (p) => p.$?.["android:name"] === androidPerm
      );
      if (!exists) {
        manifest["uses-permission"].push({ $: { "android:name": androidPerm } });
      }
    }

    return config;
  });
};

module.exports = withHealthConnect;