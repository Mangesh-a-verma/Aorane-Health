import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const PRIMARY = "#005d90";
const TEAL = "#006b56";
const BG = "#f7f9fe";

const ORG_TYPES = [
  { value: "corporate", label: "Corporate", icon: "corporate_fare" },
  { value: "hospital", label: "Hospital / Clinic", icon: "local_hospital" },
  { value: "gym", label: "Gym & Fitness", icon: "fitness_center" },
  { value: "yoga", label: "Yoga / Wellness", icon: "self_improvement" },
  { value: "school", label: "School / College", icon: "school" },
  { value: "insurance", label: "Insurance / TPA", icon: "policy" },
  { value: "ngo", label: "NGO / Nonprofit", icon: "volunteer_activism" },
  { value: "other", label: "Other", icon: "business" },
];

const STEP_LABELS = ["Organization Type", "Organization Details", "Verify Email", "Admin Account"];

function Icon({ name, size = 20, color = PRIMARY }: { name: string; size?: number; color?: string }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: size, color, lineHeight: 1, display: "inline-block", userSelect: "none" }}>
      {name}
    </span>
  );
}

function Input({
  label, type = "text", value, onChange, placeholder, required, autoFocus,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}{required && <span style={{ color: PRIMARY }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "12px 16px", borderRadius: 12,
          border: focused ? `2px solid ${PRIMARY}` : "2px solid #e5e7eb",
          background: "white", color: "#181c20", fontSize: 14,
          outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: focused ? `0 0 0 3px ${PRIMARY}18` : "none",
          fontFamily: "'Inter', sans-serif",
        }}
      />
    </div>
  );
}

