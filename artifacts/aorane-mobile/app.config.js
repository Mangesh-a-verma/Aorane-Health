// This file wraps app.json (Expo automatically loads app.json as the base
// config and passes it in as `config` below — nothing in app.json changes).
//
// Why this file exists:
// google-services.json is gitignored (never pushed to GitHub for safety).
// For local builds, the file sitting in this folder is used directly.
// For EAS cloud builds, the file is instead pulled from the EAS Secret
// named GOOGLE_SERVICES_JSON — EAS injects it as a temp file path into the
// GOOGLE_SERVICES_JSON environment variable automatically during the build.

module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
    },
  };
};