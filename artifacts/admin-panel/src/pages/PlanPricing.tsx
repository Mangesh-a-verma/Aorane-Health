import React, { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import { api, type PlanPricingItem } from "@/lib/api";
import {
  IndianRupee, Users, Sparkles, Edit3, Save, X, RotateCcw,
  Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Building2,
  Smartphone, ToggleLeft, ToggleRight,
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

type EditState = {
  displayName: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxSeats: string;
  badgeText: string;
  badgeColor: string;
  features: string[];
  isActive: boolean;
};

function PlanCard({ plan, onSave }: { plan: PlanPricingItem; onSave: (p: PlanPricingItem) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [newFeature, setNewFeature] = useState("");
  const featureInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EditState>({
    displayName: plan.displayName,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice ?? "",
    maxSeats: plan.maxSeats?.toString() ?? "",
    badgeText: plan.badgeText ?? "",
    badgeColor: plan.badgeColor ?? "#0077B6",
    features: [...plan.features],
    isActive: plan.isActive,
  });

  function resetForm(p: PlanPricingItem) {
    setForm({
      displayName: p.displayName,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice ?? "",
      maxSeats: p.maxSeats?.toString() ?? "",
      badgeText: p.badgeText ?? "",
      badgeColor: p.badgeColor ?? "#0077B6",
      features: [...p.features],
      isActive: p.isActive,
    });
  }

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
      resetForm(result.plan);
      setEditing(false);
    } catch (e: Error | unknown) {
      setErr((e as Error).message || "Save failed");
    } finally { setSaving(false); }
  }

  function addFeature() {
    const f = newFeature.trim();
    if (f && !form.features.includes(f)) {
      setForm(prev => ({ ...prev, features: [...prev.features, f] }));
      setNewFeature("");
      featureInputRef.current?.focus();
    }
  }

  function removeFeature(i: number) {
    setForm(prev => ({ ...prev, features: prev.features.filter((_, j) => j !== i) }));
  }

  const color = form.badgeColor || "#0077B6";
  const TypeIcon = TYPE_ICONS[plan.type] ?? Smartphone;
  const monthly = parseFloat(form.monthlyPrice) || 0;
  const yearly = parseFloat(form.yearlyPrice) || 0;
  const yearlyDiscount = monthly > 0 && yearly > 0
    ? Math.round((1 - yearly / (monthly * 12)) * 100) : 0;

  return (
    <div className="rounded-2xl overflow-hidden relative"
         style={{
           background: "rgba(255,255,255,0.03)",
           border: editing ? `1px solid ${color}50` : "1px solid rgba(255,255,255,0.07)",
           transition: "border-color 0.2s",
         }}>
      {/* Color accent top bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg,${color},${color}80)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: `${color}18` }}>
              <TypeIcon size={18} style={{ color }} />
            </div>
            <div>
              {editing ? (
                <input
                  value={form.displayName}
                  onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                  className="text-base font-bold bg-transparent outline-none border-b border-dashed w-32"
                  style={{ color: "#dee1f7", borderColor: `${color}60` }}
                />
              ) : (
                <div className="font-bold text-base" style={{ color: "#dee1f7" }}>{plan.displayName}</div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: "rgba(255,255,255,0.3)" }}>
                  {plan.planKey} · {plan.type}
                </span>
                {form.badgeText && <Badge text={form.badgeText} color={color} />}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Active toggle */}
            <button
              onClick={() => editing
                ? setForm(p => ({ ...p, isActive: !p.isActive }))
                : undefined}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all"
              style={{
                background: form.isActive ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)",
                color: form.isActive ? "#34d399" : "#6B7280",
                border: `1px solid ${form.isActive ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.2)"}`,
                cursor: editing ? "pointer" : "default",
              }}>
              {form.isActive
                ? <ToggleRight size={13} />
                : <ToggleLeft size={13} />}
              {form.isActive ? "Active" : "Hidden"}
            </button>

            {editing ? (
              <>
                <button onClick={() => { resetForm(plan); setEditing(false); setErr(""); }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                  <X size={14} />
                </button>
                <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
                        style={{ background: color, color: "white" }}>
                  {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                <Edit3 size={12} />
                Edit
              </button>
            )}
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-xs mb-3 p-2.5 rounded-lg"
               style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            <AlertCircle size={12} /> {err}
          </div>
        )}

        {/* Pricing row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-1.5"
                 style={{ color: "rgba(255,255,255,0.3)" }}>Monthly Price</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-sm" style={{ color }}>₹</span>
                <input type="number" min="0"
                  value={form.monthlyPrice}
                  onChange={e => setForm(p => ({ ...p, monthlyPrice: e.target.value }))}
                  className="text-xl font-bold bg-transparent outline-none w-full border-b border-dashed"
                  style={{ color: "#dee1f7", borderColor: `${color}40` }}
                />
              </div>
            ) : (
              <div className="text-xl font-bold" style={{ color }}>
                {monthly > 0 ? `₹${monthly.toLocaleString("en-IN")}` : "Free"}
              </div>
            )}
            <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>per month</div>
          </div>

          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-1.5"
                 style={{ color: "rgba(255,255,255,0.3)" }}>Yearly Price</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-sm" style={{ color: "#F59E0B" }}>₹</span>
                <input type="number" min="0"
                  value={form.yearlyPrice}
                  onChange={e => setForm(p => ({ ...p, yearlyPrice: e.target.value }))}
                  placeholder="0"
                  className="text-xl font-bold bg-transparent outline-none w-full border-b border-dashed"
                  style={{ color: "#dee1f7", borderColor: "rgba(245,158,11,0.4)" }}
                />
              </div>
            ) : (
              <div className="text-xl font-bold" style={{ color: "#F59E0B" }}>
                {yearly > 0 ? `₹${yearly.toLocaleString("en-IN")}` : "—"}
              </div>
            )}
            {yearlyDiscount > 0 && (
              <div className="text-[10px] mt-1 font-semibold" style={{ color: "#34d399" }}>
                {yearlyDiscount}% off vs monthly
              </div>
            )}
          </div>
        </div>

        {/* Max seats + badge */}
        {editing && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-1.5"
                   style={{ color: "rgba(255,255,255,0.3)" }}>Max Seats</div>
              <input type="number" min="1"
                value={form.maxSeats}
                onChange={e => setForm(p => ({ ...p, maxSeats: e.target.value }))}
                placeholder="Unlimited"
                className="text-sm font-bold bg-transparent outline-none w-full border-b border-dashed"
                style={{ color: "#dee1f7", borderColor: "rgba(255,255,255,0.15)" }}
              />
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-1.5"
                   style={{ color: "rgba(255,255,255,0.3)" }}>Badge Label</div>
              <input
                value={form.badgeText}
                onChange={e => setForm(p => ({ ...p, badgeText: e.target.value }))}
                placeholder="e.g. Popular"
                className="text-sm font-bold bg-transparent outline-none w-full border-b border-dashed"
                style={{ color: "#dee1f7", borderColor: "rgba(255,255,255,0.15)" }}
              />
            </div>
          </div>
        )}

        {!editing && plan.maxSeats && (
          <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Users size={11} />
            <span>Max {plan.maxSeats} seats</span>
          </div>
        )}

        {/* Color picker — edit only */}
        {editing && (
          <div className="flex items-center gap-3 mb-4">
            <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
              Theme Color
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={form.badgeColor}
                onChange={e => setForm(p => ({ ...p, badgeColor: e.target.value }))}
                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>{form.badgeColor}</span>
            </div>
            {["#0077B6","#10B981","#8B5CF6","#F59E0B","#EF4444","#DC2626"].map(c => (
              <button key={c} onClick={() => setForm(p => ({ ...p, badgeColor: c }))}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: form.badgeColor === c ? "#fff" : "transparent" }}
              />
            ))}
          </div>
        )}

        {/* Features */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest mb-2"
               style={{ color: "rgba(255,255,255,0.3)" }}>Features</div>
          <div className="space-y-1.5">
            {form.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <CheckCircle2 size={12} style={{ color, flexShrink: 0 }} />
                <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.65)" }}>{f}</span>
                {editing && (
                  <button onClick={() => removeFeature(i)}
                    className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "#f87171" }}>
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
            {editing && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-3 h-3 rounded-full border border-dashed shrink-0"
                     style={{ borderColor: `${color}50` }} />
                <input ref={featureInputRef}
                  value={newFeature}
                  onChange={e => setNewFeature(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addFeature()}
                  placeholder="Add new feature... (Enter)"
                  className="flex-1 text-xs bg-transparent outline-none border-b border-dashed"
                  style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.12)" }}
                />
                <button onClick={addFeature}
                  className="w-5 h-5 flex items-center justify-center rounded"
                  style={{ background: `${color}25`, color }}>
                  <Plus size={10} />
                </button>
              </div>
            )}
          </div>
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
  const [saveToast, setSaveToast] = useState("");

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
    setSaveToast(`${updated.displayName} plan saved!`);
    setTimeout(() => setSaveToast(""), 3000);
  };

  const handleReset = async () => {
    if (!confirm("Sab plans ko default pricing pe reset karein? Ye action undo nahi hoga.")) return;
    setResetting(true);
    try {
      const result = await api.resetPlanPricing();
      setPlans(result.plans);
      setSaveToast("Sab plans default pricing pe reset ho gaye!");
      setTimeout(() => setSaveToast(""), 3000);
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
              Yahan price change karo — Mobile App, Business Portal sab jagah auto-update hoga
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

        {/* Toast */}
        {saveToast && (
          <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
               style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}>
            <CheckCircle2 size={15} />
            {saveToast}
          </div>
        )}

        {err && (
          <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
               style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
            <AlertCircle size={15} />
            {err}
          </div>
        )}

        {/* How it works banner */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
             style={{ background: "rgba(0,119,182,0.07)", border: "1px solid rgba(0,119,182,0.15)" }}>
          <Sparkles size={16} style={{ color: "#0077B6", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "#94ccff" }}>Kaise kaam karta hai?</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Kisi bhi plan ki price ya features edit karo aur Save dabao. Mobile App pe upgrade screen, Business Portal pe billing page — dono turant naye prices ke saath load honge. Koi code changes nahi chahiye.
            </div>
          </div>
        </div>

        {/* Type filter tabs */}
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
              <span className="text-[10px] rounded-full px-1.5 py-0.5"
                    style={{ background: "rgba(255,255,255,0.1)" }}>
                {key === "all" ? plans.length : plans.filter(p => p.type === key).length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl animate-pulse"
                   style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Individual plans */}
            {individualPlans.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone size={14} style={{ color: "#0077B6" }} />
                  <span className="text-sm font-semibold" style={{ color: "#dee1f7" }}>Individual / Mobile App Plans</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>— aorane.in/upgrade se dikhega</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {individualPlans.map(p => (
                    <PlanCard key={p.planKey} plan={p} onSave={handleSave} />
                  ))}
                </div>
              </div>
            )}

            {/* Organization plans */}
            {orgPlans.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} style={{ color: "#8B5CF6" }} />
                  <span className="text-sm font-semibold" style={{ color: "#dee1f7" }}>Organization / Business Portal Plans</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>— business.aorane.in/billing se dikhega</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {orgPlans.map(p => (
                    <PlanCard key={p.planKey} plan={p} onSave={handleSave} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </Layout>
  );
}
