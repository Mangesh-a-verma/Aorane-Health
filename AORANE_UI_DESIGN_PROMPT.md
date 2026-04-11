# AORANE — Complete UI Design Prompt
## (Use in Figma / Flutter / Google Stitch / Framer / Any Design Tool)

---

## PROJECT OVERVIEW

**App Name:** AORANE (आरण)
**Tagline:** Your health, in your hands 🇮🇳
**Type:** Indian Health & Wellness Mobile App (Android + iOS)
**Target Users:** Indian users, all age groups, semi-urban & urban, supports 10 languages
**Platform:** Mobile-first (375px width standard, also design for 390px iPhone 14 Pro)

---

## BRAND / DESIGN SYSTEM

### Colors
| Role | Hex Code | Usage |
|---|---|---|
| Background | `#F0FAFB` | All screen backgrounds |
| Primary | `#0077B6` | Buttons, active tabs, headers |
| Accent / Green | `#00B896` | Success states, health metrics, highlights |
| Dark Text | `#0D1F33` | Headings, important text |
| Medium Text | `#4A6175` | Subheadings, labels |
| Light Text | `#8EA7BA` | Placeholders, hints |
| Card White | `#FFFFFF` | Card backgrounds |
| Border | `#E2EFF5` | Card borders, input borders |
| Error | `#E53E3E` | Error messages |
| Warning | `#F6A623` | Warning badges |
| Dark Mode BG | `#0A1628` | Dark mode background |
| Dark Mode Card | `#1A2940` | Dark mode card |

### Typography
- **Font Family:** Use `Nunito` (Google Font) — warm, rounded, readable
- **Fallback:** Inter, SF Pro, Roboto
- **Scale:**
  - Display: 28px Bold
  - H1: 24px Bold
  - H2: 20px SemiBold
  - H3: 17px SemiBold
  - Body: 15px Regular
  - Small: 13px Regular
  - Micro: 11px Medium (labels, badges)

### Spacing System (8px base)
- xs: 4px | sm: 8px | md: 16px | lg: 24px | xl: 32px | xxl: 48px

### Border Radius
- Small: 8px | Medium: 12px | Large: 16px | XL: 24px | Full: 999px (pills)

### Shadows
- Card shadow: `0px 2px 12px rgba(0, 119, 182, 0.08)`
- Elevated: `0px 8px 24px rgba(0, 119, 182, 0.15)`

### Icons
- Use `Ionicons` or `Lucide React Native` icon set
- Icon size: 20px (nav), 24px (actions), 28px (feature icons)

---

## SCREENS TO DESIGN (Total: 18 Screens)

---

### SCREEN 1 — SPLASH / LOADING
**File:** splash.tsx
**Description:** Full screen splash shown for 2 seconds on app open

**Layout:**
- Background: Full gradient `#0077B6` → `#00B896` (top-left to bottom-right)
- Center: AORANE logo (circular, white background, teal color logo inside)
- Below logo: App name "AORANE" in white, 32px Bold
- Below name: Tagline "Your health, in your hands 🇮🇳" in white/80%, 14px
- Bottom: Loading dots animation (3 dots, pulsing)
- Very bottom: "Made in India 🇮🇳" in white/50%, 11px

---

### SCREEN 2 — LOGIN
**File:** app/(auth)/login.tsx
**Description:** First screen user sees. Language selector + OTP/PIN login

**Layout (top to bottom):**

**Header Section:**
- Top padding: 60px
- AORANE logo (circular, 80px diameter): background `#0077B6`, teal lotus icon inside
- App name: "AORANE" — 22px Bold, `#0D1F33`
- Tagline: "Your health, in your hands 🇮🇳" — 13px, `#4A6175`
- Feature pills row (horizontal scroll): [AI Food Scan] [Exercise Tracker] [Health Score] [Medicine Remind]
  - Each pill: 8px padding, border `#E2EFF5`, 999px radius, 13px text

