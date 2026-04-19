# AORANE — Indian Health Platform

## Overview
AORANE is an Indian health platform designed to provide comprehensive health management. It comprises a mobile application for individual health tracking, a business portal for organizations, and an admin panel for platform control. The platform aims to revolutionize health management in India by offering personalized health insights, integrating with various health services, and providing robust administrative capabilities.

## User Preferences
I prefer detailed explanations and clear communication. Please ask before making any major changes to the codebase or architectural decisions. I want to follow an iterative development process, focusing on completing one feature set before moving to the next.

## System Architecture
AORANE's architecture consists of three main components: a mobile app (built with Expo/React Native), a Business Portal (React Web CRM), and an Admin Panel (React Web). All components share a single PostgreSQL database (managed by Supabase) and an Express.js API server, leveraging Drizzle ORM. Redis (Upstash) is used for caching.

**UI/UX Decisions:**
- **Mobile App:** Complete Apple Health-inspired redesign with white (#FFFFFF) background, Trust Blue (#007AFF) primary, Mint Green (#34C759) accent. Design system in `lib/theme.ts` (DS tokens). Lucide icons for general UI, MaterialCommunityIcons for exercise-specific icons. Glassmorphism glass headers (BlurView on iOS, semi-transparent on Android). White card sections with subtle blue shadows. CustomTabBar with animated pill. Screens: Dashboard (Paytm-style 3×2 grid), Exercise, Food, Medicine, Profile — all fully redesigned.
- **Business Portal:** Light theme with professional split-panel login (blue branding left, white form right). Dashboard shows aggregate health analytics (recharts bar + pie charts), seat-based billing (MAX ₹199/seat, PRO ₹249/seat, GST 18% with CGST/SGST/IGST split), verification structure stubs (email + phone OTP ready for keys). Uses AORANE Blue (#0077B6) and Teal (#1B998B) on white background (#F8FAFC).
- **Admin Panel:** Features a dark navy sidebar with a prominent "ADMIN PANEL" badge and AORANE blue/teal accents.

**Technical Implementations & Feature Specifications:**
- **Authentication:** Utilizes JWT for sessions (30-day user, 12-hour admin), OTP via Fast2SMS, and Google OAuth.
- **AI Integration:** Gemini 2.5 Flash (via Replit AI Integrations proxy — no user API key needed) powers Smart Scan (vision: food/report/medicine), diet plans, and health tips. Fallback to user's GOOGLE_GEMINI_API_KEY if proxy not available. NVIDIA DeepSeek powers non-vision AI. The Admin Panel allows per-feature AI configuration (ai_config table). Proxy env vars: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY`.
- **Payment Gateway:** Razorpay is integrated for handling subscriptions and payments.
- **Dynamic Plan Pricing Engine:** Admin panel `/plan-pricing` page lets admin update plan prices and features. Changes auto-reflect in Mobile App upgrade screen and Business Portal billing — no code changes needed. DB table: `plan_pricing`. Public endpoint: `GET /api/plans?type=individual|organization`. Admin endpoints: `GET/PUT /api/admin/plan-pricing/:planKey`, `POST /api/admin/plan-pricing/reset`.
- **Notifications:** Firebase FCM and Fast2SMS are used for notifications.
- **Storage:** Supabase handles file storage.
- **Database Schema:** A comprehensive PostgreSQL schema includes tables for users, health data (food, exercise, water, medicine, stress, period, medical reports), community features (family groups, blood donation), business entities (organizations, members, enrollment codes), revenue (subscriptions, payments, promo codes), and platform infrastructure.
- **Plan-based Feature Gating:** Server-side via `feature_flags.enabled_for_plans` (TEXT[]) — checked in `requireFeature()` middleware. Client-side `PlanGate` overlay in scan.tsx for free users. Free plan: limited AI Coach (upgrade banner in suggestions.tsx). Max/Pro/Family: AI Smart Scan, full AI Coach, wearable sync.
- **Privacy-first Design:** Features 8 privacy toggles, with sensitive data logging (Stress, Sleep, Medicine) defaulting to OFF.
- **Offline-first Capability:** An offline queue table is implemented for data synchronization when connectivity is restored.
- **Semantic Caching:** Food scan checks a database cache first to reduce AI API calls.
- **Blood Emergency System:** Implements double OTP verification, rate limiting, and 48-hour auto-expiry for blood requests.
- **Global Readiness:** Tables are designed to support `country_code`, `language_code`, and RTL (Right-to-Left) for future internationalization.
- **Data Entry Flexibility:** Supports Photo, Text, and Voice input for logging Food, Exercise, and Water.

## Security Scan & Business Portal Update (April 2026)

**Security Fixes Applied:**
- `medicine.ts`, `users.ts`, `suggestions.ts`: Added `Object.prototype.hasOwnProperty.call()` guard on all dynamic field updates to prevent prototype pollution attacks (4 SAST HIGH findings resolved)
- `business.ts`: Register endpoint now returns `admin` object in response (previously only returned org, token, orgCode)
- **Result:** 0 critical, 0 high vulnerabilities (dependency audit clean; SAST 0 HIGH remaining)

**Business Portal Features Built:**
- **Members page**: Added CSV export button (downloads filtered member list as CSV), member detail modal (shows AORANE ID, BMI, blood group, health scores for last 7 days, remove from org option)
- **Settings page**: Full rewrite — edit org details (name, email, phone, city, state), change admin password with show/hide toggle, org code + seat usage display
- **New API endpoints**: `PATCH /business/settings` (update org details), `PATCH /business/admin/password` (change admin password)

**Business Auth Flow (complete, working):**
1. Landing page → "For Business" toggle in navbar → "Sign In" / "Get Started Free" buttons → `BusinessAuthModal`
2. 3-step signup: Org Type → Details (name, email, city) → Account (name, password)
3. After auth → redirects to `business-portal/auth?t=token&a=admin&o=org`
4. Business portal stores credentials in localStorage, redirects to `/dashboard`

**AI Strategy (confirmed):**
- NVIDIA LLaMA 3.3 70B: diet-plan, health-tip, meal-swap, stress insights, daily suggestions, text food search
- Gemini 2.0 Flash: medical report scan, smart-scan (camera), food image scan (vision required)

## Onboarding Flow Fix (April 2026)

**Critical Bug Fixed:** Onboarding was skipping 4 screens entirely!

**Before (Broken):**
```
OTP Verify → Profile Setup → Permissions → PIN Setup → Dashboard
```

**After (Fixed):**
```
OTP Verify → Profile (Step 1/5) → Physical/BMI (Step 2/5) → Health Conditions (Step 3/5) → Lifestyle (Step 4/5) → Health Goals (Step 5/5) → Permissions (Almost Done!) → PIN/Biometric Setup → Dashboard
```

**Files changed:**
- `_layout.tsx`: Added physical, health, lifestyle, goals screens to Stack
- `index.tsx`: Now navigates to `physical` instead of `permissions`; step bar updated to 5 steps
- `goals.tsx`: Now navigates to `permissions` instead of calling `setOnboardingComplete()` prematurely; added `router` import
- `permissions.tsx`: Step indicator updated to show all 5 filled (Almost Done!)

## Bug Audit & Fixes (April 2026)

### 🔴 Critical Security Fix
- **`api-server/src/routes/modules/auth.ts`**: `devOtp` was always returned in OTP response — now gated behind `NODE_ENV !== "production"`. In production (Render), OTP will NEVER be exposed in API response.

### 🟠 High Priority Fixes
- **`aorane-mobile/lib/api.ts`**: Replaced fragile `res.json()` with robust `res.text()` → `JSON.parse()` pattern. Handles sleeping Render server (empty body), non-JSON responses, and network errors gracefully.
- **`aorane-mobile/eas.json`**: Added `EXPO_PUBLIC_API_URL=https://aorane.onrender.com/api` to ALL build profiles (development, preview, production). Without this, native builds would fall back to `localhost:8080` and fail.
- **`admin-panel/src/lib/api.ts`** + **`Login.tsx`**: Already fixed in previous session — robust error handling + stale token clearing.
- **`api-server/src/routes/modules/admin.ts`**: `/admin/users` endpoint had `search` query param extracted but never applied to the DB query. Now correctly filters by phone using `ilike`.

### 🟡 Medium Priority Fixes
- **`business-portal/src/pages/Login.tsx`**: Added localStorage token cleanup before login attempt (same pattern as admin panel).
- **`aorane-landing/src/components/BusinessAuthModal.tsx`**: `apiPost` function used raw `res.json()` — now uses robust text-first pattern.
- **`aorane-mobile/app.json`**: Added `privacyPolicyUrl: "https://aorane.in/privacy"` (required for Play Store) and Android deep link intent filter for `aorane.in`.
- **`admin-panel/src/App.tsx`**: Fixed broken 404 page redirect link (`/admin-panel/dashboard` → `/dashboard`).

### 🟢 Design Decisions Confirmed (Not Bugs)
- **PIN storage in Redis**: PINs stored in Upstash Redis (365-day TTL), not in DB. Users must re-set PIN after server restart in early prod. Acceptable for v1.0.
- **SMS fallback**: When Fast2SMS DLT not configured, `smsSent: false` returned. devOtp visible in dev only — users must enter OTP manually.
- **WhatsApp OTP fallback**: Automatically falls back to SMS if WhatsApp delivery fails.

## AI Food Discovery System (April 2026)

**Feature: AI-Discovered Food Cache Review & Auto-Promotion**

A complete workflow for managing AI-discovered foods from user searches:

**Database Changes:**
- `food_scan_cache` table — 6 new columns: `is_promoted` (bool), `is_rejected` (bool), `source_ai` (text, nvidia/gemini), `name_normalized` (text for fuzzy matching), `reviewed_at` (timestamp), `promoted_food_item_id` (uuid FK)
- `food_items` table — 2 new columns: `ai_generated` (bool), `ai_source_cache_id` (uuid)

**Backend (api-server):**
- `food.ts`: Added fuzzy duplicate detection — normalizes food names (lowercase, strip punctuation) and checks similarity before inserting to cache. Prevents "Poha", "poha", "POHA" from creating 3 entries.
- **Auto-promote**: When any cache entry reaches `hit_count ≥ 5`, it's automatically promoted to `food_items` table.
- New admin endpoints:
  - `GET /admin/food-cache/stats` — total/pending/promoted/rejected/autoPromoted counts
  - `GET /admin/food-cache` — list with filter (all/pending/promoted/rejected), search, pagination
  - `POST /admin/food-cache/:id/promote` — manually promote to food_items (isVerified:true, addedByAdmin:true)
  - `POST /admin/food-cache/:id/reject` — mark as rejected
  - `GET /admin/food-cache/export?format=csv|json&filter=...` — download export

**Admin Panel UI:**
- New page: `AIFoodDiscovery.tsx` — route `/ai-food-discovery`
- 5 stats cards: Total, Pending, Promoted, Rejected, Auto-Promoted
- Table with: food name, hit count, calories, macros (P/C/F), source AI, status badge, Promote/Reject actions
- Filter tabs: All | Pending Review | Promoted | Rejected
- Detail modal: full nutrition breakdown (macros, vitamins, dietary tags, health tip)
- CSV/JSON export buttons
- Added to sidebar nav under "Content" group (sparkles icon, purple color)

## Advanced API Features (April 2026)

**AI Provider Abstraction Layer:**
- `lib/ai.ts` — `callAI(feature, messages, options?)` routes each feature to correct provider (NVIDIA or Gemini)
- `middlewares/feature-check.ts` — `requireFeature(name)` middleware with 5-min in-memory cache; applied to all AI routes
- Feature names: `meal_planner`, `health_suggestions`, `food_ai`, `smart_scan`, `stress_ai`, `health_prediction`, `weekly_diet_chart`, `water_ai`, `blood_ai`, `medical_ai`
- `smart_scan` stays on Gemini (image vision); all others can be toggled to NVIDIA via Admin Panel AI Config
- Admin panel cache invalidation calls added to `admin.ts` after config/flag updates

**Weather-Based Food Suggestions:**
- `POST /food/weather-suggestions` — AI-powered seasonal Indian food recommendations
- 4-season fallback (Winter=Sarson Saag, Summer=Aam Panna, Monsoon=Khichdi, Autumn=Pomegranate)
- Mobile food.tsx shows horizontal scrollable chip row with emoji, name, and calorie count
- Tapping a chip pre-fills the food search in the Add Food modal

**App Sessions / DAU Tracking:**
- `appSessionsTable` in DB schema (`lib/db/src/schema/platform.ts`)
- `sessions.ts` route module: `POST /sessions/start`, `POST /sessions/heartbeat`, `POST /sessions/end`, `GET /sessions/dau` (admin)
- Returns DAU/MAU stats for Admin Panel analytics

**Blood Emergency V2:**
- `bloodDonationsTable` in DB schema (`lib/db/src/schema/community.ts`)
- 90-day donor cooldown enforced via `blood_donors.donor_inactive_until` column
- `POST /blood/donate/confirm` + `GET /blood/donate/history` endpoints
- Donor search excludes donors within cooldown period

## External Dependencies
- **Database:** PostgreSQL (managed by Supabase)
- **Backend Framework:** Express.js (Node.js)
- **ORM:** Drizzle ORM
- **Mobile Development:** Expo (React Native)
- **Frontend Development:** React + Vite
- **Caching:** Upstash Redis
- **SMS Gateway:** Fast2SMS (for OTP)
- **OAuth:** Google OAuth
- **AI Services:** Gemini 2.0 Flash
- **Payment Gateway:** Razorpay
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Cloud Hosting (API Server):** Railway
- **Cloud Hosting (Mobile App, Business Portal, Admin Panel):** Render (for EXPO_PUBLIC_API_URL)