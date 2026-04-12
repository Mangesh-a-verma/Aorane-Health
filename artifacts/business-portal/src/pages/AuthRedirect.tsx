import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function AuthRedirect() {
  const [, navigate] = useLocation();
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

      localStorage.setItem("bp_token", token);
      localStorage.setItem("bp_admin", adminStr);
      localStorage.setItem("bp_org", orgStr);

      navigate("/dashboard");
    } catch {
      setStatus("error");
    }
  }, [navigate]);

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