**Language Selector:**
- Label: "SELECT YOUR LANGUAGE" — 11px Bold, `#8EA7BA`, letter-spacing 1px
- Horizontal scrollable chip row:
  - Options: English | हिंदी | বাংলা | मराठी | తెలుగు | தமிழ் | ગુજરાતી | ಕನ್ನಡ | മലയാളം | ਪੰਜਾਬੀ
  - Active chip: `#0077B6` background, white text, 999px radius
  - Inactive chip: white background, `#4A6175` text, `#E2EFF5` border

**Login Card:**
- White card, 16px radius, shadow
- Card header: Blue phone icon (40px circle, `#0077B6`), "Login" (18px Bold), "OTP will be sent to your number" (13px, `#8EA7BA`)
- Tab switcher: [📱 OTP] [🔐 PIN] — full width, pill style. Active tab = `#0077B6` solid, inactive = transparent

**OTP Tab Content:**
- Phone input: Flag 🇮🇳 + "+91" | 10-digit number field
  - Border: `#E2EFF5`, 12px radius, 52px height
- "Send SMS OTP" button: Full width, `#0077B6`, white text, 52px height, 12px radius
- Divider: "— OR —"
- WhatsApp button: Green `#25D366`, WhatsApp icon, "WhatsApp" text, 50% width
- X (Twitter) button: Black, X icon, "X (Twitter)" text + "Soon" badge, 50% width

**PIN Tab Content:**
- 10-digit phone input (same as above)
- "Enter 4-Digit PIN" label
- 4 PIN boxes in a row (each 56x56px, border `#E2EFF5`, large font)
- "Login with PIN" button: `#0077B6` solid

**Footer:**
- 3 trust badges in a row: 🔒 256-bit Encrypted | ✅ DPDP Compliant | 🇮🇳 Made in India
- Font: 11px, `#8EA7BA`

---

### SCREEN 3 — OTP VERIFICATION
**File:** app/(auth)/verify-otp.tsx
**Description:** Enter 6-digit OTP received via SMS

**Layout:**
- Back arrow (top left)
- Lock shield icon (60px, `#0077B6`)
- Title: "OTP Verification" — 24px Bold
- Subtitle: "Enter the 6-digit code sent to +91 XXXXXXXXXX" — 14px, `#4A6175`
- 6 OTP input boxes in a row (each 48x56px, border 2px `#0077B6` when active, `#E2EFF5` inactive)
  - Auto-focus, auto-advance, numeric keyboard
- "Verify OTP" button: Full width, `#0077B6`, 52px
- "Resend OTP in 30s" countdown in gray, then "Resend OTP" clickable in `#0077B6`
- Dev mode note (if testing): small gray box showing "OTP: 123456"

---

### SCREEN 4 — PIN SETUP
**File:** app/(auth)/setup-pin.tsx
**Description:** First-time PIN creation (2 steps: set + confirm)

**Layout:**
- Shield + Lock icon (top, 64px, `#0077B6`)
- Step indicator: "Step 1 of 2" pill
- Title: "Create 4-Digit PIN" / "Confirm Your PIN"
- Subtitle: "Use this to login quickly next time"
- 4 large PIN boxes in a row (72x80px each)
  - Filled: dark circle inside, `#0077B6` border
  - Empty: gray border, transparent
- Custom numpad (4x3 grid):
  - Numbers 1-9, backspace button (←), 0
  - Each key: 72x56px, light gray background, 12px radius, 24px font
  - Active press: `#0077B6` flash
- Biometric toggle (if available): "Enable Face ID / Fingerprint" with toggle switch
- Progress dots at bottom (2 dots, active = filled `#0077B6`)

---

### SCREEN 5 — ONBOARDING: PROFILE SETUP (Step 1 of 5)
**File:** app/(onboarding)/index.tsx
**Description:** Basic personal info

