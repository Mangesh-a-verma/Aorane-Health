import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type EnrollmentCode } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { QrCode, Plus, Copy, Check, Clock, Users, AlertCircle, X, Lock } from "lucide-react";

function CodeBadge({ code }: { code: EnrollmentCode }) {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date(code.expiresAt) < new Date();
  const isFull = code.usedSeats >= code.totalSeats;
  const pct = Math.min(100, (code.usedSeats / code.totalSeats) * 100);

  const copyCode = () => {
    navigator.clipboard.writeText(code.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`bg-card border rounded-2xl p-5 transition-all ${isExpired || isFull ? "border-border opacity-60" : "border-border hover:border-primary/30 hover:shadow-md"}`}>
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="font-mono-data text-2xl font-bold text-foreground tracking-widest">{code.code}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {isExpired && <span className="pill-chip bg-destructive/10 text-destructive">Expired</span>}
            {isFull && !isExpired && <span className="pill-chip bg-amber-100 text-amber-700">Full</span>}
            {!isExpired && !isFull && <span className="pill-chip bg-emerald-100 text-emerald-700 capitalize">{code.planType}</span>}
          </div>
        </div>
        <button onClick={copyCode} className="shrink-0 p-2 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground" aria-label="Copy code">
          {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
        </button>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5 text-muted-foreground">
          <span className="flex items-center gap-1"><Users size={11} /> {code.usedSeats}/{code.totalSeats} used</span>
          <span className="font-mono-data tabular-nums">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock size={11} />
        <span>Expires {new Date(code.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
    </div>
  );
}

export default function EnrollmentCodes() {
  const { isPaidActive, subscriptionLoading } = useAuth();
  const [codes, setCodes] = useState<EnrollmentCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ planType: "basic", totalSeats: "20", validityDays: "365" });

  const fetchCodes = () => {
    setLoading(true);
    api.getCodes().then((r) => setCodes(r.codes)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      await api.createCode({
        planType: form.planType,
        totalSeats: parseInt(form.totalSeats),
        validityDays: parseInt(form.validityDays),
      });
      setShowModal(false);
      fetchCodes();
    } catch (err) {
      setError((err as Error).message || "Failed to create code");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Hero */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="pill-chip bg-primary/10 text-primary uppercase">
                <QrCode size={11} /> Member Invites
              </span>
            </div>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">Enrollment Codes</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Generate codes to invite members to your organization.</p>
          </div>
          {!subscriptionLoading && !isPaidActive ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-muted border border-border text-muted-foreground text-sm font-semibold cursor-not-allowed opacity-60">
              <Lock size={14} /> Requires Active Plan
            </div>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={subscriptionLoading}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-2.5 rounded-full text-sm transition-all shadow-md shadow-primary/20 disabled:opacity-60"
            >
              <Plus size={16} />
              New Code
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                <div className="h-7 bg-muted rounded mb-3 w-3/4" />
                <div className="h-2 bg-muted rounded mb-2" />
                <div className="h-2 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-dashed border-border rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <QrCode size={24} className="text-muted-foreground/50" />
            </div>
            <p className="font-display font-semibold text-foreground">No enrollment codes created yet</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">Click the New Code button to create your first enrollment code.</p>
            {isPaidActive && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 flex items-center gap-2 bg-primary/10 hover:bg-primary/15 text-primary px-4 py-2 rounded-full text-sm font-semibold transition-all"
              >
                <Plus size={15} /> Create First Code
              </button>
            )}
            {!isPaidActive && !subscriptionLoading && (
              <a href="/billing" className="mt-4 flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-full text-sm font-semibold transition-all">
                <Lock size={14} /> Activate Plan to Create Codes
              </a>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {codes.map((code) => <CodeBadge key={code.id} code={code} />)}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display font-bold text-foreground text-lg">New Enrollment Code</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure invitation details</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Plan Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {["basic", "premium", "enterprise"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setForm((f) => ({ ...f, planType: p }))}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium capitalize transition-all ${
                        form.planType === p ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Total Seats</label>
                <input
                  type="number"
                  value={form.totalSeats}
                  onChange={(e) => setForm((f) => ({ ...f, totalSeats: e.target.value }))}
                  min="1"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-mono-data"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Validity</label>
                <div className="grid grid-cols-4 gap-2">
                  {["30", "90", "180", "365"].map((d) => (
                    <button
                      key={d}
                      onClick={() => setForm((f) => ({ ...f, validityDays: d }))}
                      className={`py-2 rounded-xl border text-sm transition-all ${
                        form.validityDays === d ? "bg-primary/10 border-primary text-primary font-semibold" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-full disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Enrollment Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
