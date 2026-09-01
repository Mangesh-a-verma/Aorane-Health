/**
 * All "day" boundaries in this app are anchored to IST (Asia/Kolkata), matching
 * the Health Score engine (scoring.ts). Querying a calendar date with UTC
 * boundaries instead would miscount anything logged between IST midnight and
 * 05:30 IST, so every date-scoped query must go through these helpers.
 */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function istDayBounds(date: string): { dayStart: string; dayEnd: string } {
  return {
    dayStart: `${date}T00:00:00+05:30`,
    dayEnd: `${date}T23:59:59+05:30`,
  };
}

/**
 * IST-anchored Monday of the current week, "YYYY-MM-DD".
 *
 * This is the cache key the weekly diet chart and health prediction are stored
 * under. The AI Coach reads the same row, so the key MUST be computed
 * identically in both places — it lives here rather than being written twice.
 */
export function istWeekStart(): string {
  const [y, m, d] = todayIST().split("-").map(Number);
  // Treat the IST calendar date as a plain Y/M/D and compute its Monday using
  // UTC getters, so no further timezone shift is introduced.
  const asUTC = new Date(Date.UTC(y, m - 1, d));
  const day = asUTC.getUTCDay(); // 0=Sun … 6=Sat
  const diff = asUTC.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(Date.UTC(asUTC.getUTCFullYear(), asUTC.getUTCMonth(), diff));
  return monday.toISOString().split("T")[0]; // "2025-01-06"
}

/** Current hour (0-23) in IST — server local time may be UTC. */
export function istHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false,
    }).format(new Date())
  );
}

/** IST weekday name ("Monday" … "Sunday") for a "YYYY-MM-DD" date. */
export function istWeekdayName(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long", timeZone: "UTC",
  });
}
