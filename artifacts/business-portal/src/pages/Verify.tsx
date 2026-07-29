import React, { useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { Mail, Phone, CheckCircle, AlertCircle, Clock, Shield, Loader2 } from "lucide-react";

export default function Verify() {
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState<"email" | "phone" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sendEmailVerification = async () => {
    setLoading("email"); setMessage(""); setError("");
    try {
      const res = await api.sendEmailVerification();
      setEmailSent(true); setMessage(res.message);
    } catch (e) { setError((e as Error).message || "Failed to send verification email"); }
    finally { setLoading(null); }
  };

  const sendPhoneOtp = async () => {
    setLoading("phone"); setMessage(""); setError("");
    try {
      const res = await api.sendPhoneOtp();
      setPhoneSent(true); setMessage(res.message);
    } catch (e) { setError((e as Error).message || "Failed to send OTP"); }
    finally { setLoading(null); }
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {/* Hero */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="pill-chip bg-primary/10 text-primary uppercase">
              <Shield size={11} /> Trust & Verification
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">Account Verification</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Verify your email and phone to unlock all features and build member trust.</p>
        </div>

        {/* Coming Soon Notice */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Clock size={16} className="text-amber-600" />
          </div>
          <div>
            <div className="font-display font-semibold text-amber-900 text-sm">Verification setup in progress</div>
            <p className="text-amber-800/80 text-xs mt-1 leading-relaxed">
              Email verification (SMTP) and Phone OTP (MSG91/Twilio) will be activated once the keys are configured. The structure is ready — your admin will enable it soon.
            </p>
          </div>
        </div>

        {message && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-sm">
            <CheckCircle size={16} className="shrink-0" /> {message}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-sm">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Email Verification */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail size={20} className="text-primary" />
                </div>
                <div>
                  <div className="font-display font-semibold text-foreground">Email Verification</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Verify your organization email address</div>
                </div>
              </div>
              {emailSent ? (
                <span className="pill-chip bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle size={12} /> Sent (stub)
                </span>
              ) : (
                <button
                  onClick={sendEmailVerification}
                  disabled={loading === "email"}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold transition-all disabled:opacity-60 hover:bg-primary/90"
                >
                  {loading === "email" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Send Verification
                </button>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={11} /> Email service (SMTP/SendGrid) required — structure ready, keys pending
              </div>
            </div>
          </div>

          {/* Phone OTP */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                  <Phone size={20} className="text-secondary" />
                </div>
                <div>
                  <div className="font-display font-semibold text-foreground">Phone OTP Verification</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Verify via SMS OTP</div>
                </div>
              </div>
              {phoneSent ? (
                <span className="pill-chip bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle size={12} /> Sent (stub)
                </span>
              ) : (
                <button
                  onClick={sendPhoneOtp}
                  disabled={loading === "phone"}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold transition-all disabled:opacity-60 hover:bg-secondary/90"
                >
                  {loading === "phone" ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                  Send OTP
                </button>
              )}
            </div>
            {phoneSent && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Enter OTP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground font-mono-data text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
                  />
                  <button className="px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold opacity-60 cursor-not-allowed">
                    Verify (stub)
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={11} /> OTP service (MSG91/Twilio) required — structure ready, keys pending
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Contact your Aorane administrator to activate verification services.
        </p>
      </div>
    </Layout>
  );
}
