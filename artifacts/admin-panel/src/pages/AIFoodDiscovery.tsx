import React, { useEffect, useState, useCallback } from "react";
import Layout from "@/components/Layout";
import { api, type FoodCacheEntry, type FoodCacheStats } from "@/lib/api";
import {
  Brain, Search, CheckCircle, XCircle, Clock, TrendingUp,
  Download, RefreshCw, ChevronDown, Sparkles, X,
} from "lucide-react";

type FilterType = "all" | "pending" | "promoted" | "rejected";

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function NutritionBadge({ label, value, color }: { label: string; value: unknown; color: string }) {
  if (!value && value !== 0) return null;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: color + "22", color }}>
      {label}: {Number(value).toFixed(1)}
    </span>
  );
}

export default function AIFoodDiscovery() {
  const [stats, setStats] = useState<FoodCacheStats | null>(null);
  const [entries, setEntries] = useState<FoodCacheEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterType>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [detailEntry, setDetailEntry] = useState<FoodCacheEntry | null>(null);

  const loadStats = useCallback(() => {
    api.foodCacheStats().then(setStats).catch(console.error);
  }, []);

  const loadEntries = useCallback(() => {
    setLoading(true);
    api.foodCache({ filter, search }).then((r) => {
      setEntries(r.entries);
      setTotal(r.total);
    }).catch(console.error).finally(() => setLoading(false));
  }, [filter, search]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const promote = async (id: string) => {
    setActionId(id);
    try {
      await api.promoteFood(id);
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, isPromoted: true } : e));
      loadStats();
    } catch (err) { alert((err as Error).message); }
    finally { setActionId(null); }
  };

  const reject = async (id: string) => {
    if (!confirm("Reject this food entry? It will be hidden from review.")) return;
    setActionId(id);
    try {
      await api.rejectFood(id);
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, isRejected: true } : e));
      loadStats();
    } catch (err) { alert((err as Error).message); }
    finally { setActionId(null); }
  };

  const exportData = async (format: "json" | "csv") => {
    setExporting(true);
    try {
      await api.exportFoodCache(filter, format);
    } catch (err) { alert((err as Error).message); }
    finally { setExporting(false); }
  };

  const getStatus = (e: FoodCacheEntry) => {
    if (e.isPromoted) return { label: "Promoted", color: "#10B981", bg: "#10B98120", icon: CheckCircle };
    if (e.isRejected) return { label: "Rejected", color: "#EF4444", bg: "#EF444420", icon: XCircle };
    return { label: "Pending", color: "#F59E0B", bg: "#F59E0B20", icon: Clock };
  };

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "pending",  label: "Pending Review" },
    { key: "promoted", label: "Promoted" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#6366F120" }}>
                <Brain size={18} style={{ color: "#6366F1" }} />
              </div>
              <h1 className="text-2xl font-bold text-foreground">AI Food Discovery</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-11">
              Review AI-discovered foods · Promote to database · Auto-promotes at 5 searches
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportData("csv")} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all disabled:opacity-50">
              <Download size={13} />
              CSV
            </button>
            <button onClick={() => exportData("json")} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all disabled:opacity-50">
              <Download size={13} />
              JSON
            </button>
            <button onClick={() => { loadStats(); loadEntries(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-all">
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total AI-Discovered" value={stats?.total ?? 0}     icon={Brain}       color="#6366F1" bg="#6366F120" />
          <StatCard label="Pending Review"       value={stats?.pending ?? 0}   icon={Clock}       color="#F59E0B" bg="#F59E0B20" />
          <StatCard label="Promoted"             value={stats?.promoted ?? 0}  icon={CheckCircle} color="#10B981" bg="#10B98120" />
          <StatCard label="Rejected"             value={stats?.rejected ?? 0}  icon={XCircle}     color="#EF4444" bg="#EF444420" />
          <StatCard label="Auto-Promoted"        value={stats?.autoPromoted ?? 0} icon={Sparkles}  color="#8B5CF6" bg="#8B5CF620" />
        </div>

        {/* Filter Tabs + Search */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${filter === f.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search food name..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
          </div>

          <div className="text-xs text-muted-foreground">{total} entries</div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 border-b border-border" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Brain size={40} className="text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No entries found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {filter === "pending" ? "All caught up! No pending reviews." : `No ${filter} entries yet.`}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Food Name", "Hit Count", "Calories", "Macros", "Source AI", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const status = getStatus(entry);
                    const StatusIcon = status.icon;
                    const r = entry.aiResult as Record<string, unknown>;
                    const isActing = actionId === entry.id;

                    return (
                      <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/20 group">
                        <td className="px-4 py-3">
                          <button onClick={() => setDetailEntry(entry)}
                            className="font-medium text-foreground hover:text-primary transition-colors text-left flex items-center gap-1.5">
                            {entry.foodNameEn}
                            <ChevronDown size={12} className="text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                          </button>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(entry.createdAt).toLocaleDateString("en-IN")}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp size={12} className="text-primary" />
                            <span className={`font-semibold ${entry.hitCount >= 5 ? "text-green-500" : "text-foreground"}`}>
                              {entry.hitCount}
                            </span>
                            {entry.hitCount >= 5 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#10B98120", color: "#10B981" }}>
                                AUTO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-orange-500 font-semibold">
                          {r.calories ? `${Number(r.calories).toFixed(0)} kcal` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <NutritionBadge label="P"   value={r.proteinG} color="#3B82F6" />
                            <NutritionBadge label="C"   value={r.carbsG}   color="#F59E0B" />
                            <NutritionBadge label="F"   value={r.fatG}     color="#EF4444" />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "#6366F115", color: "#6366F1" }}>
                            {entry.sourceAi || "nvidia"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full w-fit"
                               style={{ background: status.bg }}>
                            <StatusIcon size={11} style={{ color: status.color }} />
                            <span className="text-[11px] font-medium" style={{ color: status.color }}>{status.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {!entry.isPromoted && !entry.isRejected ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => promote(entry.id)} disabled={isActing}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 active:scale-95"
                                style={{ background: "#10B98120", color: "#10B981" }}>
                                <CheckCircle size={11} />
                                {isActing ? "..." : "Promote"}
                              </button>
                              <button onClick={() => reject(entry.id)} disabled={isActing}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 active:scale-95"
                                style={{ background: "#EF444420", color: "#EF4444" }}>
                                <XCircle size={11} />
                                {isActing ? "..." : "Reject"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {entry.reviewedAt ? new Date(entry.reviewedAt).toLocaleDateString("en-IN") : "—"}
                            </span>
                          )}
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

      {/* Detail Modal */}
      {detailEntry && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
             onClick={() => setDetailEntry(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground text-lg">{detailEntry.foodNameEn}</h2>
              <button
                aria-label="Close modal"
                onClick={() => setDetailEntry(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            {(() => {
              const r = detailEntry.aiResult as Record<string, unknown>;
              const vs = r.vitamins as Record<string, unknown> | undefined;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Calories",    value: r.calories,    unit: "kcal", color: "#F97316" },
                      { label: "Protein",     value: r.proteinG,    unit: "g",    color: "#3B82F6" },
                      { label: "Carbs",       value: r.carbsG,      unit: "g",    color: "#F59E0B" },
                      { label: "Fat",         value: r.fatG,        unit: "g",    color: "#EF4444" },
                      { label: "Fiber",       value: r.fiberG,      unit: "g",    color: "#10B981" },
                      { label: "Sodium",      value: r.sodiumMg,    unit: "mg",   color: "#8B5CF6" },
                      { label: "Serving",     value: r.servingSizeG, unit: "g",   color: "#6B7280" },
                    ].map(({ label, value, unit, color }) => value != null && (
                      <div key={label} className="bg-muted/30 rounded-xl p-3">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="font-bold text-sm mt-0.5" style={{ color }}>
                          {Number(value).toFixed(1)} {unit}
                        </div>
                      </div>
                    ))}
                  </div>

                  {vs && Object.keys(vs).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Vitamins & Minerals</div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(vs).map(([k, v]) => v ? (
                          <span key={k} className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                            {k.replace(/_/g, " ")}: {Number(v).toFixed(1)}
                          </span>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  {!!r.category && (
                    <div>
                      <span className="text-xs capitalize bg-muted text-muted-foreground px-3 py-1 rounded-full">
                        {String(r.category)}
                      </span>
                    </div>
                  )}

                  {Array.isArray(r.dietaryTags) && r.dietaryTags.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Dietary Tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(r.dietaryTags as string[]).map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "#10B98115", color: "#10B981" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!r.healthTip && (
                    <div className="bg-muted/30 rounded-xl p-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Health Tip</div>
                      <p className="text-xs text-foreground/80">{String(r.healthTip)}</p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    Hit Count: <strong>{detailEntry.hitCount}</strong> ·
                    Source: <strong>{detailEntry.sourceAi || "nvidia"}</strong> ·
                    Discovered: <strong>{new Date(detailEntry.createdAt).toLocaleDateString("en-IN")}</strong>
                  </div>

                  {!detailEntry.isPromoted && !detailEntry.isRejected && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { promote(detailEntry.id); setDetailEntry(null); }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                        style={{ background: "#10B981", color: "white" }}>
                        Promote to Food Database
                      </button>
                      <button onClick={() => { reject(detailEntry.id); setDetailEntry(null); }}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border border-border text-muted-foreground hover:text-red-500 hover:border-red-500">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </Layout>
  );
}
