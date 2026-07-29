import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type Analytics, type HealthAnalytics } from "@/lib/api";
import {
  Users, TrendingUp, Activity, Heart, BarChart3,
  Flame, Droplets, Dumbbell, Pill, Zap, ShieldCheck, AlertTriangle, Clock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ComposedChart, Line,
} from "recharts";

function KPICard({ label, value, sub, icon: Icon, color, bold }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string; bold?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className={`kpi-number text-3xl text-foreground ${bold ? "font-black" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const GENDER_COLORS = ["#0077B6", "#EC4899", "#6B7280"];
const STATUS_COLORS = ["#10B981", "#F59E0B", "#6B7280"];
const STRESS_COLORS = ["#EF4444", "#F59E0B", "#10B981"];
const VITALS_COLORS = ["#FF6B6B", "#4FC3F7", "#66BB6A", "#AB47BC"];

const tooltipStyle = {
  backgroundColor: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  color: "#181c20",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [health, setHealth] = useState<HealthAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAnalytics(), api.getHealthAnalytics()])
      .then(([a, h]) => { setData(a); setHealth(h); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </Layout>
  );

  if (!data) return (
    <Layout>
      <div className="p-6 text-center text-muted-foreground">Failed to load analytics</div>
    </Layout>
  );

  const statusData = health ? [
    { name: "Healthy", value: health.healthyCount },
    { name: "At Risk", value: health.atRiskCount },
    { name: "Inactive", value: health.inactiveCount },
  ] : [];

  const stressData = health && health.stressTrackedCount > 0 ? [
    { name: "High Stress", value: health.highStressCount },
    { name: "Moderate", value: health.moderateStressCount },
    { name: "Low Stress", value: health.lowStressCount },
  ] : [];

  const vitalsData = health ? [
    { name: "Nutrition", fullMark: 100, score: Math.round(health.avgFood) },
    { name: "Hydration", fullMark: 100, score: Math.round(health.avgWater) },
    { name: "Exercise", fullMark: 100, score: Math.round(health.avgExercise) },
    { name: "Medication", fullMark: 100, score: Math.round(health.avgMedicine) },
  ] : [];

  const vitalsBar = health ? [
    { name: "Nutrition", value: Math.round(health.avgFood), color: VITALS_COLORS[0] },
    { name: "Hydration", value: Math.round(health.avgWater), color: VITALS_COLORS[1] },
    { name: "Exercise", value: Math.round(health.avgExercise), color: VITALS_COLORS[2] },
    { name: "Medication", value: Math.round(health.avgMedicine), color: VITALS_COLORS[3] },
  ] : [];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="pill-chip bg-primary/10 text-primary uppercase">
                <BarChart3 size={11} /> Live Insights
              </span>
            </div>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Privacy-safe, aggregate health and engagement insights for your organization.</p>
          </div>
        </div>

        {/* Row 1: KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total Members" value={data.totalMembers} sub="Enrolled in org" icon={Users} color="#0077B6" />
          <KPICard label="Avg Health Score" value={health ? `${Math.round(health.avgHealthScore)}/100` : "—"} sub="Across all members" icon={Heart} color="#EF4444" bold />
          <KPICard label="Active (7 days)" value={health?.activeLast7Days ?? "—"} sub="Logged at least once" icon={Activity} color="#10B981" />
          <KPICard label="Active Today" value={health?.activeToday ?? "—"} sub="Health logs today" icon={Zap} color="#F59E0B" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Avg BMI" value={data.avgBmi ?? "—"} sub="Org average" icon={TrendingUp} color="#7C3AED" />
          <KPICard label="Avg Stress Score" value={health?.avgStressScore != null ? `${Math.round(health.avgStressScore)}/100` : "—"} sub="Lower is better" icon={Flame} color="#EF4444" />
          <KPICard label="High Stress Members" value={health?.highStressCount ?? "—"} sub="Burnout risk zone" icon={AlertTriangle} color="#EF4444" />
          <KPICard label="Stress Tracked" value={health?.stressTrackedCount ?? "—"} sub="Have stress data" icon={ShieldCheck} color="#10B981" />
        </div>

        {/* Row 2: Join Trend (full width) */}
        {data.joinTrend.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-4 uppercase tracking-wider">Member Join Trend (Last 30 Days)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.joinTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="joinGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0077B6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0077B6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7280" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#0077B6" fill="url(#joinGrad)" strokeWidth={2} name="New Members" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Row 3: Daily Active Trend */}
        {health && health.dailyActiveTrend.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-1 uppercase tracking-wider">Daily Active Members (Last 14 Days)</h2>
            <p className="text-xs text-muted-foreground mb-4">Members who logged any health data each day</p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={health.dailyActiveTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7280" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="activeCount" stroke="#10B981" fill="url(#activeGrad)" strokeWidth={0} name="Active Members" />
                <Line type="monotone" dataKey="activeCount" stroke="#10B981" strokeWidth={2.5} dot={false} name="Active Members" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Row 4: Three charts */}
        <div className="grid md:grid-cols-3 gap-5">
          {/* Gender Distribution */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-4 uppercase tracking-wider">Gender Distribution</h2>
            {data.genderDist.some(g => g.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.genderDist.filter(g => g.value > 0)} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {data.genderDist.filter(g => g.value > 0).map((entry, i) => (
                      <Cell key={entry.name} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            )}
          </div>

          {/* Health Status Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-1 uppercase tracking-wider">Health Status</h2>
            <p className="text-xs text-muted-foreground mb-4">Based on health scores</p>
            {health && statusData.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData.filter(s => s.value > 0)} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
                    {statusData.filter(s => s.value > 0).map((entry, i) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No health score data yet</div>
            )}
          </div>

          {/* Stress Distribution */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-1 uppercase tracking-wider">Stress Distribution</h2>
            <p className="text-xs text-muted-foreground mb-4">Members with stress logs</p>
            {stressData.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={stressData.filter(s => s.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value">
                    {stressData.filter(s => s.value > 0).map((entry, i) => (
                      <Cell key={entry.name} fill={STRESS_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No stress data yet</div>
            )}
          </div>
        </div>

        {/* Row 5: Vitals + Age + Plans */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Average Vitals Compliance */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-1 uppercase tracking-wider">Avg Habit Compliance</h2>
            <p className="text-xs text-muted-foreground mb-4">Daily average score (0–100)</p>
            {vitalsBar.some(v => v.value > 0) ? (
              <>
                <div className="space-y-3">
                  {vitalsBar.map(v => (
                    <div key={v.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{v.name}</span>
                        <span className="font-bold" style={{ color: v.color }}>{v.value}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${v.value}%`, backgroundColor: v.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {vitalsData.length > 0 && (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={130}>
                      <RadarChart data={vitalsData}>
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "#6B7280" }} />
                        <Radar name="Score" dataKey="score" stroke="#0077B6" fill="#0077B6" fillOpacity={0.25} strokeWidth={2} />
                        <Tooltip contentStyle={tooltipStyle} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No vitals data yet</div>
            )}
          </div>

          {/* Age Distribution */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-4 uppercase tracking-wider">Age Groups</h2>
            {data.ageDist.some(a => a.value > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.ageDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Members">
                    {data.ageDist.map((_, i) => (
                      <Cell key={i} fill={["#0077B6", "#00B4D8", "#48CAE4", "#90E0EF", "#ADE8F4"][i % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            )}
          </div>

          {/* Plan Distribution */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-4 uppercase tracking-wider">Member Plans</h2>
            {data.planDist.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.planDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#0077B6" radius={[6, 6, 0, 0]} name="Members" />
                  </BarChart>
                </ResponsiveContainer>
                {/* Plan breakdown pills */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.planDist.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-full px-3 py-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ["#0077B6", "#10B981", "#F59E0B", "#7C3AED"][i % 4] }} />
                      <span className="font-semibold capitalize">{p.name}</span>
                      <span className="text-muted-foreground">{p.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            )}
          </div>
        </div>

        {/* Vitals Icon Summary Row */}
        {health && (
          <div className="bg-gradient-to-br from-primary/5 to-teal-500/5 border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-4 uppercase tracking-wider">Organization Health Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Flame, label: "Avg Nutrition", value: `${Math.round(health.avgFood)}%`, color: "#FF6B6B" },
                { icon: Droplets, label: "Avg Hydration", value: `${Math.round(health.avgWater)}%`, color: "#4FC3F7" },
                { icon: Dumbbell, label: "Avg Exercise", value: `${Math.round(health.avgExercise)}%`, color: "#66BB6A" },
                { icon: Pill, label: "Avg Medication", value: `${Math.round(health.avgMedicine)}%`, color: "#AB47BC" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-lg font-bold text-foreground">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.totalMembers === 0 && (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Activity size={24} className="text-muted-foreground/50" />
            </div>
            <p className="font-display font-semibold text-foreground">No member data yet</p>
            <p className="text-muted-foreground text-sm mt-1">Analytics will populate as members join and log health data</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
