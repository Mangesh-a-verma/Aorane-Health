import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import type { Admin, Org } from "@/lib/api";

export default function AuthRedirect() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("t");
      const adminStr = params.get("a");
      const orgStr = params.get("o");

      if (!token || !adminStr || !orgStr) {
        setStatus("error");
        return;
      }

      const admin = JSON.parse(adminStr) as Admin;
      const org = JSON.parse(orgStr) as Org;

      if (!admin?.id || !org?.id) {
        setStatus("error");
        return;
      }

      login(token, admin, org);
      navigate("/dashboard");
    } catch {
      setStatus("error");
    }
  }, []);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #020B18 0%, #051B2C 100%)" }}>
        <div className="text-center text-white">
          <p className="text-lg font-semibold mb-3">Authentication failed</p>
          <a href="/login" className="text-sm underline" style={{ color: "#38BDF8" }}>
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #020B18 0%, #051B2C 100%)" }}>
      <div className="text-center text-white">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-white/60">Setting up your dashboard...</p>
      </div>
    </div>
  );
}
