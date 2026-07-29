import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { api, type Admin, type Org } from "@/lib/api";

const INACTIVITY_MS = 15 * 60 * 1000;
const WARNING_MS    = 14 * 60 * 1000;

interface AuthState {
  token: string | null;
  admin: Admin | null;
  org: Org | null;
  isLoading: boolean;
  subscriptionStatus: string | null;
  subscriptionLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string, admin: Admin, org: Org) => void;
  logout: () => void;
  setOrg: (org: Org) => void;
  refreshSubscription: () => Promise<void>;
  isPaidActive: boolean;
  inactiveWarning: boolean;
  resetInactivityTimer: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null, admin: null, org: null, isLoading: true,
    subscriptionStatus: null, subscriptionLoading: false,
  });
  const [inactiveWarning, setInactiveWarning] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = useCallback((andRedirect = false) => {
    localStorage.removeItem("bp_token");
    localStorage.removeItem("bp_admin");
    localStorage.removeItem("bp_org");
    localStorage.removeItem("bp_last_active");
    setInactiveWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current)    clearTimeout(warningTimer.current);
    setState({ token: null, admin: null, org: null, isLoading: false, subscriptionStatus: null, subscriptionLoading: false });
    if (andRedirect) {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "/business-portal";
      window.location.href = base + "/login";
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    localStorage.setItem("bp_last_active", Date.now().toString());
    setInactiveWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current)    clearTimeout(warningTimer.current);
    warningTimer.current    = setTimeout(() => setInactiveWarning(true), WARNING_MS);
    inactivityTimer.current = setTimeout(() => {
      localStorage.setItem("bp_session_expired", "inactivity");
      clearSession(true);
    }, INACTIVITY_MS);
  }, [clearSession]);

  const fetchSubscription = async () => {
    setState((s) => ({ ...s, subscriptionLoading: true }));
    try {
      const data = await api.getBillingSubscription();
      setState((s) => ({ ...s, subscriptionStatus: data?.payment?.status || null, subscriptionLoading: false }));
    } catch {
      setState((s) => ({ ...s, subscriptionStatus: null, subscriptionLoading: false }));
    }
  };

  useEffect(() => {
    const token     = localStorage.getItem("bp_token");
    const adminStr  = localStorage.getItem("bp_admin");
    const orgStr    = localStorage.getItem("bp_org");
    const lastActive = localStorage.getItem("bp_last_active");

    if (lastActive && Date.now() - parseInt(lastActive) > INACTIVITY_MS) {
      clearSession(true);
      return;
    }

    if (token && token !== "undefined" && token !== "null" && adminStr && orgStr) {
      try {
        const admin = JSON.parse(adminStr);
        const org   = JSON.parse(orgStr);
        if (admin?.id && org?.id) {
          setState({ token, admin, org, isLoading: false, subscriptionStatus: null, subscriptionLoading: true });
          fetchSubscription();
          resetInactivityTimer();
          return;
        }
      } catch { /* fall through */ }
    }
    clearSession();
  }, []);

  useEffect(() => {
    if (!state.token) return;
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];
    const handler = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current)    clearTimeout(warningTimer.current);
    };
  }, [state.token, resetInactivityTimer]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && state.token) {
        localStorage.setItem("bp_last_active", Date.now().toString());
      }
      if (document.visibilityState === "visible" && state.token) {
        const last = localStorage.getItem("bp_last_active");
        if (last && Date.now() - parseInt(last) > INACTIVITY_MS) {
          clearSession(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state.token, clearSession]);

  const login = (token: string, admin: Admin, org: Org) => {
    if (!token || token === "undefined" || !admin?.id || !org?.id) return;
    localStorage.setItem("bp_token", token);
    localStorage.setItem("bp_admin", JSON.stringify(admin));
    localStorage.setItem("bp_org", JSON.stringify(org));
    localStorage.setItem("bp_last_active", Date.now().toString());
    setState({ token, admin, org, isLoading: false, subscriptionStatus: null, subscriptionLoading: true });
    fetchSubscription();
    resetInactivityTimer();
  };

  const logout = () => { clearSession(true); };

  const setOrg = (org: Org) => {
    localStorage.setItem("bp_org", JSON.stringify(org));
    setState(s => ({ ...s, org }));
  };

  const isPaidActive = state.subscriptionStatus === "success" || state.subscriptionStatus === "active";

  return (
    <AuthContext.Provider value={{
      ...state, login, logout, setOrg,
      refreshSubscription: fetchSubscription,
      isPaidActive, inactiveWarning, resetInactivityTimer,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
