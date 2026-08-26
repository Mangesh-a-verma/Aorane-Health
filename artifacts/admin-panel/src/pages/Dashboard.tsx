import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useChartColors } from "@/lib/chart-colors";
import {
  Users, Building2, CreditCard, IndianRupee,
  Activity, Database, ShieldCheck, Zap, Brain, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

type Overview = {
  totalUsers: number;
  totalOrganizations: number;
  activeSubscriptions: number;
  totalBloodRequests: number;
  totalRevenue: number;
  monthRevenue: number;
  newUsersToday: number;
  newUsersThisMonth: number;
  planBreakdown: Array<{ plan: string; count: number }>;
  dailyGrowth: Array<{ date: string; newUsers: number; revenue: number }>;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];


function fmtDay(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs space-y-1 shadow-2xl neu-flat">
      <div className="font-mono mb-1 text-muted-foreground" style={{ fontSize: "10px" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-foreground">{p.name || p.dataKey}:</span>
          <span className="font-semibold" style={{ color: p.color || p.fill }}>
            {p.dataKey === "revenue" ? `₹${Number(p.value).toLocaleString("en-IN")}` : Number(p.value).toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
};

const SYSTEM_INFO = [
  { label: "API Version",  value: "v2.0.0",       icon: Zap,         color: "var(--chart-4)" },
  { label: "API Status",   value: "Healthy",       icon: Activity,    color: "var(--chart-3)" },
  { label: "Database",     value: "PostgreSQL",    icon: Database,    color: "var(--chart-1)" },
  { label: "Auth System",  value: "JWT",           icon: ShieldCheck, color: "var(--chart-5)" },
];

const QUICK_LINKS = [
  { href: "/users",         label: "Manage Users",   color: "var(--chart-1)" },
  { href: "/analytics",     label: "Analytics",      color: "var(--chart-4)" },
  { href: "/ads",           label: "Ads Manager",    color: "var(--chart-5)" },
  { href: "/feature-flags", label: "Feature Flags",  color: "var(--chart-3)" },
  { href: "/food-items",    label: "Food Database",  color: "hsl(var(--destructive))" },
  { href: "/subscriptions", label: "Subscriptions",  color: "var(--chart-2)" },
  { href: "/promo-codes",   label: "Promo Codes",    color: "var(--chart-6)" },
  { href: "/audit-logs",    label: "Audit Logs",     color: "var(--chart-2)" },
];

export default function Dashboard() {
  const C = useChartColors();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.overview().then(r => setData(r.stats)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const L = (n?: number) => loading ? "..." : (n ?? 0).toLocaleString("en-IN");
  const areaData = (data?.dailyGrowth ?? []).map(d => ({ date: fmtDay(d.date), users: d.newUsers, revenue: d.revenue }));
  const barData  = (data?.planBreakdown ?? []).map(p => ({
    plan: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    users: p.count,
    color: C.plan[p.plan] || C.neutral,
  }));

  const convRate = data && data.totalUsers > 0
    ? ((data.activeSubscriptions / data.totalUsers) * 100).toFixed(1) + "%"
    : "0.0%";
  const arpu = data && data.activeSubscriptions > 0
    ? `₹${Math.round(data.totalRevenue / data.activeSubscriptions).toLocaleString("en-IN")}`
    : "₹0";

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-5">

        {/* ── Page header ──────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-1.5 text-primary">
              Platform Overview
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs tone-brand">
            <Brain size={12} />
            Aorane AI · Active
          </div>
        </div>

        {/* ── System health banner ─────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl px-6 py-4 neu-flat">
          <div className="absolute -top-8 right-0 w-48 h-48 rounded-full pointer-events-none"
               style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--brand-orange) 8%, transparent) 0%, transparent 70%)" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase mb-1 text-muted-foreground">Platform Health</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.series[2] }} />
                <span className="font-semibold text-sm text-foreground">All Systems Operational</span>
              </div>
              <div className="text-xs mt-1 text-muted-foreground">
                API Server · PostgreSQL DB · Mobile App · Business Portal
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs">
              {["API", "DB", "Mobile", "Portal"].map(s => (
                <div key={s} className="flex items-center gap-1.5" style={{ color: C.series[2] }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.series[2] }} />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Progressive disclosure: one hero metric + compact secondary strip ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">

          {/* Hero: Total Revenue — the number that matters most, with a real spark of the last 7 days */}
          <div className="relative overflow-hidden rounded-[22px] p-6 neu">
            <div className="absolute -top-5 -right-5 w-40 h-40 rounded-full pointer-events-none"
                 style={{ background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)" }} />
            <div className="relative flex items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                    <IndianRupee size={13} style={{ color: C.series[4] }} />
                  </div>
                  <span className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Total Revenue</span>
                </div>
                <div className="text-[2.6rem] leading-none font-bold tracking-tight text-foreground">
                  {loading ? "…" : `₹${(data?.totalRevenue ?? 0).toLocaleString("en-IN")}`}
                </div>
                <div className="text-xs mt-2.5 text-muted-foreground">
                  ₹{L(data?.monthRevenue)} in the last 30 days · {arpu} avg. per subscriber
                </div>
              </div>
              {!loading && areaData.length > 1 && (
                <ResponsiveContainer width={140} height={56} className="shrink-0 mt-1.5 hidden sm:block">
                  <AreaChart data={areaData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gHero" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.series[4]} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={C.series[4]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="revenue" stroke={C.series[4]} strokeWidth={2} fill="url(#gHero)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Secondary strip: compact, lower visual weight */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl neu-inset-sm">
              <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 tone-brand">
                <Users size={13} />
              </div>
              <span className="flex-1 text-[11.5px] text-muted-foreground">Total Users</span>
              <span className="text-sm font-bold text-foreground">{L(data?.totalUsers)}</span>
              <span className="text-[10px] font-medium text-muted-foreground">+{L(data?.newUsersToday)} today</span>
            </div>
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl neu-inset-sm">
              <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 tone-purple">
                <Building2 size={13} />
              </div>
              <span className="flex-1 text-[11.5px] text-muted-foreground">Organizations</span>
              <span className="text-sm font-bold text-foreground">{L(data?.totalOrganizations)}</span>
            </div>
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl neu-inset-sm">
              <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 tone-success">
                <CreditCard size={13} />
              </div>
              <span className="flex-1 text-[11.5px] text-muted-foreground">Subscriptions</span>
              <span className="text-sm font-bold text-foreground">{L(data?.activeSubscriptions)}</span>
              <span className="text-[10px] font-medium text-muted-foreground">{convRate} of users</span>
            </div>
          </div>
        </div>

        <div className="font-mono text-[9.5px] font-bold tracking-[0.18em] uppercase text-muted-foreground pt-1">Details</div>

        {/* ── Charts row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          <div className="lg:col-span-3 rounded-2xl p-5 neu-flat">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-sm text-foreground">User Growth</div>
                <div className="text-xs mt-0.5 text-muted-foreground">New registrations · last 7 days</div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: C.series[0] }} />Users</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: C.series[2] }} />Revenue</div>
              </div>
            </div>
            {loading ? (
              <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={areaData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.series[0]} stopOpacity={0.32} />
                      <stop offset="95%" stopColor={C.series[0]} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.series[2]} stopOpacity={0.26} />
                      <stop offset="95%" stopColor={C.series[2]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="users"   name="Users"   stroke={C.series[0]} strokeWidth={2} fill="url(#gUsers)" dot={false} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.series[2]} strokeWidth={2} fill="url(#gRevenue)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl p-5 neu-flat">
            <div className="mb-4">
              <div className="font-semibold text-sm text-foreground">Plan Distribution</div>
              <div className="text-xs mt-0.5 text-muted-foreground">Users by subscription tier</div>
            </div>
            {loading || barData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
                {loading ? "Loading…" : "No plan data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="plan" tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="users" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Bento row: Conversion + System + Quick Links ──────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <div className="rounded-2xl p-5 neu-flat">
            <div className="text-[10px] font-mono uppercase tracking-widest mb-3 text-muted-foreground">Conversion Metrics</div>
            <div className="space-y-4">
              {[
                { label: "Free → Paid",         value: convRate, color: C.series[0] },
                { label: "Avg. Revenue / User", value: arpu,      color: C.series[2] },
                { label: "B2B Organizations",   value: L(data?.totalOrganizations), color: "var(--chart-4)" },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <span className="text-sm font-bold" style={{ color: m.color }}>{m.value}</span>
                </div>
              ))}

              {data?.planBreakdown && data.planBreakdown.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono mb-2 text-muted-foreground">Plan split</div>
                  <div className="flex h-2 rounded-full overflow-hidden gap-px">
                    {data.planBreakdown.map(p => {
                      const pct = data.totalUsers > 0 ? (p.count / data.totalUsers) * 100 : 0;
                      return <div key={p.plan} style={{ width: `${pct}%`, background: C.plan[p.plan] || C.neutral }} />;
                    })}
                  </div>
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {data.planBreakdown.map(p => (
                      <div key={p.plan} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <div className="w-2 h-2 rounded-sm" style={{ background: C.plan[p.plan] || C.neutral }} />
                        <span className="capitalize">{p.plan}</span>
                        <span className="font-mono">{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-5 neu-flat">
            <div className="text-[10px] font-mono uppercase tracking-widest mb-3 text-muted-foreground">System Info</div>
            <div className="space-y-3">
              {SYSTEM_INFO.map(s => (
                <div key={s.label} className="flex items-center gap-3 p-2.5 rounded-xl neu-inset-sm">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}18` }}>
                    <s.icon size={13} style={{ color: s.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-xs font-semibold truncate text-foreground">{s.value}</div>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.series[2] }} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5 neu-flat">
            <div className="text-[10px] font-mono uppercase tracking-widest mb-3 text-muted-foreground">Quick Actions</div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_LINKS.map(a => (
                <Link key={a.href} href={a.href}
                   className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02] group cursor-pointer neu-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="truncate">{a.label}</span>
                  <ArrowRight size={10} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