**Layout:**
- Progress bar: 20% filled, `#0077B6`
- Step label: "Step 1 of 5 — Let's Get Started!"
- Title: "Introduce Yourself"
- Subtitle: "Help us personalize your health journey"
- Form fields (each 52px height, 12px radius, `#E2EFF5` border):
  - Full Name * (text input)
  - Age * (number input)
  - Date of Birth (date picker)
  - Gender (3 option selector: Male | Female | Other — pill buttons)
  - Blood Group (dropdown: A+, A-, B+, B-, O+, O-, AB+, AB-)
  - Medical Conditions (multi-select chips: Diabetes, Hypertension, Thyroid, Heart Disease, None)
  - Emergency Contact Name
  - Emergency Contact Phone
- "Required Information" notice (small, `#F6A623`)
- "Next →" button: Full width, `#0077B6`, 52px, 12px radius

---

### SCREEN 6 — ONBOARDING: PHYSICAL DETAILS (Step 2 of 5)
**File:** app/(onboarding)/physical.tsx

**Layout:**
- Progress bar: 40% filled
- Title: "Physical Details"
- BMI Calculator card:
  - Height input (cm) + Weight input (kg) — side by side
  - BMI display: Large number (e.g., "22.5") + category badge (Normal/Overweight/Underweight)
  - BMI color: Green (Normal), Orange (Overweight), Red (Obese), Blue (Underweight)
- Target Weight input
- Activity Level (radio buttons with icons):
  - 🛋️ Sedentary | 🚶 Light | 🏃 Moderate | 🏋️ Very Active | 🚀 Extra Active
- "Next →" button

---

### SCREEN 7 — ONBOARDING: HEALTH DETAILS (Step 3 of 5)
**File:** app/(onboarding)/health.tsx

**Layout:**
- Progress bar: 60%
- Title: "Health Information"
- Fields:
  - Current Medications (text area)
  - Known Allergies (chip multi-select)
  - Do you smoke? (Yes/No/Quit toggle)
  - Do you drink alcohol? (Yes/No/Occasionally)
  - Sleep Hours per night (slider: 4-12 hours)
  - Stress Level (slider: 1-10)
- "Next →" button

---

### SCREEN 8 — ONBOARDING: GOALS (Step 4 of 5)
**File:** app/(onboarding)/goals.tsx

**Layout:**
- Progress bar: 80%
- Title: "Your Main Goal?"
- 2x3 grid of large goal cards (each 160x140px):
  - Each card: emoji (48px) + goal name + description
  - Cards: 🏋️ Lose Weight | 💪 Build Muscle | 🍎 Eat Healthy | 😴 Better Sleep | 🧘 Reduce Stress | 🏃 Get Fit
  - Selected card: `#0077B6` border 2px + light blue background
- "Next →" button

---

### SCREEN 9 — ONBOARDING: LIFESTYLE (Step 5 of 5)
**File:** app/(onboarding)/lifestyle.tsx

**Layout:**
- Progress bar: 100%
- Title: "Your Lifestyle" + "Last Step!"
- Work Profile (icon+label selector):
  - 🏠 Work from Home | 🏢 Office Job | 🏭 Field Work | 👨‍🍳 Manual Labor | 🎓 Student
- Meal Preference (chips):
  - 🌿 Vegetarian | 🥩 Non-Veg | 🥗 Vegan | 🍳 Eggetarian | 🌾 Jain
- Food Allergies (chips): Gluten | Dairy | Nuts | Soy | None
- Preferred Language (same language selector as login screen)
- "Complete Setup 🎉" button: Full width gradient `#0077B6` → `#00B896`

---

### SCREEN 10 — DASHBOARD (Main Home Tab)
**File:** app/(tabs)/dashboard.tsx
**Description:** Main screen after login. Health overview.

**Layout:**

**Header (non-scrollable):**
- Left: "Good Morning, [Name]! 👋" — 20px Bold
- Left below: "Saturday, 11 April" — 13px, `#4A6175`
- Right: Notification bell icon + Profile avatar (32px circle)

**Health Score Card (large, gradient `#0077B6` → `#005A8E`):**
- "Your Health Score" label — white
- Large circular progress ring (120px): Score number inside (0-100)
  - Ring fill color based on score: Red < 40, Orange 40-70, Green > 70
- "View Detailed Report" link — white/80%

