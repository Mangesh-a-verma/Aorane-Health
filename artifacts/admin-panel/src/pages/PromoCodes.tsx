import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type PromoCode } from "@/lib/api";
import { Tag, Plus, Copy, Check, X, ChevronDown, ChevronUp, Pencil, Trash2, Loader2 } from "lucide-react";

const PLAN_GROUPS = [
  {
    label: "Individual Plans",
    color: "#0077B6",
    plans: [
      { key: "max",    label: "Max" },
      { key: "pro",    label: "Pro" },
      { key: "family", label: "Family" },
      { key: "free",   label: "Free" },
    ],
  },
  {
    label: "Business Plans",
    color: "#8B5CF6",
    plans: [
      { key: "starter",    label: "Starter" },
      { key: "growth",     label: "Growth" },
      { key: "enterprise", label: "Enterprise" },
      { key: "org_pro",    label: "Org Pro" },
      { key: "org_basic",  label: "Org Basic" },
    ],
  },
];

const ALL_PLAN_KEYS = PLAN_GROUPS.flatMap(g => g.plans.map(p => p.key));

function PlanSelector({ selected, onChange }: { selected: string[]; onChange: (plans: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);

  const label = selected.length === 0
    ? "Koi plan select nahi"
    : selected.length === ALL_PLAN_KEYS.length
    ? "Sab plans"
    : selected.length <= 3
    ? selected.map(k => k.toUpperCase()).join(", ")
    : `${selected.length} plans select hue`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary transition-all"
      >
        <span className={selected.length === 0 ? "text-muted-foreground" : "text-foreground font-medium"}>{label}</span>
        {open ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <button type="button" onClick={() => onChange(ALL_PLAN_KEYS)} className="text-xs text-primary hover:underline font-medium">Sab select karo</button>
            <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground hover:underline">Clear</button>
          </div>
          {PLAN_GROUPS.map(group => (
            <div key={group.label} className="p-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 mb-1" style={{ color: group.color }}>
                {group.label}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {group.plans.map(plan => {
                  const checked = selected.includes(plan.key);
                  return (
                    <button key={plan.key} type="button" onClick={() => toggle(plan.key)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${checked ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${checked ? "bg-primary border-primary" : "border-border"}`}>
                        {checked && <Check size={9} className="text-white" />}
                      </div>
                      {plan.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditCodeModal({ code, onClose, onSaved }: { code: PromoCode; onClose: () => void; onSaved: (updated: PromoCode) => void }) {
  const [form, setForm] = useState({
    discountPct: String(code.discountPct),
    usageLimit: code.usageLimit ? String(code.usageLimit) : "",
    expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().split("T")[0] : "",
    applicablePlans: code.applicablePlans || [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!form.discountPct || Number(form.discountPct) < 1 || Number(form.discountPct) > 100) {
      setErr("Discount 1–100 ke beech hona chahiye"); return;
    }
    setSaving(true); setErr("");
    try {
      const res = await api.updatePromoCode(code.id, {
        discountPct: Number(form.discountPct),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        applicablePlans: form.applicablePlans,
      });
      onSaved(res.code);
      onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Edit Promo Code"
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-foreground">Code Edit Karo</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{code.code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        {err && <div className="mb-3 text-sm text-red-500 bg-red-500/10 rounded-xl px-3 py-2">{err}</div>}
        <div className="space-y-3">
          {[
            { label: "Discount %", key: "discountPct", type: "number", placeholder: "10" },
            { label: "Usage Limit", key: "usageLimit", type: "number", placeholder: "Unlimited (khali chhodo)" },
            { label: "Expiry Date", key: "expiresAt", type: "date", placeholder: "" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{f.label}</label>
              <input type={f.type}
                value={(form as unknown as Record<string, string>)[f.key]}
                onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Applicable Plans *</label>
            <PlanSelector selected={form.applicablePlans} onChange={plans => setForm(f => ({ ...f, applicablePlans: plans }))} />
          </div>
          <button onClick={save} disabled={saving || form.applicablePlans.length === 0}
            className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromoCodes() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCode, setEditCode] = useState<PromoCode | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    discountPct: "10",
    usageLimit: "100",
    expiresAt: "",
    applicablePlans: ["max", "pro", "family"] as string[],
  });

  useEffect(() => {
    api.promoCodes().then((r) => setCodes(r.codes)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.createPromoCode({
        code: form.code.toUpperCase(),
        discountPct: Number(form.discountPct),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        applicablePlans: form.applicablePlans,
      });
      setCodes((c) => [res.code, ...c]);
      setShowModal(false);
      setForm({ code: "", discountPct: "10", usageLimit: "100", expiresAt: "", applicablePlans: ["max", "pro", "family"] });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`"${code}" promo code delete karein? Ye action undo nahi ho sakta.`)) return;
    setDeletingId(id);
    try {
      await api.deletePromoCode(id);
      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const isExpired = (code: PromoCode) => code.expiresAt ? new Date(code.expiresAt) < new Date() : false;
  const isFull = (code: PromoCode) => code.usageLimit !== null && code.timesUsed >= (code.usageLimit ?? Infinity);

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Promo Codes</h1>
            <p className="text-muted-foreground text-sm">{codes.length} codes total — Individual + Business plans dono ke liye</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus size={15} /> New Code
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Tag size={36} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Koi promo code nahi mila</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Code", "Discount", "Plans", "Used", "Expiry", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded">{c.code}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                      {c.discountPct}% OFF
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(c.applicablePlans || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">All plans</span>
                        ) : (
                          (c.applicablePlans || []).slice(0, 4).map(p => (
                            <span key={p} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {p.toUpperCase()}
                            </span>
                          ))
                        )}
                        {(c.applicablePlans || []).length > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{(c.applicablePlans || []).length - 4} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {c.timesUsed}{c.usageLimit ? `/${c.usageLimit}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.expiresAt
                        ? new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "Kabhi nahi"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isExpired(c)
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : isFull(c)
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}>
                        {isExpired(c) ? "Expired" : isFull(c) ? "Limit Reached" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyCode(c.id, c.code)} title="Copy code"
                          className="p-1.5 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all">
                          {copiedId === c.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        </button>
                        <button onClick={() => setEditCode(c)} title="Edit code"
                          className="p-1.5 rounded-lg bg-muted hover:bg-blue-100 dark:hover:bg-blue-900/30 text-muted-foreground hover:text-blue-600 transition-all">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(c.id, c.code)} title="Delete code"
                          disabled={deletingId === c.id}
                          className="p-1.5 rounded-lg bg-muted hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-all disabled:opacity-50">
                          {deletingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="New Promo Code"
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">Naya Promo Code</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Code *", key: "code", placeholder: "HEALTH20", type: "text" },
                { label: "Discount %", key: "discountPct", placeholder: "10", type: "number" },
                { label: "Usage Limit", key: "usageLimit", placeholder: "100", type: "number" },
                { label: "Expires At", key: "expiresAt", placeholder: "", type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{f.label}</label>
                  <input type={f.type}
                    value={(form as unknown as Record<string, string>)[f.key]}
                    onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Applicable Plans *</label>
                <PlanSelector selected={form.applicablePlans} onChange={(plans) => setForm(f => ({ ...f, applicablePlans: plans }))} />
                <div className="text-[10px] text-muted-foreground mt-1">Individual + Business dono plans select kar sakte ho</div>
              </div>
              <button onClick={create} disabled={creating || !form.code || form.applicablePlans.length === 0}
                className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 mt-1 flex items-center justify-center gap-2">
                {creating ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : "Code Banao"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editCode && (
        <EditCodeModal
          code={editCode}
          onClose={() => setEditCode(null)}
          onSaved={(updated) => {
            setCodes(prev => prev.map(c => c.id === updated.id ? updated : c));
            setEditCode(null);
          }}
        />
      )}
    </Layout>
  );
}
