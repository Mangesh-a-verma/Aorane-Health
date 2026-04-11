import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type AdCampaign } from "@/lib/api";
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Eye, MousePointerClick, Image as ImageIcon, Globe, RefreshCw,
  TrendingUp,
} from "lucide-react";

const SLOT_LABELS: Record<number, string> = {
  1: "Slot 1 — Pehla", 2: "Slot 2", 3: "Slot 3", 4: "Slot 4", 5: "Slot 5 — Aakhri",
};

const SCREEN_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "all", label: "Sab Pages" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  expired: "bg-gray-100 text-gray-500",
  pending: "bg-blue-100 text-blue-700",
};

type FormData = {
  title: string; adType: "google" | "direct"; advertiserName: string;
  bannerUrl: string; linkUrl: string; googleAdCode: string;
  slidePosition: number; targetScreen: string; status: string;
  priority: number; dealAmount: string;
  startsAt: string; endsAt: string;
};

const EMPTY_FORM: FormData = {
  title: "", adType: "direct", advertiserName: "", bannerUrl: "", linkUrl: "",
  googleAdCode: "", slidePosition: 1, targetScreen: "dashboard",
  status: "active", priority: 1, dealAmount: "", startsAt: "", endsAt: "",
};

function AdCard({ ad, onEdit, onDelete, onToggle }: {
  ad: AdCampaign;
  onEdit: (ad: AdCampaign) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const ctr = ad.impressionCount > 0
    ? ((ad.clickCount / ad.impressionCount) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Banner preview */}
      <div className="relative h-36 bg-muted/30 flex items-center justify-center overflow-hidden">
        {ad.bannerUrl ? (
          <img src={ad.bannerUrl} alt={ad.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon size={28} />
            <span className="text-xs">Koi image nahi</span>
          </div>
        )}
        {/* Slot badge */}
        <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] rounded px-2 py-0.5 font-medium">
          Slot {ad.slidePosition ?? 1}
        </div>
        {/* Status badge */}
        <div className={`absolute top-2 right-2 text-[10px] rounded px-2 py-0.5 font-semibold ${STATUS_COLORS[ad.status] || "bg-gray-100 text-gray-600"}`}>
          {ad.status.toUpperCase()}
        </div>
        {/* Type badge */}
        <div className="absolute bottom-2 left-2 bg-black/40 text-white text-[10px] rounded px-2 py-0.5">
          {ad.adType === "google" ? "🔵 Google Ad" : "📢 Direct Ad"}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-sm text-foreground leading-tight">{ad.title}</p>
          {ad.advertiserName && (
            <p className="text-xs text-muted-foreground mt-0.5">{ad.advertiserName}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye size={12} />
            <span>{ad.impressionCount.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointerClick size={12} />
            <span>{ad.clickCount.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp size={12} />
            <span>{ctr}% CTR</span>
          </div>
        </div>

        {/* Target screen */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe size={11} />
          <span>{ad.targetScreen === "all" ? "Sab Pages" : "Dashboard"}</span>
        </div>

        {/* Link preview */}
        {ad.linkUrl && (
          <p className="text-xs text-primary truncate">{ad.linkUrl}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <button
            onClick={() => onToggle(ad.id)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-muted transition-colors"
          >
            {ad.status === "active"
              ? <ToggleRight size={14} className="text-green-600" />
              : <ToggleLeft size={14} className="text-muted-foreground" />}
            <span>{ad.status === "active" ? "Active" : "Paused"}</span>
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onEdit(ad)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(ad.id)}
            className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdModal({
  initial, onSave, onClose,
}: {
  initial: Partial<AdCampaign> | null;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(
    initial ? {
      title: initial.title || "",
      adType: initial.adType || "direct",
      advertiserName: initial.advertiserName || "",
      bannerUrl: initial.bannerUrl || "",
      linkUrl: initial.linkUrl || "",
      googleAdCode: initial.googleAdCode || "",
      slidePosition: initial.slidePosition ?? 1,
      targetScreen: initial.targetScreen || "dashboard",
      status: initial.status || "active",
      priority: initial.priority ?? 1,
      dealAmount: initial.dealAmount || "",
      startsAt: initial.startsAt ? initial.startsAt.slice(0, 16) : "",
      endsAt: initial.endsAt ? initial.endsAt.slice(0, 16) : "",
    } : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormData, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border">
          <h2 className="font-bold text-lg text-foreground">
            {initial?.id ? "Ad Edit Karo" : "Naya Ad Banao"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Slider mein dikhne wala banner</p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Ad Title *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} required
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. AORANE Premium — 50% Off"
            />
          </div>

          {/* Ad Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Ad Type *</label>
            <div className="flex gap-2">
              {(["direct", "google"] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => set("adType", t)}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                    form.adType === t
                      ? "border-primary bg-primary text-white"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t === "direct" ? "📢 Direct (Custom Image)" : "🔵 Google Ad"}
                </button>
              ))}
            </div>
          </div>

          {/* Banner Image URL */}
          {form.adType === "direct" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Banner Image URL</label>
              <input value={form.bannerUrl} onChange={(e) => set("bannerUrl", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="https://... (landscape image, 16:6 ratio best)"
              />
              {form.bannerUrl && (
                <img src={form.bannerUrl} alt="preview" className="mt-2 w-full h-24 object-cover rounded-lg border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
          )}

          {/* Google Ad Code */}
          {form.adType === "google" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Google AdSense Code</label>
              <textarea value={form.googleAdCode} onChange={(e) => set("googleAdCode", e.target.value)}
                rows={4}
                className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="<script async src='https://pagead2.googlesyndication.com/...'></script>&#10;<ins class='adsbygoogle' ...></ins>"
              />
              <p className="text-xs text-muted-foreground mt-1">Google AdSense ka pura HTML code yahan paste karo</p>
            </div>
          )}

          {/* Click URL */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Click karne pe kahan jaaye (URL)</label>
            <input value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="https://example.com ya deep link"
            />
          </div>

          {/* Slider Position + Target Screen */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Slider Slot (1–5)</label>
              <select value={form.slidePosition} onChange={(e) => set("slidePosition", Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{SLOT_LABELS[n]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Kahan dikhega</label>
              <select value={form.targetScreen} onChange={(e) => set("targetScreen", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SCREEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {["active", "paused", "pending", "expired"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Priority (1=high)</label>
              <input type="number" min={1} max={10} value={form.priority} onChange={(e) => set("priority", Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Advertiser + Deal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Advertiser Name</label>
              <input value={form.advertiserName} onChange={(e) => set("advertiserName", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Company name"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Deal Amount (₹)</label>
              <input type="number" value={form.dealAmount} onChange={(e) => set("dealAmount", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. 5000"
              />
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Start Date</label>
              <input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">End Date</label>
              <input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving..." : initial?.id ? "Update Karo" : "Ad Banao"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdsManager() {
  const [ads, setAds] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAd, setModalAd] = useState<Partial<AdCampaign> | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setAds((await api.ads()).ads); }
    catch { setError("Ads load nahi hue"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: ReturnType<typeof Object.assign>) => {
    try {
      if (modalAd && "id" in modalAd && modalAd.id) {
        await api.updateAd(modalAd.id, data);
      } else {
        await api.createAd(data);
      }
      setModalAd(undefined);
      load();
    } catch { setError("Save nahi hua, dobara koshish karo"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yeh ad delete hoga. Pakka?")) return;
    try { await api.deleteAd(id); load(); }
    catch { setError("Delete nahi hua"); }
  };

  const handleToggle = async (id: string) => {
    try { await api.toggleAd(id); load(); }
    catch { setError("Toggle nahi hua"); }
  };

  const totalImpressions = ads.reduce((s, a) => s + a.impressionCount, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clickCount, 0);
  const activeCount = ads.filter((a) => a.status === "active").length;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ads Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Mobile app ke slider mein dikhne wale banners control karo. Admin panel se direct publish hota hai.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setModalAd({})}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus size={15} />
              Naya Ad
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Hatao</button>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Active Ads", value: activeCount, icon: ToggleRight, color: "text-green-600" },
            { label: "Total Impressions", value: totalImpressions.toLocaleString("en-IN"), icon: Eye, color: "text-blue-600" },
            { label: "Total Clicks", value: totalClicks.toLocaleString("en-IN"), icon: MousePointerClick, color: "text-purple-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon size={16} className={stat.color} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Slot overview — visual */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Slider Slots Overview</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((slot) => {
              const slotAd = ads.find((a) => a.slidePosition === slot && a.status === "active");
              return (
                <div key={slot} className={`flex-1 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
                  slotAd ? "border-primary/40 bg-primary/5" : "border-border"
                }`}>
                  <span className="text-[10px] font-bold text-muted-foreground">SLOT {slot}</span>
                  {slotAd ? (
                    <span className="text-[10px] text-primary font-medium px-1 text-center leading-tight" style={{ maxWidth: "100%" }}>
                      {slotAd.title.slice(0, 18)}{slotAd.title.length > 18 ? "…" : ""}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Khaali</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Ads grid */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Ads load ho rahe hain...</div>
        ) : ads.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Koi ad nahi mila. Pehla ad banao!</p>
            <button onClick={() => setModalAd({})} className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors">
              Naya Ad Banao
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} onEdit={setModalAd} onDelete={handleDelete} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>

      {modalAd !== undefined && (
        <AdModal
          initial={modalAd ?? null}
          onSave={handleSave}
          onClose={() => setModalAd(undefined)}
        />
      )}
    </Layout>
  );
}
