# Mobile App Audit Report

## 1. Architecture & State Management

**Summary:** State management heavily relies on React's built-in hooks (`useState`, `useEffect`, `useCallback`, Context API). State flows relatively simply but could lead to performance bottlenecks under heavy use because of lack of optimization mechanisms like `React.memo` or `useMemo`. `AuthContext` relies on `AsyncStorage` and coordinates between offline and server state.

*   🟡 **WARNINGS**:
    *   **Overuse of `useState` / `useEffect` without Memoization:** Deeply nested component trees (e.g., in `wearable.tsx`, `dashboard.tsx`) frequently utilize large `useState` objects. A lack of `useMemo` and `React.memo` means that state updates will trigger full re-renders of large parent components and their children.
    *   **Potential Memory Leaks:** `useEffect` in several files might be lacking proper cleanup functions or referencing stale closures if dependencies are missing (needs deeper static analysis, but `wearable.tsx` complex state suggests this risk).
    *   **Context API for Global State:** While simple, `AuthContext` holds multiple changing pieces of state (`isLoading`, `isAuthenticated`, `user`, etc.). Any change here will re-render the entire app tree consuming it.
*   🟢 **OPTIMIZATIONS**:
    *   **State Colocation:** Consider pushing state down closer to where it's used or using more robust state management (Zustand, Redux) for complex domain state.
    *   **Memoization:** Audit components that render lists or complex SVG graphics and wrap them in `React.memo` where props don't change often.

## 2. Navigation & Routing (Expo Router)

**Summary:** The app uses Expo Router for file-based routing. It features stack navigation (`app/_layout.tsx`) and tab navigation (`app/(tabs)/_layout.tsx`), as well as specific groups for `(auth)` and `(onboarding)`. The root `index.tsx` functions effectively as an authentication/authorization gatekeeper.

*   🟡 **WARNINGS**:
    *   **Hardcoded route type casts:** `Redirect` uses `as never` for several routes (`href={"/(onboarding)/" as never}` and `href={"/(auth)/verify-pin" as never}`). This defeats Expo Router's static typing and suggests missing type generation or incorrect route definitions.
    *   **Root `index.tsx` Mount/Unmount logic:** Re-rendering `index.tsx` acts as the navigation guard. If state changes rapidly (e.g., during login), it might result in transient mounting of `SplashScreen` or jarring redirects. It's usually better to handle auth redirects via route groups and layout guards in Expo Router.
*   🟢 **OPTIMIZATIONS**:
    *   **Route Typing:** Run `npx expo customize tsconfig.json` to enable strict route types.
    *   **Transitions:** The transition into the tab navigator can be smoothed out using layout-level animations rather than relying solely on screen component mount animations.

## 3. API Integration & Error Handling

**Summary:** API calls are abstracted behind `lib/api.ts` utilizing `fetch` with AbortControllers for timeouts. There's a queueing mechanism (`lib/offlineQueue.ts`) for offline functionality and a retry mechanism for token refresh logic on `401 Unauthorized`. Custom errors (`APILimitError`) are properly modeled.

*   🟡 **WARNINGS**:
    *   **Silent Failures in Background:** Many API calls inside `useEffect` (e.g., `dashboard.tsx`) wrap `try {} catch {}` without updating any error state. This means users won't know if a dashboard widget failed to load, it will just show empty or infinite loading states.
    *   **Large API Surface in Single File:** `lib/api.ts` is ~750 lines long. It holds the entire API client, including auth refresh logic, offline queue integration, and all feature endpoints. This is becoming a God object.
*   🟢 **OPTIMIZATIONS**:
    *   **Extract API Domains:** Split `api.ts` into feature-specific domains (e.g., `api/auth.ts`, `api/health.ts`, `api/user.ts`).
    *   **React Query for Data Fetching:** A `QueryClient` is initialized in `app/_layout.tsx` but the app still primarily uses `useEffect` for data fetching. Adopting `@tanstack/react-query` thoroughly would solve the caching, background fetching, deduplication, and error-state issues present in `useState`/`useEffect` combinations.
    *   **Consistent Error UI:** Ensure every component doing an API call properly traps the error and displays an Error Boundary or standard Alert/Toast instead of silently swallowing exceptions.

