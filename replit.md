# AORANE — Indian Health Platform

## Overview
AORANE is an Indian health platform designed to provide comprehensive health management through a mobile application for individual health tracking, a business portal for organizations, and an admin panel for platform control. The platform aims to revolutionize health management in India by offering personalized health insights, integrating with various health services, and providing robust administrative capabilities. Key features include AI-powered health insights, dynamic plan pricing, privacy-first design, and a robust payment system.

## User Preferences
I prefer detailed explanations and clear communication. Please ask before making any major changes to the codebase or architectural decisions. I want to follow an iterative development process, focusing on completing one feature set before moving to the next. Communication is in Hinglish.

## Deployment Stack
- **API Server:** Render (https://aorane.onrender.com/api) — auto-deploys from GitHub (Mangesh-a-verma/Health-Data-Hub)
- **Landing Page:** Vercel (aorane.com)
- **Business Portal:** Vercel (business.aorane.com)
- **Database:** Supabase PostgreSQL (South Asia — Mumbai ap-south-1)
- **Mobile App:** Expo/React Native — Android package: com.aorane.app — APK builds via Codemagic
- **Admin Panel:** Replit hosted

## System Architecture
AORANE's architecture is composed of a mobile app (Expo/React Native), a Business Portal (React Web CRM), and an Admin Panel (React Web). All components share a single PostgreSQL database (managed by Supabase, Mumbai region) and an Express.js API server deployed on Render, leveraging Drizzle ORM.

**UI/UX Decisions:**
- **Mobile App:** Features an Apple Health-inspired redesign with a white background, Trust Blue primary color, Mint Green accent, and custom design system (DS tokens). It uses Lucide and MaterialCommunityIcons, glassmorphism headers, white card sections with subtle blue shadows, and a custom animated pill-shaped TabBar. Screens include a Paytm-style Dashboard, Exercise, Food, Medicine, and Profile.
- **Business Portal:** Employs a light theme with a professional split-panel login. It displays aggregate health analytics using charts, supports seat-based billing with GST splits, and includes verification structures for email and phone OTP. The color scheme uses AORANE Blue and Teal on a white background.
- **Admin Panel:** Characterized by a dark navy sidebar with an "ADMIN PANEL" badge and AORANE blue/teal accents. Dashboard shows 9 real-time stats: totalUsers, totalOrganizations, activeSubscriptions, totalBloodRequests, totalRevenue, monthRevenue, newUsersToday, newUsersThisMonth, planBreakdown.

**Technical Implementations & Feature Specifications:**
- **Authentication:** JWT for sessions (access: 30d, refresh: 90d), OTP via email (Resend) and Fast2SMS, and Google OAuth.
- **AI Integration:** Gemini 2.5 Flash powers Smart Scan (vision for food/report/medicine), diet plans, and health tips, utilizing a Replit AI Integrations proxy. NVIDIA DeepSeek handles non-vision AI tasks. The Admin Panel allows per-feature AI configuration via an `ai_config` table. NVIDIA LLaMA 3.3 70B is used for diet plans, health tips, meal swaps, stress insights, daily suggestions, and text food search.
- **Payment Gateway:** Razorpay integrated for subscriptions and payments — Live mode active. Webhook endpoint: `/api/webhooks/razorpay`.
- **Dynamic Plan Pricing Engine:** Admin panel allows real-time updates to plan prices and features, which automatically reflect across Mobile App and Business Portal without code changes. Plan fields: `monthlyPrice`, `yearlyPrice`, `planKey`, `displayName`, `badgeText`, `badgeColor`, `gradientColors`.
- **Notifications:** Firebase FCM (push) and Fast2SMS (SMS). Expo push token registered per device.
- **Storage:** Supabase manages file storage.
- **Database Schema:** Comprehensive PostgreSQL schema supporting users, health data, community features, business entities, revenue management, and platform infrastructure. Tables designed for `country_code`, `language_code`, and RTL support. 173 migration steps applied.
- **Plan-based Feature Gating:** Server-side via `requireFeature()` middleware with 5-minute in-memory cache. `enabledForPlans: null` or `[]` = all plans allowed. Client-side `PlanGate` overlays in mobile app.
- **Privacy-first Design:** 8 privacy toggles, sensitive data (stress, sleep, medicines) default to OFF. DPDPA 2023 compliant.
- **Offline-first Capability:** Offline queue table for data synchronization.
- **Semantic Caching:** Food scan checks DB cache to reduce AI API calls.
- **Blood Emergency System:** Double OTP verification, rate limiting, 48-hour auto-expiry, 90-day donor cooldown.
- **Data Entry Flexibility:** Photo, Text, and Voice input for Food, Exercise, and Water logging.
- **AI Food Discovery System:** AI-discovered foods with fuzzy duplicate detection, auto-promotion to `food_items` based on `hit_count`, Admin Panel review UI.
- **AI Provider Abstraction Layer:** `lib/ai.ts` routes features to correct AI provider (NVIDIA or Gemini), with `requireFeature()` middleware and in-memory cache.
- **Weather-Based Food Suggestions:** AI-powered seasonal Indian food recommendations.
- **App Sessions / DAU Tracking:** Tracks user sessions; DAU/MAU stats in Admin Panel.
- **Google Fit Integration:** `openAuthSessionAsync` on Android for OAuth flow. Callback via `APP_URL_BASE`.

## Key Files
- `artifacts/api-server/src/routes/index.ts` — all 27 route modules registered
- `artifacts/api-server/src/routes/modules/admin.ts` — admin endpoints including 9-stat overview
- `artifacts/api-server/src/middlewares/feature-check.ts` — feature flag middleware (5-min cache)
- `artifacts/api-server/src/lib/ai.ts` — AI provider abstraction (NVIDIA + Gemini)
- `artifacts/api-server/src/app.ts` — CORS config (aorane.com, aorane.in, vercel.app, onrender.com, replit.app)
- `artifacts/aorane-mobile/lib/api.ts` — 96 API calls, all endpoints verified
- `artifacts/aorane-mobile/app.json` — package: com.aorane.app, versionCode: 1
- `artifacts/aorane-landing/src/pages/PrivacyPage.tsx` — DPDPA 2023 compliant privacy policy
- `lib/db/src/schema/` — all Drizzle ORM table definitions
- `lib/db/src/index.ts` — `export * from "./schema"` (all tables exported)

## External Dependencies
- **Database:** PostgreSQL (Supabase — Mumbai)
- **Backend Framework:** Express.js (Node.js)
- **ORM:** Drizzle ORM
- **Mobile Development:** Expo (React Native) — Codemagic for APK builds
- **Frontend Development:** React + Vite
- **SMS Gateway:** Fast2SMS
- **Email:** Resend
- **OAuth:** Google OAuth
- **AI Services:** Gemini 2.5 Flash, NVIDIA DeepSeek, NVIDIA LLaMA 3.3 70B
- **Payment Gateway:** Razorpay (Live mode)
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Cloud Hosting (API Server):** Render (https://aorane.onrender.com)
- **Cloud Hosting (Landing + Business Portal):** Vercel (aorane.com, business.aorane.com)
- **Source Control + CI/CD:** GitHub (Mangesh-a-verma/Health-Data-Hub) → auto-deploy to Render
