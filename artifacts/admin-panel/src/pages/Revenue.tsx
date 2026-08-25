import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useChartColors } from "@/lib/chart-colors";
import { api, apiBase } from "@/lib/api";
import {
  IndianRupee, Users, TrendingUp, TrendingDown, CreditCard,
  ArrowUpRight, ArrowDownRight, RefreshCw, Receipt, Wallet,
  CheckCircle2, XCircle, Clock, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie, Legend,
} from "recharts";

type RevData = {
  summary: {
    totalRevenue: number; totalUsers: number; paidUsers: number; freeUsers: number;
    netRevenue: number; gatewayFees: number; monthlyCostINR: number; netProfit: number;
    expectedMRR: number; conversionRate: string;
  };
  planBreakdown: Array<{ plan: string; users: number; monthlyRate: number; expectedMRR: number; actualRevenue: number; transactions: number }>;
  recentPayments: Array<{ id: string; userId: string | null; plan: string; amount: number; currency: string; status: string; razorpayPaymentId: string | null; gatewayFee: number | null; createdAt: string }>;
};

const STATUS_COLOR: Record<string, string> = {
  success: "var(--chart-3)", failed: "hsl(var(--destructive))",
  pending: "var(--chart-5)", refunded: "hsl(var(--muted-foreground))",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  success: CheckCircle2, failed: XCircle, pending: Clock, refunded: AlertCircle,
};

const INR = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs space-y-1 shadow-2xl"
         style={{ background: "rgba(9,14,28,0.94)", backdropFilter: "blur(16px)", border: "1px solid hsl(var(--border))" }}>
      <div className="font-mono mb-1" style={{ color: "hsl(var(--muted-foreground))", fontSize: "10px" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill || "hsl(var(--muted-foreground))" }} />
          <span style={{ color: "hsl(var(--muted-foreground))" }}>{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color || "hsl(var(--foreground))" }}>
            {p.name?.toLowerCase().includes("user") ? p.value : `₹${Number(p.value).toLocaleString("en-IN")}`}
          </span>
        </div>
      ))}
    </div>
  );
};

function SummaryCard({
  label, value, sub, color, icon: Icon, up,
}: { label: string; value: string; sub?: string; color: string; icon: React.ElementType; up?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5"
         style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em]"
                style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `${color}18` }}>
            <Icon size={15} style={{ color }} />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>{value}</div>
        {sub && (
          <div className="flex items-center gap-1 mt-1.5 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            {up !== undefined && (up
              ? <ArrowUpRight size={11} style={{ color: "#34d399" }} />
              : <ArrowDownRight size={11} style={{ color: "#f87171" }} />)}
            <span>{sub}</span>
          </div>
        )}
      </div>
    </div>
  );
}

type RzpStatus = { ok: boolean; mode?: string; maskedKey?: string; message?: string; razorpayError?: string; networkError?: string; status?: number };

