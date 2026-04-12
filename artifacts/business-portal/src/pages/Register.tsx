import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Building2, AlertCircle, ChevronRight, ChevronLeft, Heart, CheckCircle2 } from "lucide-react";

const ORG_TYPES = [
  { value: "corporate", label: "Corporate", icon: "🏢" },
  { value: "hospital", label: "Hospital / Clinic", icon: "🏥" },
  { value: "gym", label: "Gym & Fitness", icon: "💪" },
  { value: "insurance", label: "Insurance", icon: "🛡️" },
  { value: "ngo", label: "NGO / Nonprofit", icon: "🤝" },
  { value: "yoga", label: "Yoga / Wellness", icon: "🧘" },
  { value: "school", label: "School / College", icon: "📚" },
  { value: "other", label: "Other", icon: "✨" },
];

const STEP_LABELS = ["Organization Type", "Org Details", "Admin Account"];

export default function Register() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    orgType: "",
    name: "",
    contactEmail: "",
    contactPhone: "",
    city: "",
    state: "",
    adminName: "",
    adminPassword: "",
    confirmPassword: "",
    totalSeats: "50",
  });

  const set = (field: string, val: string) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async () => {
    if (form.adminPassword !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await api.register({
        orgType: form.orgType,
        name: form.name,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        city: form.city,
        state: form.state,
        adminName: form.adminName,
        adminPassword: form.adminPassword,
        totalSeats: parseInt(form.totalSeats),
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

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif", background: "linear-gradient(135deg, #020B18 0%, #051B2C 40%, #081F30 70%, #04141F 100%)" }}>

      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #0EA5E9 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="relative w-full max-w-lg z-10">

        {/* Logo */}
        <div className="text-center mb-7">
          <a href="/" className="inline-flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 0 28px rgba(14,165,233,0.45)" }}>
              <Heart size={22} className="text-white" />
            </div>
            <div>
              <span className="text-xl font-bold" style={{ background: "linear-gradient(90deg, #38BDF8, #34D399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                AORANE
              </span>
              <span className="text-white/40 text-sm font-normal ml-1.5">Business</span>
            </div>
          </a>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-6">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  i + 1 < step ? "text-white" : i + 1 === step ? "text-white" : "text-white/30"
                }`}
                  style={{
                    background: i + 1 < step ? "linear-gradient(135deg, #0EA5E9, #10B981)" :
                      i + 1 === step ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.06)",
                    border: i + 1 === step ? "1px solid rgba(14,165,233,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: i + 1 === step ? "0 0 14px rgba(14,165,233,0.3)" : "none"
                  }}>
                  {i + 1 < step ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block truncate transition-colors ${i + 1 === step ? "text-white/70" : "text-white/25"}`}>
                  {label}
                </span>
              </div>
              {i < 2 && <div className="w-6 shrink-0 h-px" style={{ background: i + 1 < step ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.1)" }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Glass Card */}
        <div className="rounded-3xl p-8 border"
          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 32px 64px rgba(0,0,0,0.4)" }}>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 border"
              style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Step 1: Org Type */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Organization Type</h2>
              <p className="text-white/40 text-sm mb-6">What type of organization are you?</p>
              <div className="grid grid-cols-2 gap-2.5">
                {ORG_TYPES.map((t) => (
                  <button key={t.value} onClick={() => set("orgType", t.value)}
                    className="flex items-center gap-2.5 p-3.5 rounded-xl border text-left transition-all hover:scale-[1.02]"
                    style={{
                      background: form.orgType === t.value ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
                      borderColor: form.orgType === t.value ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.09)",
                      color: form.orgType === t.value ? "#fff" : "rgba(255,255,255,0.50)",
                      boxShadow: form.orgType === t.value ? "0 0 16px rgba(14,165,233,0.2)" : "none",
                    }}>
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-sm font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => form.orgType && setStep(2)} disabled={!form.orgType}
                className="w-full mt-6 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-40 disabled:scale-100"
                style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 8px 24px rgba(14,165,233,0.3)" }}>
                Continue <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2: Org Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Organization Details</h2>
                <p className="text-white/40 text-sm">Fill in your basic information</p>
              </div>
              {[
                { label: "Organization Name *", key: "name", placeholder: "e.g., Sunrise Health Clinic" },
                { label: "Email Address *", key: "contactEmail", placeholder: "admin@yourorg.com", type: "email" },
                { label: "Phone Number", key: "contactPhone", placeholder: "+91 XXXXXXXXXX" },
                { label: "City", key: "city", placeholder: "Mumbai" },
                { label: "State", key: "state", placeholder: "Maharashtra" },
                { label: "Total Seats (Members)", key: "totalSeats", placeholder: "50", type: "number" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-white/50 text-xs font-medium mb-1.5">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none transition-all text-sm"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = "rgba(14,165,233,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-white/50 hover:text-white text-sm transition-all"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
                  <ChevronLeft size={14} /> Back
                </button>
                <button onClick={() => form.name && form.contactEmail && setStep(3)}
                  disabled={!form.name || !form.contactEmail}
                  className="flex-1 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:scale-[1.01] disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 4px 16px rgba(14,165,233,0.25)" }}>
                  Continue <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Admin Setup */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Admin Account</h2>
                <p className="text-white/40 text-sm">Set up your portal credentials</p>
              </div>
              {[
                { label: "Full Name *", key: "adminName", placeholder: "Dr. Rajesh Kumar" },
                { label: "Password *", key: "adminPassword", placeholder: "••••••••", type: "password" },
                { label: "Confirm Password *", key: "confirmPassword", placeholder: "••••••••", type: "password" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-white/50 text-xs font-medium mb-1.5">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none transition-all text-sm"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = "rgba(14,165,233,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-white/50 hover:text-white text-sm transition-all"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
                  <ChevronLeft size={14} /> Back
                </button>
                <button onClick={handleSubmit}
                  disabled={isLoading || !form.adminName || !form.adminPassword || !form.confirmPassword}
                  className="flex-1 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:scale-[1.01] disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #0EA5E9, #10B981)", boxShadow: "0 4px 16px rgba(14,165,233,0.25)" }}>
                  {isLoading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : "Create Account"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-white/30 text-xs mt-5">
          Already registered?{" "}
          <a href="/login" className="font-medium transition-colors hover:text-white" style={{ color: "#38BDF8" }}>
            Login here
          </a>
        </p>
      </div>
    </div>
  );
}
