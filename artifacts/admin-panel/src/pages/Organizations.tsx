import React, { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { api, type Org } from "@/lib/api";
import {
  Building2, MapPin, Mail, Users, RefreshCw, Calendar,
  Search, ChevronRight, Activity, Hash, Shield, Briefcase,
  ToggleLeft, ToggleRight, Loader2, Pencil, Trash2, X, Check,
  AlertTriangle, Plus, LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown,
  IndianRupee, CheckCircle2,
} from "lucide-react";

const ORG_TYPES = ["corporate", "hospital", "gym", "insurance", "ngo", "yoga", "school", "other"] as const;

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  corporate:  { icon: "🏢", label: "Corporate",  color: "#0077B6" },
  hospital:   { icon: "🏥", label: "Hospital",   color: "#DC2626" },
  gym:        { icon: "💪", label: "Gym",         color: "#10B981" },
  insurance:  { icon: "🛡️", label: "Insurance",  color: "#8B5CF6" },
  ngo:        { icon: "🤝", label: "NGO",         color: "#F59E0B" },
  yoga:       { icon: "🧘", label: "Yoga",        color: "#06B6D4" },
  school:     { icon: "📚", label: "School",      color: "#3B82F6" },
  other:      { icon: "✨", label: "Other",       color: "#6B7280" },
};

