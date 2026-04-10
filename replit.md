# AORANE — Indian Health Platform

## Project Overview
AORANE is a comprehensive Indian health platform with three components:
1. **Mobile App** (Expo — Android/iOS) — Individual health tracking
2. **Business Portal** (React Web CRM) — Adaptive for all business types
3. **Admin Panel** (React Web) — Full platform control

All three share one PostgreSQL database and API server.

## Architecture

```
Mobile App (Expo) ──┐
Business Portal  ───┼──→ API Server (Express/Railway) → PostgreSQL (Supabase)
Admin Panel      ──┘         ↑ Redis Cache (Upstash)
```

## Tech Stack
- **Backend**: Express.js (Node.js), Drizzle ORM, PostgreSQL
- **Mobile**: Expo (React Native) — planned
- **Frontend**: React + Vite — planned
- **Auth**: JWT (30d user, 12h admin), OTP via Fast2SMS, Google OAuth
- **AI**: Gemini 2.0 Flash — food scan, tips, diet plans, medical reports
- **Payments**: Razorpay
- **Notifications**: Firebase FCM + Fast2SMS
- **Storage**: Supabase
- **Cache**: In-memory (production: Upstash Redis)

## Current Status

### ✅ Phase 1: Database — COMPLETE
46 PostgreSQL tables created and pushed to Supabase:
- Users: users, user_profiles, user_preferences, user_privacy_settings, user_auth_providers, user_medical_conditions, user_health_goals
- Health: food_logs, food_items, food_scan_cache, exercise_logs, water_logs, medicine_schedules, medicine_logs, stress_logs, period_logs, medical_reports, daily_health_scores
- Community: family_groups, family_members, blood_donors, blood_emergency_requests, blood_emergency_responses
- Business: organizations, org_admins, org_members, enrollment_codes, insurance_api_keys
- Revenue: subscriptions, payments, promo_codes, referrals
- Platform: push_tokens, notifications, announcements, feature_flags, ad_campaigns, ad_impressions, ad_clicks, admin_users, admin_audit_logs
- Infrastructure: wearable_connections, wearable_data, offline_queue, languages, translations

### ✅ Food Database Seeded — 1061 Indian Foods
food_items table populated with IFCT-verified data:
- **Source**: VitaCoach IFCT database (1014 items) + verified IFCT staples (47 items)
- **Coverage**: 21 categories including Dal & Lentils (57), Rice & Grains (68), Breads & Rotis (44), Snacks & Street Food (73), Sweets & Desserts (237), Vegetable Dishes (82), Beverages (71), Chicken/Mutton/Fish/Eggs (105 nonveg items), Paneer (22), Condiments & Chutneys (99)
- **Nutrients per food**: calories, protein, carbs, fat, fiber, sugar, sodium, calcium, iron, vitamin C (per 100g)
- **Extra fields**: Hindi name (name_hi stored in food_name_local JSONB), cuisine_type=indian, country_code=IN, dietary_tags (veg/nonveg), is_verified=true
- **Search**: ILIKE-based case-insensitive search via `/food/search?q=` endpoint works instantly

### ✅ Phase 2: API Server — COMPLETE
Express.js API server running on port 8080 with:
- **Auth**: OTP send/verify, Google OAuth, JWT refresh, logout
- **Users**: Profile CRUD, onboarding, medical conditions, health goals, preferences, privacy settings
- **Food**: Logs, search (1061 Indian foods DB), AI scan (Gemini-powered with vitamins), daily summary
- **Health**: Exercise logs (MET formula, profile-aware), water logs, daily health scores (auto-computed), history
- **Medicine**: Schedules, logs, adherence tracking
- **Medical Reports**: AI scan via Gemini Vision (`/medical/scan`), reports list/delete
- **Blood Emergency**: OTP-verified requests, donor registration, compatibility matching
- **Business**: Registration, login, members, enrollment codes
- **Admin**: Users, orgs, feature flags, food items, promo codes, announcements, blood moderation, languages, audit logs

### Middleware
- `requireAuth` — User JWT validation
- `requireAdmin` — Admin JWT validation  
- `requireBusinessAuth` — Business JWT validation
- `requirePlan` — Plan-based feature gating
- `checkPrivacy` — User privacy enforcement

## Key Design Decisions
1. **Privacy-first**: 8 privacy toggles, Stress/Sleep/Medicine DEFAULT OFF
2. **Offline-first**: Offline queue table for later sync
3. **Semantic cache**: Food scan checks DB cache first (90%+ hit target)
4. **Medical = Findings ONLY**: PDFs never stored
5. **Activity Confidence**: Every health score shows data completeness %
6. **Blood Emergency**: Double OTP verification, rate limited 2/month, 48hr auto-expiry
7. **Global-ready**: country_code, language_code, RTL support in all tables
8. **Three-way entry**: Photo + Text + Voice for Food/Exercise/Water

