import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { clearSessionAndRedirect } from "@/lib/api";

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 14 * 60 * 1000;    // warn 1 min before logout

interface AdminUser { id: string; fullName: string; role: string; }
interface AuthState { token: string | null; admin: AdminUser | null; isLoading: boolean; }
interface AuthCtx extends AuthState {
  login: (token: string, admin: AdminUser) => void;
  logout: () => void;
  inactiveWarning: boolean;
  resetInactivityTimer: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, admin: null, isLoading: true });
  const [inactiveWarning, setInactiveWarning] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("ap_token");
    const adminStr = localStorage.getItem("ap_admin");
    if (token && adminStr) {
      try { setState({ token, admin: JSON.parse(adminStr), isLoading: false }); }
      catch { setState({ token: null, admin: null, isLoading: false }); }
    } else { setState((s) => ({ ...s, isLoading: false })); }
  }, []);

  const logout = useCallback((redirect = true) => {
    setState({ token: null, admin: null, isLoading: false });
    setInactiveWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (redirect) clearSessionAndRedirect();
  }, []);

  const resetInactivityTimer = useCallback(() => {
    setInactiveWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    warningTimer.current = setTimeout(() => setInactiveWarning(true), WARNING_MS);
    inactivityTimer.current = setTimeout(() => logout(), INACTIVITY_MS);
  }, [logout]);

  // ── Auto-logout on inactivity (persists across route changes) ──────────────
  useEffect(() => {
    if (!state.token) return;
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, [state.token, resetInactivityTimer]);

  // ── Tab visibility detection ───────────────────────────────────────────────
  useEffect(() => {
    if (!state.token) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        sessionStorage.setItem("aorane_hidden_at", Date.now().toString());
      } else {
        const hiddenAt = sessionStorage.getItem("aorane_hidden_at");
        if (hiddenAt) {
          const elapsed = Date.now() - Number(hiddenAt);
          sessionStorage.removeItem("aorane_hidden_at");
          if (elapsed > INACTIVITY_MS) logout();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state.token, logout]);

  const login = useCallback((token: string, admin: AdminUser) => {
    localStorage.setItem("ap_token", token);
    localStorage.setItem("ap_admin", JSON.stringify(admin));
    setState({ token, admin, isLoading: false });
  }, []);

  return (
    <Ctx.Provider value={{ ...state, login, logout, inactiveWarning, resetInactivityTimer }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
