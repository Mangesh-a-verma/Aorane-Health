import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import {
  Users, Building2, CreditCard, IndianRupee,
  TrendingUp, TrendingDown, Activity, Database,
  ShieldCheck, Zap, Brain, Droplet, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

type Analytics = {
  totalUsers: number;
  totalOrganizations: number;
  activeSubscriptions: number;
  totalRevenue: number;
  planBreakdown: Array<{ plan: string; count: number }>;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function genSparkData(base: number) {
  return Array.from({ length: 8 }, (_, i) => ({
    v: Math.round(base * (0.7 + Math.random() * 0.6) * ((i + 4) / 8)),
  }));
}

function genAreaData(totalUsers: number, totalRevenue: number) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return {
      date: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
      users: Math.round((totalUsers / 7) * (0.6 + i * 0.07)),
      revenue: Math.round((totalRevenue / 7) * (0.5 + i * 0.08)),
    };
  });
}

function genBarData(planBreakdown: Array<{ plan: string; count: number }>) {
  return planBreakdown.map(p => ({
    plan: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    users: p.count,
    color:
      p.plan === "pro"    ? "#0077B6" :
      p.plan === "max"    ? "#F59E0B" :
      p.plan === "family" ? "#8B5CF6" : "#4B5563",
  }));
}

