import { useState } from "react";
import { X, Bell, Mail, Phone, User, Send, CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { getAttribution, track, ConsumerEvents } from "@workspace/analytics";

const API_BASE = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, "")
  : (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

interface NotifyModalProps {
  featureName?: string;
  onClose: () => void;
}

type Step = "form" | "otp" | "done";

export default function NotifyModal({ featureName, onClose }: NotifyModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [otpError, setOtpError] = useState("");

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  const isFormValid =
    name.trim().length > 0 &&
    age.trim().length > 0 &&
    gender.length > 0 &&
    email.trim().length > 0 &&
    emailValid;

  async function sendOtp() {
    if (!isFormValid) return;
    setOtpSending(true);
    setOtpError("");
    try {
      const r = await fetch(`${API_BASE}/api/leads/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setOtpError(d.error || "Failed to send OTP — please try again");
        setOtpSending(false);
        return;
      }
      setOtpSent(true);
      setStep("otp");
    } catch {
      setOtpError("Network error — please check your internet connection");
    }
    setOtpSending(false);
  }

  async function handleSubmit() {
    if (!otp.trim() || otp.length !== 6) {
      setOtpError("Please enter the 6-digit OTP");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/api/enquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "notify_me",
          name: name.trim(),
          email: email.trim(),
          mobile: phone.trim() || undefined,
          source: "notify_popup",
          message: JSON.stringify({ age, gender, feature: featureName || "general" }),
          otp,
          attribution: getAttribution(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Submission failed — please try again");
        setSubmitting(false);
        return;
      }
      track(ConsumerEvents.NOTIFY_ME_SUBMIT, { feature: featureName || "general" }, "marketing");
      setStep("done");
    } catch {
      setError("Network error — please check your internet connection");
    }
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4" style={{ background: "linear-gradient(135deg, #05473C 0%, #082F28 100%)" }}>
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-medium">Early Access Notification</p>
              <h2 className="text-white font-extrabold text-lg leading-tight">
                {featureName ? `Notify me for ${featureName}` : "Notify me when it's live!"}
              </h2>
            </div>
          </div>
          <p className="text-white/60 text-xs">
            When this feature launches, you'll be the first to know. Free early access guaranteed.
          </p>
        </div>

        <div className="px-6 py-5">
          {/* ─── Step: Form ──────────────────────────────── */}
          {step === "form" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Your Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C79A] focus:ring-2 focus:ring-[#00C79A]/25"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Age *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="25"
                    maxLength={3}
                    value={age}
                    onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C79A] focus:ring-2 focus:ring-[#00C79A]/25"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Gender *</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Male", "Female", "Other"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className="py-2.5 text-sm font-medium rounded-xl border transition-all"
                      style={
                        gender === g
                          ? { background: "#05473C", color: "white", borderColor: "#05473C" }
                          : { background: "white", color: "#374151", borderColor: "#E5E7EB" }
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C79A] focus:ring-2 focus:ring-[#00C79A]/25"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  Mobile Number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    inputMode="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C79A] focus:ring-2 focus:ring-[#00C79A]/25"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button
                type="button"
                onClick={sendOtp}
                disabled={!isFormValid || otpSending}
                className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: isFormValid ? "#05473C" : "#9CA3AF", color: "white" }}
              >
                {otpSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {otpSending ? "Sending OTP..." : "Verify via Email OTP"}
              </button>

              <p className="text-center text-[11px] text-gray-400">
                * Your data is used only for launch notifications. Unsubscribe anytime.
              </p>
            </div>
          )}

          {/* ─── Step: OTP ──────────────────────────────── */}
          {step === "otp" && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#E6F4F1] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-7 h-7 text-[#05473C]" />
                </div>
                <h3 className="font-bold text-gray-900">OTP sent to your email</h3>
                <p className="text-sm text-gray-500 mt-1">
                  A 6-digit OTP has been sent to{" "}
                  <span className="font-medium text-gray-700">{email}</span>.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block text-center">
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="_ _ _ _ _ _"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full px-4 py-3 text-center text-xl font-bold tracking-[0.5em] border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#00C79A] focus:ring-2 focus:ring-[#00C79A]/25"
                />
              </div>

              {(otpError || error) && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg text-center">
                  {otpError || error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={otp.length !== 6 || submitting}
                className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: otp.length === 6 ? "#05473C" : "#9CA3AF", color: "white" }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {submitting ? "Submitting..." : "Verify & Register"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setStep("form"); setOtp(""); setOtpError(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Go back / Change email
                </button>
                {otpSent && (
                  <span className="ml-3 text-xs text-gray-400">
                    ·{" "}
                    <button
                      type="button"
                      onClick={sendOtp}
                      disabled={otpSending}
                      className="text-[#05473C] hover:underline disabled:opacity-50"
                    >
                      {otpSending ? "Sending..." : "Resend OTP"}
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ─── Step: Done ──────────────────────────────── */}
          {step === "done" && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-9 h-9 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">You're registered! 🎉</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Hi <span className="font-medium text-gray-700">{name}</span>! When{" "}
                  <span className="font-medium text-[#05473C]">
                    {featureName || "this feature"}
                  </span>{" "}
                  launches, you'll be the first to know at{" "}
                  <span className="font-medium text-gray-700">{email}</span>.
                </p>
              </div>
              <div className="bg-[#E6F4F1] rounded-2xl px-4 py-3 text-xs text-[#05473C]">
                💡 In the meantime, download the Aorane app — all live features are free!
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "#05473C", color: "white" }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
