import { DS } from "@/lib/theme";

const P = DS.color.primary;

// ── Exercise Categories ────────────────────────────────────────────────────────
export type Category = "All" | "Cardio" | "Strength" | "Yoga" | "Sports";

export const EXERCISE_LIST: { name: string; icon: string; color: string; category: Exclude<Category, "All"> }[] = [
  // ── Cardio ──
  { name: "Walking",       icon: "walk",               color: "#34C759", category: "Cardio"   },
  { name: "Running",       icon: "run-fast",            color: "#FF3B30", category: "Cardio"   },
  { name: "Cycling",       icon: "bike",                color: "#FF9500", category: "Cardio"   },
  { name: "Swimming",      icon: "swim",                color: "#32ADE6", category: "Cardio"   },
  { name: "Skipping",      icon: "jump-rope",           color: "#FF9500", category: "Cardio"   },
  { name: "HIIT",          icon: "fire",                color: "#FF3B30", category: "Cardio"   },
  { name: "Treadmill",     icon: "run",                 color: "#34C759", category: "Cardio"   },
  { name: "Elliptical",    icon: "skiing",              color: "#5856D6", category: "Cardio"   },
  { name: "Rowing",        icon: "rowing",              color: "#32ADE6", category: "Cardio"   },
  { name: "Stair Climbing",icon: "stairs",              color: "#FF6B35", category: "Cardio"   },
  { name: "Dancing",       icon: "dance-ballroom",      color: "#FF2D55", category: "Cardio"   },
  { name: "Zumba",         icon: "music",               color: "#FF2D55", category: "Cardio"   },
  // ── Strength / Gym ──
  { name: "Weight Training",icon: "weight-lifter",      color: "#5856D6", category: "Strength" },
  { name: "Bench Press",   icon: "dumbbell",            color: "#7C3AED", category: "Strength" },
  { name: "Squats",        icon: "human-handsdown",     color: "#EF4444", category: "Strength" },
  { name: "Deadlifts",     icon: "weight",              color: "#DC2626", category: "Strength" },
  { name: "Shoulder Press",icon: "arm-flex",            color: "#6366F1", category: "Strength" },
  { name: "Bicep Curls",   icon: "arm-flex-outline",    color: "#8B5CF6", category: "Strength" },
  { name: "Pull-ups",      icon: "human-handsup",       color: "#0284C7", category: "Strength" },
  { name: "Push-ups",      icon: "human",               color: "#0369A1", category: "Strength" },
  { name: "Lunges",        icon: "human-male",          color: "#7C3AED", category: "Strength" },
  { name: "Plank",         icon: "yoga",                color: "#059669", category: "Strength" },
  { name: "Leg Press",     icon: "seat",                color: "#DC2626", category: "Strength" },
  { name: "Lat Pulldown",  icon: "cable-data",          color: "#2563EB", category: "Strength" },
  { name: "Cable Rows",    icon: "weight-lifter",       color: "#1D4ED8", category: "Strength" },
  { name: "Tricep Dips",   icon: "arm-flex",            color: "#7C3AED", category: "Strength" },
  // ── Yoga / Flexibility ──
  { name: "Yoga",          icon: "yoga",                color: "#AF52DE", category: "Yoga"     },
  { name: "Pilates",       icon: "human-handsdown",     color: "#AF52DE", category: "Yoga"     },
  { name: "Surya Namaskar",icon: "weather-sunny",       color: "#FF9500", category: "Yoga"     },
  // ── Sports ──
  { name: "Cricket",       icon: "cricket",             color: "#34C759", category: "Sports"   },
  { name: "Badminton",     icon: "badminton",           color: P,          category: "Sports"   },
  { name: "Football",      icon: "soccer",              color: "#34C759", category: "Sports"   },
  { name: "Basketball",    icon: "basketball",          color: "#FF9500", category: "Sports"   },
  { name: "Volleyball",    icon: "volleyball",          color: "#F59E0B", category: "Sports"   },
  { name: "Climbing",      icon: "slope-uphill",        color: "#FF9500", category: "Sports"   },
];

export const STEPS_EXERCISES = new Set(["Walking", "Running", "Treadmill", "Stair Climbing"]);
export const STRENGTH_EXERCISES = new Set([
  "Weight Training","Bench Press","Squats","Deadlifts","Shoulder Press",
  "Bicep Curls","Pull-ups","Push-ups","Lunges","Plank","Leg Press",
  "Lat Pulldown","Cable Rows","Tricep Dips",
]);

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "All",      label: "All",      icon: "all-inclusive"   },
  { key: "Cardio",   label: "Cardio",   icon: "run-fast"        },
  { key: "Strength", label: "Gym",      icon: "dumbbell"        },
  { key: "Yoga",     label: "Yoga",     icon: "yoga"            },
  { key: "Sports",   label: "Sports",   icon: "soccer"          },
];

export const INTENSITIES: { value: string; label: string; softBg: string; softColor: string; hint: string }[] = [
  { value: "light",    label: "Light 🚶",    softBg: DS.color.greenSoft,  softColor: DS.color.green,  hint: "You can talk and sing easily" },
  { value: "moderate", label: "Moderate 🚴", softBg: DS.color.orangeSoft, softColor: DS.color.orange, hint: "You can talk, but not sing" },
  { value: "intense",  label: "Intense 🔥",  softBg: DS.color.redSoft,    softColor: DS.color.red,    hint: "You can barely talk" },
];

export const DURATION_PRESETS = [15, 30, 45, 60, 90];

export function todayDate() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); }
export function uid() { return Math.random().toString(36).slice(2, 9); }
