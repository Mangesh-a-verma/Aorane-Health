# AORANE Health Platform — PRD & Fix Tracking

## Original Problem Statement
GitHub connected hai, mobile app ko analysis karo. Pura project audit karo, errors identify karo, fixes apply karo (Phase 1 + B1), aur auto deploy karo (direct main branch push).

User Repo: `Mangesh-a-verma/Health-Data-Hub` (pnpm monorepo)

## Architecture
- **Monorepo**: pnpm workspaces with 6 apps under `artifacts/`
- **API Server**: Express 5 + Drizzle ORM + PostgreSQL (Supabase Mumbai), deployed to Render
- **Mobile**: Expo SDK 54 + React Native 0.81 + expo-router
- **Admin Panel**: Vite + React 19 (Vercel)
- **Business Portal**: Vite + React 19 (Vercel)
- **Landing**: Vite + React (Vercel)
- **DB**: Single shared PostgreSQL (Supabase, ap-south-1)

## User Personas
1. End-user — patient (free/max/pro/family plan)
2. Family group owner (family plan)
3. Organization member (b2b enrolled)
4. Business admin (org admin)
5. Platform admin (admin panel)

## Audit Findings (from full codebase analysis)
- **32 total issues** identified: 5 Critical, 10 High, 13 Medium, 4 Low
- Detailed audit in chat history

## Phase 1 + B1 — Implemented (this session, May 11, 2026)

### Critical Security Fixes
| # | Issue | Status | Files |
|---|-------|--------|-------|
| C1 | Razorpay webhook signature was optional → forgery risk | ✅ Done | `api-server/src/routes/modules/webhook.ts` |
| C2 | Webhook used JSON.stringify(req.body) instead of raw bytes | ✅ Done | `api-server/src/app.ts` (added express.raw mount) + `webhook.ts` |
| C3 | Stale JWT plan claim — PRO users got "Upgrade to MAX" error on food scan | ✅ Done | `user-auth.ts` (read plan from DB+cache), `payment.ts` (rotate tokens), `business.ts` (rotate tokens on enrollment), `aorane-mobile/lib/api.ts`, `upgrade.tsx`, `enrollment.tsx` |
| C4 | PIN + auth tokens in plaintext AsyncStorage | ✅ Done | `aorane-mobile/lib/storage.ts` (migrated to expo-secure-store), `lib/api.ts` |
| C5 | google-services.json committed to repo | ✅ Done | `.gitignore` + renamed file to `.example` with redacted values |

### B1 — PRO Food Scan Bug (Root Cause = C3)
✅ Fixed via C3 — server now reads `plan` from DB on every authenticated request (cached 120s). Plan cache invalidated on payment/enrollment success. Fresh JWT also issued to client.

### Bonus Fixes Included
| # | Issue | Status |
|---|-------|--------|
| H9 | /auth/refresh didn't check token revocation | ✅ Done in `auth.ts` |
| B5 | Webhook UPDATE users plan via subquery NULL risk | ✅ Done with COALESCE in `webhook.ts` |

## Verification Done
- Static syntax check via esbuild on all 9 modified files: **ALL PASS** ✅
- No breaking changes to existing route signatures
- Express 5 supports async middleware (requireAuth converted to async)
- SecureStore fallback to AsyncStorage on web (graceful degradation)
- Migration logic in storage.ts auto-moves legacy AsyncStorage values to SecureStore

## Production Deployment Notes
- Render auto-deploys from `main` branch of GitHub repo
- **CRITICAL — Before deploy, verify env vars set in Render:**
  - `RAZORPAY_WEBHOOK_SECRET` (was optional, NOW MANDATORY — webhooks will reject without it)
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_SECRET`, `BUSINESS_JWT_SECRET`
  - `DATABASE_URL`
- **EAS Build for mobile:** Need to add `google-services.json` as EAS secret file (was previously committed)
  ```
  eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
  ```
  Then in `app.json` use the secret file reference.

## Remaining Backlog (P1/P2)

### High
- H1: SQL injection risk in dynamic table names (`auth.ts:698`)
- H2: Dynamic column UPDATE in `users.ts:207,240`
- H3: CORS regex needs `^$` anchors
- H4: 15 console.log in admin-panel
- H5: Firebase hardcoded API key fallback
- H6: Render free tier → cold starts
- H7: 10 `any` types in backend
- H8: Twilio env validation missing
- H10: Plan hierarchy (PRO vs MAX) confusion

### Medium
- M1: 30+ Android permissions — Play Store rejection risk
- M2: html2canvas in RN bundle (web-only)
- M3: Massive files >1000 lines
- M4: migrate.ts mixing schema+data (1315 lines)
- M5: Codemagic + EAS dual CI
- M6: No automated tests
- M7: Proguard disabled
- M8: babel-plugin-react-compiler beta SHA
- M9: Mixed Animated + Reanimated v4
- M10: Firebase web SDK bundle bloat
- M11: AI daily limit same across plans
- M12: ~30 empty catch blocks swallowing errors
- M13: No Sentry/Crashlytics

### Low
- L1-L7: Various nits (TODOs, console.log, .env files committed, etc.)

### Functional Bugs Remaining
- B2: Notifications lost after app update (not just reinstall)
- B3: Offline queue race condition (dedup needed)
- B4: Fixed via H9 above
- B6: Push token registration silently fails
- B7: Family reminder missing TTL/priority
- B8: Health score timezone edge case

## Next Action Items
1. **User: Use "Save to GitHub" feature in chat input to push /app to their repo**
2. **User: Verify Render env vars before traffic resumes** (especially `RAZORPAY_WEBHOOK_SECRET`)
3. **User: After Render deploy, test PRO food scan with a PRO test user**
4. **User: Set up `expo-secure-store` peer config in `eas.json` (only if EAS prebuild used)**
5. **Pending: Move `google-services.json` to EAS secret file**
6. **Pending Phases** (mai chalu kar sakta hun on user's signal):
   - Phase 2 (SQL & Validation): H1, H2 — 1 day
   - Phase 3 (Bugs): H10, B3, B6, B7 — 2-3 days
   - Phase 4 (Code Quality): M3, M4, refactors — 3-5 days
   - Phase 5 (Observability): Sentry, pino transports, Maestro tests — 1 week
   - Phase 6 (Polish): empty catches, beta deps, single animation lib

## File Change Inventory (this session)
```
artifacts/api-server/src/app.ts                              (+5 lines, raw body mount)
artifacts/api-server/src/middlewares/user-auth.ts            (REWRITTEN, plan-from-DB)
artifacts/api-server/src/routes/modules/webhook.ts           (rawBody Buffer + signature mandatory + COALESCE)
artifacts/api-server/src/routes/modules/payment.ts           (rotateUserTokensForPlan + 3 call sites)
artifacts/api-server/src/routes/modules/business.ts          (token rotation in 2 enrollment endpoints)
artifacts/api-server/src/routes/modules/auth.ts              (refresh revocation check)
artifacts/aorane-mobile/package.json                         (+expo-secure-store dep)
artifacts/aorane-mobile/lib/storage.ts                       (REWRITTEN, SecureStore + migration)
artifacts/aorane-mobile/lib/api.ts                           (storage helper + refreshTokensFromServer)
artifacts/aorane-mobile/app/upgrade.tsx                      (token persistence after payment)
artifacts/aorane-mobile/app/enrollment.tsx                   (token persistence after enrollment)
artifacts/aorane-mobile/.gitignore                           (+google-services.json)
artifacts/aorane-mobile/google-services.json                 (removed real)
artifacts/aorane-mobile/google-services.json.example         (redacted template)
```
