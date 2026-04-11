import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { Users, Building2, Activity, Database, ShieldCheck, Zap, CreditCard, TrendingUp, IndianRupee, BarChart2 } from "lucide-react";

function StatBox({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/25 transition-all">
      <div className="flex items-start justify-between mb-3">
        <span className="text-muted-foreground text-sm">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={17} style={{ color }} />
        </div>
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const INFO_CARDS = [
  { label: "Platform Version", value: "v2.0.0", icon: Zap, color: "#8B5CF6" },
  { label: "API Status", value: "Healthy", icon: Activity, color: "#10B981" },
  { label: "Database", value: "PostgreSQL", icon: Database, color: "#0077B6" },
  { label: "Auth", value: "JWT + OTP", icon: ShieldCheck, color: "#F59E0B" },
];

type Analytics = {
  totalUsers: number;
  totalOrganizations: number;
  activeSubscriptions: number;
  totalRevenue: number;
  planBreakdown: Array<{ plan: string; count: number }>;
};

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics().then(setAnalytics).catch(console.error).finally(() => setLoading(false));
  }, []);

  const L = (n: number | undefined) => loading ? "..." : (n ?? 0).toLocaleString("en-IN");

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Platform Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Real-time platform overview</p>
        </div>

        {/* Hero banner */}
        <div className="bg-gradient-to-r from-[#0A1628] to-[#0D2035] border border-white/8 rounded-2xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-[#0077B6]/20 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-[#1B998B]/15 rounded-full blur-xl" />
          </div>
          <div className="relative">
            <div className="text-white/40 text-xs font-mono mb-2 uppercase tracking-widest">Platform Health</div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white font-bold text-lg">All Systems Operational</span>
            </div>
            <p className="text-white/40 text-sm">API Server · Database · Mobile App · Business Portal</p>
          </div>
        </div>

        {/* Main stats — 2 rows */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatBox label="Total Users" value={L(analytics?.totalUsers)} icon={Users} color="#0077B6" sub="Registered accounts" />
          <StatBox label="Organizations" value={L(analytics?.totalOrganizations)} icon={Building2} color="#1B998B" sub="Business accounts" />
          <StatBox label="Active Subscriptions" value={L(analytics?.activeSubscriptions)} icon={CreditCard} color="#8B5CF6" sub="Paid plans" />
          <StatBox label="Total Revenue" value={`₹${loading ? "..." : (analytics?.totalRevenue ?? 0).toLocaleString("en-IN")}`} icon={IndianRupee} color="#10B981" sub="All time" />
        </div>

        {/* Plan breakdown */}
        {analytics?.planBreakdown && analytics.planBreakdown.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={15} className="text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">Plan Distribution</h2>
            </div>
            <div className="flex gap-4 flex-wrap">
              {analytics.planBreakdown.map((p) => {
                const pct = analytics.totalUsers > 0 ? Math.round((p.count / analytics.totalUsers) * 100) : 0;
                const colors: Record<string, string> = { free: "#6B7280", pro: "#0077B6", max: "#8B5CF6", family: "#10B981" };
                return (
                  <div key={p.plan} className="flex-1 min-w-[100px]">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize font-medium text-foreground">{p.plan}</span>
                      <span className="text-muted-foreground">{p.count.toLocaleString("en-IN")} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors[p.plan] || "#6B7280" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {INFO_CARDS.map((c) => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-4">
              <c.icon size={16} style={{ color: c.color }} className="mb-2" />
              <div className="text-foreground font-semibold text-sm">{c.value}</div>
              <div className="text-muted-foreground text-xs mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 text-sm">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { href: "/users", label: "Manage Users", color: "#0077B6" },
              { href: "/analytics", label: "Analytics", color: "#8B5CF6" },
              { href: "/ads", label: "Ads Manager", color: "#F59E0B" },
              { href: "/feature-flags", label: "Feature Flags", color: "#10B981" },
              { href: "/food-database", label: "Food Database", color: "#EF4444" },
              { href: "/subscriptions", label: "Subscriptions", color: "#6B7280" },
              { href: "/promo-codes", label: "Promo Codes", color: "#EC4899" },
              { href: "/audit-logs", label: "Audit Logs", color: "#0EA5E9" },
            ].map((a) => (
              <a key={a.href} href={`/admin-panel${a.href}`}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all text-sm text-muted-foreground hover:text-foreground">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                {a.label}
              </a>
            ))}
          </div>
        </div>

        {/* Conversion stats */}
        {analytics && (
          <div className="mt-4 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">Conversion Rate</h2>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <span className="text-2xl font-bold text-foreground">
                  {analytics.totalUsers > 0 ? ((analytics.activeSubscriptions / analytics.totalUsers) * 100).toFixed(1) : "0.0"}%
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">Free → Paid</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <span className="text-2xl font-bold text-foreground">
                  {analytics.totalOrganizations > 0 ? analytics.totalOrganizations : "0"}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">B2B Organisations</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <span className="text-2xl font-bold text-foreground">
                  ₹{analytics.activeSubscriptions > 0 && analytics.totalRevenue > 0
                    ? Math.round(analytics.totalRevenue / analytics.activeSubscriptions).toLocaleString("en-IN")
                    : "0"}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">Avg. Revenue Per User</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
