import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/lib/storage";
import { api, setUnauthorizedCallback } from "@/lib/api";

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

type AuthContextType = AuthState & {
  loginWithToken: (token: string, refreshToken: string, user: User, isNewUser: boolean) => Promise<void>;
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

  useEffect(() => {
    initAuth();
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

  const loginWithToken = useCallback(async (token: string, refreshToken: string, user: User, isNewUser: boolean) => {
    await storage.setToken(token);
    await storage.setRefreshToken(refreshToken);
    await storage.setUser(user as Record<string, unknown>);
    const onboarding = isNewUser ? false : await storage.isOnboardingDone();
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
