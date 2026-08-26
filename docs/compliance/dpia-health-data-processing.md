# Data Protection Impact Assessment — Aorane Health-Tracking Platform

**Status:** Internal working document. Not published on the website — health
data processing is a "high risk" category under DPDP Rules 2025 and GDPR
Art. 35, both of which expect a controller to be able to *produce* a DPIA on
request from a regulator/auditor, not to publish one for the general public.
Update this document whenever a new health-data feature ships or a
sub-processor changes; a DPIA that reflects last year's product is not
useful evidence of an actual assessment process.

## 1. Description of Processing

- **Controller:** Aorane (for its direct B2C users). Aorane also acts as
  **Processor** for enterprise/Business Portal customers under a signed
  Data Processing Agreement — see `/data-processing-agreement`.
- **Data subjects:** Individual app/web users; where Family Account features
  are used, dependents added by a user; where Business Portal is used,
  employees enrolled by a corporate customer.
- **Categories of personal data processed:** account identifiers (name,
  email, phone), authentication data, profile/biometric basics (age, gender,
  height, weight, blood group), health logs (exercise, sleep, stress,
  period, medication, food/nutrition), uploaded medical reports and
  extracted lab values, food photographs (short-lived), location (optional,
  consent-gated), payment/subscription metadata.
- **Purpose:** service delivery (Health Score, wellness insights, reminders),
  AI-assisted food/report analysis, platform security and fraud prevention,
  legally required record-keeping (billing).
- **Sub-processors involved:** see `/sub-processors` (public categories) and
  the DPA appendix (named AI/ML providers, provided to signed enterprise
  Controllers).

## 2. Necessity & Proportionality

- Each data category maps to a specific, disclosed purpose in the Privacy
  Policy (Section 3) — there is no category collected "in case it's useful
  later" without a stated purpose.
- Food photographs are processed for immediate analysis only and are
  deleted ~24h after processing (see `lib/analytics` is unrelated; this is
  enforced in the mobile/API upload-processing pipeline — confirm current
  TTL in that code path before relying on this document for an audit).
- Medical report *originals* are not retained; only extracted structured
  values are kept, reducing the volume of raw sensitive documents at rest.

## 3. Risks Identified & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unauthorized access to health records via a compromised admin account | Medium | High | Tiered RBAC (`admin`/`super_admin`) enforced server-side on destructive/sensitive routes; audit-log entry on every such action; bcrypt password hashing; per-email + per-IP login rate limiting; timing-safe login response. |
| AI provider mishandling data sent for inference (e.g. retaining it for their own training) | Low–Medium | High | Contractual terms with AI sub-processors prohibit using submitted data for foundation-model training (stated in Privacy Policy §4 and the DPA template); data minimized to what's needed for the specific inference call. |
| Health data exposure via a leaked API/JWT secret | Low | High | Server refuses to boot in staging/production without real `JWT_SECRET`/`ADMIN_JWT_SECRET`/`BUSINESS_JWT_SECRET`/`JWT_REFRESH_SECRET` values (no insecure fallback outside local dev); secrets set only via hosting-platform environment variables, never committed. |
| Re-identification of "deleted" users via retained payment records | Low | Medium | Deletion flow anonymizes phone/email on the `users` row (deterministic non-PII tombstone) *before* the financial-retention exception applies, so retained payment rows are not linkable back to the original identity via the row itself. |
| Repo being public exposing infrastructure/vendor choices | Medium (current state) | Low–Medium | Tracked as a known, accepted gap during active development; repo will be made private after the current build phase (owner decision, logged here for audit trail — see conversation history / PR #52). AI vendor names specifically withheld from the public Sub-processor List regardless of repo visibility. |
| Cross-border transfer of health data (AI providers, hosting regions) without a transfer mechanism | Medium | Medium | Privacy Policy §6 discloses possible processing in India/US/EU; DPA template commits to executing Standard Contractual Clauses (or equivalent) before an EU-originating transfer that requires one. No SCC has been executed yet — action item, see §5. |

## 4. Data Subject Rights — How They're Actually Exercised

- Access/correction/deletion requests: `support@aorane.com`, or in-app
  account deletion (OTP-gated, see `api-server/src/routes/modules/
  delete-account.ts`) — this route explicitly deletes every table listed in
  `CHILD_TABLES`, not just deactivating the account.
- Grievance escalation: named Grievance Officer per DPDP Act §13 — see
  `/privacy#contact`.

## 5. Open Action Items (update as closed)

- [ ] Execute Standard Contractual Clauses (or equivalent) proactively with
      any sub-processor that may receive EU-originating personal data,
      rather than waiting for the first EU customer to request it.
- [ ] Confirm the food-photo 24h deletion TTL is enforced by an actual
      scheduled job/cron in the current codebase, and document where.
- [ ] Make this repository private (owner action, already decided —
      tracked here so the DPIA reflects the plan, not just the current gap).
- [ ] Re-run this assessment when Family Account data sharing, the Doctor
      Marketplace, or Blood Emergency features move from planned to live —
      each introduces a new category of data subject or recipient.

## 6. Review History

| Date | Reviewer | Change |
|---|---|---|
| August 2026 | Compliance audit (this session) | Initial DPIA drafted alongside the Phase 1–3 legal-document build-out. |