## File Structure
```
lib/
├── db/src/schema/
│   ├── users.ts           — User tables + enums
│   ├── health-food.ts     — Food items, logs, AI cache
│   ├── health-tracking.ts — Exercise, water, medicine, stress, period, medical reports
│   ├── community.ts       — Family groups, blood emergency
│   ├── business.ts        — Organizations, enrollments
│   ├── platform.ts        — Ads, notifications, feature flags, admin
│   ├── revenue.ts         — Subscriptions, payments, promos
│   └── wearable.ts        — Wearables, offline queue, i18n
│
artifacts/
└── api-server/src/
    ├── lib/
    │   ├── jwt.ts         — JWT sign/verify (user/admin/business)
    │   ├── otp.ts         — OTP generation + Fast2SMS
    │   └── redis.ts       — In-memory cache (Upstash-ready interface)
    ├── middlewares/
    │   ├── user-auth.ts   — User JWT middleware
    │   ├── admin-auth.ts  — Admin JWT middleware
    │   ├── business-auth.ts — Business JWT middleware
    │   ├── plan-check.ts  — Plan feature gating
    │   └── privacy-guard.ts — Privacy enforcement
    └── routes/
        ├── health.ts      — Health check
        └── modules/
            ├── auth.ts    — OTP, Google, JWT refresh
            ├── users.ts   — Profile, preferences, privacy
            ├── food.ts    — Logs, search, AI scan
            ├── health.ts  — Exercise, water, scores
            ├── medicine.ts — Schedules and logs
            ├── blood.ts   — Emergency system
            ├── business.ts — Portal APIs
            └── admin.ts   — Admin panel APIs
```

## Plans
- Free: ₹0
- Max: ₹199/month  
- Pro: ₹249/month
- Family: ₹499/month (4 members)
- Business: ₹89-149/seat/month

### ✅ Phase 3: Mobile App — COMPLETE
Expo mobile app running on port 18624 with:
- **Auth Flow**: Login (OTP + Google) → Verify OTP → Setup PIN → Main tabs
- **Onboarding**: 5 steps — Name/DOB/Gender → Physical → Health Conditions → Lifestyle → Goals
- **5 Tabs**: Dashboard, Food, Exercise, Medicine, Profile
- **Dashboard**: Health Ring (score + confidence %) + Water Tracker + Calorie Ring + Stats
- **Food**: Meal-wise logging + AI scan + food search + macros tracking
- **Exercise**: 10+ exercise types + duration + intensity + calorie burn
- **Medicine**: Schedules with reminders + meal timing
- **Profile**: BMI card + Privacy switches (sleep/stress/medicine default OFF) + Logout
- **Colors**: Teal #00BFA6 (primary), Purple #7C3AED (accent), Navy #0A0F1E (background)
- **API**: Connected to Express API server via EXPO_PUBLIC_API_URL

### ✅ Phase 4: Business Portal — COMPLETE
React + Vite web portal running on port 22981 at `/business-portal/`:
- **Auth**: Login (email+password), 3-step Registration (OrgType → Details → Admin)
- **Dashboard**: Org code banner, stats cards, seat capacity bar, org details panel
- **Members**: Grid view with avatar initials, blood group, join date, search filter
- **Enrollment Codes**: Create/list codes with usage bars, expiry, plan type badges
- **Settings**: Admin profile, org details, seat info, logout
- **Layout**: Dark sidebar with org info + seat progress, topbar with org code chip
- **API**: Connected to Express `/api/business/*` endpoints via JWT auth
- **Colors**: AORANE Blue #0077B6 + Teal #1B998B on dark navy background

### ✅ Phase 5: Admin Panel — COMPLETE
React + Vite super-admin panel running on port 20130 at `/admin-panel/`:
- **Auth**: Email + password login with restricted-access banner, JWT auth
- **Default Admin**: superadmin@aorane.in / admin123
- **Dashboard**: Platform health banner, user + org stats, quick action links
- **Users (10-tab sidebar)**: Table view with plan changer, ban/activate toggles, search
- **Organizations**: Card grid with org type icons, seat usage, status badges
- **Feature Flags**: Toggle switches for platform features, create new flags
- **Food Database**: Admin-verified food items table, add new items with macros
- **Promo Codes**: Usage tracking table, create codes with discount % and expiry
- **Announcements**: Publish platform-wide announcements with scheduling
- **Blood Emergency**: Moderate requests (flag, fulfil, cancel) with blood group display
- **Languages**: i18n setup with translation completion bars, RTL support
- **Audit Logs**: Full read-only audit trail of all admin actions, searchable
- **API**: Connected to Express `/api/admin/*` endpoints via JWT auth
- **Design**: Dark navy sidebar, red "ADMIN PANEL" badge, AORANE blue/teal accents

## Pending
- [ ] Razorpay payment integration
- [ ] Firebase FCM setup
- [ ] Diet plan AI agent
- [ ] Stress PPG camera feature
- [ ] Wearable adapter implementation
- [ ] Weekly PDF report generation
