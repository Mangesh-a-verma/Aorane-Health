import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const PRIMARY = "#005d90";
const TEAL = "#006b56";
const BG = "#f7f9fe";

function Icon({ name, size = 20, color = PRIMARY }: { name: string; size?: number; color?: string }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: size, color, lineHeight: 1, display: "inline-block", userSelect: "none" }}>
      {name}
    </span>
  );
}

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password are required"); return; }
    setIsLoading(true); setError("");
    localStorage.removeItem("bp_token");
    localStorage.removeItem("bp_admin");
    localStorage.removeItem("bp_org");
    try {
      const res = await api.login(email, password);
      login(res.token, res.admin, res.org);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', sans-serif", display: "flex" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .hide-on-mobile { display: none !important; }
          .mobile-logo { display: flex !important; }
        }
      `}</style>

      {/* Left branding panel — desktop only */}
      <div
        className="hide-on-mobile"
        style={{
          width: 420, flexShrink: 0,
          background: `linear-gradient(160deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
          display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 40px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 56 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="monitor_heart" size={22} color="white" />
            </div>
            <span style={{ color: "white", fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>AORANE Business</span>
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "white", lineHeight: 1.25, margin: "0 0 16px", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}>
            Employee health, measured. Not guessed.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 1.75, margin: 0 }}>
            Real-time aggregate health analytics for your entire workforce — privacy-safe and built for Indian companies.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { icon: "dashboard", text: "Live aggregate health dashboard" },
            { icon: "manage_accounts", text: "Seat-based enrollment management" },
            { icon: "psychology", text: "AI-powered burnout detection" },
            { icon: "verified", text: "DPDP Act 2023 compliant" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={item.icon} size={18} color="white" />
              </div>
              <span style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Stat strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          {[
            { value: "500+", label: "Organizations" },
            { value: "98%", label: "Satisfaction" },
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp 0.5s ease forwards" }}>

          {/* Mobile logo */}
          <div className="mobile-logo" style={{ display: "none", alignItems: "center", gap: 10, marginBottom: 36 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="monitor_heart" size={20} color="white" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20" }}>AORANE Business</span>
          </div>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>
              Sign in to your organization account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
              <Icon name="error" size={18} color="#ef4444" />
              <span style={{ fontSize: 14, color: "#dc2626" }}>{error}</span>
            </div>
          )}

          {/* Form Card */}
          <div style={{ background: "white", borderRadius: 24, border: "1.5px solid rgba(191,199,209,0.3)", boxShadow: "0 8px 40px rgba(0,0,0,0.07)", padding: "36px 32px" }}>
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                    <Icon name="mail" size={18} color={focusedField === "email" ? PRIMARY : "#9ca3af"} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@yourcompany.com"
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "12px 16px 12px 44px", borderRadius: 12,
                      border: `2px solid ${focusedField === "email" ? PRIMARY : email ? PRIMARY + "40" : "#e5e7eb"}`,
                      background: "white", color: "#181c20", fontSize: 14,
                      outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
                      boxShadow: focusedField === "email" ? `0 0 0 3px ${PRIMARY}18` : "none",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                    <Icon name="lock" size={18} color={focusedField === "password" ? PRIMARY : "#9ca3af"} />
                  </div>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "12px 48px 12px 44px", borderRadius: 12,
                      border: `2px solid ${focusedField === "password" ? PRIMARY : password ? PRIMARY + "40" : "#e5e7eb"}`,
                      background: "white", color: "#181c20", fontSize: 14,
                      outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
                      boxShadow: focusedField === "password" ? `0 0 0 3px ${PRIMARY}18` : "none",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                  >
                    <Icon name={showPass ? "visibility_off" : "visibility"} size={18} color="#9ca3af" />
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
                  color: "white", fontWeight: 700, fontSize: 15, cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  opacity: isLoading ? 0.75 : 1,
                  boxShadow: "0 4px 20px rgba(0,93,144,0.28)",
                  transition: "all 0.2s", marginTop: 4,
                }}
              >
                {isLoading ? (
                  <>
                    <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <Icon name="arrow_forward" size={18} color="white" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer links */}
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <span style={{ fontSize: 14, color: "#9ca3af" }}>Don't have an account? </span>
            <a
              href="/business-portal/register"
              style={{ fontSize: 14, color: PRIMARY, fontWeight: 600, textDecoration: "none" }}
            >
              Register your organization
            </a>
          </div>

          {/* Trust */}
          <div style={{ marginTop: 28, padding: "16px 20px", background: "white", borderRadius: 14, border: "1.5px solid rgba(191,199,209,0.3)", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              {[
                { icon: "shield", text: "DPDP Act 2023" },
                { icon: "lock", text: "256-bit SSL" },
                { icon: "location_on", text: "Made in India" },
              ].map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name={b.icon} size={14} color={TEAL} />
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ textAlign: "center", marginTop: 16 }}>
            <a href="/business-portal/" style={{ fontSize: 13, color: "#9ca3af", textDecoration: "none" }}>
              ← Back to home
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
