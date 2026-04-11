import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type Analytics } from "@/lib/api";
import { Users, TrendingUp, Activity, Heart } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

function KPICard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const GENDER_COLORS = ["#0077B6", "#EC4899", "#6B7280"];

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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Member health & engagement insights</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard label="Total Members" value={data.totalMembers} sub="Active in org" icon={Users} color="#0077B6" />
          <KPICard label="Avg BMI" value={data.avgBmi ?? "—"} sub="Across all members" icon={Activity} color="#10B981" />
          <KPICard label="Male Members" value={data.genderDist.find(g => g.name === "Male")?.value ?? 0} sub="By gender" icon={TrendingUp} color="#7C3AED" />
          <KPICard label="Female Members" value={data.genderDist.find(g => g.name === "Female")?.value ?? 0} sub="By gender" icon={Heart} color="#EC4899" />
        </div>

        {/* Join Trend */}
        {data.joinTrend.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Member Join Trend (Last 30 Days)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.joinTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="joinGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0077B6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0077B6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7280" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#0077B6" fill="url(#joinGrad)" strokeWidth={2} name="New Members" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
          {/* Gender Distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Gender Distribution</h2>
            {data.genderDist.some(g => g.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.genderDist.filter(g => g.value > 0)} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {data.genderDist.filter(g => g.value > 0).map((entry, i) => (
                      <Cell key={entry.name} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            )}
          </div>

          {/* Plan Distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Member Plans</h2>
            {data.planDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.planDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="#0077B6" radius={[4, 4, 0, 0]} name="Members" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            )}
          </div>

          {/* Age Distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Age Groups</h2>
            {data.ageDist.some(a => a.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.ageDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} name="Members" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
            )}
          </div>
        </div>

        {data.totalMembers === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Activity size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No member data yet</p>
            <p className="text-sm mt-1">Analytics will populate as members join your organization</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
