import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { api, type Overview } from "@/lib/api";
import {
  Users, Server, TrendingUp, Activity, Copy, Check,
  Building2, MapPin, Mail, Phone, Shield, Heart, Droplets, Dumbbell, Pill,
  AlertTriangle, UserCheck, UserX,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

interface HealthAnalytics {
  totalMembers: number;
  activeToday: number;
  activeLast7Days: number;
  avgHealthScore: number;
  avgFood: number;
  avgWater: number;
  avgExercise: number;
  avgMedicine: number;
  healthyCount: number;
  atRiskCount: number;
  inactiveCount: number;
  dailyActiveTrend: { date: string; activeCount: number }[];
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#6B7280] text-sm font-medium">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-[#0D1F33]">{value}</div>
      {sub && <div className="text-xs text-[#9CA3AF] mt-1">{sub}</div>}
    </div>
  );
}

function HealthCircle({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: React.ElementType;
}) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#F3F4F6" strokeWidth="7" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-lg font-bold text-[#0D1F33] text-center">{value}%</div>
        <div className="text-[11px] text-[#6B7280] text-center">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { org } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<HealthAnalytics | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    api.overview().then(setOverview).catch(console.error).finally(() => setLoading(false));
    api.getHealthAnalytics().then(setAnalytics).catch(console.error).finally(() => setAnalyticsLoading(false));
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(org?.orgCode || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const seatPct = org ? Math.min(100, (org.usedSeats / org.totalSeats) * 100) : 0;

  const orgTypeLabels: Record<string, string> = {
    corporate: "Corporate", hospital: "Hospital", gym: "Gym & Fitness",
    insurance: "Insurance", ngo: "NGO", yoga: "Yoga Studio",
    school: "School", other: "Organization",
  };

  const healthDistData = analytics ? [
    { name: "Healthy", value: analytics.healthyCount, color: "#10B981" },
    { name: "At Risk", value: analytics.atRiskCount, color: "#F59E0B" },
    { name: "Inactive", value: analytics.inactiveCount, color: "#E5E7EB" },
  ] : [];

  const trendData = (analytics?.dailyActiveTrend || []).slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    count: d.activeCount,
  }));

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0D1F33]">Dashboard</h1>
          <p className="text-[#6B7280] text-sm mt-0.5">Organization overview &amp; aggregate health insights</p>
        </div>

        {/* Enrollment Code Banner */}
        <div className="mb-6 rounded-xl p-5 text-white"
          style={{ background: "linear-gradient(135deg, #0077B6, #1B998B)" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-white/70 text-sm mb-1">Organization Enrollment Code</div>
              <div className="text-3xl font-bold tracking-widest font-mono">{org?.orgCode}</div>
              <div className="text-white/60 text-xs mt-1">Share this code with employees to join your organization</div>
            </div>
            <button onClick={copyCode}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl px-4 py-2.5 text-sm font-medium transition-all">
              {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Code</>}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Members" value={loading ? "..." : overview?.memberCount || 0}
            sub="Active enrolled users" icon={Users} color="#0077B6" />
          <StatCard label="Seats Used" value={`${org?.usedSeats || 0}/${org?.totalSeats || 0}`}
            sub={`${seatPct.toFixed(0)}% utilized`} icon={Server} color="#1B998B" />
          <StatCard label="Active (7 days)" value={analyticsLoading ? "..." : analytics?.activeLast7Days || 0}
            sub="Users with health data" icon={TrendingUp} color="#F59E0B" />
          <StatCard label="Avg Health Score" value={analyticsLoading ? "..." : analytics?.avgHealthScore || 0}
            sub="Out of 100" icon={Activity} color="#10B981" />
        </div>

        {/* Health Analytics Section */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-[#0D1F33]">Aggregate Health Analytics</h2>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Privacy-safe — no individual data shown. DPDP Act 2023 compliant.</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF] bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5">
              <Shield size={11} className="text-[#0077B6]" /> Aggregate only
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-[#0077B6]/30 border-t-[#0077B6] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Health Metric Circles — always shown, zeros when no data */}
              <div className="flex justify-around flex-wrap gap-4 mb-4 py-4 bg-[#F8FAFC] rounded-xl">
                <HealthCircle label="Nutrition" value={analytics?.avgFood ?? 0} color="#F59E0B" icon={Heart} />
                <HealthCircle label="Hydration" value={analytics?.avgWater ?? 0} color="#0EA5E9" icon={Droplets} />
                <HealthCircle label="Exercise" value={analytics?.avgExercise ?? 0} color="#10B981" icon={Dumbbell} />
                <HealthCircle label="Medicine" value={analytics?.avgMedicine ?? 0} color="#8B5CF6" icon={Pill} />
              </div>
              {(!analytics || analytics.totalMembers === 0) && (
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF] justify-center mb-4 bg-[#F8FAFC] rounded-lg px-3 py-2 border border-[#E5E7EB]">
                  <Heart size={12} className="text-[#D1D5DB]" />
                  Data appears when employees log health activities in the Aorane app
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-5">
                {/* Daily Active Trend */}
                <div>
                  <h3 className="text-sm font-semibold text-[#374151] mb-3">Daily Active Users (Last 14 days)</h3>
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={trendData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                        <Tooltip
                          contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => [v, "Active Users"]}
                        />
                        <Bar dataKey="count" fill="#0077B6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-sm text-[#9CA3AF]">No trend data yet</div>
                  )}
                </div>

                {/* Health Distribution Pie */}
                <div>
                  <h3 className="text-sm font-semibold text-[#374151] mb-3">Member Health Distribution</h3>
                  {healthDistData.some(d => d.value > 0) ? (
                    <div className="flex items-center gap-4">
                      <PieChart width={120} height={120}>
                        <Pie data={healthDistData} cx={55} cy={55} innerRadius={30} outerRadius={55}
                          dataKey="value" paddingAngle={3}>
                          {healthDistData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                      <div className="flex flex-col gap-2.5 flex-1">
                        {[
                          { label: "Healthy", count: analytics.healthyCount, color: "#10B981", icon: UserCheck },
                          { label: "At Risk", count: analytics.atRiskCount, color: "#F59E0B", icon: AlertTriangle },
                          { label: "Inactive", count: analytics.inactiveCount, color: "#9CA3AF", icon: UserX },
                        ].map(({ label, count, color, icon: Icon }) => (
                          <div key={label} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                            <Icon size={12} style={{ color }} className="shrink-0" />
                            <span className="text-xs text-[#374151] flex-1">{label}</span>
                            <span className="text-xs font-bold text-[#0D1F33]">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-sm text-[#9CA3AF]">No distribution data yet</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Row */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Building2 size={18} className="text-[#0077B6]" />
              <h2 className="font-semibold text-[#0D1F33]">Organization Details</h2>
            </div>
            <div className="space-y-3">
              {[
                { icon: Building2, label: "Type", value: orgTypeLabels[org?.orgType || ""] || "—" },
                { icon: MapPin, label: "Location", value: [org?.city, org?.state].filter(Boolean).join(", ") || "—" },
                { icon: Mail, label: "Email", value: org?.contactEmail || "—" },
                { icon: Phone, label: "Phone", value: org?.contactPhone || "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon size={15} className="text-[#9CA3AF] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-[#9CA3AF]">{label}</div>
                    <div className="text-sm text-[#0D1F33] font-medium">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Shield size={18} className="text-[#0077B6]" />
              <h2 className="font-semibold text-[#0D1F33]">Seat Capacity</h2>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#6B7280]">Seats used</span>
                <span className="text-[#0D1F33] font-semibold">{org?.usedSeats} of {org?.totalSeats}</span>
              </div>
              <div className="h-3 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${seatPct}%`, background: seatPct > 90 ? "#EF4444" : "linear-gradient(90deg, #0077B6, #1B998B)" }} />
              </div>
              <div className="text-xs text-[#9CA3AF] mt-2">{org && org.totalSeats - org.usedSeats} seats available</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Total", value: org?.totalSeats || 0, color: "text-[#0D1F33]" },
                { label: "Used", value: org?.usedSeats || 0, color: "text-[#0077B6]" },
                { label: "Free", value: (org?.totalSeats || 0) - (org?.usedSeats || 0), color: "text-emerald-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-[#9CA3AF]">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
