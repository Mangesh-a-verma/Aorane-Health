import React, { useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { Mail, Phone, CheckCircle, AlertCircle, Clock, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardShell, NeuCard, PageHeader } from "@/components/portal/primitives";

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
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="Trust"
          title="Account Verification"
          description="Verify your email and phone to unlock all features and build member trust."
        />

        <Alert className="rounded-3xl">
          <Clock size={16} />
          <AlertTitle>Verification setup in progress</AlertTitle>
          <AlertDescription>
            Email verification (SMTP) and Phone OTP (MSG91/Twilio) will be activated once the keys are
            configured. The structure is ready — your admin will enable it soon.
          </AlertDescription>
        </Alert>

        {message && (
          <NeuCard variant="flat" className="flex items-center gap-3 p-4 text-sm tone-mint">
            <CheckCircle size={16} className="shrink-0" /> {message}
          </NeuCard>
        )}
        {error && (
          <NeuCard variant="flat" className="flex items-center gap-3 p-4 text-sm tone-danger">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </NeuCard>
        )}

        <div className="grid grid-cols-1 gap-5">
          {/* Email Verification */}
          <CardShell>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl tone-primary">
                  <Mail size={20} />
                </span>
                <div>
                  <div className="font-semibold text-foreground">Email Verification</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Verify your organization email address</div>
                </div>
              </div>
              {emailSent ? (
                <Badge variant="success"><CheckCircle size={12} /> Sent (stub)</Badge>
              ) : (
                <Button variant="brand" onClick={sendEmailVerification} disabled={loading === "email"}>
                  {loading === "email" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Send Verification
                </Button>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={11} /> Email service (SMTP/SendGrid) required — structure ready, keys pending
              </div>
            </div>
          </CardShell>

          {/* Phone OTP */}
          <CardShell>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl tone-teal">
                  <Phone size={20} />
                </span>
                <div>
                  <div className="font-semibold text-foreground">Phone OTP Verification</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Verify via SMS OTP</div>
                </div>
              </div>
              {phoneSent ? (
                <Badge variant="success"><CheckCircle size={12} /> Sent (stub)</Badge>
              ) : (
                <Button variant="neu" onClick={sendPhoneOtp} disabled={loading === "phone"}>
                  {loading === "phone" ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                  Send OTP
                </Button>
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
                    className="flex-1 neu-inset rounded-xl px-4 py-2.5 bg-transparent text-foreground font-mono-data text-center text-lg tracking-widest focus:outline-none"
                  />
                  <Button variant="neu" disabled className="opacity-60 cursor-not-allowed">
                    Verify (stub)
                  </Button>
                </div>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={11} /> OTP service (MSG91/Twilio) required — structure ready, keys pending
              </div>
            </div>
          </CardShell>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Contact your Aorane administrator to activate verification services.
        </p>
      </div>
    </Layout>
  );
}