**Quick Stats Row (4 cards, horizontally scrollable):**
Each card (85px width):
- Steps 🚶: Count + "/ 10,000" goal
- Calories 🔥: kcal consumed
- Water 💧: glasses / 8 goal
- Sleep 😴: hours last night
- Card: white, 12px radius, shadow

**Quick Action Grid (2x2):**
Each action button (full half-width, 80px height):
- 🍎 Log Meal | 💊 Add Medicine | 🏃 Log Exercise | 📊 Health Report
- Style: white card, icon + label, 12px radius

**Today's Meals Card:**
- "Today's Nutrition" header
- Horizontal progress bars: Protein | Carbs | Fat | Fiber
- Each bar: label + current/goal + colored fill bar

**Wearable Sync Banner (if not connected):**
- `#FFF8E7` background, orange border
- "Connect your Wearable" — Fitbit | Mi Band | Apple Watch icons
- "Connect Now" button

**Recent Activity Feed:**
- List of recent logs with time (Exercise logged, Meal added, etc.)

---

### SCREEN 11 — DIET / FOOD LOG TAB
**File:** app/(tabs)/diet.tsx

**Layout:**
- Header: "Diet & Nutrition" + Today's date
- Calorie ring (top center): Consumed / Goal with remaining
- Macro breakdown (4 pills): Protein | Carbs | Fat | Fiber — each with progress bar
- "Add Food" FAB button (bottom right, `#0077B6`, +icon)
- Meal sections (expandable cards):
  - 🌅 Breakfast | ☀️ Lunch | 🌙 Dinner | 🥤 Snacks
  - Each section: Calorie count badge + food items list
  - Each food item: name + quantity + kcal + delete button
- Water tracker: "💧 Water Intake" + 8 glass icons (filled/empty) + "Add Glass" button

---

### SCREEN 12 — AI FOOD SCAN
**File:** app/(tabs)/food.tsx
**Description:** Camera-based food recognition using AI

**Layout:**
- Camera viewfinder (full screen, 65% height)
- Overlay guide: Rounded rectangle frame in center ("Point at your food")
- Bottom sheet (35% height):
  - "AI Food Scan" header
  - [📷 Take Photo] [🖼️ Gallery] buttons side by side
  - OR "Type food name" text input with search
  - After scan: Food name + confidence % + nutrition info card
    - Calories, Protein, Carbs, Fat, Fiber values
  - "Add to Today's Log" button: `#00B896` green, full width

---

### SCREEN 13 — EXERCISE TAB
**File:** app/(tabs)/exercise.tsx

**Layout:**
- Header: "Exercise Tracker"
- Today's Summary card: Total kcal burned + minutes active + steps
- "Log Exercise" card:
  - Exercise type dropdown (Walking, Running, Cycling, Yoga, Gym, Swimming, etc.)
  - Duration input (minutes)
  - Intensity selector: Light | Moderate | Intense (pill buttons)
  - AI Estimate: "~320 kcal will be burned" (auto-calculated)
  - "Log Exercise" button: `#0077B6`
- Exercise History list (last 7 days):
  - Each entry: Exercise icon + name + duration + kcal burned + date/time
  - Delete swipe action

---

### SCREEN 14 — MEDICINE / HEALTH TAB
**File:** app/(tabs)/medicine.tsx

**Layout:**
- Header: "Medicine & Health" + "Manage your meds"
- "Scan Medical Report" card (prominent, `#0077B6` gradient):
  - Camera icon + "Scan Report / Prescription"
  - "AI will analyze your medical reports"
- "Add Medicine Reminder" card:
  - Medicine name input
  - Dosage input (e.g., "1 tablet")
  - Time picker
  - Frequency: Daily | Alternate | Weekly
  - "Set Reminder" button: `#00B896`
- "Today's Medicines" section:
  - List of scheduled medicines
  - Each: pill icon + name + time + "Take" / "Taken" toggle
- Upcoming Reminders list

---

### SCREEN 15 — PROFILE TAB
**File:** app/(tabs)/profile.tsx

