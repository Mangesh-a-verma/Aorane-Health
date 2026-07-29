# Security Remediation — Action Log

This file tracks the concrete follow-up actions needed after the code audit.
Check items off as you complete them on your live GitHub repo.

## 1. Rotate the exposed Firebase Android API key
The key `AIzaSyCDIS8...` (redacted — see git history / Firebase console for the
full value if needed) was committed in
`attached_assets/google-services_new_1777905256562.json` and
`attached_assets/google-services_new_new_1777905559692.json`.
Deleting the files (already done in this fix) does **not** remove them from
git history — anyone can still find the key in old commits.

### Step 1 — Restrict the key in Google Cloud (do this FIRST, before anything else)
- [ ] Go to Google Cloud Console → APIs & Services → Credentials.
- [ ] Open this key, confirm **Application restrictions** is set to
      **Android apps** with your correct package names
      (`com.aorane.app`, `in.aorane.com`, `in.aorane.app`) and SHA-1
      fingerprints. If it's currently unrestricted, restrict it now — **this
      one step alone neutralizes 95% of the risk**, since a restricted
      Android key only works from your signed APK, not from a random script.

### Step 2 — (Optional but recommended) Rotate the key
- [ ] In Firebase Console → Project Settings, regenerate/replace the API key.
- [ ] Download the new `google-services.json` and upload it as a build
      secret in EAS (`eas secret:create`) or Codemagic — never commit it.

### Step 3 — Purge it from git history (do this AFTER step 1)
This rewrites history, so coordinate with your team first — anyone with a
local clone will need to re-clone after this.
```bash
# 1. Make a full backup first
git clone --mirror https://github.com/<your-org>/<your-repo>.git repo-backup.git

# 2. Install git-filter-repo if you don't have it
pip install git-filter-repo --break-system-packages
# or: brew install git-filter-repo

# 3. In your real working clone, remove both files from all of history
git filter-repo --invert-paths \
  --path attached_assets/google-services_new_1777905256562.json \
  --path attached_assets/google-services_new_new_1777905559692.json

# 4. Re-add your GitHub remote (filter-repo removes it as a safety measure)
git remote add origin https://github.com/<your-org>/<your-repo>.git

# 5. Force-push the rewritten history
git push origin --force --all
git push origin --force --tags
```
- [ ] After force-pushing, tell any collaborators to run
      `git fetch origin && git reset --hard origin/main` on their local
      clones (their old clones' history no longer matches).
- [ ] Render/Vercel auto-deploy will simply redeploy the current `main` HEAD
      as normal — force-pushing history doesn't affect what's currently
      deployed, only the commit log.

## 2. Confirm `.env.example` matches your actual Render/Vercel/EAS config
- [ ] Compare `artifacts/api-server/.env.example` against the environment
      variables currently set in the Render dashboard for the api-server
      service. Fill in any gaps.
- [ ] Same for `admin-panel`, `business-portal`, `aorane-landing` on Vercel
      (`VITE_API_URL` must point at the **production** api-server URL, not

      localhost).
- [ ] For `aorane-mobile`, confirm EAS secrets (`eas secret:list`) cover
      `EXPO_PUBLIC_API_URL` and that the real `google-services.json` is
      uploaded as a build credential, not committed.
      (Codemagic has been removed — EAS Build is now the only CI/CD
      pipeline. One-time setup: `eas secret:create --scope project --name
      GOOGLE_SERVICES_JSON --type file --value ./google-services.json`.
      `app.json`'s new `android.googleServicesFile` field points EAS's
      prebuild step at it automatically.)

## 3. Verify JWT secrets are real in every deployed environment
After the `jwt.ts` fix in this patch, the server will now **refuse to start**
in any environment where `NODE_ENV` is not `development`/`test` unless
`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_SECRET`, and
`BUSINESS_JWT_SECRET` are all set. Before deploying this patch:
- [ ] Confirm all four are set on Render for the api-server production
      service (and any staging/preview service, if you have one).
- [ ] Confirm they are four **different**, long, random values — not the same
      string reused across all four.

## 4. Payment / webhook checks (Razorpay)
- [ ] Confirm `RAZORPAY_WEBHOOK_SECRET` on Render matches the secret
      configured in the Razorpay Dashboard → Webhooks for the
      `/api/webhooks/razorpay` endpoint.
- [ ] Confirm the webhook URL registered in Razorpay points at your real
      production domain (not a Render preview URL).
- [ ] Test with Razorpay's "Send Test Webhook" feature and confirm your logs
      show `Duplicate webhook ignored` on a second delivery of the same
      event (idempotency check working).

## 5. SMS / WhatsApp / Email provider keys
- [ ] Confirm `TWILIO_*`, `FAST2SMS_API_KEY`, and `RESEND_API_KEY` are valid
      and not expired/rate-limited — test OTP login end-to-end on production.

## 6. Ongoing safeguard — prevent future accidental key commits

Verified findings (this pass):
- ✅ `render.yaml` — all sensitive keys use `sync: false` (value only in Render
  dashboard, never in repo). Correct.
- ✅ `vercel.json` — no secrets, only public build config.
- ✅ `VITE_*` / `EXPO_PUBLIC_*` env vars only carry non-secret URLs
  (`VITE_API_URL`, `EXPO_PUBLIC_API_URL`, `VITE_BUSINESS_URL`). Correct —
  but remember these get bundled into public client JS / the APK, so this
  prefix must NEVER be used for an actual secret key.
- ⚠️ Real Firebase key was found committed (see Section 1) — needs history
  purge + GCP restriction check.
- 🧹 Stale root-level `/public/assets/*.js` build bundle — no secrets found
  inside it, but it's orphaned leftover from before the `artifacts/`
  restructuring. Safe to delete for repo hygiene.

### Add automated secret-scanning so this can't happen again silently
- [ ] Add [gitleaks](https://github.com/gitleaks/gitleaks) as a GitHub Action
      that runs on every push/PR and fails the build if a secret-shaped
      string is committed. Minimal setup:
      ```yaml
      # .github/workflows/gitleaks.yml
      name: gitleaks
      on: [push, pull_request]
      jobs:
        scan:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
              with:
                fetch-depth: 0
            - uses: gitleaks/gitleaks-action@v2
      ```
- [ ] Optionally add a local pre-commit hook (`pip install pre-commit`,
      `gitleaks protect --staged`) so it's caught before it even reaches
      GitHub.
- [ ] Rule of thumb going forward: only `VITE_*` / `EXPO_PUBLIC_*` prefixed
      vars are ever safe to be non-secret + client-visible. Everything else
      (Razorpay, Twilio, JWT, AI provider keys, DB URL) must always be
      `sync: false` in Render / set only in Vercel's server-side env, never
      referenced from frontend code.