## 4. Performance & Optimization

**Summary:** The app renders a lot of UI via `ScrollView` combined with `.map()` for lists. While `ScrollView` is fine for small numbers of items, it suffers severe performance penalties compared to `FlatList` for long or dynamic lists because it mounts all children immediately.

*   🟡 **WARNINGS**:
    *   **Over-reliance on `ScrollView` over `FlatList`:** In almost all list-like interfaces (evident from `grep -rn "<ScrollView"` returning 53 results vs 1 result for `<FlatList`), `ScrollView` with `.map()` is being used. If any of these lists grow (e.g., search results in food logging, history logs in wearable metrics), the main thread will block while it renders all nodes.
    *   **Re-rendering Heavy Assets/Images:** Without `React.memo` or proper list virtualization, updating a single state variable in a screen can cause all images and SVG icons in that screen to re-render.
*   🟢 **OPTIMIZATIONS**:
    *   **Implement `FlatList`:** Refactor any unbounded or long lists (search results, history logs, meal entries) to use `FlatList` with `keyExtractor` and `renderItem`.
    *   **Image Caching:** Verify `expo-image` is fully configured for aggressive caching of network images to prevent unnecessary network and memory strain.
    *   **Skeleton Loaders:** Ensure that complex screens don't block the UI thread during data fetching by showing lightweight animated skeletons instead of standard `ActivityIndicator` spinners for better perceived performance.

## 5. Code Quality & Hardcoding

**Summary:** The codebase makes use of custom utility libraries for API (`api.ts`), standard UI components (`components/`), and theme variables (`lib/theme.ts`). However, there are numerous violations of DRY and i18n principles inside the app screens.

*   🟡 **WARNINGS**:
    *   **Hardcoded Strings:** Widespread hardcoded English strings (e.g., `🔔 Notification Settings`, `Manual Data Entry` shown in `notification-settings.tsx` and `wearable.tsx`). These should use the `LanguageContext.tsx` `t()` translation function.
    *   **Inline Styles and Colors:** Many components are using inline styles with hardcoded hex codes (e.g., `<Text style={{ color: "#FFF", fontSize: 21... }}>`) instead of the shared `DS.color` tokens from `lib/theme.ts`. This makes dark mode or theme updates extremely difficult.
    *   **Platform Specific Hacks:** Usage of inline platform checks (`Platform.OS === 'web'`) litters components instead of being abstracted away into standard cross-platform hooks or wrapper components.
*   🟢 **OPTIMIZATIONS**:
    *   **Full Internationalization (i18n):** Replace all hardcoded English strings with localization keys utilizing the pre-existing translation system.
    *   **Stylesheet Refactor:** Extract all inline styles to `StyleSheet.create` and strictly enforce the usage of `DS.color` variables.

## 6. Critical Security & Stability Findings

*   🔴 **CRITICAL**:
    *   **Native Module Null Dereferencing (`wearable.tsx`):** The `_hc` check attempts to guard against `NativeModules.HealthConnect` being null, but Expo updates and native bridge delays can occasionally still bypass this, causing uncatchable JVM crashes on Android.
    *   **Authentication Token Leak Risk (`lib/api.ts`):** While tokens are stored in `SecureStore` (via `storage.ts`), `AsyncStorage` handles fallback/migration. A deep audit is needed to ensure legacy insecure token references don't persist on device storage after updates.
    *   **Unbounded Background Tasks:** There's polling in `useNetworkSync.ts` every 15 seconds. On low-end Android devices, this can lead to battery drain and the OS forcefully terminating the app.
