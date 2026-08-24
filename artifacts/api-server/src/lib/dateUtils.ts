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
