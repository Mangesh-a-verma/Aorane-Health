# AORANE — Indian Health Platform

## Overview
AORANE is an Indian health platform designed to provide comprehensive health management. It comprises a mobile application for individual health tracking, a business portal for organizations, and an admin panel for platform control. The platform aims to revolutionize health management in India by offering personalized health insights, integrating with various health services, and providing robust administrative capabilities.

## User Preferences
I prefer detailed explanations and clear communication. Please ask before making any major changes to the codebase or architectural decisions. I want to follow an iterative development process, focusing on completing one feature set before moving to the next.

## System Architecture
AORANE's architecture consists of three main components: a mobile app (built with Expo/React Native), a Business Portal (React Web CRM), and an Admin Panel (React Web). All components share a single PostgreSQL database (managed by Supabase) and an Express.js API server, leveraging Drizzle ORM. Redis (Upstash) is used for caching.

**UI/UX Decisions:**
- **Mobile App:** Complete Apple Health-inspired redesign with white (#FFFFFF) background, Trust Blue (#007AFF) primary, Mint Green (#34C759) accent. Design system in `lib/theme.ts` (DS tokens). Lucide icons for general UI, MaterialCommunityIcons for exercise-specific icons. Glassmorphism glass headers (BlurView on iOS, semi-transparent on Android). White card sections with subtle blue shadows. CustomTabBar with animated pill. Screens: Dashboard (Paytm-style 3×2 grid), Exercise, Food, Medicine, Profile — all fully redesigned.
- **Business Portal:** Designed with a dark sidebar displaying organization information and seat progress, and a top bar with an organization code chip. Uses AORANE Blue (#0077B6) and Teal (#1B998B) on a dark navy background.
- **Admin Panel:** Features a dark navy sidebar with a prominent "ADMIN PANEL" badge and AORANE blue/teal accents.

**Technical Implementations & Feature Specifications:**
- **Authentication:** Utilizes JWT for sessions (30-day user, 12-hour admin), OTP via Fast2SMS, and Google OAuth.
- **AI Integration:** Gemini 2.0 Flash is integrated for advanced features like food scanning, diet plans, health tips, and medical report analysis. The Admin Panel allows per-feature AI configuration.
- **Payment Gateway:** Razorpay is integrated for handling subscriptions and payments.
- **Notifications:** Firebase FCM and Fast2SMS are used for notifications.
- **Storage:** Supabase handles file storage.
- **Database Schema:** A comprehensive PostgreSQL schema includes tables for users, health data (food, exercise, water, medicine, stress, period, medical reports), community features (family groups, blood donation), business entities (organizations, members, enrollment codes), revenue (subscriptions, payments, promo codes), and platform infrastructure.
- **Privacy-first Design:** Features 8 privacy toggles, with sensitive data logging (Stress, Sleep, Medicine) defaulting to OFF.
- **Offline-first Capability:** An offline queue table is implemented for data synchronization when connectivity is restored.
- **Semantic Caching:** Food scan checks a database cache first to reduce AI API calls.
- **Blood Emergency System:** Implements double OTP verification, rate limiting, and 48-hour auto-expiry for blood requests.
- **Global Readiness:** Tables are designed to support `country_code`, `language_code`, and RTL (Right-to-Left) for future internationalization.
- **Data Entry Flexibility:** Supports Photo, Text, and Voice input for logging Food, Exercise, and Water.

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