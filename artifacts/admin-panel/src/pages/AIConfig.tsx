import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type AiConfig } from "@/lib/api";
import {
  Brain, Save, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Info, Eye, EyeOff,
} from "lucide-react";

const PROVIDERS = [
  { value: "google", label: "Google (Gemini)" },
  { value: "nvidia", label: "AI-powered (DeepSeek V3)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openrouter", label: "OpenRouter" },
];

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  google: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  nvidia: [
    { value: "deepseek-ai/deepseek-v3.2", label: "DeepSeek V3.2" },
    { value: "deepseek-ai/deepseek-r1", label: "DeepSeek R1 (Reasoning)" },
    { value: "meta/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
    { value: "mistralai/mixtral-8x7b-instruct-v0.1", label: "Mixtral 8x7B" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  openrouter: [
    { value: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B (Free)" },
    { value: "google/gemini-flash-1.5", label: "Gemini Flash 1.5" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini via OR" },
  ],
};

const DEFAULT_FEATURES: AiConfig[] = [
  { id: null, feature: "food_ai", label: "Food AI Analysis", provider: "google", model: "gemini-2.0-flash", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "medical_ai", label: "Medical AI Assistant", provider: "google", model: "gemini-2.0-flash", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "smart_scan", label: "Smart Scan (OCR + AI)", provider: "google", model: "gemini-2.0-flash", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "water_ai", label: "Water Intake Suggestions", provider: "google", model: "gemini-2.0-flash", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "stress_ai", label: "Stress & Sleep Analysis", provider: "google", model: "gemini-2.0-flash", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "blood_ai", label: "Blood Report Analysis", provider: "google", model: "gemini-2.0-flash", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "meal_planner", label: "AI Meal Planner", provider: "google", model: "gemini-2.0-flash", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "health_suggestions", label: "Daily Health Suggestions", provider: "google", model: "gemini-2.0-flash", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "health_prediction", label: "Monthly Disease Risk Prediction", provider: "nvidia", model: "deepseek-ai/deepseek-v3.2", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
  { id: null, feature: "weekly_diet_chart", label: "Weekly AI Diet Chart", provider: "nvidia", model: "deepseek-ai/deepseek-v3.2", apiKey: null, systemPrompt: null, isEnabled: true, fallbackProvider: null, fallbackModel: null, fallbackApiKey: null },
];

const FEATURE_COLORS: Record<string, string> = {
  food_ai: "#10B981", medical_ai: "#0077B6", smart_scan: "#8B5CF6",
  water_ai: "#3B82F6", stress_ai: "#F59E0B", blood_ai: "#EF4444",
  meal_planner: "#EC4899", health_suggestions: "#1B998B",
  health_prediction: "#6366F1", weekly_diet_chart: "#0EA5E9",
};

function FeatureCard({
  config, onSave,
}: {
  config: AiConfig;
  onSave: (feature: string, data: Partial<AiConfig>) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ ...config });
  const [showKey, setShowKey] = useState(false);
  const [showFallbackKey, setShowFallbackKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const color = FEATURE_COLORS[config.feature] || "#6366F1";

  const models = MODELS_BY_PROVIDER[form.provider] || MODELS_BY_PROVIDER.google;
  const fallbackModels = form.fallbackProvider ? (MODELS_BY_PROVIDER[form.fallbackProvider] || []) : [];

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(form.feature, {
        provider: form.provider,
        model: form.model,
        apiKey: form.apiKey || null,
        systemPrompt: form.systemPrompt || null,
        isEnabled: form.isEnabled,
        label: form.label,
        fallbackProvider: form.fallbackProvider || null,
        fallbackModel: form.fallbackModel || null,
        fallbackApiKey: form.fallbackApiKey || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20` }}
        >
          <Brain size={18} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">{config.label}</p>
          <p className="text-xs text-muted-foreground font-mono">{config.feature}</p>
        </div>
        {/* Provider pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
          {PROVIDERS.find(p => p.value === form.provider)?.label ?? form.provider}
        </div>
        {/* Enabled toggle */}
        <button
          onClick={() => setForm(f => ({ ...f, isEnabled: !f.isEnabled }))}
          className={`w-10 h-5 rounded-full relative transition-colors ${form.isEnabled ? "bg-green-500" : "bg-muted"}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.isEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Provider + Model row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">AI Provider</label>
              <select
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value, model: MODELS_BY_PROVIDER[e.target.value]?.[0]?.value ?? f.model }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Model</label>
              <select
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {models.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
                <option value={form.model}>{form.model}</option>
              </select>
            </div>
          </div>

          {/* API Key override */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              API Key Override
              <span className="text-[10px] text-muted-foreground/60 font-normal ml-1">(optional — leave blank to use global key)</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={form.apiKey ?? ""}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value || null }))}
                placeholder="sk-... or AIza..."
                className="w-full h-9 rounded-lg border border-border bg-background px-3 pr-9 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              Custom System Prompt
              <span className="text-[10px] text-muted-foreground/60 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={form.systemPrompt ?? ""}
              onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value || null }))}
              placeholder="You are a helpful health assistant for Aorane..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none font-mono text-xs"
            />
          </div>

          {/* Automatic Fallback (Phase 2) */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
            <label className="text-xs font-medium text-foreground flex items-center gap-1">
              Automatic Fallback Provider
              <span className="text-[10px] text-muted-foreground/70 font-normal ml-1">
                (optional — if the primary provider fails/rate-limits, this one is tried automatically)
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={form.fallbackProvider ?? ""}
                  onChange={e => setForm(f => ({
                    ...f,
                    fallbackProvider: e.target.value || null,
                    fallbackModel: e.target.value ? (MODELS_BY_PROVIDER[e.target.value]?.[0]?.value ?? null) : null,
                  }))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="">None (no fallback)</option>
                  {PROVIDERS.filter(p => p.value !== form.provider).map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              {form.fallbackProvider && (
                <div>
                  <select
                    value={form.fallbackModel ?? ""}
                    onChange={e => setForm(f => ({ ...f, fallbackModel: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    {fallbackModels.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                    {form.fallbackModel && !fallbackModels.some(m => m.value === form.fallbackModel) && (
                      <option value={form.fallbackModel}>{form.fallbackModel}</option>
                    )}
                  </select>
                </div>
              )}
            </div>
            {form.fallbackProvider && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Fallback API Key
                  <span className="text-[10px] text-muted-foreground/60 font-normal ml-1">(optional — leave blank to use that provider's global key)</span>
                </label>
                <div className="relative">
                  <input
                    type={showFallbackKey ? "text" : "password"}
                    value={form.fallbackApiKey ?? ""}
                    onChange={e => setForm(f => ({ ...f, fallbackApiKey: e.target.value || null }))}
                    placeholder="Leave blank to use global key for the fallback provider"
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 pr-9 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFallbackKey(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showFallbackKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>The global Gemini API key is set via the <code className="font-mono bg-muted px-1 rounded text-[10px]">GOOGLE_GEMINI_API_KEY</code> environment variable on the API server. Per-feature overrides here take priority.</span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <XCircle size={13} />
              {error}
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: saved ? "#10B981" : color, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? (
                <><RefreshCw size={13} className="animate-spin" /> Saving...</>
              ) : saved ? (
                <><CheckCircle2 size={13} /> Saved</>
              ) : (
                <><Save size={13} /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIConfig() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { configs: rows } = await api.getAiConfig();
      const merged = DEFAULT_FEATURES.map(def => {
        const existing = rows.find(r => r.feature === def.feature);
        return existing ? { ...def, ...existing } : def;
      });
      setConfigs(merged);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load AI config");
      setConfigs(DEFAULT_FEATURES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (feature: string, data: Partial<AiConfig>) => {
    const result = await api.updateAiConfig(feature, data);
    setConfigs(prev => prev.map(c => c.feature === feature ? { ...c, ...result.config } : c));
  };

  const enabledCount = configs.filter(c => c.isEnabled).length;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={20} className="text-[#6366F1]" />
              <h1 className="text-lg font-bold text-foreground">AI Configuration</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure AI providers, models, and system prompts for each platform feature.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Features", value: configs.length, color: "#6366F1" },
            { label: "Active", value: enabledCount, color: "#10B981" },
            { label: "Disabled", value: configs.length - enabledCount, color: "#EF4444" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
            <XCircle size={15} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground py-8 justify-center">
            <RefreshCw size={16} className="animate-spin" />
            Loading AI configurations...
          </div>
        )}

        {/* Feature cards */}
        {!loading && (
          <div className="space-y-3">
            {configs.map(config => (
              <FeatureCard key={config.feature} config={config} onSave={handleSave} />
            ))}
          </div>
        )}

        {/* Global key notice */}
        <div className="flex items-start gap-3 bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-xl p-4 text-sm text-foreground/80">
          <Info size={15} className="text-[#6366F1] shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-foreground">API Key Setup Guide</p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Gemini (Google):</span>{" "}
                Set <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">GOOGLE_GEMINI_API_KEY</code> in the API server environment.
                Used for Food AI, Smart Scan, Medical AI, and daily suggestions.
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">AI-powered (DeepSeek):</span>{" "}
                Set <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">NVIDIA_API_KEY</code> in the API server environment.
                Used for monthly disease risk prediction and weekly diet chart generation.
                Get your key at <span className="font-mono text-[11px]">build.nvidia.com</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Per-feature API key overrides in each card above take priority over the global keys.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
