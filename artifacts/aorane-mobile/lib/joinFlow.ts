import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * State for the employee onboarding path, held between screens that straddle
 * sign-in.
 *
 * The enrolment code is entered BEFORE the user has an account (so a wrong code
 * is caught before sign-up), but it is not redeemed until AFTER sign-in, once a
 * department has been chosen. Nothing in memory survives that gap — the auth
 * flow can remount the navigator, and on native the app can be backgrounded
 * mid-OTP — so the code is parked here and read back on the other side.
 *
 * This is the same shape as lib/consent.ts's pending-consent handoff, and for
 * the same reason: onboarding starts before there is a user_id to attach
 * anything to.
 *
 * Not sensitive: an enrolment code is meant to be circulated inside a company,
 * and it grants nothing without a signed-in account plus a seat. Plain
 * AsyncStorage is the right home; SecureStore is for tokens.
 */

const JOIN_TYPE_KEY = "join_flow_type";
const PENDING_CODE_KEY = "join_flow_pending_code";
const PENDING_ORG_KEY = "join_flow_pending_org";

export type JoinType = "individual" | "employee";

export async function setJoinType(type: JoinType): Promise<void> {
  await AsyncStorage.setItem(JOIN_TYPE_KEY, type);
}

export async function getJoinType(): Promise<JoinType | null> {
  const v = await AsyncStorage.getItem(JOIN_TYPE_KEY);
  return v === "individual" || v === "employee" ? v : null;
}

/** Called once the code has been verified, before sign-in. */
export async function setPendingEnrollment(code: string, orgName: string): Promise<void> {
  await AsyncStorage.multiSet([
    [PENDING_CODE_KEY, code],
    [PENDING_ORG_KEY, orgName],
  ]);
}

export async function getPendingEnrollment(): Promise<{ code: string; orgName: string } | null> {
  const [[, code], [, orgName]] = await AsyncStorage.multiGet([PENDING_CODE_KEY, PENDING_ORG_KEY]);
  if (!code) return null;
  return { code, orgName: orgName ?? "" };
}

/** Called once the code has actually been redeemed, or the user abandons the
 *  employee path. Leaving a stale code behind would send the next sign-in
 *  back into department selection for an org they never joined. */
export async function clearPendingEnrollment(): Promise<void> {
  await AsyncStorage.multiRemove([PENDING_CODE_KEY, PENDING_ORG_KEY]);
}

/** Full reset, for logout and for "actually, I'll join as an individual". */
export async function clearJoinFlow(): Promise<void> {
  await AsyncStorage.multiRemove([JOIN_TYPE_KEY, PENDING_CODE_KEY, PENDING_ORG_KEY]);
}