export default function Register() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    orgType: "", name: "", contactEmail: "", contactPhone: "",
    city: "", state: "", gstin: "", adminName: "", adminPassword: "",
    confirmPassword: "", totalSeats: "50",
  });

  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpFocused, setOtpFocused] = useState(false);

  const set = (field: string, val: string) => setForm(f => ({ ...f, [field]: val }));

  const handleSendOtp = async () => {
    if (!form.name || !form.contactEmail) { setError("Organization name and email are required."); return; }
    if (form.gstin && form.gstin.length > 0 && form.gstin.length < 15) { setError("GSTIN must be exactly 15 characters (e.g. 22AAAAA0000A1Z5)."); return; }
    setIsLoading(true); setError(""); setDevOtp(null);
    try {
      const res = await api.sendRegOtp(form.contactEmail);
      if (res.devOtp) setDevOtp(res.devOtp);
      setStep(3);
    } catch (err) {
      setError((err as Error).message || "Could not send verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) { setError("Please enter the 6-digit verification code."); return; }
    setIsLoading(true); setError("");
    try {
      await api.verifyRegOtp(form.contactEmail, otpCode);
      setDevOtp(null);
      setStep(4);
    } catch (err) {
      setError((err as Error).message || "Incorrect or expired code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(""); setDevOtp(null); setOtpCode("");
    try {
      const res = await api.sendRegOtp(form.contactEmail);
      if (res.devOtp) setDevOtp(res.devOtp);
    } catch (err) {
      setError((err as Error).message || "Failed to resend code.");
    }
  };

  const handleSubmit = async () => {
    if (form.adminPassword !== form.confirmPassword) { setError("Passwords do not match"); return; }
    if (form.adminPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setIsLoading(true); setError("");
    try {
      const res = await api.register({
        orgType: form.orgType, name: form.name, contactEmail: form.contactEmail,
        contactPhone: form.contactPhone, city: form.city, state: form.state,
        gstin: form.gstin, adminName: form.adminName, adminPassword: form.adminPassword,
        totalSeats: parseInt(form.totalSeats) || 50,
      });
      const { admin, org } = await api.getMe(res.token);
      login(res.token, admin, org);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', sans-serif", display: "flex" }}>
      <Helmet>
        <title>Register Your Organisation — AORANE Business Portal</title>
        <meta name="description" content="Register your company on AORANE Business Portal. Set up employee health monitoring, stress tracking, and wellness analytics for your workforce in minutes." />
        <link rel="canonical" href="https://business.aorane.com/register" />
      </Helmet>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .org-btn:hover { transform: translateY(-2px); }
        @media (max-width: 900px) {
          .hide-on-mobile { display: none !important; }
          .mobile-logo { display: flex !important; }
        }
      `}</style>

      {/* Left branding panel */}
      <div style={{
        width: 420, flexShrink: 0, background: `linear-gradient(160deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
        display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 40px",
      }} className="hide-on-mobile">
        <div>
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 32, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>AORANE</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 4, letterSpacing: 0.5, fontWeight: 500 }}>Business CRM</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", marginTop: 10, textTransform: "uppercase" as const }}>Business Suite</div>
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "white", lineHeight: 1.25, margin: "0 0 16px", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}>
            Start your organization's health journey today
          </h2>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 1.75, margin: 0 }}>
            Join 500+ organizations monitoring and improving their team's health in real time with Aorane.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { icon: "dashboard", text: "Real-time health dashboard for your entire team" },
            { icon: "psychology", text: "AI-powered burnout and wellness insights" },
            { icon: "manage_accounts", text: "Simple seat management and flexible billing" },
            { icon: "verified_user", text: "Email verified — secure by design" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={item.icon} size={18} color="white" />
              </div>
              <span style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 520, animation: "fadeUp 0.5s ease forwards" }}>

          {/* Mobile logo */}
          <div style={{ display: "none", flexDirection: "column", gap: 2, marginBottom: 28 }} className="mobile-logo">
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.02em", lineHeight: 1 }}>AORANE</span>
            <span style={{ fontSize: 13, color: PRIMARY }}>Aorane · Business Suite</span>
          </div>

          {/* Step Progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
            {STEP_LABELS.map((label, i) => (
              <React.Fragment key={label}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: i + 1 < step ? `linear-gradient(135deg, ${PRIMARY}, ${TEAL})` : i + 1 === step ? "white" : "#f3f4f6",
                    border: i + 1 === step ? `2px solid ${PRIMARY}` : i + 1 < step ? "none" : "2px solid #e5e7eb",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                    color: i + 1 < step ? "white" : i + 1 === step ? PRIMARY : "#9ca3af",
                    boxShadow: i + 1 === step ? `0 0 0 4px ${PRIMARY}18` : "none",
                    transition: "all 0.3s",
                  }}>
                    {i + 1 < step ? <Icon name="check" size={16} color="white" /> : i + 1}
                  </div>
                </div>
                {i < 3 && (
                  <div style={{ flex: 1, height: 2, background: i + 1 < step ? `linear-gradient(to right, ${PRIMARY}, ${TEAL})` : "#e5e7eb", margin: "0 8px", transition: "background 0.3s" }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
              <Icon name="error" size={18} color="#ef4444" />
              <span style={{ fontSize: 14, color: "#dc2626" }}>{error}</span>
            </div>
          )}

          {/* Card */}
          <div style={{ background: "white", borderRadius: 24, border: "1.5px solid rgba(191,199,209,0.3)", boxShadow: "0 8px 40px rgba(0,0,0,0.07)", padding: "36px 32px" }}>

            {/* STEP 1: Org Type */}
            {step === 1 && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                    What type of organization are you?
                  </h2>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Select your business category to get started</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
                  {ORG_TYPES.map(t => (
                    <button
                      key={t.value}
                      className="org-btn"
                      onClick={() => set("orgType", t.value)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                        borderRadius: 14, border: `2px solid ${form.orgType === t.value ? PRIMARY : "#e5e7eb"}`,
                        background: form.orgType === t.value ? `${PRIMARY}08` : "white",
                        cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                        boxShadow: form.orgType === t.value ? `0 0 0 3px ${PRIMARY}18` : "none",
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: form.orgType === t.value ? `${PRIMARY}12` : "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name={t.icon} size={20} color={form.orgType === t.value ? PRIMARY : "#9ca3af"} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: form.orgType === t.value ? "#181c20" : "#6b7280" }}>{t.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => form.orgType && setStep(2)}
                  disabled={!form.orgType}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                    background: form.orgType ? `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)` : "#e5e7eb",
                    color: form.orgType ? "white" : "#9ca3af", fontWeight: 700, fontSize: 15,
                    cursor: form.orgType ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s", boxShadow: form.orgType ? "0 4px 16px rgba(0,93,144,0.25)" : "none",
                  }}
                >
                  Continue
                  <Icon name="arrow_forward" size={18} color={form.orgType ? "white" : "#9ca3af"} />
                </button>
              </div>
            )}

            {/* STEP 2: Org Details */}
            {step === 2 && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                    Organization Details
                  </h2>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Tell us about your organization. We'll verify your email next.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                  <Input label="Organization Name" value={form.name} onChange={v => set("name", v)} placeholder="e.g., Sunrise Health Clinic" required />
                  <Input label="Email Address" type="email" value={form.contactEmail} onChange={v => set("contactEmail", v)} placeholder="admin@yourorg.com" required />
                  <div>
                    <Input
                      label="GSTIN (optional)"
                      value={form.gstin}
                      onChange={v => set("gstin", v.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      placeholder="22AAAAA0000A1Z5"
                    />
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0 2px" }}>15-character GST Identification Number — required for GST invoicing. You can add it later from Settings.</p>
                  </div>
                  <Input label="Phone Number" value={form.contactPhone} onChange={v => set("contactPhone", v)} placeholder="+91 98765 43210" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input label="City" value={form.city} onChange={v => set("city", v)} placeholder="Mumbai" />
                    <Input label="State" value={form.state} onChange={v => set("state", v)} placeholder="Maharashtra" />
                  </div>
                  <Input label="Total Seats (Members)" type="number" value={form.totalSeats} onChange={v => set("totalSeats", v)} placeholder="50" />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setStep(1); setError(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 20px", borderRadius: 12, border: "2px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                  >
                    <Icon name="arrow_back" size={16} color="#6b7280" /> Back
                  </button>
                  <button
                    onClick={handleSendOtp}
                    disabled={isLoading || !form.name || !form.contactEmail}
                    style={{
                      flex: 1, padding: "13px 0", borderRadius: 12, border: "none",
                      background: form.name && form.contactEmail ? `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)` : "#e5e7eb",
                      color: form.name && form.contactEmail ? "white" : "#9ca3af",
                      fontWeight: 700, fontSize: 15, cursor: isLoading || !form.name || !form.contactEmail ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: form.name && form.contactEmail ? "0 4px 16px rgba(0,93,144,0.25)" : "none",
                      opacity: isLoading ? 0.75 : 1,
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        Sending code...
                      </>
                    ) : (
                      <>Verify Email <Icon name="send" size={16} color={form.name && form.contactEmail && form.gstin.length >= 15 ? "white" : "#9ca3af"} /></>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Email Verification */}
            {step === 3 && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: `${PRIMARY}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Icon name="mark_email_read" size={32} color={PRIMARY} />
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
                    Verify your email
                  </h2>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
                    We sent a 6-digit code to<br />
                    <strong style={{ color: PRIMARY }}>{form.contactEmail}</strong>
                  </p>
                </div>

                {devOtp && (
                  <div style={{ background: "#fef3c7", border: "2px solid #f59e0b", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Dev Mode — Your verification code:</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#b45309", letterSpacing: 10, textAlign: "center", fontFamily: "monospace" }}>{devOtp}</div>
                    <div style={{ fontSize: 11, color: "#92400e", marginTop: 6, textAlign: "center" }}>Also sent to your email. Copy this code below.</div>
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>6-digit verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={e => { setOtpCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                    placeholder="_ _ _ _ _ _"
                    autoFocus
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "16px", borderRadius: 12, textAlign: "center",
                      fontSize: 28, fontFamily: "monospace", fontWeight: 700, letterSpacing: 12,
                      border: `2px solid ${otpFocused ? PRIMARY : otpCode.length === 6 ? TEAL : "#e5e7eb"}`,
                      background: "white", color: "#181c20", outline: "none",
                      boxShadow: otpFocused ? `0 0 0 3px ${PRIMARY}18` : "none",
                      transition: "border-color 0.2s",
                    }}
                  />
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otpCode.length < 6}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                    background: otpCode.length === 6 ? `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)` : "#e5e7eb",
                    color: otpCode.length === 6 ? "white" : "#9ca3af",
                    fontWeight: 700, fontSize: 15, cursor: isLoading || otpCode.length < 6 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    opacity: isLoading ? 0.75 : 1,
                    boxShadow: otpCode.length === 6 ? "0 4px 20px rgba(0,93,144,0.28)" : "none",
                    marginBottom: 16,
                  }}
                >
                  {isLoading ? (
                    <>
                      <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      Verifying...
                    </>
                  ) : (
                    <><Icon name="verified" size={18} color={otpCode.length === 6 ? "white" : "#9ca3af"} /> Verify & Continue</>
                  )}
                </button>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button type="button" onClick={() => { setStep(2); setOtpCode(""); setDevOtp(null); setError(""); }}
                    style={{ fontSize: 13, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    ← Change email
                  </button>
                  <button type="button" onClick={handleResendOtp}
                    style={{ fontSize: 13, color: PRIMARY, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Resend code
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Admin Account */}
            {step === 4 && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${PRIMARY}, ${TEAL})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="check" size={16} color="white" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEAL }}>Email verified — {form.contactEmail}</span>
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                    Create your admin account
                  </h2>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Set up login credentials for your portal</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                  <Input label="Full Name" value={form.adminName} onChange={v => set("adminName", v)} placeholder="Dr. Rajesh Kumar" required autoFocus />
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Password <span style={{ color: PRIMARY }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPass ? "text" : "password"}
                        value={form.adminPassword}
                        onChange={e => set("adminPassword", e.target.value)}
                        placeholder="Min. 6 characters"
                        style={{ width: "100%", boxSizing: "border-box", padding: "12px 48px 12px 16px", borderRadius: 12, border: `2px solid ${form.adminPassword ? PRIMARY + "60" : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 14, outline: "none", fontFamily: "'Inter', sans-serif" }}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <Icon name={showPass ? "visibility_off" : "visibility"} size={18} color="#9ca3af" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Confirm Password <span style={{ color: PRIMARY }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={e => set("confirmPassword", e.target.value)}
                        placeholder="Re-enter password"
                        style={{ width: "100%", boxSizing: "border-box", padding: "12px 48px 12px 16px", borderRadius: 12, border: `2px solid ${form.confirmPassword && form.confirmPassword === form.adminPassword ? TEAL + "80" : form.confirmPassword ? "#ef4444" : "#e5e7eb"}`, background: "white", color: "#181c20", fontSize: 14, outline: "none", fontFamily: "'Inter', sans-serif" }}
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <Icon name={showConfirm ? "visibility_off" : "visibility"} size={18} color="#9ca3af" />
                      </button>
                    </div>
                    {form.confirmPassword && form.confirmPassword !== form.adminPassword && (
                      <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Passwords do not match</p>
                    )}
                  </div>
                  <div style={{ background: "#f7f9fe", borderRadius: 12, padding: "14px 16px", border: "1.5px solid rgba(191,199,209,0.3)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Registration Summary</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        { label: "Organization", value: form.name },
                        { label: "Email", value: form.contactEmail },
                        { label: "Total Seats", value: `${form.totalSeats} members` },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "#9ca3af" }}>{item.label}</span>
                          <span style={{ color: "#181c20", fontWeight: 600 }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setStep(3); setError(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 20px", borderRadius: 12, border: "2px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                  >
                    <Icon name="arrow_back" size={16} color="#6b7280" /> Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || !form.adminName || !form.adminPassword || !form.confirmPassword || form.adminPassword !== form.confirmPassword}
                    style={{
                      flex: 1, padding: "13px 0", borderRadius: 12, border: "none",
                      background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
                      color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      opacity: isLoading || !form.adminName || !form.adminPassword || !form.confirmPassword ? 0.65 : 1,
                      boxShadow: "0 4px 16px rgba(0,93,144,0.25)",
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        Creating account...
                      </>
                    ) : (
                      <><Icon name="check_circle" size={18} color="white" /> Create Account</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, marginTop: 20 }}>
            Already registered?{" "}
            <button onClick={() => navigate("/login")} style={{ color: PRIMARY, fontWeight: 600, textDecoration: "none", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Log in here
            </button>
          </p>
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 12 }}>
            Protected by DPDP Act 2023 · 256-bit SSL · Made in India 🇮🇳
          </p>
        </div>
      </div>
    </div>
  );
}