export default function Revenue() {
  const C = useChartColors();
  const [data, setData] = useState<RevData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rzp, setRzp] = useState<RzpStatus | null>(null);

  const load = () => {
    setLoading(true); setErr("");
    api.revenue()
      .then(setData)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch(`${apiBase}/payment/razorpay-test`)
      .then(async r => {
        const text = await r.text();
        return JSON.parse(text) as RzpStatus;
      })
      .then((d: RzpStatus) => setRzp(d))
      .catch((err) => setRzp({ ok: false, networkError: err?.message || "Cannot reach API" }));
  }, []);

  const s = data?.summary;
  const pieData = data?.planBreakdown.filter(p => p.users > 0).map(p => ({
    name: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    value: p.users,
    color: C.plan[p.plan] || C.neutral,
  })) ?? [];

  const barData = data?.planBreakdown.filter(p => p.plan !== "free").map(p => ({
    plan: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    "Expected MRR": p.expectedMRR,
    "Actual Revenue": p.actualRevenue,
    color: C.plan[p.plan],
  })) ?? [];

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-1.5" style={{ color: C.series[0] }}>
              Financial Intelligence
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>Revenue & Business</h1>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                  style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {err && (
          <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
            {err}
          </div>
        )}

        {/* ── Razorpay Gateway Status ──────────────────────────────── */}
        {rzp && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
               style={{
                 background: rzp.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                 border: `1px solid ${rzp.ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
               }}>
            <div className={`w-2 h-2 rounded-full ${rzp.ok ? "bg-green-400" : "bg-red-400"}`} style={{ boxShadow: `0 0 6px ${rzp.ok ? "#34d399" : "#f87171"}` }} />
            <span style={{ color: rzp.ok ? "#34d399" : "#f87171", fontWeight: 600 }}>
              Razorpay Gateway: {rzp.ok ? "✅ LIVE — Auth Successful" : "❌ Error"}
            </span>
            {rzp.maskedKey && (
              <span className="font-mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>({rzp.maskedKey})</span>
            )}
            {rzp.mode && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: rzp.mode === "LIVE" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: rzp.mode === "LIVE" ? "#34d399" : "#fbbf24" }}>
                {rzp.mode} MODE
              </span>
            )}
            {(rzp.razorpayError || rzp.networkError) && (
              <span className="ml-2 text-xs" style={{ color: "#f87171" }}>
                {rzp.razorpayError || rzp.networkError}
              </span>
            )}
          </div>
        )}

        {/* ── Summary Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Revenue" icon={IndianRupee} color={C.series[2]}
            value={loading ? "..." : INR(s?.totalRevenue ?? 0)}
            sub="All-time collected" up />
          <SummaryCard label="Expected MRR" icon={TrendingUp} color={C.series[0]}
            value={loading ? "..." : INR(s?.expectedMRR ?? 0)}
            sub="If all users pay" up />
          <SummaryCard label="Paid Users" icon={CreditCard} color={C.series[4]}
            value={loading ? "..." : (s?.paidUsers ?? 0).toLocaleString("en-IN")}
            sub={`${s?.conversionRate ?? "0"}% conversion`} up />
          <SummaryCard label="Free Users" icon={Users} color={C.series[3]}
            value={loading ? "..." : (s?.freeUsers ?? 0).toLocaleString("en-IN")}
            sub="Not yet paid" />
        </div>

        {/* ── Profit / Loss Banner ──────────────────────────────── */}
        {!loading && s && (
          <div className="rounded-2xl p-5 relative overflow-hidden"
               style={{
                 background: s.netProfit >= 0
                   ? "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(255,145,77,0.05) 100%)"
                   : "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(245,158,11,0.05) 100%)",
                 border: `1px solid ${s.netProfit >= 0 ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)"}`,
               }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Total Revenue</div>
                <div className="text-xl font-bold" style={{ color: "#34d399" }}>{INR(s.totalRevenue)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Monthly Cost</div>
                <div className="text-xl font-bold" style={{ color: "#f87171" }}>–{INR(s.monthlyCostINR)}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>$87/mo @ ₹84</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Gateway Fees</div>
                <div className="text-xl font-bold" style={{ color: "#fbbf24" }}>–{INR(s.gatewayFees)}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Razorpay 2%</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Net P&L</div>
                <div className="text-xl font-bold" style={{ color: s.netProfit >= 0 ? "#34d399" : "#f87171" }}>
                  {s.netProfit >= 0 ? "+" : "–"}{INR(s.netProfit)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {s.netProfit >= 0 ? "Profitable" : "Need more paid users"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Charts Row ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Plan Revenue Bar Chart */}
          <div className="rounded-2xl p-5" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
            <div className="mb-4">
              <div className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>Expected vs Actual Revenue</div>
              <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>By paid plan (INR)</div>
            </div>
            {loading || barData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {loading ? "Loading..." : "No paid subscriptions yet"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="plan" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Expected MRR" fill="var(--chart-1)20" stroke={C.series[0]} strokeWidth={1} radius={[4,4,0,0]} />
                  <Bar dataKey="Actual Revenue" radius={[4,4,0,0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* User Distribution Pie */}
          <div className="rounded-2xl p-5" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
            <div className="mb-4">
              <div className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>User Distribution</div>
              <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Paid vs Free breakdown</div>
            </div>
            {loading || pieData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {loading ? "Loading..." : "No data"}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius="50%" outerRadius="78%" paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {pieData.map(p => {
                    const pct = s && s.totalUsers > 0 ? Math.round((p.value / s.totalUsers) * 100) : 0;
                    return (
                      <div key={p.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                            <span className="text-xs capitalize" style={{ color: "hsl(var(--muted-foreground))" }}>{p.name}</span>
                          </div>
                          <span className="text-xs font-mono font-bold" style={{ color: p.color }}>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{p.value} users</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Plan Breakdown Table ──────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <div className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>Plan Breakdown</div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Users per plan — expected & actual revenue</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  {["Plan", "Users", "Price/mo", "Expected MRR", "Actual Collected", "Transactions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-mono uppercase tracking-widest"
                        style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-3"><div className="h-4 rounded animate-pulse" style={{ background: "hsl(var(--muted))" }} /></td>
                      ))}
                    </tr>
                  ))
                ) : (data?.planBreakdown.sort((a, b) => b.monthlyRate - a.monthlyRate) ?? []).map(p => (
                  <tr key={p.plan} className="transition-colors hover:bg-muted/50"
                      style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
                            style={{ background: `${C.plan[p.plan] || C.neutral}18`, color: C.plan[p.plan] || C.neutral }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.plan[p.plan] }} />
                        {p.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold" style={{ color: "hsl(var(--foreground))" }}>{p.users.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {p.monthlyRate > 0 ? INR(p.monthlyRate) + "/mo" : "Free"}
                    </td>
                    <td className="px-5 py-3 font-semibold" style={{ color: p.monthlyRate > 0 ? C.series[0] : "hsl(var(--muted-foreground))" }}>
                      {p.expectedMRR > 0 ? INR(p.expectedMRR) : "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold" style={{ color: p.actualRevenue > 0 ? C.series[2] : "hsl(var(--muted-foreground))" }}>
                      {p.actualRevenue > 0 ? INR(p.actualRevenue) : "—"}
                    </td>
                    <td className="px-5 py-3" style={{ color: "hsl(var(--muted-foreground))" }}>{p.transactions}</td>
                  </tr>
                ))}
                {/* Total row */}
                {!loading && s && (
                  <tr style={{ background: "rgba(255,145,77,0.05)", borderTop: "1px solid rgba(255,145,77,0.15)" }}>
                    <td className="px-5 py-3 font-bold text-xs font-mono uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>TOTAL</td>
                    <td className="px-5 py-3 font-bold" style={{ color: "hsl(var(--foreground))" }}>{s.totalUsers.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 font-bold" style={{ color: C.series[0] }}>{INR(s.expectedMRR)}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: C.series[2] }}>{INR(s.totalRevenue)}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: "hsl(var(--foreground))" }}>
                      {data?.recentPayments?.length ?? 0}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent Transactions ───────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <div>
              <div className="flex items-center gap-2">
                <Receipt size={15} style={{ color: C.series[0] }} />
                <span className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>Payment Transactions</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                {data?.recentPayments?.length ?? 0} recent transactions via Razorpay
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                 style={{ background: "rgba(255,145,77,0.1)", border: "1px solid rgba(255,145,77,0.18)", color: C.series[0] }}>
              <Wallet size={11} />
              Razorpay
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading transactions...</div>
          ) : !data?.recentPayments?.length ? (
            <div className="p-12 text-center">
              <Receipt size={36} className="mx-auto mb-3" style={{ color: "hsl(var(--muted-foreground))" }} />
              <div className="text-sm font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>No transactions yet</div>
              <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Transactions will appear here when users make payments</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    {["Date", "User ID", "Plan", "Amount", "Gateway Fee", "Status", "Razorpay ID"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-mono uppercase tracking-widest"
                          style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayments.map((p) => {
                    const StatusIcon = STATUS_ICON[p.status] || Clock;
                    const statusColor = STATUS_COLOR[p.status] || "#6B7280";
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-muted/50"
                          style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                        <td className="px-5 py-3 text-xs font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {p.userId ? p.userId.slice(0, 8) + "..." : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                                style={{ background: `${C.plan[p.plan] || C.neutral}18`, color: C.plan[p.plan] || C.neutral }}>
                            {p.plan}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold" style={{ color: "#34d399" }}>{INR(p.amount)}</td>
                        <td className="px-5 py-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {p.gatewayFee != null ? INR(p.gatewayFee) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: statusColor }}>
                            <StatusIcon size={12} />
                            <span className="capitalize">{p.status}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {p.razorpayPaymentId || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Breakeven Notice ─────────────────────────────────── */}
        {!loading && s && (
          <div className="rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4"
               style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                Breakeven @ Pro ₹199
              </div>
              <div className="text-2xl font-bold" style={{ color: C.series[0] }}>
                {Math.ceil(s.monthlyCostINR / 199)} paid users
              </div>
              <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>needed every month</div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                Current Paid Users
              </div>
              <div className="text-2xl font-bold" style={{ color: s.paidUsers >= Math.ceil(s.monthlyCostINR / 199) ? "#34d399" : "#f87171" }}>
                {s.paidUsers}
              </div>
              <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                {s.paidUsers >= Math.ceil(s.monthlyCostINR / 199) ? "✅ Above breakeven!" : `Need ${Math.ceil(s.monthlyCostINR / 199) - s.paidUsers} more`}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                Conversion Rate
              </div>
              <div className="text-2xl font-bold" style={{ color: C.series[4] }}>{s.conversionRate}%</div>
              <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Free → Paid conversion</div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
