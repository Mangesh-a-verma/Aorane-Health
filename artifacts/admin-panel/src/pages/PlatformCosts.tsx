import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { DollarSign, Server, Users, TrendingDown } from "lucide-react";

type Cost = { category: string; monthlyUSD: number; description: string };
type CostData = { costs: Cost[]; totalMonthlyUSD: number; totalMonthlyINR: number; userCount: number; costPerUser: number };

const CATEGORY_COLORS: Record<string, string> = {
  "Supabase DB": "#0077B6",
  "API Server (Render)": "#10B981",
  "Gemini AI API": "#8B5CF6",
  "SMS OTP (Fast2SMS)": "#F59E0B",
  "Expo / EAS Build": "#EC4899",
  "Domain & SSL": "#6B7280",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  "Supabase DB": "🗄️",
  "API Server (Render)": "⚡",
  "Gemini AI API": "🤖",
  "SMS OTP (Fast2SMS)": "📱",
  "Expo / EAS Build": "📦",
  "Domain & SSL": "🌐",
};

export default function PlatformCosts() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.platformCosts().then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  const INR_RATE = 84;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Platform Costs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Monthly infrastructure aur service costs</p>
        </div>

        {err && <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 mb-4 text-sm">{err}</div>}

        {loading ? (
          <div className="text-muted-foreground text-sm">Loading cost data...</div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-muted-foreground text-sm">Monthly Cost (USD)</span>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0077B6]/12">
                    <DollarSign size={17} className="text-[#0077B6]" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground">${data.totalMonthlyUSD}</div>
                <div className="text-xs text-muted-foreground mt-1">Per month</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-muted-foreground text-sm">Monthly Cost (INR)</span>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#10B981]/12">
                    <span className="text-sm font-bold" style={{ color: "#10B981" }}>₹</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground">₹{data.totalMonthlyINR.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">@ ₹{INR_RATE}/USD</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-muted-foreground text-sm">Total Users</span>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#8B5CF6]/12">
                    <Users size={17} className="text-[#8B5CF6]" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground">{data.userCount.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Registered accounts</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-muted-foreground text-sm">Cost Per User</span>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F59E0B]/12">
                    <TrendingDown size={17} className="text-[#F59E0B]" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground">${data.costPerUser}</div>
                <div className="text-xs text-muted-foreground mt-1">Per user/month</div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-5">
                <Server size={16} className="text-primary" />
                <h2 className="font-semibold text-foreground">Cost Breakdown</h2>
              </div>
              <div className="space-y-3">
                {data.costs.map((cost, i) => {
                  const color = CATEGORY_COLORS[cost.category] || "#6B7280";
                  const emoji = CATEGORY_EMOJIS[cost.category] || "💻";
                  const pct = Math.round((cost.monthlyUSD / data.totalMonthlyUSD) * 100);
                  return (
                    <div key={i} className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                        {emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground text-sm">{cost.category}</span>
                          <span className="font-bold text-foreground text-sm">${cost.monthlyUSD}/mo</span>
                        </div>
                        <div className="text-muted-foreground text-xs mb-2">{cost.description}</div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                      <div className="text-muted-foreground text-xs w-10 text-right">{pct}%</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                <div className="font-semibold text-foreground">Total Monthly Cost</div>
                <div className="text-right">
                  <div className="font-bold text-xl text-foreground">${data.totalMonthlyUSD}/mo</div>
                  <div className="text-muted-foreground text-xs">≈ ₹{data.totalMonthlyINR.toLocaleString()}/mo</div>
                </div>
              </div>
            </div>

            {/* Breakeven Analysis */}
            <div className="bg-gradient-to-r from-[#10B981]/10 to-[#0077B6]/10 border border-[#10B981]/20 rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3">Breakeven Analysis</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Pro Plan (₹199/mo)</div>
                  <div className="font-bold text-foreground">{Math.ceil(data.totalMonthlyINR / 199)} users</div>
                  <div className="text-xs text-muted-foreground">to breakeven</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Max Plan (₹249/mo)</div>
                  <div className="font-bold text-foreground">{Math.ceil(data.totalMonthlyINR / 249)} users</div>
                  <div className="text-xs text-muted-foreground">to breakeven</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Current Users</div>
                  <div className="font-bold text-foreground">{data.userCount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">registered</div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
