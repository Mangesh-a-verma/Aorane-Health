import React, { useState } from "react";
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

const STEP_LABELS = ["Organization Type", "Organization Details", "Admin Account"];

function Icon({ name, size = 20, color = PRIMARY }: { name: string; size?: number; color?: string }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: size, color, lineHeight: 1, display: "inline-block", userSelect: "none" }}>
      {name}
    </span>
  );
}

function Input({
  label, type = "text", value, onChange, placeholder, required,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
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
    city: "", state: "", adminName: "", adminPassword: "",
    confirmPassword: "", totalSeats: "50",
  });

  const set = (field: string, val: string) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async () => {
    if (form.adminPassword !== form.confirmPassword) { setError("Passwords do not match"); return; }
    if (form.adminPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setIsLoading(true); setError("");
    try {
      const res = await api.register({
        orgType: form.orgType, name: form.name, contactEmail: form.contactEmail,
        contactPhone: form.contactPhone, city: form.city, state: form.state,
        adminName: form.adminName, adminPassword: form.adminPassword,
        totalSeats: parseInt(form.totalSeats) || 50,
      });
      const admin = { id: "", fullName: form.adminName, role: "owner", email: form.contactEmail };
      login(res.token, admin, res.org);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', sans-serif", display: "flex" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .org-btn:hover { transform: translateY(-2px); }
      `}</style>

      {/* Left branding panel — desktop only */}
      <div style={{
        width: 420, flexShrink: 0, background: `linear-gradient(160deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
        display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 40px",
      }} className="hide-on-mobile">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 56 }}>
            <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Aorane" style={{ width: 200, height: 200, objectFit: "contain" }} />
            <span style={{ color: "white", fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Aorane Business</span>
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
            { icon: "verified", text: "HIPAA-ready and DPDP Act 2023 compliant" },
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
          <div style={{ display: "none", alignItems: "center", gap: 10, marginBottom: 32 }} className="mobile-logo">
            <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Aorane" style={{ width: 180, height: 180, objectFit: "contain" }} />
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20" }}>Aorane Business</span>
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: i + 1 === step ? PRIMARY : "#9ca3af", display: "none", whiteSpace: "nowrap" }} className="step-label">
                    {label}
                  </span>
                </div>
                {i < 2 && (
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
                  <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Tell us about your organization</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                  <Input label="Organization Name" value={form.name} onChange={v => set("name", v)} placeholder="e.g., Sunrise Health Clinic" required />
                  <Input label="Email Address" type="email" value={form.contactEmail} onChange={v => set("contactEmail", v)} placeholder="admin@yourorg.com" required />
                  <Input label="Phone Number" value={form.contactPhone} onChange={v => set("contactPhone", v)} placeholder="+91 98765 43210" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input label="City" value={form.city} onChange={v => set("city", v)} placeholder="Mumbai" />
                    <Input label="State" value={form.state} onChange={v => set("state", v)} placeholder="Maharashtra" />
                  </div>
                  <Input label="Total Seats (Members)" type="number" value={form.totalSeats} onChange={v => set("totalSeats", v)} placeholder="50" />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 20px", borderRadius: 12, border: "2px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}
                  >
                    <Icon name="arrow_back" size={16} color="#6b7280" /> Back
                  </button>
                  <button
                    onClick={() => form.name && form.contactEmail && setStep(3)}
                    disabled={!form.name || !form.contactEmail}
                    style={{
                      flex: 1, padding: "13px 0", borderRadius: 12, border: "none",
                      background: form.name && form.contactEmail ? `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)` : "#e5e7eb",
                      color: form.name && form.contactEmail ? "white" : "#9ca3af",
                      fontWeight: 700, fontSize: 15, cursor: form.name && form.contactEmail ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: form.name && form.contactEmail ? "0 4px 16px rgba(0,93,144,0.25)" : "none",
                    }}
                  >
                    Continue <Icon name="arrow_forward" size={18} color={form.name && form.contactEmail ? "white" : "#9ca3af"} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Admin Account */}
            {step === 3 && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                    Create Your Admin Account
                  </h2>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Set up login credentials for your portal</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                  <Input label="Full Name" value={form.adminName} onChange={v => set("adminName", v)} placeholder="Dr. Rajesh Kumar" required />
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
                  {/* Summary */}
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
                    onClick={() => setStep(2)}
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
                      <>Create Account <Icon name="check_circle" size={18} color="white" /></>
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

      <style>{`
        @media (max-width: 900px) {
          .hide-on-mobile { display: none !important; }
          .mobile-logo { display: flex !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
