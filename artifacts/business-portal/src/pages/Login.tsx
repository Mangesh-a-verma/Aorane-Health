import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
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

function Field({ label, type = "text", value, onChange, placeholder, icon, right, focused, onFocus, onBlur }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: string; right?: React.ReactNode;
  focused?: boolean; onFocus?: () => void; onBlur?: () => void;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>
      <div style={{ position: "relative" }}>
        {icon && (
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
            <Icon name={icon} size={18} color={focused ? PRIMARY : "#9ca3af"} />
          </div>
        )}
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} onFocus={onFocus} onBlur={onBlur}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: `12px ${right ? "48px" : "16px"} 12px ${icon ? "44px" : "16px"}`,
            borderRadius: 12, border: `2px solid ${focused ? PRIMARY : value ? PRIMARY + "40" : "#e5e7eb"}`,
            background: "white", color: "#181c20", fontSize: 14, outline: "none",
            transition: "border-color 0.2s", boxShadow: focused ? `0 0 0 3px ${PRIMARY}18` : "none",
            fontFamily: "'Inter', sans-serif",
          }}
        />
        {right && (
          <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
            {right}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();

  const [sessionExpiredMsg, setSessionExpiredMsg] = useState("");
  const [loginTab, setLoginTab] = useState<"password" | "otp" | "forgot">("password");

  useEffect(() => {
    const reason = localStorage.getItem("bp_session_expired");
    if (reason === "inactivity") {
      setSessionExpiredMsg("Session expired due to inactivity. Please log in again.");
      localStorage.removeItem("bp_session_expired");
    }
  }, []);

  // Password login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // OTP login tab
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"send" | "verify">("send");
  const [otpLoading, setOtpLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Forgot password flow
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "reset">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotDevOtp, setForgotDevOtp] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const [error, setError] = useState("");

  const clearError = () => setError("");

  // ─── Password Login ────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password required"); return; }
    setIsLoading(true); clearError();
    try {
      const res = await api.login(email, password);
      login(res.token, res.admin, res.org);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Login failed. Please try again.");
    } finally { setIsLoading(false); }
  };

  // ─── Email OTP Login ───────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)) { setError("Valid email required"); return; }
    setOtpLoading(true); clearError(); setDevOtp(null);
    try {
      const res = await api.sendBusinessEmailOtp(otpEmail);
      if (!res.sent && !res.devOtp) { setError("This email is not registered. Please register first."); return; }
      if (res.devOtp) setDevOtp(res.devOtp);
      setOtpStep("verify");
    } catch (err) { setError((err as Error).message || "Failed to send OTP."); }
    finally { setOtpLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) { setError("Enter the 6-digit OTP."); return; }
    setOtpLoading(true); clearError();
    try {
      const res = await api.verifyLoginOtp(otpEmail, otpCode);
      login(res.token, res.admin, res.org);
      navigate("/dashboard");
    } catch (err) { setError((err as Error).message || "Invalid or expired OTP."); }
    finally { setOtpLoading(false); }
  };

  // ─── Forgot Password ───────────────────────────────────────────────────────
  const handleForgotSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { setError("Email required"); return; }
    setForgotLoading(true); clearError(); setForgotDevOtp(null);
    try {
      const res = await api.forgotPassword(forgotEmail);
      if (res.devOtp) setForgotDevOtp(res.devOtp);
      setForgotStep("otp");
    } catch (err) { setError((err as Error).message || "Failed to send reset code."); }
    finally { setForgotLoading(false); }
  };

  const handleForgotVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp || forgotOtp.length < 6) { setError("Enter the 6-digit code."); return; }
    clearError();
    setForgotStep("reset");
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotNewPass || forgotNewPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (forgotNewPass !== forgotConfirm) { setError("Passwords do not match."); return; }
    setForgotLoading(true); clearError();
    try {
      await api.forgotPasswordVerify(forgotEmail, forgotOtp, forgotNewPass);
      setForgotSuccess(true);
    } catch (err) { setError((err as Error).message || "Failed to reset password."); }
    finally { setForgotLoading(false); }
  };

  const resetForgot = () => {
    setForgotStep("email"); setForgotEmail(""); setForgotOtp(""); setForgotNewPass(""); setForgotConfirm("");
    setForgotDevOtp(null); setForgotSuccess(false); clearError();
  };

  const Spinner = () => (
    <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  );

  const btnStyle = (disabled = false) => ({
    width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
    background: disabled ? "#e5e7eb" : `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
    color: disabled ? "#9ca3af" : "white", fontWeight: 700, fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    opacity: 1, boxShadow: disabled ? "none" : "0 4px 20px rgba(0,93,144,0.28)",
    transition: "all 0.2s", marginTop: 4,
  });

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', sans-serif", display: "flex" }}>
      <Helmet>
        <title>Sign In — AORANE Business Portal</title>
        <meta name="description" content="Sign in to your AORANE Business Portal account." />
        <link rel="canonical" href="https://business.aorane.com/login" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) { .hide-on-mobile { display: none !important; } .mobile-logo { display: flex !important; } }
      `}</style>

      {/* Left branding panel */}
      <div className="hide-on-mobile" style={{
        width: 420, flexShrink: 0,
        background: `linear-gradient(160deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
        display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 40px",
      }}>
        <div>
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 32, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>AORANE</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>Business CRM</div>
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
              <span style={{ color: "rgba(255,255,255,0.82)", fontSize: 14 }}>{item.text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[{ value: "500+", label: "Organizations" }, { value: "98%", label: "Satisfaction" }].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "white" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp 0.5s ease forwards" }}>
          <div className="mobile-logo" style={{ display: "none", flexDirection: "column", gap: 2, marginBottom: 32 }}>
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20" }}>AORANE</span>
            <span style={{ fontSize: 13, color: PRIMARY }}>Business Suite</span>
          </div>

          {sessionExpiredMsg && (
            <div style={{ marginBottom: 20, padding: "12px 16px", background: "#FFF3CD", border: "1px solid #FBBF24", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#D97706", flexShrink: 0, marginTop: 1 }}>schedule</span>
              <p style={{ margin: 0, fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>{sessionExpiredMsg}</p>
            </div>
          )}

          {/* ─── FORGOT PASSWORD FLOW ─────────────────────────────────── */}
          {loginTab === "forgot" ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <button type="button" onClick={() => { setLoginTab("password"); resetForgot(); }}
                  style={{ fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                  <Icon name="arrow_back" size={16} color="#6b7280" /> Back to sign in
                </button>
                <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
                  {forgotSuccess ? "Password Reset!" : forgotStep === "reset" ? "New Password" : "Reset Password"}
                </h1>
                <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>
                  {forgotSuccess ? "Your password has been updated." : forgotStep === "email" ? "Enter your registered email to receive a reset code." : forgotStep === "otp" ? `Enter the 6-digit code sent to ${forgotEmail}` : "Create a strong new password."}
                </p>
              </div>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
                  <Icon name="error" size={18} color="#ef4444" />
                  <span style={{ fontSize: 14, color: "#dc2626" }}>{error}</span>
                </div>
              )}

              <div style={{ background: "white", borderRadius: 24, border: "1.5px solid rgba(191,199,209,0.3)", boxShadow: "0 8px 40px rgba(0,0,0,0.07)", padding: "36px 32px" }}>
                {forgotSuccess ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <Icon name="check_circle" size={36} color="#10b981" />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#181c20", marginBottom: 8 }}>Password Updated!</div>
                    <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>You can now sign in with your new password.</div>
                    <button onClick={() => { setLoginTab("password"); resetForgot(); }} style={btnStyle()}>
                      <Icon name="login" size={18} color="white" /> Sign In
                    </button>
                  </div>
                ) : forgotStep === "email" ? (
                  <form onSubmit={handleForgotSend} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <Field label="Registered Email" type="email" value={forgotEmail} onChange={setForgotEmail}
                      placeholder="admin@yourcompany.com" icon="mail"
                      focused={focusedField === "fe"} onFocus={() => setFocusedField("fe")} onBlur={() => setFocusedField(null)} />
                    <button type="submit" disabled={forgotLoading || !forgotEmail} style={btnStyle(forgotLoading || !forgotEmail)}>
                      {forgotLoading ? <Spinner /> : <><Icon name="send" size={18} color="white" /> Send Reset Code</>}
                    </button>
                  </form>
                ) : forgotStep === "otp" ? (
                  <form onSubmit={handleForgotVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {forgotDevOtp && (
                      <div style={{ background: "#fef3c7", border: "2px solid #f59e0b", borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>🔧 Dev Mode — Reset Code:</div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: "#b45309", letterSpacing: 10, textAlign: "center", fontFamily: "monospace" }}>{forgotDevOtp}</div>
                      </div>
                    )}
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>6-digit Reset Code</label>
                      <input
                        type="text" inputMode="numeric" maxLength={6} value={forgotOtp}
                        onChange={e => { setForgotOtp(e.target.value.replace(/\D/g, "")); clearError(); }}
                        placeholder="_ _ _ _ _ _" autoFocus
                        style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 12, border: `2px solid ${forgotOtp.length === 6 ? TEAL : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 22, outline: "none", letterSpacing: 10, fontFamily: "monospace", fontWeight: 700, textAlign: "center" }}
                      />
                    </div>
                    <button type="submit" disabled={forgotOtp.length < 6} style={btnStyle(forgotOtp.length < 6)}>
                      <Icon name="verified" size={18} color={forgotOtp.length < 6 ? "#9ca3af" : "white"} /> Verify Code
                    </button>
                    <button type="button" onClick={() => setForgotStep("email")}
                      style={{ fontSize: 13, color: PRIMARY, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                      ← Use a different email
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleForgotReset} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>New Password</label>
                      <div style={{ position: "relative" }}>
                        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                          <Icon name="lock" size={18} color="#9ca3af" />
                        </div>
                        <input type={showForgotPass ? "text" : "password"} value={forgotNewPass}
                          onChange={e => setForgotNewPass(e.target.value)} placeholder="Min 6 characters"
                          style={{ width: "100%", boxSizing: "border-box", padding: "12px 48px 12px 44px", borderRadius: 12, border: "2px solid #e5e7eb", background: "white", color: "#181c20", fontSize: 14, outline: "none" }} />
                        <button type="button" onClick={() => setShowForgotPass(!showForgotPass)}
                          style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
                          <Icon name={showForgotPass ? "visibility_off" : "visibility"} size={18} color="#9ca3af" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Confirm New Password</label>
                      <div style={{ position: "relative" }}>
                        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                          <Icon name="lock_reset" size={18} color="#9ca3af" />
                        </div>
                        <input type="password" value={forgotConfirm}
                          onChange={e => setForgotConfirm(e.target.value)} placeholder="Repeat password"
                          style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px 12px 44px", borderRadius: 12, border: "2px solid #e5e7eb", background: "white", color: "#181c20", fontSize: 14, outline: "none" }} />
                      </div>
                    </div>
                    <button type="submit" disabled={forgotLoading || !forgotNewPass || !forgotConfirm} style={btnStyle(forgotLoading || !forgotNewPass || !forgotConfirm)}>
                      {forgotLoading ? <Spinner /> : <><Icon name="lock_reset" size={18} color="white" /> Reset Password</>}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            /* ─── MAIN LOGIN ────────────────────────────────────────── */
            <>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
                  Welcome back
                </h1>
                <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>Sign in to your organization account</p>
              </div>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
                  <Icon name="error" size={18} color="#ef4444" />
                  <span style={{ fontSize: 14, color: "#dc2626" }}>{error}</span>
                </div>
              )}

              <div style={{ background: "white", borderRadius: 24, border: "1.5px solid rgba(191,199,209,0.3)", boxShadow: "0 8px 40px rgba(0,0,0,0.07)", padding: "36px 32px" }}>
                {/* Tab switcher */}
                <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "#f3f4f6", borderRadius: 12, padding: 4 }}>
                  {([["password", "lock", "Password"], ["otp", "mail", "Email OTP"]] as const).map(([tab, icon, label]) => (
                    <button key={tab} type="button"
                      onClick={() => { setLoginTab(tab); clearError(); setDevOtp(null); }}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
                        background: loginTab === tab ? "white" : "transparent",
                        color: loginTab === tab ? PRIMARY : "#6b7280",
                        fontWeight: loginTab === tab ? 700 : 500, fontSize: 13,
                        boxShadow: loginTab === tab ? "0 1px 6px rgba(0,0,0,0.10)" : "none",
                        transition: "all 0.18s",
                      }}>
                      <Icon name={icon} size={16} color={loginTab === tab ? PRIMARY : "#9ca3af"} />
                      {label}
                    </button>
                  ))}
                </div>

                {loginTab === "password" ? (
                  <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <Field label="Email Address" type="email" value={email} onChange={setEmail}
                      placeholder="admin@yourcompany.com" icon="mail"
                      focused={focusedField === "email"} onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)} />
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
                        <button type="button" onClick={() => { setLoginTab("forgot"); setForgotEmail(email); clearError(); }}
                          style={{ fontSize: 12, color: PRIMARY, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                          Forgot password?
                        </button>
                      </div>
                      <div style={{ position: "relative" }}>
                        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                          <Icon name="lock" size={18} color={focusedField === "password" ? PRIMARY : "#9ca3af"} />
                        </div>
                        <input
                          type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)}
                          style={{ width: "100%", boxSizing: "border-box", padding: "12px 48px 12px 44px", borderRadius: 12, border: `2px solid ${focusedField === "password" ? PRIMARY : password ? PRIMARY + "40" : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 14, outline: "none", fontFamily: "'Inter', sans-serif" }} />
                        <button type="button" onClick={() => setShowPass(!showPass)}
                          style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                          <Icon name={showPass ? "visibility_off" : "visibility"} size={18} color="#9ca3af" />
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={isLoading} style={btnStyle(isLoading)}>
                      {isLoading ? <><Spinner /> Signing in...</> : <><Icon name="login" size={18} color="white" /> Sign In</>}
                    </button>
                  </form>
                ) : (
                  /* Email OTP tab */
                  <form onSubmit={otpStep === "send" ? handleSendOtp : handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {devOtp && (
                      <div style={{ background: "#fef3c7", border: "2px solid #f59e0b", borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>🔧 Dev Mode — OTP:</div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: "#b45309", letterSpacing: 10, textAlign: "center", fontFamily: "monospace" }}>{devOtp}</div>
                      </div>
                    )}
                    {otpStep === "send" ? (
                      <Field label="Registered Email" type="email" value={otpEmail} onChange={setOtpEmail}
                        placeholder="admin@yourcompany.com" icon="mail"
                        focused={focusedField === "otpEmail"} onFocus={() => setFocusedField("otpEmail")} onBlur={() => setFocusedField(null)} />
                    ) : (
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                          6-digit OTP sent to {otpEmail}
                        </label>
                        <input type="text" inputMode="numeric" maxLength={6} value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="_ _ _ _ _ _" autoFocus
                          style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 12, border: `2px solid ${otpCode.length === 6 ? TEAL : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 22, outline: "none", letterSpacing: 10, fontFamily: "monospace", fontWeight: 700, textAlign: "center" }} />
                        <button type="button" onClick={() => { setOtpStep("send"); setOtpCode(""); setDevOtp(null); }}
                          style={{ fontSize: 12, color: PRIMARY, background: "none", border: "none", cursor: "pointer", marginTop: 6, fontWeight: 600 }}>
                          ← Change email
                        </button>
                      </div>
                    )}
                    <button type="submit" disabled={otpLoading} style={btnStyle(otpLoading)}>
                      {otpLoading ? <Spinner /> : otpStep === "send" ? <><Icon name="send" size={18} color="white" /> Send OTP</> : <><Icon name="verified" size={18} color="white" /> Verify & Sign In</>}
                    </button>
                  </form>
                )}
              </div>

              <div style={{ marginTop: 24, textAlign: "center" }}>
                <span style={{ fontSize: 14, color: "#9ca3af" }}>Don't have an account? </span>
                <button onClick={() => navigate("/register")}
                  style={{ fontSize: 14, color: PRIMARY, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Register your organization
                </button>
              </div>

              <div style={{ marginTop: 20, padding: "14px 20px", background: "white", borderRadius: 14, border: "1.5px solid rgba(191,199,209,0.3)", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                  {[{ icon: "shield", text: "DPDP Act 2023" }, { icon: "lock", text: "256-bit SSL" }, { icon: "location_on", text: "Made in India" }].map((b, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name={b.icon} size={14} color="#6b7280" />
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