**Layout:**
- Profile header card (gradient `#0077B6`):
  - Avatar (80px circle, initials if no photo)
  - Name (white, 20px Bold)
  - "Premium Member" or "Free Plan" badge
  - Edit Profile icon (top right)
- Health Stats mini cards (2x2 grid):
  - Height | Weight | BMI | Blood Group
- Settings sections list:
  - 👤 Personal Information
  - 🏥 Health Information
  - 🔔 Notifications
  - 🌐 Language (shows current language)
  - 🌙 Dark Mode (toggle switch)
  - 🔒 Change PIN
  - 📱 Connected Wearables
  - ⭐ Upgrade to Premium
  - 📞 Support / Help
  - 🔒 Privacy Policy
  - 🚪 Logout (red text)
- Each row: icon + label + right arrow (chevron)

---

### SCREEN 16 — DARK MODE
**Description:** All screens must have a dark mode variant

**Dark Mode Colors:**
- Background: `#0A1628`
- Card: `#1A2940`
- Text Primary: `#FFFFFF`
- Text Secondary: `#8EA7BA`
- Input Border: `#2A3F58`
- Input Background: `#0F2035`
- Primary button: Same `#0077B6`
- Accent: Same `#00B896`

---

### SCREEN 17 — BOTTOM NAVIGATION TAB BAR
**File:** app/(tabs)/_layout.tsx
**Description:** Always visible bottom nav (5 tabs)

**Layout:**
- Height: 60px + safe area bottom
- Background: White (light) / `#1A2940` (dark)
- Top border: 1px `#E2EFF5`
- 5 tabs evenly spaced:
  - 🏠 Home (dashboard)
  - 🍎 Diet
  - 🍽️ Food Scan (center, elevated FAB style — larger, `#0077B6` circle background)
  - 🏃 Exercise
  - 👤 Profile
- Active tab: `#0077B6` color icon + label
- Inactive: `#8EA7BA` icon + label
- Label font: 11px Medium

---

### SCREEN 18 — PREMIUM UPGRADE
**Description:** Upsell screen for paid features

**Layout:**
- Full screen gradient background `#0077B6` → `#003F73`
- Gold crown icon (top, 64px)
- "AORANE Premium" — 28px Bold White
- "Unlock your full health potential"
- Feature list (white checkmark bullets):
  - ✅ Unlimited AI Food Scans
  - ✅ Advanced Health Reports
  - ✅ Wearable Sync (Fitbit, Mi Band)
  - ✅ WhatsApp Health Alerts
  - ✅ Priority Doctor Consultation
  - ✅ Family Health Dashboard (5 members)
- Pricing cards (2 options):
  - Monthly: ₹199/month
  - Yearly: ₹1499/year (save 37% badge in orange)
- "Start Free Trial" button: White background, `#0077B6` text, 52px
- "Continue Free" link below (white/60%)

---

## COMPONENT LIBRARY (Reusable)

### Input Field
- Height: 52px
- Border: 1.5px `#E2EFF5` (normal), `#0077B6` (focused), `#E53E3E` (error)
- Border radius: 12px
- Left icon (optional): 20px, `#8EA7BA`
- Font: 15px, `#0D1F33`
- Placeholder: `#8EA7BA`
- Error text below: 12px, `#E53E3E`

### Primary Button
- Height: 52px
- Background: `#0077B6`
- Text: 16px SemiBold White
- Border radius: 12px
- Press state: 0.9 opacity + slight scale down

### Gradient Button
- Same as primary but gradient `#0077B6` → `#00B896`

### Card
- Background: White
- Border: 1px `#E2EFF5`
- Border radius: 16px
- Shadow: `0px 2px 12px rgba(0, 119, 182, 0.08)`
- Padding: 16px

### Badge / Pill
- Padding: 4px 10px
- Border radius: 999px
- Font: 12px SemiBold
- Colors by type: Blue (info), Green (success), Orange (warning), Red (error)

### Toggle Switch
- On: `#0077B6` track, white thumb
- Off: `#E2EFF5` track, white thumb

