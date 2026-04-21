import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type Analytics } from "@/lib/api";
import { Users, TrendingUp, Activity, Heart, BarChart3 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

function KPICard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="kpi-number text-3xl text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const GENDER_COLORS = ["#0077B6", "#EC4899", "#6B7280"];

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(setData).catch(console.error).finally(() => setLoading(false));
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

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Hero */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="pill-chip bg-primary/10 text-primary uppercase">
                <BarChart3 size={11} /> Live Insights
              </span>
            </div>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Member health and engagement insights for your organization.</p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total Members" value={data.totalMembers} sub="Active in org" icon={Users} color="#0077B6" />
          <KPICard label="Avg BMI" value={data.avgBmi ?? "—"} sub="Across all members" icon={Activity} color="#10B981" />
          <KPICard label="Male Members" value={data.genderDist.find(g => g.name === "Male")?.value ?? 0} sub="By gender" icon={TrendingUp} color="#7C3AED" />
          <KPICard label="Female Members" value={data.genderDist.find(g => g.name === "Female")?.value ?? 0} sub="By gender" icon={Heart} color="#EC4899" />
        </div>

        {/* Join Trend */}
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
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

          {/* Plan Distribution */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-4 uppercase tracking-wider">Member Plans</h2>
            {data.planDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.planDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#0077B6" radius={[6, 6, 0, 0]} name="Members" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            )}
          </div>

          {/* Age Distribution */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-display font-bold text-foreground mb-4 uppercase tracking-wider">Age Groups</h2>
            {data.ageDist.some(a => a.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.ageDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#10B981" radius={[6, 6, 0, 0]} name="Members" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            )}
          </div>
        </div>

        {data.totalMembers === 0 && (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Activity size={24} className="text-muted-foreground/50" />
            </div>
            <p className="font-display font-semibold text-foreground">No member data yet</p>
            <p className="text-muted-foreground text-sm mt-1">Analytics will populate as members join your organization</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
