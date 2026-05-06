import React, { useEffect, useState, useRef, useCallback } from "react";
import Layout from "@/components/Layout";
import { api, type Flag, type PlanFeature } from "@/lib/api";
import {
  Flag as FlagIcon, Plus, RefreshCw, X, ChevronDown, ChevronUp, Info,
  Table, Zap, Check, AlertCircle, ToggleLeft, ToggleRight,
} from "lucide-react";

const PLANS = [
  { key: "free",   label: "Free",   color: "bg-slate-500 text-white",   ring: "ring-slate-400"  },
  { key: "max",    label: "Max",    color: "bg-blue-600 text-white",     ring: "ring-blue-400"   },
  { key: "pro",    label: "Pro",    color: "bg-violet-600 text-white",   ring: "ring-violet-400" },
  { key: "family", label: "Family", color: "bg-amber-500 text-white",    ring: "ring-amber-400"  },
];

const AI_FEATURES = [
  "ai_food_scan_photo_daily",
  "ai_food_scan_text_daily",
  "ai_medical_scan_daily",
  "ai_diet_plan_daily",
  "ai_health_coach_daily",
  "ai_meal_swap_daily",
  "ai_predictions_enabled",
  "ai_stress_monitoring",
];

function featureLabel(name: string): string {
  return name
    .replace(/_daily$/, "")
    .replace(/_enabled$/, "")
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function detectType(val: string): "boolean" | "number" | "text" {
  if (val === "true" || val === "false") return "boolean";
  if (/^-?\d+$/.test(val)) return "number";
  return "text";
}

type CellState = "idle" | "saving" | "saved" | "error";

function PlanCell({
  value,
  featureName,
  planKey,
  onSave,
}: {
  value: string;
  featureName: string;
  planKey: "free" | "max" | "pro" | "family";
  onSave: (featureName: string, planKey: string, newValue: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<CellState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const type = detectType(value);

  useEffect(() => { setDraft(value); }, [value]);

  const save = useCallback(async (v: string) => {
    if (v === value) { setEditing(false); return; }
    setState("saving");
    setEditing(false);
    try {
      await onSave(featureName, planKey, v);
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setDraft(value); // revert
      setTimeout(() => setState("idle"), 3000);
    }
  }, [value, featureName, planKey, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") save(draft);
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  };

  if (type === "boolean") {
    const isTrue = draft === "true";
    return (
      <div className="flex items-center justify-center">
        {state === "saving" && <span className="text-[10px] text-muted-foreground">Saving…</span>}
        {state === "saved"  && <Check size={12} className="text-green-500" />}
        {state === "error"  && <AlertCircle size={12} className="text-red-500" />}
        {state === "idle"   && (
          <button
            onClick={() => save(isTrue ? "false" : "true")}
            title={isTrue ? "Click to disable" : "Click to enable"}
            className={`relative w-10 h-5 rounded-full transition-all duration-200 ${isTrue ? "bg-[#1B998B]" : "bg-muted"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${isTrue ? "left-5" : "left-0.5"}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-w-[60px]">
      {state === "saving" && <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>}
      {state === "saved"  && <span className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5"><Check size={10} />Saved</span>}
      {state === "error"  && <span className="text-[10px] text-red-500 flex items-center gap-0.5"><AlertCircle size={10} />Error</span>}
      {state === "idle" && (
        editing ? (
          <input
            ref={inputRef}
            type={type === "number" ? "number" : "text"}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => save(draft)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-16 text-center text-xs font-mono bg-background border border-primary rounded px-1 py-0.5 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Click to edit"
            className="text-xs font-mono font-semibold px-2 py-0.5 rounded hover:bg-muted transition-all cursor-pointer"
          >
            {value === "-1" ? "∞" : value}
          </button>
        )
      )}
    </div>
  );
}

function MasterToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      title={enabled ? "Disable for all" : "Enable for all"}
      className={`relative w-11 h-6 rounded-full transition-all duration-200 shrink-0 ${enabled ? "bg-[#1B998B]" : "bg-muted"}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${enabled ? "left-6" : "left-1"}`} />
    </button>
  );
}

function PlanPills({ enabledForPlans, masterEnabled, onTogglePlan }: {
  enabledForPlans: string[];
  masterEnabled: boolean;
  onTogglePlan: (plan: string) => void;
}) {
  const allPlans = enabledForPlans.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="text-[11px] text-muted-foreground font-medium mr-0.5">Plans:</span>
      {PLANS.map((p) => {
        const active = allPlans || enabledForPlans.includes(p.key);
        return (
          <button key={p.key} onClick={() => masterEnabled && onTogglePlan(p.key)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all duration-150 select-none
              ${active && masterEnabled ? `${p.color} ring-1 ${p.ring} shadow-sm` : "bg-muted/60 text-muted-foreground/60 ring-1 ring-border opacity-60"}
              ${masterEnabled ? "cursor-pointer hover:scale-105" : "cursor-not-allowed"}`}
          >{p.label}</button>
        );
      })}
      {masterEnabled && (
        <span className="text-[10px] text-muted-foreground/50 ml-1">{allPlans ? "All plans" : `${enabledForPlans.length}/4 plans`}</span>
      )}
    </div>
  );
}

export default function FeatureFlags() {
  const [activeTab, setActiveTab] = useState<"flags" | "plan_features">("plan_features");

  // ── Feature Flags state ─────────────────────────────────────────────────────
  const [flags, setFlags] = useState<Flag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: "", label: "", description: "", isEnabled: false, enabledForPlans: [] as string[],
  });

  // ── Plan Features state ─────────────────────────────────────────────────────
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresLocal, setFeaturesLocal] = useState<PlanFeature[]>([]);

  const fetchFlags = () => {
    setFlagsLoading(true);
    api.flags().then(r => setFlags(r.flags)).catch(console.error).finally(() => setFlagsLoading(false));
  };

  const fetchFeatures = () => {
    setFeaturesLoading(true);
    api.planFeatures()
      .then(r => { setFeatures(r.features); setFeaturesLocal(r.features); })
      .catch(console.error)
      .finally(() => setFeaturesLoading(false));
  };

  useEffect(() => { fetchFlags(); fetchFeatures(); }, []);

  const handleSaveCell = useCallback(async (featureName: string, planKey: string, newValue: string) => {
    const fieldMap: Record<string, string> = {
      free: "freeValue", max: "maxValue", pro: "proValue", family: "familyValue",
    };
    const field = fieldMap[planKey];
    if (!field) throw new Error("Invalid plan key");
    await api.updatePlanFeature(featureName, { [field]: newValue });
    setFeaturesLocal(prev => prev.map(f =>
      f.feature_name === featureName
        ? { ...f, [`${planKey}_value`]: newValue }
        : f
    ));
    setFeatures(prev => prev.map(f =>
      f.feature_name === featureName
        ? { ...f, [`${planKey}_value`]: newValue }
        : f
    ));
  }, []);

  const toggleMaster = async (flag: Flag, enabled: boolean) => {
    setSaving(flag.key);
    try {
      await api.updateFlag(flag.key, { isEnabled: enabled });
      setFlags(f => f.map(x => x.key === flag.key ? { ...x, isEnabled: enabled } : x));
    } catch {}
    finally { setSaving(null); }
  };

  const togglePlan = async (flag: Flag, planKey: string) => {
    const current = flag.enabledForPlans ?? [];
    const allPlanKeys = PLANS.map(p => p.key);
    let next: string[];
    if (current.length === 0) next = allPlanKeys.filter(k => k !== planKey);
    else if (current.includes(planKey)) next = current.filter(k => k !== planKey);
    else next = [...current, planKey];
    if (next.length === allPlanKeys.length) next = [];
    setSaving(flag.key);
    try {
      await api.updateFlag(flag.key, { enabledForPlans: next });
      setFlags(f => f.map(x => x.key === flag.key ? { ...x, enabledForPlans: next } : x));
    } catch {}
    finally { setSaving(null); }
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.createFlag(form);
      setFlags(f => [res.flag, ...f]);
      setShowModal(false);
      setForm({ key: "", label: "", description: "", isEnabled: false, enabledForPlans: [] });
    } catch (err) { alert((err as Error).message); }
    finally { setCreating(false); }
  };

  const toggleFormPlan = (planKey: string) => {
    setForm(prev => {
      const current = prev.enabledForPlans;
      const allPlanKeys = PLANS.map(p => p.key);
      let next: string[];
      if (current.length === 0) next = allPlanKeys.filter(k => k !== planKey);
      else if (current.includes(planKey)) next = current.filter(k => k !== planKey);
      else next = [...current, planKey];
      if (next.length === allPlanKeys.length) next = [];
      return { ...prev, enabledForPlans: next };
    });
  };

  const aiFeatures = featuresLocal.filter(f => AI_FEATURES.includes(f.feature_name));
  const otherFeatures = featuresLocal.filter(f => !AI_FEATURES.includes(f.feature_name));

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Feature & Plan Controls</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage feature flags and per-plan limits — changes apply instantly without redeployment.
            </p>
          </div>
          <button onClick={() => { fetchFlags(); fetchFeatures(); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg transition-all">
            <RefreshCw size={14} className={(flagsLoading || featuresLoading) ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 bg-muted/40 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("plan_features")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "plan_features" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Table size={14} /> Plan Features Table
          </button>
          <button
            onClick={() => setActiveTab("flags")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "flags" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FlagIcon size={14} /> Feature Flags
          </button>
        </div>

        {/* ── TAB: Plan Features ─────────────────────────────────────────────── */}
        {activeTab === "plan_features" && (
          <div className="space-y-6">
            <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>
                Click any cell to edit. <strong>Toggle</strong> = boolean on/off. <strong>Numbers</strong> = daily limit (-1 means unlimited).
                Changes apply instantly to all users — no redeployment needed.
              </span>
            </div>

            {/* AI Limits section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-amber-500" />
                <h2 className="text-base font-bold text-foreground">AI Limits</h2>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">FIX 4</span>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground w-52">Feature</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground w-28">
                          <span className="bg-slate-500 text-white px-2 py-0.5 rounded-full text-[10px]">Free</span>
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground w-28">
                          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px]">Max</span>
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground w-28">
                          <span className="bg-violet-600 text-white px-2 py-0.5 rounded-full text-[10px]">Pro</span>
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground w-28">
                          <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px]">Family</span>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featuresLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i} className="border-b border-border">
                            {Array.from({ length: 6 }).map((_, j) => (
                              <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                            ))}
                          </tr>
                        ))
                      ) : aiFeatures.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No AI features found</td></tr>
                      ) : (
                        aiFeatures.map(f => (
                          <tr key={f.feature_name} className="border-b border-border hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">{featureLabel(f.feature_name)}</div>
                              <div className="font-mono text-[10px] text-muted-foreground/60">{f.feature_name}</div>
                            </td>
                            {(["free", "max", "pro", "family"] as const).map(plan => (
                              <td key={plan} className="px-4 py-3">
                                <PlanCell
                                  value={f[`${plan}_value`]}
                                  featureName={f.feature_name}
                                  planKey={plan}
                                  onSave={handleSaveCell}
                                />
                              </td>
                            ))}
                            <td className="px-4 py-3 text-xs text-muted-foreground">{f.description || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* All Plan Features section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Table size={16} className="text-primary" />
                <h2 className="text-base font-bold text-foreground">All Plan Features</h2>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">FIX 1</span>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground w-52">Feature</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground w-28">
                          <span className="bg-slate-500 text-white px-2 py-0.5 rounded-full text-[10px]">Free</span>
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground w-28">
                          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px]">Max</span>
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground w-28">
                          <span className="bg-violet-600 text-white px-2 py-0.5 rounded-full text-[10px]">Pro</span>
                        </th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground w-28">
                          <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px]">Family</span>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featuresLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i} className="border-b border-border">
                            {Array.from({ length: 6 }).map((_, j) => (
                              <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                            ))}
                          </tr>
                        ))
                      ) : otherFeatures.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No features found</td></tr>
                      ) : (
                        otherFeatures.map(f => (
                          <tr key={f.feature_name} className="border-b border-border hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">{featureLabel(f.feature_name)}</div>
                              <div className="font-mono text-[10px] text-muted-foreground/60">{f.feature_name}</div>
                            </td>
                            {(["free", "max", "pro", "family"] as const).map(plan => (
                              <td key={plan} className="px-4 py-3">
                                <PlanCell
                                  value={f[`${plan}_value`]}
                                  featureName={f.feature_name}
                                  planKey={plan}
                                  onSave={handleSaveCell}
                                />
                              </td>
                            ))}
                            <td className="px-4 py-3 text-xs text-muted-foreground">{f.description || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Feature Flags ─────────────────────────────────────────────── */}
        {activeTab === "flags" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300 flex-1 mr-3">
                <Info size={15} className="mt-0.5 shrink-0" />
                <span><strong>Master switch</strong> = ON/OFF globally. <strong>Plan pills</strong> = which plans get access when ON.</span>
              </div>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all shrink-0">
                <Plus size={15} /> New Flag
              </button>
            </div>
            <div className="space-y-2">
              {flagsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-40 mb-2" />
                        <div className="h-3 bg-muted rounded w-64 mb-3" />
                        <div className="flex gap-2">{[1,2,3,4].map(j => <div key={j} className="h-5 bg-muted rounded-full w-12" />)}</div>
                      </div>
                      <div className="w-11 h-6 bg-muted rounded-full ml-4 mt-1" />
                    </div>
                  </div>
                ))
              ) : flags.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <FlagIcon size={36} className="text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No feature flags found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Click "New Flag" to create one</p>
                </div>
              ) : (
                flags.map(flag => (
                  <div key={flag.id}
                    className={`bg-card border rounded-xl transition-all ${saving === flag.key ? "opacity-60" : ""} ${flag.isEnabled ? "border-border hover:border-primary/30" : "border-border/50 opacity-75"}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded">{flag.key}</span>
                            <span className="font-semibold text-foreground text-sm">{flag.label}</span>
                            {!flag.isEnabled && (
                              <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">DISABLED</span>
                            )}
                          </div>
                          {flag.description && <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>}
                          <PlanPills
                            enabledForPlans={flag.enabledForPlans ?? []}
                            masterEnabled={flag.isEnabled}
                            onTogglePlan={plan => togglePlan(flag, plan)}
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          <span className={`text-xs font-semibold ${flag.isEnabled ? "text-[#1B998B]" : "text-muted-foreground"}`}>
                            {saving === flag.key ? "Saving…" : flag.isEnabled ? "ON" : "OFF"}
                          </span>
                          <MasterToggle enabled={flag.isEnabled} onChange={v => toggleMaster(flag, v)} />
                          <button onClick={() => setExpandedKey(expandedKey === flag.key ? null : flag.key)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                            {expandedKey === flag.key ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>
                      {expandedKey === flag.key && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Plan Access Details</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {PLANS.map(p => {
                              const allActive = (flag.enabledForPlans ?? []).length === 0;
                              const hasAccess = allActive || (flag.enabledForPlans ?? []).includes(p.key);
                              const active = flag.isEnabled && hasAccess;
                              return (
                                <button key={p.key}
                                  onClick={() => flag.isEnabled && togglePlan(flag, p.key)}
                                  className={`rounded-xl p-3 border text-left transition-all ${active ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30" : "border-border bg-muted/30 opacity-60"} ${flag.isEnabled ? "cursor-pointer hover:scale-[1.02]" : "cursor-not-allowed"}`}
                                >
                                  <div className={`text-sm font-bold mb-0.5 ${active ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>{p.label}</div>
                                  <div className={`text-[11px] font-medium ${active ? "text-green-600 dark:text-green-500" : "text-muted-foreground/60"}`}>
                                    {active ? "Has access" : flag.isEnabled ? "No access" : "Feature OFF"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create flag modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">New Feature Flag</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Key *", key: "key", placeholder: "feature_key_name" },
                { label: "Label *", key: "label", placeholder: "User-facing label" },
                { label: "Description", key: "description", placeholder: "What does this flag control?" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{f.label}</label>
                  <input
                    value={(form as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Plan Access <span className="text-muted-foreground/50">(tap to restrict)</span></label>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map(p => {
                    const active = form.enabledForPlans.length === 0 || form.enabledForPlans.includes(p.key);
                    return (
                      <button key={p.key} type="button" onClick={() => toggleFormPlan(p.key)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${active ? `${p.color} ring-1 ${p.ring}` : "bg-muted text-muted-foreground ring-1 ring-border opacity-60"}`}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-medium text-muted-foreground">Enable by default</label>
                <button type="button" onClick={() => setForm(x => ({ ...x, isEnabled: !x.isEnabled }))}
                  className={`relative w-11 h-6 rounded-full transition-all ${form.isEnabled ? "bg-[#1B998B]" : "bg-muted"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isEnabled ? "left-6" : "left-1"}`} />
                </button>
              </div>
              <button onClick={create} disabled={creating || !form.key || !form.label}
                className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 mt-2">
                {creating ? "Creating..." : "Create Flag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
