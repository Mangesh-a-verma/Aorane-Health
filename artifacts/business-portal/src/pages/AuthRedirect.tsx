import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function AuthRedirect() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    async function handleRedirect() {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("t");

        if (!token || token === "undefined" || token === "null") {
          setErrMsg("Missing authentication token.");
          setStatus("error");
          return;
        }

        const { admin, org } = await api.getMe(token);

        if (!admin?.id || !org?.id) {
          setErrMsg("Could not load account data. Please log in.");
          setStatus("error");
          return;
        }

        login(token, admin, org);
        navigate("/dashboard");
      } catch (err) {
        setErrMsg((err as Error).message || "Authentication failed. Please log in.");
        setStatus("error");
      }
    }
    handleRedirect();
  }, []);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #020B18 0%, #051B2C 100%)" }}>
        <div className="text-center text-white p-8">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#ef4444" }}>error</span>
          </div>
          <p className="text-lg font-semibold mb-2">Authentication failed</p>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 20 }}>{errMsg}</p>
          <a href="/business-portal/login"
            style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, background: "#005d90", color: "white", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
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
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#38BDF8", margin: "0 auto 16px", animation: "pulse 1.5s ease infinite" }} />
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Setting up your dashboard...</p>
      </div>
    </div>
  );
}
