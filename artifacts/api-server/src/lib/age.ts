/**
 * Calculates age in completed years from a date-of-birth string/Date.
 * Returns null if the input can't be parsed as a valid date.
 *
 * Used to enforce AORANE's 18+ age restriction (DPDPA 2023 Section 9 —
 * processing a minor's personal data requires verifiable parental
 * consent, which this app does not currently implement, so instead we
 * block account use entirely for under-18 users at the point they
 * submit their date of birth).
 */
export function calculateAge(dob: string | Date): number | null {
  const birthDate = dob instanceof Date ? dob : new Date(dob);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export const MINIMUM_AGE_YEARS = 18;
