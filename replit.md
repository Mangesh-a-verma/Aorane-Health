# AORANE — Indian Health Platform

## Overview
AORANE is an Indian health platform designed to provide comprehensive health management through a mobile application for individual health tracking, a business portal for organizations, and an admin panel for platform control. The platform aims to revolutionize health management in India by offering personalized health insights, integrating with various health services, and providing robust administrative capabilities. Key features include AI-powered health insights, dynamic plan pricing, privacy-first design, and a robust payment system.

## User Preferences
I prefer detailed explanations and clear communication. Please ask before making any major changes to the codebase or architectural decisions. I want to follow an an iterative development process, focusing on completing one feature set before moving to the next.

## System Architecture
AORANE's architecture is composed of a mobile app (Expo/React Native), a Business Portal (React Web CRM), and an Admin Panel (React Web). All components share a single PostgreSQL database (managed by Supabase) and an Express.js API server, leveraging Drizzle ORM. Redis (Upstash) is used for caching.

**UI/UX Decisions:**
- **Mobile App:** Features an Apple Health-inspired redesign with a white background, Trust Blue primary color, Mint Green accent, and custom design system (DS tokens). It uses Lucide and MaterialCommunityIcons, glassmorphism headers, white card sections with subtle blue shadows, and a custom animated pill-shaped TabBar. Screens include a Paytm-style Dashboard, Exercise, Food, Medicine, and Profile.
- **Business Portal:** Employs a light theme with a professional split-panel login. It displays aggregate health analytics using charts, supports seat-based billing with GST splits, and includes verification structures for email and phone OTP. The color scheme uses AORANE Blue and Teal on a white background.
- **Admin Panel:** Characterized by a dark navy sidebar with an "ADMIN PANEL" badge and AORANE blue/teal accents.

**Technical Implementations & Feature Specifications:**
- **Authentication:** JWT for sessions, OTP via Fast2SMS, and Google OAuth.
- **AI Integration:** Gemini 2.5 Flash powers Smart Scan (vision for food/report/medicine), diet plans, and health tips, utilizing a Replit AI Integrations proxy. NVIDIA DeepSeek handles non-vision AI tasks. The Admin Panel allows per-feature AI configuration via an `ai_config` table. NVIDIA LLaMA 3.3 70B is used for diet plans, health tips, meal swaps, stress insights, daily suggestions, and text food search.
- **Payment Gateway:** Razorpay is integrated for subscriptions and payments.
- **Dynamic Plan Pricing Engine:** An Admin panel feature allows real-time updates to plan prices and features, which automatically reflect across the Mobile App and Business Portal without code changes.
- **Notifications:** Firebase FCM and Fast2SMS are used for push and SMS notifications.
- **Storage:** Supabase manages file storage.
- **Database Schema:** A comprehensive PostgreSQL schema supports users, health data, community features, business entities, revenue management, and platform infrastructure. Tables are designed for `country_code`, `language_code`, and RTL support.
- **Plan-based Feature Gating:** Implemented server-side using `feature_flags.enabled_for_plans` and client-side `PlanGate` overlays.
- **Privacy-first Design:** Includes 8 privacy toggles, with sensitive data logging defaulting to OFF.
- **Offline-first Capability:** An offline queue table for data synchronization.
- **Semantic Caching:** Food scan checks a database cache to reduce AI API calls.
- **Blood Emergency System:** Features double OTP verification, rate limiting, and 48-hour auto-expiry for requests.
- **Data Entry Flexibility:** Supports Photo, Text, and Voice input for logging Food, Exercise, and Water.
- **AI Food Discovery System:** Manages AI-discovered foods with fuzzy duplicate detection, auto-promotion to `food_items` based on `hit_count`, and a dedicated Admin Panel UI for review and management.
- **AI Provider Abstraction Layer:** `lib/ai.ts` routes features to the correct AI provider (NVIDIA or Gemini), with `requireFeature()` middleware for access control and an in-memory cache.
- **Weather-Based Food Suggestions:** AI-powered seasonal Indian food recommendations presented in the mobile app.
- **App Sessions / DAU Tracking:** Tracks user sessions and provides Daily/Monthly Active User (DAU/MAU) statistics for the Admin Panel.
- **Blood Emergency V2:** Enforces a 90-day donor cooldown period and provides donor history.

## External Dependencies
- **Database:** PostgreSQL (Supabase)
- **Backend Framework:** Express.js (Node.js)
- **ORM:** Drizzle ORM
- **Mobile Development:** Expo (React Native)
- **Frontend Development:** React + Vite
- **Caching:** Upstash Redis
- **SMS Gateway:** Fast2SMS
- **OAuth:** Google OAuth
- **AI Services:** Gemini 2.0 Flash, NVIDIA DeepSeek, NVIDIA LLaMA 3.3 70B
- **Payment Gateway:** Razorpay
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Cloud Hosting (API Server):** Railway
- **Cloud Hosting (Frontend):** Render (for mobile app, business portal, admin panel)