import { useState } from "react";
import { postEnquiry } from "@/lib/useSiteSettings";

type Props = {
  open: boolean;
  onClose: () => void;
  type: "expert" | "investor_deck" | "general";
  title: string;
  subtitle: string;
  source: string;
  primaryColor?: string;
  successDownload?: boolean; // if true and downloadUrl returned, auto-open
};

export default function EnquiryModal({ open, onClose, type, title, subtitle, source, primaryColor = "#005d90", successDownload }: Props) {
  const [form, setForm] = useState({ name: "", email: "", mobile: "", companyName: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ msg: string; url?: string | null } | null>(null);
  const [err, setErr] = useState("");

  if (!open) return null;

  const reset = () => { setForm({ name: "", email: "", mobile: "", companyName: "", message: "" }); setDone(null); setErr(""); };
  const close = () => { reset(); onClose(); };

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!form.name.trim() || !form.email.trim()) { setErr("Name & email required"); return; }
    setSubmitting(true);
    const res = await postEnquiry({
      type,
      name: form.name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim() || undefined,
      companyName: form.companyName.trim() || undefined,
      message: form.message.trim() || undefined,
      accountType: "company",
      source,
    });
    setSubmitting(false);
    if (!res.success) { setErr(res.error || "Submission failed. Try again."); return; }
    if (successDownload && res.downloadUrl) {
      window.open(res.downloadUrl, "_blank", "noopener");
      setDone({ msg: "Download started! Check your downloads folder.", url: res.downloadUrl });
    } else if (successDownload && !res.downloadUrl) {
      setDone({ msg: "Thank you! Our team will email the deck to you shortly." });
    } else {
      setDone({ msg: "Thanks! Our team will reach out within 24 hours." });
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={close}
    >
      <div
        style={{ background: "white", borderRadius: 24, maxWidth: 480, width: "100%", padding: 32, boxShadow: "0 25px 80px rgba(0,0,0,0.3)", position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={close} aria-label="Close" style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "#f3f4f6", border: "none", cursor: "pointer", fontSize: 20, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>

        {done ? (
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#10B98115", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <span style={{ fontSize: 30, color: "#10B981" }}>✓</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#181c20", margin: "0 0 8px" }}>You're all set!</h3>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 20px" }}>{done.msg}</p>
            {done.url && (
              <a href={done.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 20px", background: primaryColor, color: "white", borderRadius: 99, fontSize: 13, fontWeight: 700, textDecoration: "none", marginRight: 8 }}>Open Again</a>
            )}
            <button onClick={close} style={{ padding: "10px 20px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: "#181c20", margin: "0 0 6px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h3>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>{subtitle}</p>
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label="Full Name *" value={form.name} onChange={(v) => set("name", v)} placeholder="Your name" />
              <Input label="Work Email *" value={form.email} onChange={(v) => set("email", v)} placeholder="you@company.com" type="email" />
              <Input label="Mobile" value={form.mobile} onChange={(v) => set("mobile", v)} placeholder="+91 98765 43210" type="tel" />
              <Input label="Company / Organization" value={form.companyName} onChange={(v) => set("companyName", v)} placeholder="e.g. Acme Corp" />
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" }}>Message (optional)</label>
                <textarea
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder="How can we help?"
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", color: "#181c20", background: "white" }}
                />
              </div>
              {err && <div style={{ fontSize: 13, color: "#ef4444", background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>{err}</div>}
              <button
                type="submit"
                disabled={submitting}
                style={{ marginTop: 8, padding: "14px 24px", background: primaryColor, color: "white", border: "none", borderRadius: 99, fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, transition: "all 0.2s" }}
              >
                {submitting ? "Submitting..." : type === "investor_deck" ? "Get the Deck" : "Submit"}
              </button>
              <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: "4px 0 0" }}>
                By submitting, you agree to be contacted by Aorane regarding your enquiry.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", color: "#181c20", background: "white" }}
      />
    </div>
  );
}
