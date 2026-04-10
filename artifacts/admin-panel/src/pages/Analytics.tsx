import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { Users, Building2, CreditCard, TrendingUp, BarChart2 } from "lucide-react";

type Analytics = {
  totalUsers: number; totalOrganizations: number; activeSubscriptions: number;
  totalRevenue: number; planBreakdown: Array<{ plan: string; count: number }>;
};

const PLAN_COLORS: Record<string, string> = { free: "#6B7280", pro: "#0077B6", max: "#8B5CF6", family: "#10B981" };

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
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

export default function Analytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.analytics().then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  const maxCount = data ? Math.max(...data.planBreakdown.map(p => p.count), 1) : 1;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Platform performance aur user breakdown</p>
        </div>

        {err && <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 mb-4 text-sm">{err}</div>}

        {loading ? (
          <div className="text-muted-foreground text-sm">Loading analytics...</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Users" value={data.totalUsers.toLocaleString()} icon={Users} color="#0077B6" sub="Registered accounts" />
              <StatCard label="Organizations" value={data.totalOrganizations.toLocaleString()} icon={Building2} color="#1B998B" sub="Business accounts" />
              <StatCard label="Active Subscriptions" value={data.activeSubscriptions.toLocaleString()} icon={CreditCard} color="#8B5CF6" sub="Paid plans" />
              <StatCard label="Total Revenue" value={`₹${data.totalRevenue.toLocaleString()}`} icon={TrendingUp} color="#10B981" sub="All time" />
            </div>

            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 size={16} className="text-primary" />
                <h2 className="font-semibold text-foreground">Plan Distribution</h2>
              </div>
              <div className="space-y-4">
                {data.planBreakdown.map((p) => {
                  const pct = maxCount > 0 ? Math.round((p.count / maxCount) * 100) : 0;
                  const color = PLAN_COLORS[p.plan] || "#6B7280";
                  return (
                    <div key={p.plan}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                          <span className="text-sm font-medium text-foreground capitalize">{p.plan} Plan</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{p.count.toLocaleString()} users ({data.totalUsers > 0 ? Math.round((p.count / data.totalUsers) * 100) : 0}%)</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#0077B6]/10 to-[#1B998B]/10 border border-[#0077B6]/20 rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3">Revenue Metrics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Paid Users</div>
                  <div className="font-bold text-foreground text-lg">{(data.activeSubscriptions).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Conversion Rate</div>
                  <div className="font-bold text-foreground text-lg">{data.totalUsers > 0 ? ((data.activeSubscriptions / data.totalUsers) * 100).toFixed(1) : 0}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Avg Revenue/User</div>
                  <div className="font-bold text-foreground text-lg">₹{data.activeSubscriptions > 0 ? Math.round(data.totalRevenue / data.activeSubscriptions).toLocaleString() : 0}</div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
