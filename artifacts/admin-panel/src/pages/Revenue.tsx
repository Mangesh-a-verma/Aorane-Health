import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
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

const PLAN_COLORS: Record<string, string> = {
  free: "#4B5563", pro: "#0077B6", max: "#F59E0B", family: "#8B5CF6",
};
const STATUS_COLOR: Record<string, string> = {
  success: "#10B981", failed: "#EF4444", pending: "#F59E0B", refunded: "#6B7280",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  success: CheckCircle2, failed: XCircle, pending: Clock, refunded: AlertCircle,
};

const INR = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs space-y-1 shadow-2xl"
         style={{ background: "rgba(9,14,28,0.94)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.09)" }}>
      <div className="font-mono mb-1" style={{ color: "rgba(255,255,255,0.38)", fontSize: "10px" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill || "#0077B6" }} />
          <span style={{ color: "#bfc7d1" }}>{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color || "#94ccff" }}>
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
         style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em]"
                style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `${color}18` }}>
            <Icon size={15} style={{ color }} />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight" style={{ color: "#dee1f7" }}>{value}</div>
        {sub && (
          <div className="flex items-center gap-1 mt-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
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

export default function Revenue() {
  const [data, setData] = useState<RevData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = () => {
    setLoading(true); setErr("");
    api.revenue()
      .then(setData)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const s = data?.summary;
  const pieData = data?.planBreakdown.filter(p => p.users > 0).map(p => ({
    name: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    value: p.users,
    color: PLAN_COLORS[p.plan] || "#4B5563",
  })) ?? [];

  const barData = data?.planBreakdown.filter(p => p.plan !== "free").map(p => ({
    plan: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    "Expected MRR": p.expectedMRR,
    "Actual Revenue": p.actualRevenue,
    color: PLAN_COLORS[p.plan],
  })) ?? [];

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-1.5" style={{ color: "#0077B6" }}>
              Financial Intelligence
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#dee1f7" }}>Revenue & Business</h1>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {err && (
          <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
            {err}
          </div>
        )}

        {/* ── Summary Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Revenue" icon={IndianRupee} color="#10B981"
            value={loading ? "..." : INR(s?.totalRevenue ?? 0)}
            sub="All-time collected" up />
          <SummaryCard label="Expected MRR" icon={TrendingUp} color="#0077B6"
            value={loading ? "..." : INR(s?.expectedMRR ?? 0)}
            sub="If all users pay" up />
          <SummaryCard label="Paid Users" icon={CreditCard} color="#F59E0B"
            value={loading ? "..." : (s?.paidUsers ?? 0).toLocaleString("en-IN")}
            sub={`${s?.conversionRate ?? "0"}% conversion`} up />
          <SummaryCard label="Free Users" icon={Users} color="#8B5CF6"
            value={loading ? "..." : (s?.freeUsers ?? 0).toLocaleString("en-IN")}
            sub="Not yet paid" />
        </div>

        {/* ── Profit / Loss Banner ──────────────────────────────── */}
        {!loading && s && (
          <div className="rounded-2xl p-5 relative overflow-hidden"
               style={{
                 background: s.netProfit >= 0
                   ? "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(0,119,182,0.05) 100%)"
                   : "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(245,158,11,0.05) 100%)",
                 border: `1px solid ${s.netProfit >= 0 ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)"}`,
               }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Total Revenue</div>
                <div className="text-xl font-bold" style={{ color: "#34d399" }}>{INR(s.totalRevenue)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Monthly Cost</div>
                <div className="text-xl font-bold" style={{ color: "#f87171" }}>–{INR(s.monthlyCostINR)}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>$87/mo @ ₹84</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Gateway Fees</div>
                <div className="text-xl font-bold" style={{ color: "#fbbf24" }}>–{INR(s.gatewayFees)}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>Razorpay 2%</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Net P&L</div>
                <div className="text-xl font-bold" style={{ color: s.netProfit >= 0 ? "#34d399" : "#f87171" }}>
                  {s.netProfit >= 0 ? "+" : "–"}{INR(s.netProfit)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>
                  {s.netProfit >= 0 ? "Profitable" : "Need more paid users"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Charts Row ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Plan Revenue Bar Chart */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="mb-4">
              <div className="font-semibold text-sm" style={{ color: "#dee1f7" }}>Expected vs Actual Revenue</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>By paid plan (INR)</div>
            </div>
            {loading || barData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                {loading ? "Loading..." : "No paid subscriptions yet"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="plan" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Expected MRR" fill="#0077B620" stroke="#0077B6" strokeWidth={1} radius={[4,4,0,0]} />
                  <Bar dataKey="Actual Revenue" radius={[4,4,0,0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* User Distribution Pie */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="mb-4">
              <div className="font-semibold text-sm" style={{ color: "#dee1f7" }}>User Distribution</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Paid vs Free breakdown</div>
            </div>
            {loading || pieData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
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
                            <span className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.55)" }}>{p.name}</span>
                          </div>
                          <span className="text-xs font-mono font-bold" style={{ color: p.color }}>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{p.value} users</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Plan Breakdown Table ──────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="font-semibold text-sm" style={{ color: "#dee1f7" }}>Plan Breakdown</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Users per plan — expected & actual revenue</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {["Plan", "Users", "Price/mo", "Expected MRR", "Actual Collected", "Transactions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-mono uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.28)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-3"><div className="h-4 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} /></td>
                      ))}
                    </tr>
                  ))
                ) : (data?.planBreakdown.sort((a, b) => b.monthlyRate - a.monthlyRate) ?? []).map(p => (
                  <tr key={p.plan} className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
                            style={{ background: `${PLAN_COLORS[p.plan] || "#4B5563"}18`, color: PLAN_COLORS[p.plan] || "#4B5563" }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: PLAN_COLORS[p.plan] }} />
                        {p.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold" style={{ color: "#dee1f7" }}>{p.users.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {p.monthlyRate > 0 ? INR(p.monthlyRate) + "/mo" : "Free"}
                    </td>
                    <td className="px-5 py-3 font-semibold" style={{ color: p.monthlyRate > 0 ? "#0077B6" : "rgba(255,255,255,0.3)" }}>
                      {p.expectedMRR > 0 ? INR(p.expectedMRR) : "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold" style={{ color: p.actualRevenue > 0 ? "#10B981" : "rgba(255,255,255,0.3)" }}>
                      {p.actualRevenue > 0 ? INR(p.actualRevenue) : "—"}
                    </td>
                    <td className="px-5 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>{p.transactions}</td>
                  </tr>
                ))}
                {/* Total row */}
                {!loading && s && (
                  <tr style={{ background: "rgba(0,119,182,0.05)", borderTop: "1px solid rgba(0,119,182,0.15)" }}>
                    <td className="px-5 py-3 font-bold text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>TOTAL</td>
                    <td className="px-5 py-3 font-bold" style={{ color: "#dee1f7" }}>{s.totalUsers.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 font-bold" style={{ color: "#0077B6" }}>{INR(s.expectedMRR)}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: "#10B981" }}>{INR(s.totalRevenue)}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: "#dee1f7" }}>
                      {data?.recentPayments?.length ?? 0}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent Transactions ───────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <div className="flex items-center gap-2">
                <Receipt size={15} style={{ color: "#0077B6" }} />
                <span className="font-semibold text-sm" style={{ color: "#dee1f7" }}>Payment Transactions</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                {data?.recentPayments?.length ?? 0} recent transactions via Razorpay
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                 style={{ background: "rgba(0,119,182,0.1)", border: "1px solid rgba(0,119,182,0.18)", color: "#94ccff" }}>
              <Wallet size={11} />
              Razorpay
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading transactions...</div>
          ) : !data?.recentPayments?.length ? (
            <div className="p-12 text-center">
              <Receipt size={36} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
              <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Koi transactions nahi abhi tak</div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Jab users pay karenge, yahan dikhega</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {["Date", "User ID", "Plan", "Amount", "Gateway Fee", "Status", "Razorpay ID"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-mono uppercase tracking-widest"
                          style={{ color: "rgba(255,255,255,0.28)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayments.map((p) => {
                    const StatusIcon = STATUS_ICON[p.status] || Clock;
                    const statusColor = STATUS_COLOR[p.status] || "#6B7280";
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-white/[0.02]"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-5 py-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                            {p.userId ? p.userId.slice(0, 8) + "..." : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                                style={{ background: `${PLAN_COLORS[p.plan] || "#4B5563"}18`, color: PLAN_COLORS[p.plan] || "#4B5563" }}>
                            {p.plan}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold" style={{ color: "#34d399" }}>{INR(p.amount)}</td>
                        <td className="px-5 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {p.gatewayFee != null ? INR(p.gatewayFee) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: statusColor }}>
                            <StatusIcon size={12} />
                            <span className="capitalize">{p.status}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
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
               style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                Breakeven @ Pro ₹199
              </div>
              <div className="text-2xl font-bold" style={{ color: "#0077B6" }}>
                {Math.ceil(s.monthlyCostINR / 199)} paid users
              </div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>needed every month</div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                Current Paid Users
              </div>
              <div className="text-2xl font-bold" style={{ color: s.paidUsers >= Math.ceil(s.monthlyCostINR / 199) ? "#34d399" : "#f87171" }}>
                {s.paidUsers}
              </div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                {s.paidUsers >= Math.ceil(s.monthlyCostINR / 199) ? "✅ Above breakeven!" : `Need ${Math.ceil(s.monthlyCostINR / 199) - s.paidUsers} more`}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                Conversion Rate
              </div>
              <div className="text-2xl font-bold" style={{ color: "#F59E0B" }}>{s.conversionRate}%</div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Free → Paid conversion</div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
