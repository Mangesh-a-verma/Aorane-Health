# Incident Response & Breach Notification Policy

**Status:** Internal working document — the process this describes, not a
public-facing page. Referenced by the DPA (`/data-processing-agreement`,
"Data Breach Notification") and BAA (`/business-associate-agreement`,
"Breach Notification") pages, which state the notification deadlines this
document exists to make achievable. Update this whenever the on-call/escalation
setup, the sub-processor list, or the notification deadlines in a signed
DPA/BAA change.

## 1. What Counts as an Incident

Any of the following, confirmed or reasonably suspected:

- Unauthorized access to, or disclosure of, personal or health data
- Loss or destruction of personal or health data without a backup
- Compromise of an admin, super-admin, or service credential
- A vulnerability report (via `/vulnerability-disclosure`) confirmed to have
  been exploited, or assessed as critical severity even if exploitation is
  unconfirmed
- A sub-processor notifying Aorane of an incident affecting Aorane's data

## 2. Severity & Timeline Commitments

| Severity | Examples | Internal escalation | External notification target |
|---|---|---|---|
| **Critical** | Confirmed unauthorized access to health records at scale; admin credential compromise with evidence of use | Immediate — all hands | DPDP: within 72 hours of confirmation, per DPDP Rules 2025. HIPAA-covered engagements: within 60 days per the BAA, but Aorane's internal target is far faster than the legal maximum. Affected enterprise Controllers notified per their DPA's stated timeline (no DPA yet commits to a number looser than 72 hours). |
| **High** | Vulnerability confirmed exploitable but no evidence of actual data access; single-account compromise | Within 4 hours of confirmation | Affected individual user(s) notified once scope is confirmed; no regulatory threshold met unless it escalates |
| **Low** | Contained/theoretical issue, no data exposure confirmed | Standard triage | Internal record only, unless investigation later escalates severity |

These targets are internal commitments layered on top of, not a substitute
for, the actual legal deadlines in DPDP Rules 2025, GDPR Art. 33/34 (72
hours to the supervisory authority once "aware"), and any signed DPA/BAA.

## 3. Response Steps

1. **Contain** — revoke/rotate the compromised credential or close the
   exploited path first, before full root-cause analysis. Use the audit log
   (see `/security`) to scope what the credential/access actually touched.
2. **Assess scope** — which tables/users/data categories were reachable;
   cross-reference `CHILD_TABLES` in `delete-account.ts` as a checklist of
   every place health data lives, since that list is already maintained as
   the source of truth for "everywhere a user's data exists."
3. **Notify** — per the timeline table above. For a DPA/BAA customer, use
   the contact designated in their signed agreement, not just a general
   inbox. For individual users, use the same channel as
   `sendAccountDeletedEmail`-style transactional email, not marketing email.
4. **Remediate** — the actual code/config/process fix, validated the same
   way any other production change is (typecheck, build, targeted test of
   the failure mode) before considered closed.
5. **Record** — add an entry to Section 5 below and, if the incident reveals
   a gap this DPIA-adjacent framework didn't anticipate, update
   `docs/compliance/dpia-health-data-processing.md` §3 (Risks) too.

## 4. Roles

- **Incident owner:** whoever is on-call / the founder, until a dedicated
  security role exists — update this section once that changes; don't let
  it silently go stale.
- **Notification decision-maker:** same person, in consultation with legal
  counsel for any incident that might cross a regulatory notification
  threshold — don't self-assess "this doesn't need reporting" without that
  second opinion once the incident is above Low severity.

## 5. Incident Log

| Date | Severity | Summary | Notified? | Closed |
|---|---|---|---|---|
| — | — | No incidents recorded since this policy was drafted (August 2026). | — | — |
