import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { storage } from "@/lib/storage";
import { api, setUnauthorizedCallback } from "@/lib/api";
import { logSilentError } from "@/lib/silentCatch";

type User = {
  id: string;
  phone?: string;
  email?: string;
  plan: string;
  languageCode: string;
};

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboardingDone: boolean;
  isPinSet: boolean;
  needsPinVerification: boolean;
  user: User | null;
  token: string | null;
};

const ONBOARDING_FINAL_STEP = 5; // goals.tsx is step 5 of 5

type AuthContextType = AuthState & {
  loginWithToken: (token: string, refreshToken: string, user: User, isNewUser: boolean, onboardingStep?: number) => Promise<void>;
  logout: () => Promise<void>;
  setOnboardingComplete: () => Promise<void>;
  setPinComplete: () => Promise<void>;
  clearPinVerification: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    isOnboardingDone: false,
    isPinSet: false,
    needsPinVerification: false,
    user: null,
    token: null,
  });
  const isAuthenticatedRef = useRef(false);
  // ✅ FIX STARTUP: Track when the app was launched so we don't fire getMe()
  // during the cold-start window (first 5s). On cold start, the first AppState
  // "active" event fires immediately and this was triggering a getMe() API call
  // competing with initAuth's SecureStore reads and the font loading.
  const appLaunchTimeRef = useRef(Date.now());

  useEffect(() => {
    initAuth();
  }, []);

  // Refresh user plan from server whenever app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const msSinceLaunch = Date.now() - appLaunchTimeRef.current;
      if (nextState === "active" && isAuthenticatedRef.current && msSinceLaunch > 5000) {
        api.getMe().then((res) => {
          if (res?.user) {
            storage.setUser(res.user as unknown as Record<string, unknown>);
            setState((s) => s.isAuthenticated ? { ...s, user: res.user as unknown as typeof s.user } : s);
          }
        }).catch((e) => logSilentError('background-task', e));
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setUnauthorizedCallback(() => {
      setState({
        isLoading: false,
        isAuthenticated: false,
        isOnboardingDone: false,
        isPinSet: false,
        needsPinVerification: false,
        user: null,
        token: null,
      });
    });
    return () => setUnauthorizedCallback(() => {});
  }, []);

  async function initAuth() {
    try {
      const [token, user, onboarding, pinSet] = await Promise.all([
        storage.getToken(),
        storage.getUser(),
        storage.isOnboardingDone(),
        storage.isPinSet(),
      ]);
      if (token && user) {
        isAuthenticatedRef.current = true;
        setState({
          isLoading: false,
          isAuthenticated: true,
          isOnboardingDone: onboarding,
          isPinSet: pinSet,
          needsPinVerification: pinSet,
          user: user as User,
          token,
        });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }

  const loginWithToken = useCallback(async (token: string, refreshToken: string, user: User, isNewUser: boolean, onboardingStep = 0) => {
    isAuthenticatedRef.current = true;
    await storage.setToken(token);
    await storage.setRefreshToken(refreshToken);
    await storage.setUser(user as Record<string, unknown>);

    // Determine onboarding status:
    // 1. New users always need onboarding
    // 2. Returning users: trust DB onboarding_step (not AsyncStorage which gets cleared on logout/reinstall)
    const serverSaysDone = !isNewUser && onboardingStep >= ONBOARDING_FINAL_STEP;
    // Sync AsyncStorage so app-open (initAuth) also works without network
    if (serverSaysDone) await storage.setOnboardingDone(true);
    const onboarding = serverSaysDone ? true : (isNewUser ? false : await storage.isOnboardingDone());

    const pinSet = await storage.isPinSet();
    setState({
      isLoading: false,
      isAuthenticated: true,
      isOnboardingDone: onboarding,
      isPinSet: pinSet,
      needsPinVerification: false,
      user,
      token,
    });
  }, []);

  const logout = useCallback(async () => {
    isAuthenticatedRef.current = false;
    await storage.clearTokens();
    setState({
      isLoading: false,
      isAuthenticated: false,
      isOnboardingDone: false,
      isPinSet: false,
      needsPinVerification: false,
      user: null,
      token: null,
    });
  }, []);

  const setOnboardingComplete = useCallback(async () => {
    await storage.setOnboardingDone(true);
    setState((s) => ({ ...s, isOnboardingDone: true }));
  }, []);

  const setPinComplete = useCallback(async () => {
    await storage.setPinSet(true);
    setState((s) => ({ ...s, isPinSet: true, needsPinVerification: false }));
  }, []);

  const clearPinVerification = useCallback(() => {
    setState((s) => ({ ...s, needsPinVerification: false }));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (res.user) {
        await storage.setUser(res.user as unknown as Record<string, unknown>);
        setState((s) => ({ ...s, user: res.user as unknown as User }));
      }
    } catch { }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loginWithToken, logout, setOnboardingComplete, setPinComplete, clearPinVerification, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}