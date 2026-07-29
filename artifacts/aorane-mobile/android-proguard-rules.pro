# Aorane Health — Custom ProGuard Rules
# These are applied during release APK/AAB builds via expo-build-properties
# (enableProguardInReleaseBuilds: true is already set in app.json)

# ── Keep React Native internals ──────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.swmansion.** { *; }

# ── Expo modules ─────────────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class host.exp.** { *; }

# ── expo-notifications ───────────────────────────────────────────────────────
-keep class expo.modules.notifications.** { *; }

# ── Health Connect ───────────────────────────────────────────────────────────
-keep class androidx.health.connect.** { *; }

# ── Razorpay / payment ───────────────────────────────────────────────────────
-keep class com.razorpay.** { *; }

# ── Firebase (type-only stub — still need proguard in case any aar lands) ───
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# ── Pino logger ──────────────────────────────────────────────────────────────
# (server-side only — not needed in APK, but safe to keep)
-dontwarn org.slf4j.**

# ── Hermes JS engine ─────────────────────────────────────────────────────────
-keep class com.facebook.jni.** { *; }