function TypeDistributionBar({ orgs }: { orgs: Org[] }) {
  if (orgs.length === 0) return null;
  const counts = Object.keys(TYPE_META).map(type => ({
    type, meta: TYPE_META[type], count: orgs.filter(o => o.orgType === type).length,
  })).filter(t => t.count > 0);
  const total = orgs.length;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organization Type Distribution</span>
        <span className="text-xs text-muted-foreground">{total} total</span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {counts.map(({ type, meta, count }) => (
          <div key={type} className="h-full rounded-sm transition-all" title={`${meta.label}: ${count}`}
               style={{ width: `${(count / total) * 100}%`, background: meta.color, minWidth: count > 0 ? 4 : 0 }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {counts.map(({ type, meta, count }) => (
          <div key={type} className="flex items-center gap-1">
            <span className="text-base leading-none">{meta.icon}</span>
            <span className="text-[10px] text-muted-foreground font-medium">{meta.label}</span>
            <span className="text-[10px] font-bold" style={{ color: meta.color }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ALL_TYPES = ["all", ...Object.keys(TYPE_META)];

type SortKey = "name" | "createdAt" | "usedSeats" | "totalSeats" | "totalRevenue";
type SortDir = "asc" | "desc";
type ViewMode = "grid" | "table";
type EditForm = { name: string; contactEmail: string; city: string; state: string; totalSeats: number; orgType: string };
type CreateForm = { name: string; contactEmail: string; city: string; state: string; totalSeats: number; orgType: string };

function CreateOrgModal({ onClose, onCreate }: { onClose: () => void; onCreate: (org: Org) => void }) {
  const [form, setForm] = useState<CreateForm>({
    name: "", contactEmail: "", city: "", state: "", totalSeats: 10, orgType: "corporate",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (k: keyof CreateForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name.trim()) { setError("Organization name is required"); return; }
    if (!form.contactEmail.trim()) { setError("Contact email is required"); return; }
    if (!/\S+@\S+\.\S+/.test(form.contactEmail)) { setError("Enter a valid email address"); return; }
    setSaving(true); setError("");
    try {
      const res = await api.createOrg(form);
      onCreate(res.organization);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to create organization. Please retry.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-primary" />
            <h2 className="font-bold text-foreground">New Organization</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-sm">
              <AlertTriangle size={14} className="shrink-0" />{error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organization Name *</label>
            <input value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Tata Consultancy Services"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Email *</label>
            <input type="email" value={form.contactEmail} onChange={e => update("contactEmail", e.target.value)} placeholder="hr@company.com"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</label>
              <input value={form.city} onChange={e => update("city", e.target.value)} placeholder="Mumbai"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</label>
              <input value={form.state} onChange={e => update("state", e.target.value)} placeholder="Maharashtra"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Org Type *</label>
              <select value={form.orgType} onChange={e => update("orgType", e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all">
                {ORG_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.icon} {TYPE_META[t]?.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Seats</label>
              <input type="number" min={1} value={form.totalSeats} onChange={e => update("totalSeats", parseInt(e.target.value) || 1)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 text-xs text-muted-foreground">
            <Hash size={12} />
            <span>Org code will be auto-generated (e.g. TCS7K3)</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 pt-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? "Creating…" : "Create Organization"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditOrgModal({ org, onClose, onSave }: { org: Org; onClose: () => void; onSave: (updated: Org) => void }) {
  const [form, setForm] = useState<EditForm>({
    name: org.name, contactEmail: org.contactEmail,
    city: org.city || "", state: org.state || "",
    totalSeats: org.totalSeats, orgType: org.orgType,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (k: keyof EditForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.contactEmail.trim()) { setError("Contact email is required"); return; }
    setSaving(true); setError("");
    try {
      const res = await api.updateOrg(org.id, form);
      onSave(res.organization);
    } catch { setError("Failed to save. Please retry."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2"><Pencil size={16} className="text-primary" /><h2 className="font-bold text-foreground">Edit Organization</h2></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-sm">
              <AlertTriangle size={14} className="shrink-0" />{error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organization Name *</label>
            <input value={form.name} onChange={e => update("name", e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" placeholder="e.g. Tata Consultancy Services" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Email *</label>
            <input type="email" value={form.contactEmail} onChange={e => update("contactEmail", e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" placeholder="hr@company.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</label>
              <input value={form.city} onChange={e => update("city", e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" placeholder="Mumbai" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</label>
              <input value={form.state} onChange={e => update("state", e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" placeholder="Maharashtra" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</label>
              <select value={form.orgType} onChange={e => update("orgType", e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all">
                {ORG_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.icon} {TYPE_META[t]?.label || t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Seats</label>
              <input type="number" min={1} value={form.totalSeats} onChange={e => update("totalSeats", parseInt(e.target.value) || 1)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 pt-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-60">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ org, onClose, onConfirm }: { org: Org; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const handleDelete = async () => {
    setDeleting(true); setError("");
    try { await onConfirm(); }
    catch { setError("Failed to delete. Please retry."); setDeleting(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-red-200 dark:border-red-900 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-3">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <h2 className="font-bold text-foreground text-lg mb-1">Delete Organization?</h2>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-semibold text-foreground">"{org.name}"</span> and all associated data. This action cannot be undone.
          </p>
          {error && <div className="mt-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-xl px-3 py-2">{error}</div>}
        </div>
        <div className="flex items-center gap-2 p-5 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-all">Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-60">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomPricingModal({ org, onClose, onSaved }: { org: Org; onClose: () => void; onSaved: (updated: Org) => void }) {
  const STANDARD = 249;
  const [price, setPrice] = useState(org.customPricePerSeat ? String(org.customPricePerSeat) : "");
  const [note, setNote] = useState(org.customPriceNote || "");
  const [validUntil, setValidUntil] = useState(org.customPriceValidUntil ? new Date(org.customPriceValidUntil).toISOString().split("T")[0] : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const discount = price && Number(price) < STANDARD ? Math.round((1 - Number(price) / STANDARD) * 100) : 0;

  const save = async () => {
    if (!price || Number(price) <= 0) { setErr("Price enter karo"); return; }
    setSaving(true); setErr("");
    try {
      const r = await api.setOrgCustomPricing(org.id, { customPricePerSeat: Number(price), customPriceNote: note || undefined, customPriceValidUntil: validUntil || null });
      onSaved(r.organization); onClose();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!org.customPricePerSeat) return;
    setSaving(true);
    try {
      const r = await api.setOrgCustomPricing(org.id, { remove: true });
      onSaved(r.organization); onClose();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Custom Pricing" className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="font-bold text-sm text-foreground flex items-center gap-1.5"><IndianRupee size={14} className="text-amber-500" />Custom Pricing</div>
            <div className="text-xs text-muted-foreground mt-0.5">{org.name} · {org.orgCode}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={14} /></button>
        </div>
        <div className="p-4 space-y-3">
          {err && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Price per Seat (₹) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
              <input type="number" min="1" value={price} onChange={e => setPrice(e.target.value)} placeholder={`Standard: ₹${STANDARD}`}
                className="w-full bg-background border border-border rounded-xl pl-7 pr-4 py-2 text-sm focus:outline-none focus:border-primary" />
            </div>
            {discount > 0 && <div className="text-[11px] text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={10}/>{discount}% off standard</div>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Note / Reason</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Enterprise deal, sales negotiation..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Valid Until (optional)</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} min={new Date().toISOString().split("T")[0]}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>
        <div className="flex items-center gap-2 p-4 pt-0">
          {org.customPricePerSeat && (
            <button onClick={remove} disabled={saving} className="px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20">Remove</button>
          )}
          <button onClick={save} disabled={saving || !price}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <IndianRupee size={12} />}
            {saving ? "Saving…" : org.customPricePerSeat ? "Update Price" : "Set Price"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgCard({ org, onToggleActive, onEdit, onDelete, onCustomPrice }: {
  org: Org; onToggleActive: (id: string) => Promise<void>;
  onEdit: (org: Org) => void; onDelete: (org: Org) => void;
  onCustomPrice: (org: Org) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const meta = TYPE_META[org.orgType] || TYPE_META.other;
  const seatPct = org.totalSeats > 0 ? Math.round((org.usedSeats / org.totalSeats) * 100) : 0;
  const seatColor = seatPct >= 90 ? "#EF4444" : seatPct >= 70 ? "#F59E0B" : "#10B981";

  const handleToggle = async () => { setToggling(true); await onToggleActive(org.id); setToggling(false); };

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all hover:shadow-md ${org.isActive ? "border-border" : "border-red-200 dark:border-red-900/40"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm"
               style={{ background: `${meta.color}14` }}>
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-foreground truncate text-sm">{org.name}</h3>
                <div className="flex items-center flex-wrap gap-1.5 mt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${meta.color}18`, color: meta.color }}>{meta.label}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    org.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                 : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                    {org.isActive ? "● Active" : "○ Inactive"}
                  </span>
                  {org.customPricePerSeat && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <IndianRupee size={8} />{Number(org.customPricePerSeat)}/seat
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onCustomPrice(org)}
                  className={`p-1.5 rounded-lg text-xs transition-all ${org.customPricePerSeat ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"}`}
                  title={org.customPricePerSeat ? `Custom: ₹${Number(org.customPricePerSeat)}/seat` : "Set Custom Price"}>
                  <IndianRupee size={13} />
                </button>
                <button onClick={() => onEdit(org)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1">
            <Hash size={10} className="text-muted-foreground" />
            <span className="font-mono text-[11px] font-bold tracking-widest text-foreground uppercase">{org.orgCode}</span>
          </div>
          {org.createdAt && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar size={9} />
              <span>{new Date(org.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users size={11} /><span>Seats Used</span></div>
            <span className="text-xs font-bold" style={{ color: seatColor }}>{org.usedSeats}/{org.totalSeats} ({seatPct}%)</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(seatPct, 100)}%`, background: seatColor }} />
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        {org.contactEmail && (
          <a href={`mailto:${org.contactEmail}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors group">
            <Mail size={11} className="shrink-0" /><span className="truncate group-hover:underline">{org.contactEmail}</span>
          </a>
        )}
        {(org.city || org.state) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin size={11} className="shrink-0" /><span>{[org.city, org.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
      </div>
      {expanded && (
        <div className="border-t border-border p-4 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Organization</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs"><Briefcase size={11} className="text-muted-foreground shrink-0" /><span className="font-medium capitalize">{org.orgType}</span></div>
                <div className="flex items-center gap-2 text-xs"><Activity size={11} className="text-muted-foreground shrink-0" />
                  <span className={org.isActive ? "text-green-600" : "text-red-500"}>{org.isActive ? "Operational" : "Suspended"}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Capacity</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs"><Users size={11} className="text-muted-foreground shrink-0" /><span>{org.usedSeats} enrolled / {org.totalSeats} total</span></div>
                <div className="flex items-center gap-2 text-xs"><Shield size={11} className="text-muted-foreground shrink-0" /><span>{org.totalSeats - org.usedSeats} seats available</span></div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
            {org.contactEmail
              ? <a href={`mailto:${org.contactEmail}`} className="inline-flex items-center gap-2 text-xs text-primary hover:underline font-medium"><Mail size={11} />Send Email</a>
              : <span />}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => onCustomPrice(org)}
                aria-label="Set custom pricing"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  org.customPricePerSeat
                    ? "border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:bg-amber-900/20"
                    : "border-border text-muted-foreground hover:bg-muted/50"}`}
                title="Custom Pricing">
                <IndianRupee size={11} />
                {org.customPricePerSeat ? `₹${Number(org.customPricePerSeat)}/seat` : "Set Price"}
              </button>
              <button onClick={handleToggle} disabled={toggling}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  org.isActive
                    ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"}`}>
                {toggling ? <Loader2 size={11} className="animate-spin" /> : org.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                {org.isActive ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => onDelete(org)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20">
                <Trash2 size={11} />Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortButton({ label, sortKey, current, dir, onClick }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onClick: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
      {label}
      {active ? (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-40" />}
    </button>
  );
}

export default function Organizations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<Org | null>(null);
  const [pricingOrg, setPricingOrg] = useState<Org | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchOrgs = () => {
    setLoading(true); setError("");
    api.organizations()
      .then((r) => setOrgs(r.organizations))
      .catch(() => setError("Failed to load organizations. Please retry."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchOrgs(); }, []);

  const handleToggleActive = async (id: string) => {
    setTogglingId(id);
    try {
      const res = await api.toggleOrgActive(id);
      setOrgs(prev => prev.map(o => o.id === id ? { ...o, isActive: res.organization.isActive } : o));
    } catch {
      setError("Failed to update organization status. Please retry.");
    } finally { setTogglingId(null); }
  };

  const handleOrgCreated = (org: Org) => { setOrgs(prev => [org, ...prev]); setShowCreate(false); };
  const handleOrgUpdated = (updated: Org) => { setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o)); setEditOrg(null); };
  const handlePricingUpdated = (updated: Org) => { setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o)); setPricingOrg(null); };
  const handleOrgDeleted = async () => {
    if (!deleteOrg) return;
    await api.deleteOrg(deleteOrg.id);
    setOrgs(prev => prev.filter(o => o.id !== deleteOrg.id));
    setDeleteOrg(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let result = orgs.filter(org => {
      const matchType = typeFilter === "all" || org.orgType === typeFilter;
      const matchStatus = statusFilter === "all" || (statusFilter === "active" ? org.isActive : !org.isActive);
      const q = search.toLowerCase();
      const matchSearch = !q || org.name.toLowerCase().includes(q)
        || org.orgCode.toLowerCase().includes(q)
        || (org.city || "").toLowerCase().includes(q)
        || (org.contactEmail || "").toLowerCase().includes(q);
      return matchType && matchStatus && matchSearch;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "usedSeats") cmp = a.usedSeats - b.usedSeats;
      else if (sortKey === "totalSeats") cmp = a.totalSeats - b.totalSeats;
      else if (sortKey === "totalRevenue") cmp = (a.totalRevenue ?? 0) - (b.totalRevenue ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [orgs, typeFilter, statusFilter, search, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: orgs.length,
    active: orgs.filter(o => o.isActive).length,
    inactive: orgs.filter(o => !o.isActive).length,
    totalSeats: orgs.reduce((s, o) => s + o.totalSeats, 0),
    usedSeats: orgs.reduce((s, o) => s + o.usedSeats, 0),
  }), [orgs]);

  const typeCount = useMemo(() => {
    const c: Record<string, number> = {};
    orgs.forEach(o => { c[o.orgType] = (c[o.orgType] || 0) + 1; });
    return c;
  }, [orgs]);

  const seatPctOverall = stats.totalSeats > 0 ? Math.round((stats.usedSeats / stats.totalSeats) * 100) : 0;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
            <p className="text-muted-foreground text-sm">{orgs.length} registered businesses on Aorane</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-all">
              <Plus size={14} /> New Organization
            </button>
            <button onClick={fetchOrgs}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg transition-all">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
            <span>{error}</span>
            <button onClick={fetchOrgs} className="flex items-center gap-1.5 text-xs font-semibold hover:underline shrink-0">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Orgs",   value: stats.total,      icon: Building2, color: "#0077B6" },
            { label: "Active",       value: stats.active,     icon: Activity,  color: "#10B981" },
            { label: "Inactive",     value: stats.inactive,   icon: Activity,  color: "#EF4444" },
            { label: "Total Seats",  value: stats.totalSeats, icon: Users,     color: "#8B5CF6" },
            { label: "Enrolled",     value: stats.usedSeats,  icon: Users,     color: "#F59E0B" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}14` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-[10px] text-muted-foreground font-medium">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Seat utilization bar */}
        {stats.totalSeats > 0 && (
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overall Seat Utilization</span>
              <span className="text-xs font-bold text-foreground">{stats.usedSeats} / {stats.totalSeats} seats ({seatPctOverall}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${Math.min(seatPctOverall, 100)}%`, background: seatPctOverall >= 90 ? "#EF4444" : seatPctOverall >= 70 ? "#F59E0B" : "#10B981" }} />
            </div>
          </div>
        )}

        {/* Search + Filters + View toggle */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, code, city or email..."
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all" />
            </div>
            <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
              <button onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                title="Grid view"><LayoutGrid size={14} /></button>
              <button onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition-all ${viewMode === "table" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                title="Table view"><List size={14} /></button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Type chips */}
            <div className="flex flex-wrap gap-1.5">
              {ALL_TYPES.map(type => {
                const meta = TYPE_META[type];
                const cnt = type === "all" ? orgs.length : (typeCount[type] || 0);
                const active = typeFilter === type;
                return (
                  <button key={type} onClick={() => setTypeFilter(type)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
                    {meta ? meta.icon : "🌐"} {meta ? meta.label : "All"}
                    <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{cnt}</span>
                  </button>
                );
              })}
            </div>

            {/* Status filter */}
            <div className="flex gap-1 ml-auto">
              {(["all", "active", "inactive"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                    statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
                  {s === "all" ? "All" : s === "active" ? "● Active" : "○ Inactive"}
                </button>
              ))}
            </div>
          </div>

          {/* Sort row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Sort:</span>
            <SortButton label="Name" sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortButton label="Newest" sortKey="createdAt" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortButton label="Members" sortKey="usedSeats" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortButton label="Capacity" sortKey="totalSeats" current={sortKey} dir={sortDir} onClick={handleSort} />
            <SortButton label="Revenue" sortKey="totalRevenue" current={sortKey} dir={sortDir} onClick={handleSort} />
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {orgs.length}</span>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          viewMode === "grid" ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                  <div className="flex gap-3 mb-3">
                    <div className="w-12 h-12 bg-muted rounded-xl" />
                    <div className="flex-1 space-y-2"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-1/2" /></div>
                  </div>
                  <div className="h-2 bg-muted rounded mb-2" /><div className="h-3 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-3 border-b border-border animate-pulse">
                  <div className="w-8 h-8 bg-muted rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5"><div className="h-4 bg-muted rounded w-1/3" /><div className="h-3 bg-muted rounded w-1/4" /></div>
                  <div className="w-20 h-4 bg-muted rounded" />
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-2xl">
            <Building2 size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No organizations found</p>
            {(search || typeFilter !== "all" || statusFilter !== "all") && (
              <button onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}
                className="mt-3 text-xs text-primary hover:underline">Clear filters</button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((org) => (
              <OrgCard key={org.id} org={org} onToggleActive={handleToggleActive} onEdit={setEditOrg} onDelete={setDeleteOrg} onCustomPrice={setPricingOrg} />
            ))}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Organization", "Type", "Code", "Location", "Members", "Revenue", "Status", "Joined", "Actions"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(org => {
                    const meta = TYPE_META[org.orgType] || TYPE_META.other;
                    const seatPct = org.totalSeats > 0 ? Math.round((org.usedSeats / org.totalSeats) * 100) : 0;
                    const sc = seatPct >= 90 ? "#EF4444" : seatPct >= 70 ? "#F59E0B" : "#10B981";
                    const isToggling = togglingId === org.id;
                    return (
                      <tr key={org.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 min-w-[180px]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                                 style={{ background: `${meta.color}14` }}>{meta.icon}</div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground text-sm truncate max-w-[140px]">{org.name}</div>
                              {org.contactEmail && (
                                <div className="flex items-center gap-1">
                                  <Mail size={9} className="text-muted-foreground shrink-0" />
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{org.contactEmail}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold tracking-widest uppercase text-foreground">{org.orgCode}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {[org.city, org.state].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 min-w-[110px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold" style={{ color: sc }}>{org.usedSeats}/{org.totalSeats}</span>
                              <span className="text-[10px] text-muted-foreground">{seatPct}%</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden w-20">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(seatPct, 100)}%`, background: sc }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {org.totalRevenue ? (
                            <div className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <IndianRupee size={10} />
                              {Number(org.totalRevenue).toLocaleString("en-IN")}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            org.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                         : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                            {org.isActive ? "● Active" : "○ Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {org.createdAt ? new Date(org.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setPricingOrg(org)}
                              className={`p-1.5 rounded-lg text-xs transition-all ${org.customPricePerSeat ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"}`}
                              title={org.customPricePerSeat ? `Custom: ₹${Number(org.customPricePerSeat)}/seat` : "Set Custom Price"}>
                              <IndianRupee size={12} />
                            </button>
                            <button onClick={() => setEditOrg(org)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Edit">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => handleToggleActive(org.id)} disabled={isToggling}
                              className={`p-1.5 rounded-lg text-xs transition-all disabled:opacity-50 ${
                                org.isActive ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"}`}
                              title={org.isActive ? "Deactivate" : "Activate"}>
                              {isToggling ? <Loader2 size={12} className="animate-spin" /> : org.isActive ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                            </button>
                            <button onClick={() => setDeleteOrg(org)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onCreate={handleOrgCreated} />}
      {editOrg && <EditOrgModal org={editOrg} onClose={() => setEditOrg(null)} onSave={handleOrgUpdated} />}
      {deleteOrg && <DeleteConfirmModal org={deleteOrg} onClose={() => setDeleteOrg(null)} onConfirm={handleOrgDeleted} />}
      {pricingOrg && <CustomPricingModal org={pricingOrg} onClose={() => setPricingOrg(null)} onSaved={handlePricingUpdated} />}
    </Layout>
  );
}
