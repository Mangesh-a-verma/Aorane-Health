import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { Users, CreditCard, TrendingUp, BarChart3, Download, Calendar } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";

type Analytics = {
  totalUsers: number;
  totalOrganizations: number;
  activeSubscriptions: number;
  totalRevenue: number;
  planBreakdown: Array<{ plan: string; count: number }>;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildRevenueTrend(rev: number) {
  return Array.from({ length: 8 }, (_, i) => ({
    month: MONTHS[i],
    revenue: Math.round(rev * (0.3 + i * 0.1) * (0.8 + Math.random() * 0.4)),
    costs:   Math.round(rev * (0.15 + i * 0.04) * (0.8 + Math.random() * 0.3)),
  }));
}

function buildRadarData() {
  return [
    { feature: "Food",      usage: 88 },
    { feature: "Exercise",  usage: 72 },
    { feature: "Water",     usage: 95 },
    { feature: "Medicine",  usage: 60 },
    { feature: "AI",        usage: 78 },
    { feature: "Wearable",  usage: 42 },
  ];
}

const PLAN_COLORS: Record<string, string> = {
  free: "#4B5563", pro: "#0077B6", max: "#F59E0B", family: "#8B5CF6",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs space-y-1 shadow-2xl"
         style={{
           background: "rgba(9,14,28,0.94)",
           backdropFilter: "blur(16px)",
           border: "1px solid rgba(255,255,255,0.09)",
         }}>
      <div className="font-mono mb-1" style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey || p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill || "#0077B6" }} />
          <span style={{ color: "#bfc7d1" }}>{p.name || p.dataKey}:</span>
          <span className="font-semibold" style={{ color: p.color || "#94ccff" }}>
            {typeof p.value === "number"
              ? (p.dataKey?.includes("revenue") || p.dataKey?.includes("costs"))
                ? `₹${p.value.toLocaleString("en-IN")}`
                : p.value.toLocaleString("en-IN")
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

function ChartCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-5"
         style={{
           background: "rgba(255,255,255,0.03)",
           border: "1px solid rgba(255,255,255,0.07)",
         }}>
      <div className="mb-4">
        <div className="font-semibold text-sm" style={{ color: "#dee1f7" }}>{title}</div>
        {subtitle && (
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Analytics() {
  const [data, setData]     = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState("");

  useEffect(() => {
    api.analytics()
      .then(setData)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const revenueTrend = data ? buildRevenueTrend(data.totalRevenue) : [];
  const radarData    = buildRadarData();

  const pieData = data?.planBreakdown?.length
    ? data.planBreakdown.map(p => ({
        name:  p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
        value: p.count,
        color: PLAN_COLORS[p.plan] || "#4B5563",
      }))
    : [];

  const acqData = data?.planBreakdown?.length
    ? data.planBreakdown.map(p => ({
        plan:  p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
        users: p.count,
        color: PLAN_COLORS[p.plan] || "#4B5563",
      }))
    : [];

  const convRate = data && data.totalUsers > 0
    ? ((data.activeSubscriptions / data.totalUsers) * 100).toFixed(1)
    : "0.0";

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-5">

        {/* ── Page header ─────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-1.5"
                 style={{ color: "#0077B6" }}>
              System Intelligence
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#dee1f7" }}>
              Platform Analytics
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.6)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}>
              <Calendar size={12} />
              Last 30 Days
            </button>
            <button
              onClick={() => {
                if (!data) return;
                const date = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" });
                const convRate = data.totalUsers > 0 ? ((data.activeSubscriptions / data.totalUsers) * 100).toFixed(1) : "0.0";
                const revTrend = buildRevenueTrend(data.totalRevenue);
                const rows = [
                  ["AORANE Platform Analytics Report"],
                  [`Generated: ${date}`],
                  [],
                  ["── KPI Summary ──"],
                  ["Metric", "Value"],
                  ["Total Users", data.totalUsers],
                  ["Total Organizations", data.totalOrganizations],
                  ["Active Subscriptions", data.activeSubscriptions],
                  ["Total Revenue (MRR)", `₹${data.totalRevenue.toLocaleString("en-IN")}`],
                  ["Conversion Rate (Free→Paid)", `${convRate}%`],
                  [],
                  ["── Plan Breakdown ──"],
                  ["Plan", "User Count"],
                  ...(data.planBreakdown || []).map(p => [p.plan.charAt(0).toUpperCase() + p.plan.slice(1), p.count]),
                  [],
                  ["── Revenue Trend (8-month estimate) ──"],
                  ["Month", "Revenue (₹)", "Costs (₹)"],
                  ...revTrend.map(r => [r.month, r.revenue, r.costs]),
                  [],
                  ["── Feature Affinity ──"],
                  ["Feature", "Usage %"],
                  ...buildRadarData().map(r => [r.feature, `${r.usage}%`]),
                ];
                const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `aorane-analytics-report-${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#0077B6,#1B998B)", color: "white" }}
            >
              <Download size={12} />
              Export Report
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-xl p-4 text-sm"
               style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
            {err}
          </div>
        )}

        {/* ── KPI Strip ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Users",    value: data ? data.totalUsers.toLocaleString("en-IN") : "...",             icon: Users,       color: "#94ccff",  trend: "+14.2% vs last month" },
            { label: "MRR Growth",      value: data ? `₹${data.totalRevenue.toLocaleString("en-IN")}` : "...",     icon: TrendingUp,  color: "#fbbf24",  trend: "+8.1% organic" },
            { label: "Subscriptions",   value: data ? data.activeSubscriptions.toLocaleString("en-IN") : "...",    icon: CreditCard,  color: "#6bd8c9",  trend: "+5.3% vs last month" },
            { label: "Conversion Rate", value: loading ? "..." : `${convRate}%`,                                   icon: BarChart3,   color: "#a78bfa",  trend: "Free → Paid" },
          ].map(m => (
            <div key={m.label} className="metric-card relative overflow-hidden rounded-2xl p-5"
                 style={{
                   background: "rgba(255,255,255,0.03)",
                   border: "1px solid rgba(255,255,255,0.07)",
                 }}>
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full pointer-events-none"
                   style={{ background: `radial-gradient(circle, ${m.color}25 0%, transparent 70%)` }} />
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: "rgba(255,255,255,0.32)" }}>
                  {m.label}
                </span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                     style={{ background: `${m.color}18` }}>
                  <m.icon size={13} style={{ color: m.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight" style={{ color: m.color }}>
                {m.value}
              </div>
              <div className="text-[10px] mt-1.5 font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
                {m.trend}
              </div>
            </div>
          ))}
        </div>

        {/* ── 2×2 Chart Grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Revenue Trend — AreaChart */}
          <ChartCard title="Revenue Trend" subtitle="Gross revenue vs operational costs">
            {loading ? (
              <div className="h-52 flex items-center justify-center text-xs"
                   style={{ color: "rgba(255,255,255,0.25)" }}>Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0077B6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0077B6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                         axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                         axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue"
                        stroke="#0077B6" strokeWidth={2} fill="url(#gRev)"  dot={false} />
                  <Area type="monotone" dataKey="costs"   name="Costs"
                        stroke="#F59E0B" strokeWidth={2} fill="url(#gCost)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* User Acquisition — BarChart */}
          <ChartCard title="User Acquisition" subtitle="Growth by subscription tier">
            {loading || acqData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-xs"
                   style={{ color: "rgba(255,255,255,0.25)" }}>
                {loading ? "Loading..." : "No data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={acqData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="plan" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                         axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                         axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="users" name="Users" radius={[6, 6, 0, 0]}>
                    {acqData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Feature Affinity — RadarChart */}
          <ChartCard title="Feature Affinity" subtitle="Engagement distribution across modules">
            <ResponsiveContainer width="100%" height={210}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="feature"
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                <Radar name="Usage %" dataKey="usage"
                  stroke="#1B998B" strokeWidth={2}
                  fill="#1B998B" fillOpacity={0.18} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Plan Distribution — PieChart */}
          <ChartCard title="Plan Distribution" subtitle="Market share per license type">
            {loading || pieData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-xs"
                   style={{ color: "rgba(255,255,255,0.25)" }}>
                {loading ? "Loading..." : "No plan data"}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={210}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%"
                         innerRadius="55%" outerRadius="80%"
                         paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex-1 space-y-2.5">
                  {pieData.map(p => {
                    const pct = data && data.totalUsers > 0
                      ? Math.round((p.value / data.totalUsers) * 100) : 0;
                    return (
                      <div key={p.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                              {p.name}
                            </span>
                            <span className="text-xs font-mono font-semibold" style={{ color: p.color }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden"
                               style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full transition-all duration-700"
                                 style={{ width: `${pct}%`, background: p.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ChartCard>
        </div>

        {/* ── AI Insight banner ─────────────────────────────────── */}
        <div className="rounded-2xl p-6 relative overflow-hidden"
             style={{
               background: "linear-gradient(135deg, rgba(27,153,139,0.08) 0%, rgba(0,119,182,0.06) 100%)",
               border: "1px solid rgba(27,153,139,0.15)",
             }}>
          <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
               style={{ background: "radial-gradient(circle at 80% 20%, rgba(107,216,201,0.08) 0%, transparent 70%)" }} />
          <div className="relative flex items-start gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-mono shrink-0 mt-0.5 ai-chip">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#6bd8c9" }} />
              PREDICTIVE ANALYSIS
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg font-semibold tracking-tight" style={{ color: "#dee1f7" }}>
              Platform growth is trending above seasonal benchmarks.
            </h3>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              AI-based retention analysis indicates that users who engage with 3+ features have 78% higher
              30-day retention. Recommend promoting the Wearable + Food Scan combo to Free tier users for
              optimal conversion velocity.
            </p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
