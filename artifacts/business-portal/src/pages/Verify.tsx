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
    setLoading("email");
    setMessage("");
    setError("");
    try {
      const res = await api.sendEmailVerification();
      setEmailSent(true);
      setMessage(res.message);
    } catch (e) {
      setError((e as Error).message || "Failed to send verification email");
    } finally {
      setLoading(null);
    }
  };

  const sendPhoneOtp = async () => {
    setLoading("phone");
    setMessage("");
    setError("");
    try {
      const res = await api.sendPhoneOtp();
      setPhoneSent(true);
      setMessage(res.message);
    } catch (e) {
      setError((e as Error).message || "Failed to send OTP");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0D1F33]">Account Verification</h1>
          <p className="text-[#6B7280] text-sm mt-0.5">Verify your email and phone to unlock all features</p>
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-800 text-sm">Verification Setup In Progress</div>
            <div className="text-amber-700 text-sm mt-1">
              Email verification (SMTP) and Phone OTP (MSG91/Twilio) will be activated once the keys are configured.
              The structure is ready — your admin will enable it soon.
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-sm">
            <CheckCircle size={16} className="shrink-0" />
            {message}
          </div>
        )}
        {error && (
          <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Email Verification */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0077B6]/10 flex items-center justify-center">
                  <Mail size={20} className="text-[#0077B6]" />
                </div>
                <div>
                  <div className="font-semibold text-[#0D1F33]">Email Verification</div>
                  <div className="text-xs text-[#6B7280] mt-0.5">Verify your organization email address</div>
                </div>
              </div>
              {emailSent ? (
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                  <CheckCircle size={12} /> Sent (stub)
                </span>
              ) : (
                <button
                  onClick={sendEmailVerification}
                  disabled={loading === "email"}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-60"
                  style={{ background: "#0077B6" }}
                >
                  {loading === "email" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Send Verification
                </button>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Shield size={11} /> Email service (SMTP/SendGrid) required — structure ready, keys pending
              </div>
            </div>
          </div>

          {/* Phone OTP */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1B998B]/10 flex items-center justify-center">
                  <Phone size={20} className="text-[#1B998B]" />
                </div>
                <div>
                  <div className="font-semibold text-[#0D1F33]">Phone OTP Verification</div>
                  <div className="text-xs text-[#6B7280] mt-0.5">Verify via SMS OTP</div>
                </div>
              </div>
              {phoneSent ? (
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                  <CheckCircle size={12} /> Sent (stub)
                </span>
              ) : (
                <button
                  onClick={sendPhoneOtp}
                  disabled={loading === "phone"}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-60"
                  style={{ background: "#1B998B" }}
                >
                  {loading === "phone" ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                  Send OTP
                </button>
              )}
            </div>
            {phoneSent && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Enter OTP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#0D1F33] font-mono text-center text-lg tracking-widest focus:outline-none focus:border-[#1B998B] focus:ring-2 focus:ring-[#1B998B]/20 transition-all"
                  />
                  <button className="px-4 py-2.5 rounded-xl bg-[#1B998B] text-white text-sm font-medium opacity-60 cursor-not-allowed">
                    Verify (stub)
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Shield size={11} /> OTP service (MSG91/Twilio) required — structure ready, keys pending
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-[#9CA3AF]">
          Contact your AORANE administrator to activate verification services.
        </div>
      </div>
    </Layout>
  );
}
