import React, { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import { api, type PlanPricingItem } from "@/lib/api";
import {
  IndianRupee, Users, Sparkles, Save, X, RotateCcw,
  Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Building2,
  Smartphone, ChevronDown, ChevronUp, Settings2,
} from "lucide-react";

const TYPE_ICONS: Record<string, React.ElementType> = { individual: Smartphone, organization: Building2 };

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: `${color}22`, color, border: `1px solid ${color}30` }}>
      {text}
    </span>
  );
}

type Form = {
  displayName: string; monthlyPrice: string; yearlyPrice: string;
  maxSeats: string; badgeText: string; badgeColor: string;
  features: string[]; isActive: boolean;
};

function formFromPlan(plan: PlanPricingItem): Form {
  return {
    displayName: plan.displayName,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice ?? "",
    maxSeats: plan.maxSeats?.toString() ?? "",
    badgeText: plan.badgeText ?? "",
    badgeColor: plan.badgeColor ?? "#0077B6",
    features: [...plan.features],
    isActive: plan.isActive,
  };
}

function PlanCard({ plan, onSave }: { plan: PlanPricingItem; onSave: (p: PlanPricingItem) => void }) {
  const [form, setForm] = useState<Form>(formFromPlan(plan));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [newFeature, setNewFeature] = useState("");
  const featureRef = useRef<HTMLInputElement>(null);

  const saved = formFromPlan(plan);
  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  const color = form.badgeColor || "#0077B6";
  const TypeIcon = TYPE_ICONS[plan.type] ?? Smartphone;
  const monthly = parseFloat(form.monthlyPrice) || 0;
  const yearly = parseFloat(form.yearlyPrice) || 0;
  const discount = monthly > 0 && yearly > 0 ? Math.round((1 - yearly / (monthly * 12)) * 100) : 0;

  function discard() { setForm(formFromPlan(plan)); setErr(""); }

  async function handleSave() {
    setSaving(true); setErr("");
    try {
      const result = await api.updatePlanPricing(plan.planKey, {
        displayName: form.displayName,
        monthlyPrice: form.monthlyPrice,
        yearlyPrice: form.yearlyPrice || null,
        maxSeats: form.maxSeats ? parseInt(form.maxSeats, 10) : null,
        badgeText: form.badgeText || null,
        badgeColor: form.badgeColor,
        features: form.features,
        isActive: form.isActive,
      } as Partial<PlanPricingItem>);
      onSave(result.plan);
    } catch (e) { setErr((e as Error).message || "Save failed"); }
    finally { setSaving(false); }
  }

  function addFeature() {
    const f = newFeature.trim();
    if (f && !form.features.includes(f)) {
      setForm(p => ({ ...p, features: [...p.features, f] }));
      setNewFeature("");
      featureRef.current?.focus();
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
         style={{
           background: "rgba(255,255,255,0.03)",
           border: isDirty ? `1px solid ${color}60` : "1px solid rgba(255,255,255,0.07)",
           transition: "border-color 0.2s",
         }}>
      {/* Color top bar */}
      <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg,${color},${color}80)` }} />

      <div className="p-5 flex-1 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
              <TypeIcon size={16} style={{ color }} />
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: "#dee1f7" }}>{plan.displayName}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {plan.planKey} · {plan.type}
                </span>
                {form.badgeText && <Badge text={form.badgeText} color={color} />}
              </div>
            </div>
          </div>
          {/* Active toggle */}
          <button onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
            className="text-[11px] font-medium px-2.5 py-1 rounded-xl transition-all flex items-center gap-1.5"
            style={{
              background: form.isActive ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)",
              color: form.isActive ? "#34d399" : "#6B7280",
              border: `1px solid ${form.isActive ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.2)"}`,
            }}>
            <div className={`w-2 h-2 rounded-full ${form.isActive ? "bg-emerald-400" : "bg-gray-500"}`} />
            {form.isActive ? "Active" : "Hidden"}
          </button>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg"
               style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            <AlertCircle size={12} /> {err}
          </div>
        )}

        {/* ── Price fields — ALWAYS editable ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
              Monthly ₹
            </div>
            <input
              type="number" min="0"
              value={form.monthlyPrice}
              onChange={e => setForm(p => ({ ...p, monthlyPrice: e.target.value }))}
              className="text-2xl font-bold bg-transparent outline-none w-full"
              style={{ color }}
              placeholder="0"
            />
            <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>per month</div>
          </div>

          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
              Yearly ₹
            </div>
            <input
              type="number" min="0"
              value={form.yearlyPrice}
              onChange={e => setForm(p => ({ ...p, yearlyPrice: e.target.value }))}
              className="text-2xl font-bold bg-transparent outline-none w-full"
              style={{ color: "#F59E0B" }}
              placeholder="—"
            />
            {discount > 0 ? (
              <div className="text-[10px] mt-1 font-semibold" style={{ color: "#34d399" }}>{discount}% off</div>
            ) : (
              <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>per year</div>
            )}
          </div>
        </div>

        {/* ── Save / Discard bar — appears when dirty ── */}
        <div className={`flex items-center gap-2 transition-all duration-200 ${isDirty ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <button onClick={handleSave} disabled={saving || !isDirty}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: color, color: "white" }}>
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={discard} disabled={saving}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>
            <X size={14} />
          </button>
        </div>

        {/* Saved indicator */}
        {!isDirty && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            <CheckCircle2 size={12} style={{ color: "#34d399" }} />
            Saved
          </div>
        )}

        {/* ── Advanced: features, badge, color ── */}
        <div>
          <button onClick={() => setAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium w-full"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            <Settings2 size={11} />
            Advanced (features, badge, color)
            {advanced ? <ChevronUp size={11} className="ml-auto" /> : <ChevronDown size={11} className="ml-auto" />}
          </button>

          {advanced && (
            <div className="mt-3 space-y-3">
              {/* Badge + seats */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Badge</div>
                  <input value={form.badgeText}
                    onChange={e => setForm(p => ({ ...p, badgeText: e.target.value }))}
                    placeholder="e.g. Popular"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={{ color: "#dee1f7" }} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Max Seats</div>
                  <input type="number" min="1" value={form.maxSeats}
                    onChange={e => setForm(p => ({ ...p, maxSeats: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={{ color: "#dee1f7" }} />
                </div>
              </div>

              {/* Color */}
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>Color</div>
                <input type="color" value={form.badgeColor}
                  onChange={e => setForm(p => ({ ...p, badgeColor: e.target.value }))}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                {["#0077B6","#10B981","#8B5CF6","#F59E0B","#EF4444","#0747A6"].map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, badgeColor: c }))}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: form.badgeColor === c ? "#fff" : "transparent" }} />
                ))}
              </div>

              {/* Features */}
              <div>
                <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Features</div>
                <div className="space-y-1.5 mb-2">
                  {form.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <CheckCircle2 size={11} style={{ color, flexShrink: 0 }} />
                      <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.6)" }}>{f}</span>
                      <button onClick={() => setForm(p => ({ ...p, features: p.features.filter((_, j) => j !== i) }))}
                        className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "#f87171" }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input ref={featureRef}
                    value={newFeature}
                    onChange={e => setNewFeature(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addFeature()}
                    placeholder="Add feature (Enter)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={{ color: "#dee1f7" }} />
                  <button onClick={addFeature}
                    className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ background: `${color}25`, color }}>
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              {/* Display name */}
              <div>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Display Name</div>
                <input value={form.displayName}
                  onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                  style={{ color: "#dee1f7" }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanPricing() {
  const [plans, setPlans] = useState<PlanPricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [resetting, setResetting] = useState(false);
  const [activeType, setActiveType] = useState<"all" | "individual" | "organization">("all");
  const [toast, setToast] = useState("");

  const load = () => {
    setLoading(true); setErr("");
    api.getPlanPricing()
      .then(d => setPlans(d.plans))
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSave = (updated: PlanPricingItem) => {
    setPlans(prev => prev.map(p => p.planKey === updated.planKey ? updated : p));
    setToast(`✅ ${updated.displayName} plan saved!`);
    setTimeout(() => setToast(""), 3000);
  };

  const handleReset = async () => {
    if (!confirm("Reset all plans to default pricing?")) return;
    setResetting(true);
    try {
      const result = await api.resetPlanPricing();
      setPlans(result.plans);
      setToast("✅ Sab plans default pricing pe reset ho gaye!");
      setTimeout(() => setToast(""), 3000);
    } catch (e) { setErr((e as Error).message); }
    finally { setResetting(false); }
  };

  const filtered = plans.filter(p => activeType === "all" || p.type === activeType);
  const individualPlans = filtered.filter(p => p.type === "individual");
  const orgPlans = filtered.filter(p => p.type === "organization");

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-1.5" style={{ color: "#0077B6" }}>
              Dynamic Pricing Engine
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#dee1f7" }}>Plan Pricing</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
              Type the price directly in the input → click Save — updates everywhere automatically
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button onClick={handleReset} disabled={resetting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171" }}>
              {resetting ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Reset to Default
            </button>
          </div>
        </div>

        {/* Current plan summary strip */}
        <div className="flex flex-wrap gap-3">
          {[
            { name: "Free", price: "₹0", color: "#4B5563" },
            { name: "Max", price: "₹199/mo", color: "#0077B6" },
            { name: "Pro", price: "₹249/mo", color: "#8B5CF6" },
            { name: "Family", price: "₹399/mo", color: "#F59E0B" },
          ].map(p => (
            <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
                 style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}25` }}>
              {p.name} — {p.price}
            </div>
          ))}
        </div>

        {/* Toast */}
        {toast && (
          <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
               style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}>
            <CheckCircle2 size={15} />
            {toast}
          </div>
        )}

        {err && (
          <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
               style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
            <AlertCircle size={15} />
            {err}
          </div>
        )}

        {/* Info banner */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
             style={{ background: "rgba(0,119,182,0.07)", border: "1px solid rgba(0,119,182,0.15)" }}>
          <Sparkles size={16} style={{ color: "#0077B6", flexShrink: 0, marginTop: 2 }} />
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span className="text-white/70 font-semibold">How it works:</span>{" "}
            Type the new amount directly in the price field on each card below — a <span className="text-white/60">Save Changes</span> button will appear. Click it — Mobile App, Landing Page, and Business Portal all update instantly.
          </div>
        </div>

        {/* Type tabs */}
        <div className="flex items-center gap-2">
          {([["all","All Plans"],["individual","Individual"],["organization","Organization"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveType(key)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: activeType === key ? "#0077B6" : "rgba(255,255,255,0.05)",
                color: activeType === key ? "white" : "rgba(255,255,255,0.45)",
                border: activeType === key ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}>
              {key === "individual" ? <Smartphone size={11} /> : key === "organization" ? <Building2 size={11} /> : <IndianRupee size={11} />}
              {label}
              <span className="text-[10px] rounded-full px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.1)" }}>
                {key === "all" ? plans.length : plans.filter(p => p.type === key).length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : (
          <>
            {individualPlans.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone size={14} style={{ color: "#0077B6" }} />
                  <span className="text-sm font-semibold" style={{ color: "#dee1f7" }}>Individual / Mobile App Plans</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>— Mobile app upgrade screen pe dikhega</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {individualPlans.map(p => <PlanCard key={p.planKey} plan={p} onSave={handleSave} />)}
                </div>
              </div>
            )}
            {orgPlans.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} style={{ color: "#8B5CF6" }} />
                  <span className="text-sm font-semibold" style={{ color: "#dee1f7" }}>Organization / Business Portal Plans</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>— Business portal billing pe dikhega</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {orgPlans.map(p => <PlanCard key={p.planKey} plan={p} onSave={handleSave} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
