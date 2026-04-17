import React, { createContext, useContext, useState, useEffect } from "react";
import type { Admin, Org } from "@/lib/api";

interface AuthState {
  token: string | null;
  admin: Admin | null;
  org: Org | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string, admin: Admin, org: Org) => void;
  logout: () => void;
  setOrg: (org: Org) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, admin: null, org: null, isLoading: true });

  useEffect(() => {
    const token = localStorage.getItem("bp_token");
    const adminStr = localStorage.getItem("bp_admin");
    const orgStr = localStorage.getItem("bp_org");
    if (token && token !== "undefined" && token !== "null" && adminStr && orgStr) {
      try {
        const admin = JSON.parse(adminStr);
        const org = JSON.parse(orgStr);
        if (admin?.id && org?.id) {
          setState({ token, admin, org, isLoading: false });
          return;
        }
      } catch { /* fall through */ }
    }
    localStorage.removeItem("bp_token");
    localStorage.removeItem("bp_admin");
    localStorage.removeItem("bp_org");
    setState((s) => ({ ...s, isLoading: false }));
  }, []);

  const login = (token: string, admin: Admin, org: Org) => {
    if (!token || token === "undefined" || !admin?.id || !org?.id) {
      console.error("AuthContext: invalid login data — token or admin/org missing");
      return;
    }
    localStorage.setItem("bp_token", token);
    localStorage.setItem("bp_admin", JSON.stringify(admin));
    localStorage.setItem("bp_org", JSON.stringify(org));
    setState({ token, admin, org, isLoading: false });
  };

  const logout = () => {
    localStorage.removeItem("bp_token");
    localStorage.removeItem("bp_admin");
    localStorage.removeItem("bp_org");
    setState({ token: null, admin: null, org: null, isLoading: false });
  };

  const setOrg = (org: Org) => {
    localStorage.setItem("bp_org", JSON.stringify(org));
    setState(s => ({ ...s, org }));
  };

  return <AuthContext.Provider value={{ ...state, login, logout, setOrg }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
