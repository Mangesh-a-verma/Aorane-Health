import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type CustomDealOrg, type CustomDealUser, type Org, type SearchResult } from "@/lib/api";
import {
  Tag, Building2, User as UserIcon, IndianRupee, Percent,
  Trash2, RefreshCw, Plus, X, AlertCircle, CheckCircle2,
  Calendar, Loader2, Search, Clock,
} from "lucide-react";

const STANDARD_SEAT_PRICE = 249;

function isExpiredDate(d: string | null) {
  return d ? new Date(d) < new Date() : false;
}

function fmtDate(d: string | null) {
  if (!d) return "No expiry";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function DealBadge({ expired }: { expired: boolean }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${expired ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
      {expired ? "Expired" : "● Active"}
    </span>
  );
}

function OrgPricingModal({
  orgs, onClose, onSaved,
}: {
  orgs: Org[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [note, setNote] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
    o.orgCode.toLowerCase().includes(orgSearch.toLowerCase())
  ).slice(0, 8);

  const discount = pricePerSeat && Number(pricePerSeat) < STANDARD_SEAT_PRICE
    ? Math.round((1 - Number(pricePerSeat) / STANDARD_SEAT_PRICE) * 100)
    : 0;

  const handleSave = async () => {
    if (!selectedOrg) { setErr("Organization select karo"); return; }
    if (!pricePerSeat || Number(pricePerSeat) <= 0) { setErr("Price per seat required"); return; }
    setSaving(true); setErr("");
    try {
      await api.setOrgCustomPricing(selectedOrg.id, {
        customPricePerSeat: Number(pricePerSeat),
        customPriceNote: note || undefined,
        customPriceValidUntil: validUntil || null,
      });
      onSaved();
      onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-primary" />
            <h2 className="font-bold text-foreground">New Org Custom Price</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {err && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-sm">
              <AlertCircle size={13} />{err}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organization *</label>
            {selectedOrg ? (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                <div>
                  <div className="font-semibold text-sm text-foreground">{selectedOrg.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{selectedOrg.orgCode} · {selectedOrg.totalSeats} seats</div>
                </div>
                <button onClick={() => setSelectedOrg(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={orgSearch}
                  onChange={e => setOrgSearch(e.target.value)}
                  placeholder="Org name ya code search karo..."
                  className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                  autoFocus
                />
                {orgSearch && filtered.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                    {filtered.map(o => (
                      <button key={o.id} onClick={() => { setSelectedOrg(o); setOrgSearch(""); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                        <Building2 size={13} className="text-primary shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-foreground">{o.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{o.orgCode} · {o.totalSeats} seats</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Price / Seat *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                <input type="number" min="1" value={pricePerSeat} onChange={e => setPricePerSeat(e.target.value)}
                  placeholder="e.g. 180"
                  className="w-full bg-background border border-border rounded-xl pl-7 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
              </div>
              {discount > 0 && (
                <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={11} />{discount}% off standard price
                </div>
              )}
              {pricePerSeat && Number(pricePerSeat) > STANDARD_SEAT_PRICE && (
                <div className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                  <AlertCircle size={11} />Standard se zyada price!
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
              <div className="text-[10px] text-muted-foreground">Optional — blank = permanent</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note / Reason</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Enterprise deal — negotiated via sales call"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
          </div>

          {selectedOrg && pricePerSeat && (
            <div className="bg-muted/40 rounded-xl px-4 py-3 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Deal Summary</div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Standard price</span>
                <span className="line-through text-muted-foreground">₹{STANDARD_SEAT_PRICE}/seat</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-foreground">Custom price</span>
                <span className="text-green-600">₹{pricePerSeat}/seat</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total seats</span>
                <span className="font-medium">{selectedOrg.totalSeats}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border/50 pt-1 mt-1">
                <span className="text-foreground">Annual deal value</span>
                <span className="text-primary">₹{(Number(pricePerSeat) * selectedOrg.totalSeats * 12).toLocaleString("en-IN")}/yr</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 pt-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving || !selectedOrg || !pricePerSeat}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <IndianRupee size={13} />}
            {saving ? "Saving…" : "Set Custom Price"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDiscountModal({
  onClose, onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [discountPct, setDiscountPct] = useState("");
  const [note, setNote] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (searchTimeout) clearTimeout(searchTimeout);
    if (q.length < 3) { setResults([]); return; }
    setSearchTimeout(setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await api.searchUsers(q);
        setResults(r.results.slice(0, 6));
      } catch { setResults([]); }
      finally { setSearchLoading(false); }
    }, 400));
  };

  const handleSave = async () => {
    if (!selected) { setErr("User select karo"); return; }
    if (!discountPct || Number(discountPct) <= 0 || Number(discountPct) > 100) { setErr("Valid discount % enter karo (1–100)"); return; }
    setSaving(true); setErr("");
    try {
      await api.setUserCustomDiscount(selected.userId, {
        customDiscountPct: Number(discountPct),
        customDiscountNote: note || undefined,
        customDiscountValidUntil: validUntil || null,
      });
      onSaved();
      onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Percent size={16} className="text-primary" />
            <h2 className="font-bold text-foreground">New User Custom Discount</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {err && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-sm">
              <AlertCircle size={13} />{err}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User *</label>
            {selected ? (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                <div>
                  <div className="font-semibold text-sm text-foreground">{selected.name || selected.phone || selected.email}</div>
                  <div className="font-mono text-xs text-muted-foreground">{selected.aoraneId || selected.userId.slice(0, 12).toUpperCase()} · {selected.plan.toUpperCase()}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Phone, name, email ya Aorane ID search karo..."
                  className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                  autoFocus
                />
                {searchLoading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                {!searchLoading && results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                    {results.map(r => (
                      <button key={r.userId} onClick={() => { setSelected(r); setQuery(""); setResults([]); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                        <UserIcon size={13} className="text-primary shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-foreground">{r.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.phone} · {r.plan.toUpperCase()}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Discount % *</label>
              <div className="relative">
                <input type="number" min="1" max="100" value={discountPct} onChange={e => setDiscountPct(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full bg-background border border-border rounded-xl px-3 pr-8 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note / Reason</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Beta tester reward, referral bonus"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 pt-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving || !selected || !discountPct}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Percent size={13} />}
            {saving ? "Saving…" : "Set Discount"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomDeals() {
  const [orgs, setOrgs] = useState<CustomDealOrg[]>([]);
  const [users, setUsers] = useState<CustomDealUser[]>([]);
  const [allOrgs, setAllOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = () => {
    setLoading(true); setErr("");
    Promise.all([api.customDeals(), api.organizations()])
      .then(([deals, orgsRes]) => {
        setOrgs(deals.orgs);
        setUsers(deals.users);
        setAllOrgs(orgsRes.organizations);
      })
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const removeOrgDeal = async (id: string, name: string) => {
    if (!confirm(`"${name}" ka custom pricing remove karein?`)) return;
    setRemovingId(id);
    try {
      await api.setOrgCustomPricing(id, { remove: true });
      setOrgs(prev => prev.filter(o => o.id !== id));
      showToast(`✅ ${name} ka custom price removed`);
    } catch (e) { alert((e as Error).message); }
    finally { setRemovingId(null); }
  };

  const removeUserDeal = async (id: string, name: string) => {
    if (!confirm(`"${name}" ka custom discount remove karein?`)) return;
    setRemovingId(id);
    try {
      await api.setUserCustomDiscount(id, { remove: true });
      setUsers(prev => prev.filter(u => u.id !== id));
      showToast(`✅ ${name} ka discount removed`);
    } catch (e) { alert((e as Error).message); }
    finally { setRemovingId(null); }
  };

  const activeOrgDeals = orgs.filter(o => !isExpiredDate(o.customPriceValidUntil));
  const expiredOrgDeals = orgs.filter(o => isExpiredDate(o.customPriceValidUntil));
  const activeUserDeals = users.filter(u => !isExpiredDate(u.customDiscountValidUntil));
  const expiredUserDeals = users.filter(u => isExpiredDate(u.customDiscountValidUntil));

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-1.5 text-amber-500">Pricing Overrides</div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Custom Deals</h1>
            <p className="text-sm mt-1 text-muted-foreground">
              Corporate orgs ke liye custom seat pricing aur individual users ke liye special discounts manage karo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowOrgModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all">
              <Building2 size={14} /> Org Custom Price
            </button>
            <button onClick={() => setShowUserModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-all">
              <Percent size={14} /> User Discount
            </button>
            <button onClick={load} className="p-2 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-all">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3 bg-green-500/10 border border-green-500/20 text-green-600">
            <CheckCircle2 size={15} />{toast}
          </div>
        )}

        {err && (
          <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-500">
            <AlertCircle size={15} />
            <span>Custom deals load nahi hue — server se data fetch karne mein dikkat aayi.</span>
            <button onClick={load} className="ml-auto text-xs hover:underline font-medium shrink-0">Dobara Try Karo</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Org Deals",    value: activeOrgDeals.length,  icon: Building2, color: "#0077B6" },
            { label: "Active User Discounts", value: activeUserDeals.length, icon: UserIcon,  color: "#10B981" },
            { label: "Expired Org Deals",   value: expiredOrgDeals.length,  icon: Clock,     color: "#F59E0B" },
            { label: "Expired User Deals",  value: expiredUserDeals.length, icon: Clock,     color: "#6B7280" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}14` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{s.value}</div>
                <div className="text-[10px] text-muted-foreground font-medium leading-tight">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── Org Custom Pricing ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-primary" />
                <h2 className="text-base font-bold text-foreground">Corporate Custom Pricing</h2>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{orgs.length}</span>
                <button onClick={() => setShowOrgModal(true)}
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                  <Plus size={12} /> Add Deal
                </button>
              </div>

              {orgs.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Building2 size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Koi corporate deal active nahi hai</p>
                  <button onClick={() => setShowOrgModal(true)} className="mt-3 text-xs text-primary hover:underline font-medium">
                    + Pehla deal banao
                  </button>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["Organization", "Standard", "Custom Price", "Savings", "Note", "Valid Until", "Status", ""].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orgs.map(o => {
                          const expired = isExpiredDate(o.customPriceValidUntil);
                          const custom = Number(o.customPricePerSeat);
                          const savingsPct = custom < STANDARD_SEAT_PRICE ? Math.round((1 - custom / STANDARD_SEAT_PRICE) * 100) : 0;
                          return (
                            <tr key={o.id} className={`border-b border-border hover:bg-muted/20 transition-colors ${expired ? "opacity-60" : ""}`}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-foreground">{o.name}</div>
                                <div className="font-mono text-[10px] text-muted-foreground">{o.orgCode}</div>
                              </td>
                              <td className="px-4 py-3 text-sm line-through text-muted-foreground">₹{STANDARD_SEAT_PRICE}/seat</td>
                              <td className="px-4 py-3">
                                <span className="text-base font-bold text-green-600">₹{custom}/seat</span>
                              </td>
                              <td className="px-4 py-3">
                                {savingsPct > 0 ? (
                                  <span className="text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                                    {savingsPct}% OFF
                                  </span>
                                ) : (
                                  <span className="text-xs text-amber-600 font-semibold">+{Math.round((custom / STANDARD_SEAT_PRICE - 1) * 100)}% premium</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                                {o.customPriceNote || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar size={10} />
                                  {fmtDate(o.customPriceValidUntil)}
                                </div>
                              </td>
                              <td className="px-4 py-3"><DealBadge expired={expired} /></td>
                              <td className="px-4 py-3">
                                <button onClick={() => removeOrgDeal(o.id, o.name)}
                                  disabled={removingId === o.id}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                  {removingId === o.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
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

            {/* ── User Custom Discounts ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Percent size={16} className="text-green-600" />
                <h2 className="text-base font-bold text-foreground">Individual User Discounts</h2>
                <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium">{users.length}</span>
                <button onClick={() => setShowUserModal(true)}
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                  <Plus size={12} /> Add Discount
                </button>
              </div>

              {users.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <UserIcon size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Koi individual user discount active nahi hai</p>
                  <button onClick={() => setShowUserModal(true)} className="mt-3 text-xs text-primary hover:underline font-medium">
                    + Pehla discount do
                  </button>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["User", "Plan", "Discount", "Note", "Valid Until", "Status", ""].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => {
                          const expired = isExpiredDate(u.customDiscountValidUntil);
                          const displayName = u.fullName || u.phone || u.email || "—";
                          return (
                            <tr key={u.id} className={`border-b border-border hover:bg-muted/20 transition-colors ${expired ? "opacity-60" : ""}`}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-foreground">{displayName}</div>
                                <div className="font-mono text-[10px] text-muted-foreground">{u.aoraneId || u.id.slice(0, 12).toUpperCase()}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{u.plan.toUpperCase()}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-base font-bold text-green-600">{u.customDiscountPct}% OFF</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                                {u.customDiscountNote || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar size={10} />
                                  {fmtDate(u.customDiscountValidUntil)}
                                </div>
                              </td>
                              <td className="px-4 py-3"><DealBadge expired={expired} /></td>
                              <td className="px-4 py-3">
                                <button onClick={() => removeUserDeal(u.id, displayName)}
                                  disabled={removingId === u.id}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                  {removingId === u.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
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

            {/* Info box */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 flex items-start gap-3">
              <Tag size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground">Custom Deals kaise kaam karte hain?</div>
                <div>• <b>Org Custom Price:</b> Business portal billing pe is price per seat se charge hoga (standard ₹249 ki jagah)</div>
                <div>• <b>User Discount:</b> Individual user ke plan upgrade pe % discount apply hoga</div>
                <div>• Expired deals auto-disable ho jaate hain — active subscriptions pe effect nahi padta</div>
                <div>• Promo Codes + Custom Deals simultaneously apply ho sakte hain (maximum discount)</div>
              </div>
            </div>
          </>
        )}
      </div>

      {showOrgModal && (
        <OrgPricingModal
          orgs={allOrgs}
          onClose={() => setShowOrgModal(false)}
          onSaved={() => { load(); showToast("✅ Org custom pricing set!"); }}
        />
      )}
      {showUserModal && (
        <UserDiscountModal
          onClose={() => setShowUserModal(false)}
          onSaved={() => { load(); showToast("✅ User discount set!"); }}
        />
      )}
    </Layout>
  );
}