---

## ANIMATIONS & INTERACTIONS

- Screen transitions: Slide from right (forward), Slide to right (back)
- Button press: Scale 0.97 + opacity 0.9 (150ms ease)
- Card appear: Fade up (translateY 20px → 0, opacity 0→1, 300ms)
- Tab switch: Instant with icon scale bounce
- Loading states: Skeleton shimmer (gray animated gradient)
- Success: Green checkmark with circle expand animation
- Error shake: Input field shakes horizontally 3x

---

## LOCALIZATION / MULTI-LANGUAGE NOTES

All text in screens must be in variables (no hardcoded strings).
Supported languages: English, Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Malayalam, Punjabi

RTL: Not required (all Indian languages are LTR)
Font support: Use `Noto Sans` family as fallback to support all Indian scripts

---

## USER FLOWS (for Prototype Connections)

1. **New User:** Splash → Login (OTP tab) → Verify OTP → Onboarding Step 1→2→3→4→5 → Dashboard
2. **Returning User (OTP):** Splash → Login → Verify OTP → Dashboard
3. **Returning User (PIN):** Splash → Login (PIN tab) → Enter PIN → Dashboard
4. **Log Meal:** Dashboard → Diet Tab → Add Food button → Search/Scan → Add to Log
5. **AI Food Scan:** Food Tab → Camera → Take Photo → View Results → Add to Log
6. **Log Exercise:** Exercise Tab → Select type + duration → Log → See updated calories
7. **Medicine Reminder:** Medicine Tab → Add Medicine → Set time → Reminder set
8. **Change Language:** Profile → Language → Select Language → All screens update

---

## FIGMA-SPECIFIC INSTRUCTIONS

1. Create a **Design System page** first with: Colors, Typography, Components, Icons
2. Create each screen on separate frames (375x812px = iPhone 13 size)
3. Use **Auto Layout** for all rows and cards
4. Create **Components** for: Header, Bottom Nav, Input Field, Button, Card, Badge
5. Use **Variants** for: Button (primary/secondary/disabled), Input (empty/filled/error/focused)
6. Create **Prototype connections** for the 8 user flows listed above
7. Create a **Dark Mode** variant for each frame using color variables

---

## FLUTTER-SPECIFIC INSTRUCTIONS

```dart
// Theme Setup
ThemeData(
  colorScheme: ColorScheme.light(
    primary: Color(0xFF0077B6),
    secondary: Color(0xFF00B896),
    background: Color(0xFFF0FAFB),
    surface: Colors.white,
    onPrimary: Colors.white,
    error: Color(0xFFE53E3E),
  ),
  fontFamily: 'Nunito',
  cardTheme: CardTheme(
    elevation: 2,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    color: Colors.white,
  ),
  inputDecorationTheme: InputDecorationTheme(
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  ),
)
```

**Key Flutter Packages to use:**
- `flutter_localizations` — for multi-language
- `provider` or `riverpod` — state management
- `fl_chart` — charts and graphs (for health metrics)
- `image_picker` + `camera` — food scan
- `local_auth` — fingerprint/face ID
- `razorpay_flutter` — payments
- `firebase_messaging` — push notifications
- `google_fonts` — Nunito font

---

## ASSETS NEEDED

1. **AORANE Logo** — Circular, white bg, teal `#00B896` lotus/leaf icon
2. **App Icon** — 1024x1024px, `#0077B6` background, white lotus icon
3. **Splash Screen** — Gradient bg + centered logo + tagline
4. **Exercise Icons** — Running, Walking, Cycling, Yoga, Gym, Swimming (SVG)
5. **Food Category Icons** — Breakfast, Lunch, Dinner, Snacks (SVG)
6. **Onboarding Illustrations** — 5 simple health-themed illustrations
7. **Empty State Illustrations** — "No data yet" for each tab

---

*This prompt is for AORANE v1.0 — Indian Health Platform*
*Contact: superadmin@aorane.in*
*Build target: Android 5.0+ / iOS 13+*