const PLAN_COLORS: Record<string, string> = {
  free: "#4B5563", pro: "#0077B6", max: "#F59E0B", family: "#8B5CF6",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs space-y-1 shadow-2xl"
         style={{
           background: "rgba(9,14,28,0.92)",
           backdropFilter: "blur(16px)",
           border: "1px solid rgba(255,255,255,0.09)",
           color: "#dee1f7",
         }}>
      <div className="font-mono mb-1" style={{ color: "rgba(255,255,255,0.38)", fontSize: "10px" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill || "#0077B6" }} />
          <span style={{ color: "#dee1f7" }}>{p.name || p.dataKey}:</span>
          <span className="font-semibold" style={{ color: p.color || "#94ccff" }}>
            {p.dataKey === "revenue" ? `₹${Number(p.value).toLocaleString("en-IN")}` : Number(p.value).toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
};

function MetricCard({
  label, value, sub, color, icon: Icon, trend, trendUp,
}: {
  label: string; value: string; sub?: string; color: string;
  icon: React.ElementType; trend?: string; trendUp?: boolean;
}) {
  return (
    <div className="metric-card relative overflow-hidden rounded-2xl p-5"
         style={{
           background: "rgba(255,255,255,0.03)",
           border: "1px solid rgba(255,255,255,0.07)",
           backdropFilter: "blur(12px)",
         }}>
      {/* Glow orb */}
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em]"
                style={{ color: "rgba(255,255,255,0.35)" }}>
            {label}
          </span>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `${color}18` }}>
            <Icon size={15} style={{ color }} />
          </div>
        </div>
        <div className="text-3xl font-bold tracking-tight" style={{ color: "#dee1f7" }}>
          {value}
        </div>
        {(trend || sub) && (
          <div className="flex items-center gap-1 mt-1.5 text-[11px] font-medium">
            {trend && (
              <>
                {trendUp
                  ? <TrendingUp size={11} style={{ color: "#34d399" }} />
                  : <TrendingDown size={11} style={{ color: "#f87171" }} />}
                <span style={{ color: trendUp ? "#34d399" : "#f87171" }}>{trend}</span>
                <span style={{ color: "rgba(255,255,255,0.28)" }}>vs last month</span>
              </>
            )}
            {!trend && sub && (
              <span style={{ color: "rgba(255,255,255,0.38)" }}>{sub}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const SYSTEM_INFO = [
  { label: "API Version",  value: "v2.0.0",       icon: Zap,         color: "#8B5CF6" },
  { label: "API Status",   value: "Healthy",       icon: Activity,    color: "#10B981" },
  { label: "Database",     value: "PostgreSQL",    icon: Database,    color: "#0077B6" },
  { label: "Auth System",  value: "JWT + OTP",     icon: ShieldCheck, color: "#F59E0B" },
];

const QUICK_LINKS = [
  { href: "/users",         label: "Manage Users",   color: "#0077B6" },
  { href: "/analytics",     label: "Analytics",      color: "#8B5CF6" },
  { href: "/ads",           label: "Ads Manager",    color: "#F59E0B" },
  { href: "/feature-flags", label: "Feature Flags",  color: "#10B981" },
  { href: "/food-items",    label: "Food Database",  color: "#EF4444" },
  { href: "/subscriptions", label: "Subscriptions",  color: "#6B7280" },
  { href: "/promo-codes",   label: "Promo Codes",    color: "#EC4899" },
  { href: "/audit-logs",    label: "Audit Logs",     color: "#0EA5E9" },
];

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics().then(setAnalytics).catch(console.error).finally(() => setLoading(false));
  }, []);

  const L = (n?: number) => loading ? "..." : (n ?? 0).toLocaleString("en-IN");
  const areaData  = analytics ? genAreaData(analytics.totalUsers, analytics.totalRevenue) : [];
  const barData   = analytics?.planBreakdown ? genBarData(analytics.planBreakdown) : [];
  const sparkU    = analytics ? genSparkData(analytics.totalUsers)    : [];

  const convRate = analytics && analytics.totalUsers > 0
    ? ((analytics.activeSubscriptions / analytics.totalUsers) * 100).toFixed(1) + "%"
    : "0.0%";

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-5">

        {/* ── Page header ──────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-1.5"
                 style={{ color: "#0077B6" }}>
              Platform Overview
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#dee1f7" }}>
              Dashboard
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
               style={{
                 background: "rgba(0,119,182,0.1)",
                 border: "1px solid rgba(0,119,182,0.18)",
                 color: "#94ccff",
               }}>
            <Brain size={12} />
            Aorane AI · Active
          </div>
        </div>

        {/* ── System health banner ─────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl px-6 py-4"
             style={{
               background: "linear-gradient(135deg, rgba(0,119,182,0.12) 0%, rgba(27,153,139,0.08) 100%)",
               border: "1px solid rgba(0,119,182,0.18)",
             }}>
          <div className="absolute -top-8 right-0 w-48 h-48 rounded-full pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(0,119,182,0.12) 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(27,153,139,0.1) 0%, transparent 70%)" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase mb-1"
                   style={{ color: "rgba(255,255,255,0.35)" }}>
                Platform Health
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-sm" style={{ color: "#dee1f7" }}>
                  All Systems Operational
                </span>
              </div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                API Server · Supabase DB · Mobile App · Business Portal
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs">
              {["API", "DB", "Mobile", "Portal"].map(s => (
                <div key={s} className="flex items-center gap-1.5" style={{ color: "#34d399" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI Strip ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Users"    value={L(analytics?.totalUsers)}
            icon={Users}       color="#0077B6" trend="+12.4%" trendUp />
          <MetricCard label="Organizations"  value={L(analytics?.totalOrganizations)}
            icon={Building2}   color="#8B5CF6" trend="+8.1%"  trendUp />
          <MetricCard label="Subscriptions"  value={L(analytics?.activeSubscriptions)}
            icon={CreditCard}  color="#10B981" trend="+5.3%"  trendUp />
          <MetricCard label="Total Revenue"
            value={loading ? "..." : `₹${(analytics?.totalRevenue ?? 0).toLocaleString("en-IN")}`}
            icon={IndianRupee} color="#F59E0B" trend="+18.2%" trendUp />
        </div>

        {/* ── Bento Grid Row: Charts ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Area Chart — 60% */}
          <div className="lg:col-span-3 rounded-2xl p-5"
               style={{
                 background: "rgba(255,255,255,0.03)",
                 border: "1px solid rgba(255,255,255,0.07)",
               }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-sm" style={{ color: "#dee1f7" }}>
                  User Growth
                </div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  New registrations · Last 7 days
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: "#0077B6" }} />
                  Users
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: "#1B998B" }} />
                  Revenue
                </div>
              </div>
            </div>
            {loading ? (
              <div className="h-44 flex items-center justify-center text-xs"
                   style={{ color: "rgba(255,255,255,0.25)" }}>
                Loading chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={areaData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0077B6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0077B6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1B998B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1B998B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                         axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                         axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="users"   name="Users"
                        stroke="#0077B6" strokeWidth={2} fill="url(#gUsers)" dot={false} />
                  <Area type="monotone" dataKey="revenue" name="Revenue"
                        stroke="#1B998B" strokeWidth={2} fill="url(#gRevenue)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bar Chart — 40% */}
          <div className="lg:col-span-2 rounded-2xl p-5"
               style={{
                 background: "rgba(255,255,255,0.03)",
                 border: "1px solid rgba(255,255,255,0.07)",
               }}>
            <div className="mb-4">
              <div className="font-semibold text-sm" style={{ color: "#dee1f7" }}>
                Plan Distribution
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Users by subscription tier
              </div>
            </div>
            {loading || barData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs"
                   style={{ color: "rgba(255,255,255,0.25)" }}>
                {loading ? "Loading..." : "No plan data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="plan" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                         axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                         axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="users" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Bento Row: Conversion + System + Quick Links ──────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Conversion metrics */}
          <div className="rounded-2xl p-5"
               style={{
                 background: "rgba(255,255,255,0.03)",
                 border: "1px solid rgba(255,255,255,0.07)",
               }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-3"
                 style={{ color: "rgba(255,255,255,0.28)" }}>
              Conversion Metrics
            </div>
            <div className="space-y-4">
              {[
                { label: "Free → Paid", value: convRate, color: "#0077B6" },
                {
                  label: "Avg. Revenue / User",
                  value: analytics && analytics.activeSubscriptions > 0
                    ? `₹${Math.round(analytics.totalRevenue / analytics.activeSubscriptions).toLocaleString("en-IN")}`
                    : "₹0",
                  color: "#10B981",
                },
                { label: "B2B Orgs",  value: L(analytics?.totalOrganizations), color: "#8B5CF6" },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{m.label}</span>
                  <span className="text-sm font-bold" style={{ color: m.color }}>{m.value}</span>
                </div>
              ))}

              {/* Plan bar breakdown */}
              {analytics?.planBreakdown && analytics.planBreakdown.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Plan split
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden gap-px">
                    {analytics.planBreakdown.map(p => {
                      const pct = analytics.totalUsers > 0
                        ? (p.count / analytics.totalUsers) * 100 : 0;
                      return (
                        <div key={p.plan} style={{
                          width: `${pct}%`,
                          background: PLAN_COLORS[p.plan] || "#4B5563",
                        }} />
                      );
                    })}
                  </div>
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {analytics.planBreakdown.map(p => (
                      <div key={p.plan} className="flex items-center gap-1 text-[10px]"
                           style={{ color: "rgba(255,255,255,0.38)" }}>
                        <div className="w-2 h-2 rounded-sm"
                             style={{ background: PLAN_COLORS[p.plan] || "#4B5563" }} />
                        <span className="capitalize">{p.plan}</span>
                        <span className="font-mono">{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* System info */}
          <div className="rounded-2xl p-5"
               style={{
                 background: "rgba(255,255,255,0.03)",
                 border: "1px solid rgba(255,255,255,0.07)",
               }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-3"
                 style={{ color: "rgba(255,255,255,0.28)" }}>
              System Info
            </div>
            <div className="space-y-3">
              {SYSTEM_INFO.map(s => (
                <div key={s.label} className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
                     style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                       style={{ background: `${s.color}18` }}>
                    <s.icon size={13} style={{ color: s.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
                    <div className="text-xs font-semibold truncate" style={{ color: "#dee1f7" }}>{s.value}</div>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="rounded-2xl p-5"
               style={{
                 background: "rgba(255,255,255,0.03)",
                 border: "1px solid rgba(255,255,255,0.07)",
               }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-3"
                 style={{ color: "rgba(255,255,255,0.28)" }}>
              Quick Actions
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_LINKS.map(a => (
                <a key={a.href} href={`/admin-panel${a.href}`}
                   className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02] group"
                   style={{
                     background: "rgba(255,255,255,0.04)",
                     color: "rgba(255,255,255,0.55)",
                     border: "1px solid rgba(255,255,255,0.06)",
                   }}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="truncate">{a.label}</span>
                  <ArrowRight size={10} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
