import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Building2, ChevronRight, ChevronLeft, Eye, EyeOff,
  AlertCircle, CheckCircle2, Heart, Loader2, ArrowRight
} from "lucide-react";

// In dev: use BASE_URL so Vite proxy routes /aorane-landing/api → localhost:8080
// In production: VITE_API_URL is set to https://aorane.onrender.com via Vercel env vars
const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "") + "/api"
  : import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

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

interface Props {
  defaultTab?: "signin" | "signup";
  onClose: () => void;
}

// In dev: redirect to /business-portal on the same Replit domain
// In production: use VITE_BUSINESS_URL env var (set in Vercel) or fall back to the production domain
const BUSINESS_PORTAL_URL = import.meta.env.VITE_BUSINESS_URL ||
  (import.meta.env.DEV
    ? window.location.origin + "/business-portal"
    : "https://business.aorane.com");

function redirectToBusiness(token: string) {
  window.location.href = `${BUSINESS_PORTAL_URL}/auth?t=${encodeURIComponent(token)}`;
}

async function apiPost<T>(path: string, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error — please check your connection");
  }
  const text = await res.text().catch(() => "");
  if (!text || text.trim() === "") {
    throw new Error(`Server error (${res.status}) — please try again`);
  }
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Unexpected server response (${res.status})`); }
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export default function BusinessAuthModal({ defaultTab = "signin", onClose }: Props) {
  const [tab, setTab] = useState<"signin" | "signup">(defaultTab);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: "linear-gradient(160deg, #020B18 0%, #051B2C 50%, #081F30 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={16} />
          </button>

          <div className="px-8 pt-8 pb-2">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #00C79A, #E8B84B)", boxShadow: "0 0 20px rgba(0,199,154,0.4)" }}>
                <Heart size={18} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-lg"
                  style={{ background: "linear-gradient(90deg,#00C79A,#E8B84B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Aorane
                </span>
                <span className="text-white/35 text-xs ml-1.5">Business</span>
              </div>
            </div>

            <div className="flex gap-1 p-1 rounded-xl mb-6"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {(["signin", "signup"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: tab === t ? "linear-gradient(135deg,#00C79A,#E8B84B)" : "transparent",
                    color: tab === t ? "#fff" : "rgba(255,255,255,0.4)",
                    boxShadow: tab === t ? "0 4px 12px rgba(0,199,154,0.3)" : "none",
                  }}>
                  {t === "signin" ? "Sign In" : "Sign Up Free"}
                </button>
              ))}
            </div>
          </div>

          <div className="px-8 pb-8">
            {tab === "signin" ? (
              <SignInForm onClose={onClose} />
            ) : (
              <SignUpForm onClose={onClose} />
            )}
            <div className="mt-5 text-center text-xs text-white/25">
              {tab === "signin" ? (
                <>New to Aorane Business?{" "}
                  <button onClick={() => setTab("signup")} className="font-semibold" style={{ color: "#00C79A" }}>
                    Create free account
                  </button>
                </>
              ) : (
                <>Already registered?{" "}
                  <button onClick={() => setTab("signin")} className="font-semibold" style={{ color: "#00C79A" }}>
                    Sign in here
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SignInForm({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true); setError("");
    try {
      const res = await apiPost<{ token: string; admin: object; org: object }>("/business/login", { email, password });
      redirectToBusiness(res.token);
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-0.5">Welcome back</h2>
        <p className="text-white/35 text-sm mb-5">Sign in to your organization account</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-white/50 mb-1.5">Email Address</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="admin@yourorg.com" required
          className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder-white/20 transition-all"
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = "rgba(0,199,154,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,199,154,0.1)"; }}
          onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-white/50 mb-1.5">Password</label>
        <div className="relative">
          <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required
            className="w-full rounded-xl px-3.5 py-2.5 pr-10 text-sm outline-none placeholder-white/20 transition-all"
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = "rgba(0,199,154,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,199,154,0.1)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
          />
          <button type="button" onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 mt-2"
        style={{ background: "linear-gradient(135deg,#00C79A,#E8B84B)", boxShadow: "0 8px 20px rgba(0,199,154,0.3)" }}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Sign In</span><ArrowRight size={15} /></>}
      </button>
    </form>
  );
}

function SignUpForm({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    orgType: "", name: "", contactEmail: "", contactPhone: "",
    city: "", state: "", adminName: "", adminPassword: "", confirmPassword: "", totalSeats: "50",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
  };

  const handleSubmit = async () => {
    if (form.adminPassword !== form.confirmPassword) { setError("Passwords do not match"); return; }
    if (form.adminPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    try {
      const res = await apiPost<{ token: string; admin: object; org: object }>("/business/register", {
        orgType: form.orgType, name: form.name, contactEmail: form.contactEmail,
        contactPhone: form.contactPhone, city: form.city, state: form.state,
        adminName: form.adminName, adminPassword: form.adminPassword,
        totalSeats: parseInt(form.totalSeats),
      });
      redirectToBusiness(res.token);
    } catch (err) {
      setError((err as Error).message || "Registration failed");
      setLoading(false);
    }
  };

  const stepLabels = ["Org Type", "Details", "Account"];

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white mb-0.5">Create Business Account</h2>
        <p className="text-white/35 text-sm">Free to start — no credit card needed</p>
      </div>

      <div className="flex items-center gap-1.5 mb-5">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{
                background: i + 1 < step ? "linear-gradient(135deg,#00C79A,#E8B84B)" :
                  i + 1 === step ? "rgba(0,199,154,0.25)" : "rgba(255,255,255,0.06)",
                border: i + 1 === step ? "1px solid rgba(0,199,154,0.5)" : "1px solid rgba(255,255,255,0.08)",
                color: i + 1 <= step ? "#fff" : "rgba(255,255,255,0.25)",
              }}>
              {i + 1 < step ? <CheckCircle2 size={12} /> : i + 1}
            </div>
            <span className="text-[10px] hidden sm:block truncate"
              style={{ color: i + 1 === step ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)" }}>
              {label}
            </span>
            {i < 2 && <div className="flex-1 h-px" style={{ background: i + 1 < step ? "rgba(0,199,154,0.4)" : "rgba(255,255,255,0.08)" }} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm mb-4"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="text-white/40 text-xs mb-3">What type of organization are you?</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ORG_TYPES.map(t => (
              <button key={t.value} onClick={() => set("orgType", t.value)}
                className="flex items-center gap-2 p-3 rounded-xl text-left text-sm transition-all hover:scale-[1.02]"
                style={{
                  background: form.orgType === t.value ? "rgba(0,199,154,0.15)" : "rgba(255,255,255,0.04)",
                  border: form.orgType === t.value ? "1px solid rgba(0,199,154,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  color: form.orgType === t.value ? "#fff" : "rgba(255,255,255,0.45)",
                }}>
                <span>{t.icon}</span>
                <span className="font-medium text-xs">{t.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => form.orgType && setStep(2)} disabled={!form.orgType}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:scale-100"
            style={{ background: "linear-gradient(135deg,#00C79A,#E8B84B)", boxShadow: "0 6px 18px rgba(0,199,154,0.3)" }}>
            Continue <ChevronRight size={15} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {[
            { label: "Organization Name *", key: "name", placeholder: "e.g., Sunrise Health Clinic" },
            { label: "Email Address *", key: "contactEmail", placeholder: "admin@yourorg.com", type: "email" },
            { label: "Phone Number", key: "contactPhone", placeholder: "+91 XXXXXXXXXX" },
            { label: "City", key: "city", placeholder: "Mumbai" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-white/45 text-xs font-medium mb-1">{f.label}</label>
              <input type={f.type || "text"} value={form[f.key as keyof typeof form]}
                onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder-white/20 transition-all"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "rgba(0,199,154,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,199,154,0.1)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep(1)}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm text-white/45 hover:text-white transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
              <ChevronLeft size={13} /> Back
            </button>
            <button onClick={() => form.name && form.contactEmail && setStep(3)}
              disabled={!form.name || !form.contactEmail}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#00C79A,#E8B84B)", boxShadow: "0 4px 14px rgba(0,199,154,0.25)" }}>
              Continue <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {[
            { label: "Your Full Name *", key: "adminName", placeholder: "Dr. Rajesh Kumar" },
            { label: "Password *", key: "adminPassword", placeholder: "••••••••", type: "password" },
            { label: "Confirm Password *", key: "confirmPassword", placeholder: "••••••••", type: "password" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-white/45 text-xs font-medium mb-1">{f.label}</label>
              <input type={f.type || "text"} value={form[f.key as keyof typeof form]}
                onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder-white/20 transition-all"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "rgba(0,199,154,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,199,154,0.1)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep(2)}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm text-white/45 hover:text-white transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
              <ChevronLeft size={13} /> Back
            </button>
            <button onClick={handleSubmit}
              disabled={loading || !form.adminName || !form.adminPassword || !form.confirmPassword}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#00C79A,#E8B84B)", boxShadow: "0 4px 14px rgba(0,199,154,0.25)" }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : "Create Account & Enter Portal"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
