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

  // Password tab state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStep, setPasswordStep] = useState<"form" | "verify-otp">("form");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginOtpLoading, setLoginOtpLoading] = useState(false);

  // OTP tab state
  const [loginTab, setLoginTab] = useState<"password" | "otp">("otp");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"send" | "verify">("send");
  const [otpLoading, setOtpLoading] = useState(false);

  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Step 1: Validate password, send OTP
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password required"); return; }
    setIsLoading(true); setError(""); setDevOtp(null);
    localStorage.removeItem("bp_token");
    localStorage.removeItem("bp_admin");
    localStorage.removeItem("bp_org");
    try {
      const res = await api.login(email, password);
      if (res.requiresOtp) {
        if (res.devOtp) setDevOtp(res.devOtp);
        setPasswordStep("verify-otp");
      }
    } catch (err) {
      setError((err as Error).message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP, get token
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginOtpCode || loginOtpCode.length < 6) { setError("6-digit OTP daalen."); return; }
    setLoginOtpLoading(true); setError("");
    try {
      const res = await api.verifyLoginOtp(email, loginOtpCode);
      login(res.token, res.admin, res.org);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Invalid or expired OTP.");
    } finally {
      setLoginOtpLoading(false);
    }
  };

  // Email OTP tab handlers (business-admin specific)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)) {
      setError("Please enter a valid email address."); return;
    }
    setOtpLoading(true); setError(""); setDevOtp(null);
    try {
      const res = await api.sendBusinessEmailOtp(otpEmail);
      if (!res.sent && !res.devOtp) {
        setError("This email is not registered as a business admin. Please register your organization first.");
        return;
      }
      if (res.devOtp) setDevOtp(res.devOtp);
      setOtpStep("verify");
    } catch (err) {
      setError((err as Error).message || "Failed to send OTP.");
    } finally { setOtpLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) { setError("Enter the 6-digit OTP."); return; }
    setOtpLoading(true); setError("");
    try {
      const res = await api.verifyLoginOtp(otpEmail, otpCode);
      login(res.token, res.admin, res.org);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Invalid or expired OTP.");
    } finally { setOtpLoading(false); }
  };

  const getFormHandler = () => {
    if (loginTab === "password") {
      return passwordStep === "form" ? handleLogin : handleVerifyLoginOtp;
    }
    return otpStep === "send" ? handleSendOtp : handleVerifyOtp;
  };

  const resetPasswordTab = () => {
    setPasswordStep("form");
    setLoginOtpCode("");
    setDevOtp(null);
    setError("");
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

      {/* Left branding panel */}
      <div
        className="hide-on-mobile"
        style={{
          width: 420, flexShrink: 0,
          background: `linear-gradient(160deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
          display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 40px",
        }}
      >
        <div>
          <div style={{ marginBottom: 56 }}>
            <img src={import.meta.env.BASE_URL + 'logo-full.png'} alt="Aorane" style={{ height: 120, width: "auto", objectFit: "contain" }} />
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", marginTop: 6, textTransform: "uppercase" as const }}>Business Suite</div>
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "white", lineHeight: 1.25, margin: "0 0 16px", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}>
            Employee health, measured. Not guessed.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 1.75, margin: 0 }}>
            Real-time aggregate health analytics for your entire workforce — privacy-safe and built for Indian companies.
          </p>
        </div>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          {[{ value: "500+", label: "Organizations" }, { value: "98%", label: "Satisfaction" }].map((s, i) => (
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
            <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Aorane" style={{ width: 240, height: 240, objectFit: "contain" }} />
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20" }}>Aorane Business</span>
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

            {/* Tab switcher — only show when not in OTP verify step */}
            {passwordStep === "form" && (
              <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "#f3f4f6", borderRadius: 12, padding: 4 }}>
                {([["otp", "mail", "Email OTP"], ["password", "lock", "Password"]] as const).map(([tab, icon, label]) => (
                  <button key={tab} type="button"
                    onClick={() => { setLoginTab(tab); setError(""); setDevOtp(null); }}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
                      background: loginTab === tab ? "white" : "transparent",
                      color: loginTab === tab ? PRIMARY : "#6b7280",
                      fontWeight: loginTab === tab ? 700 : 500, fontSize: 13,
                      boxShadow: loginTab === tab ? "0 1px 6px rgba(0,0,0,0.10)" : "none",
                      transition: "all 0.18s",
                    }}
                  >
                    <Icon name={icon} size={16} color={loginTab === tab ? PRIMARY : "#9ca3af"} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Dev OTP banner */}
            {devOtp && (
              <div style={{ background: "#fef3c7", border: "2px solid #f59e0b", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>🔧 Dev Mode — Aapka OTP:</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#b45309", letterSpacing: 10, textAlign: "center", fontFamily: "monospace" }}>{devOtp}</div>
                <div style={{ fontSize: 11, color: "#92400e", marginTop: 6, textAlign: "center" }}>Email delivery unavailable. Copy this code below.</div>
              </div>
            )}

            <form onSubmit={getFormHandler()} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {loginTab === "password" ? (
                <>
                  {passwordStep === "form" ? (
                    <>
                      {/* Email */}
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email Address</label>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                            <Icon name="mail" size={18} color={focusedField === "email" ? PRIMARY : "#9ca3af"} />
                          </div>
                          <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="admin@yourcompany.com"
                            onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)}
                            style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px 12px 44px", borderRadius: 12, border: `2px solid ${focusedField === "email" ? PRIMARY : email ? PRIMARY + "40" : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 14, outline: "none", transition: "border-color 0.2s", boxShadow: focusedField === "email" ? `0 0 0 3px ${PRIMARY}18` : "none", fontFamily: "'Inter', sans-serif" }}
                          />
                        </div>
                      </div>
                      {/* Password */}
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                            <Icon name="lock" size={18} color={focusedField === "password" ? PRIMARY : "#9ca3af"} />
                          </div>
                          <input
                            type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)}
                            style={{ width: "100%", boxSizing: "border-box", padding: "12px 48px 12px 44px", borderRadius: 12, border: `2px solid ${focusedField === "password" ? PRIMARY : password ? PRIMARY + "40" : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 14, outline: "none", transition: "border-color 0.2s", boxShadow: focusedField === "password" ? `0 0 0 3px ${PRIMARY}18` : "none", fontFamily: "'Inter', sans-serif" }}
                          />
                          <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                            <Icon name={showPass ? "visibility_off" : "visibility"} size={18} color="#9ca3af" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Step 2 — OTP sent after password verified */
                    <div>
                      <div style={{ textAlign: "center", marginBottom: 20 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: `${PRIMARY}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                          <Icon name="mark_email_read" size={28} color={PRIMARY} />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#181c20", marginBottom: 4 }}>Email Verification</div>
                        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                          Password verified! OTP sent to:<br />
                          <span style={{ fontWeight: 600, color: PRIMARY }}>{email}</span>
                        </div>
                      </div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>6-digit OTP</label>
                      <div style={{ position: "relative" }}>
                        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                          <Icon name="pin" size={18} color={focusedField === "loginOtp" ? PRIMARY : "#9ca3af"} />
                        </div>
                        <input
                          type="text" inputMode="numeric" maxLength={6}
                          value={loginOtpCode} onChange={e => setLoginOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="_ _ _ _ _ _"
                          autoFocus
                          onFocus={() => setFocusedField("loginOtp")} onBlur={() => setFocusedField(null)}
                          style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px 14px 44px", borderRadius: 12, border: `2px solid ${focusedField === "loginOtp" ? PRIMARY : loginOtpCode ? PRIMARY + "40" : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 22, outline: "none", letterSpacing: 10, fontFamily: "monospace", fontWeight: 700, transition: "border-color 0.2s", boxShadow: focusedField === "loginOtp" ? `0 0 0 3px ${PRIMARY}18` : "none", textAlign: "center" }}
                        />
                      </div>
                      <button type="button" onClick={resetPasswordTab}
                        style={{ fontSize: 12, color: PRIMARY, background: "none", border: "none", cursor: "pointer", marginTop: 8, padding: 0, fontWeight: 600, display: "block" }}>
                        ← Go back / Change password
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Email OTP tab */
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    {otpStep === "send" ? "Your registered email" : `Verification code sent to ${otpEmail}`}
                  </label>
                  {otpStep === "send" && (
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 10px" }}>
                      We'll send a 6-digit sign-in code — no password needed.
                    </p>
                  )}
                  {otpStep === "send" ? (
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                        <Icon name="mail" size={18} color={focusedField === "otpEmail" ? PRIMARY : "#9ca3af"} />
                      </div>
                      <input
                        type="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                        placeholder="admin@yourcompany.com"
                        autoFocus
                        onFocus={() => setFocusedField("otpEmail")} onBlur={() => setFocusedField(null)}
                        style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px 12px 44px", borderRadius: 12, border: `2px solid ${focusedField === "otpEmail" ? PRIMARY : otpEmail ? PRIMARY + "40" : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 14, outline: "none", transition: "border-color 0.2s", boxShadow: focusedField === "otpEmail" ? `0 0 0 3px ${PRIMARY}18` : "none", fontFamily: "'Inter', sans-serif" }}
                      />
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                        <Icon name="pin" size={18} color={focusedField === "otpCode" ? PRIMARY : "#9ca3af"} />
                      </div>
                      <input
                        type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="6-digit OTP"
                        onFocus={() => setFocusedField("otpCode")} onBlur={() => setFocusedField(null)}
                        style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px 12px 44px", borderRadius: 12, border: `2px solid ${focusedField === "otpCode" ? PRIMARY : otpCode ? PRIMARY + "40" : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 18, outline: "none", letterSpacing: 8, fontFamily: "monospace", fontWeight: 700, transition: "border-color 0.2s", boxShadow: focusedField === "otpCode" ? `0 0 0 3px ${PRIMARY}18` : "none" }}
                      />
                    </div>
                  )}
                  {otpStep === "verify" && (
                    <button type="button" onClick={() => { setOtpStep("send"); setOtpCode(""); setDevOtp(null); }}
                      style={{ fontSize: 12, color: PRIMARY, background: "none", border: "none", cursor: "pointer", marginTop: 6, padding: 0, fontWeight: 600 }}>
                      ← Change email / Resend OTP
                    </button>
                  )}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || otpLoading || loginOtpLoading}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
                  color: "white", fontWeight: 700, fontSize: 15,
                  cursor: (isLoading || otpLoading || loginOtpLoading) ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  opacity: (isLoading || otpLoading || loginOtpLoading) ? 0.75 : 1,
                  boxShadow: "0 4px 20px rgba(0,93,144,0.28)",
                  transition: "all 0.2s", marginTop: 4,
                }}
              >
                {(isLoading || otpLoading || loginOtpLoading) ? (
                  <>
                    <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    {loginTab === "password"
                      ? (passwordStep === "form" ? "Verifying password..." : "Verifying OTP...")
                      : (otpStep === "send" ? "Sending OTP..." : "Verifying...")}
                  </>
                ) : (
                  <>
                    {loginTab === "password"
                      ? (passwordStep === "form" ? "Continue" : "✓ Verify & Sign In")
                      : (otpStep === "send" ? "📧 Send OTP" : "✓ Verify OTP")}
                    <Icon name="arrow_forward" size={18} color="white" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <span style={{ fontSize: 14, color: "#9ca3af" }}>Don't have an account? </span>
            <button onClick={() => navigate("/register")}
              style={{ fontSize: 14, color: PRIMARY, fontWeight: 600, textDecoration: "none", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Register your organization
            </button>
          </div>

          <div style={{ marginTop: 28, padding: "16px 20px", background: "white", borderRadius: 14, border: "1.5px solid rgba(191,199,209,0.3)", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              {[{ icon: "shield", text: "DPDP Act 2023" }, { icon: "lock", text: "256-bit SSL" }, { icon: "location_on", text: "Made in India" }].map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name={b.icon} size={14} color={TEAL} />
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={() => navigate("/")} style={{ fontSize: 13, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              ← Back to home
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
