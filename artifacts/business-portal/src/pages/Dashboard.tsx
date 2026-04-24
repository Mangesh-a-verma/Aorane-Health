import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { api, type Overview, type HealthAnalytics, type MemberStress, type MemberSearchResult } from "@/lib/api";
import {
  Users, Server, TrendingUp, Activity, Copy, Check,
  Building2, MapPin, Mail, Phone, Shield, Heart, Droplets, Dumbbell, Pill,
  AlertTriangle, UserCheck, UserX, Zap, Search, Brain, X as XIcon, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";


function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="kpi-number text-3xl text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1.5">{sub}</div>}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", emoji: "👋" };
  if (h < 17) return { text: "Good afternoon", emoji: "☀️" };
  return { text: "Good evening", emoji: "🌙" };
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
  const { admin, org, isPaidActive, subscriptionLoading } = useAuth();
  const greeting = getGreeting();
  const firstName = admin?.fullName?.split(" ")[0] || "there";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<HealthAnalytics | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Employee stress lookup state
  const [stressQuery, setStressQuery] = useState("");
  const [stressResults, setStressResults] = useState<MemberSearchResult[]>([]);
  const [stressSearching, setStressSearching] = useState(false);
  const [stressSearchErr, setStressSearchErr] = useState("");
  const [selectedStressUser, setSelectedStressUser] = useState<MemberSearchResult | null>(null);
  const [memberStress, setMemberStress] = useState<MemberStress | null>(null);
  const [stressLookupLoading, setStressLookupLoading] = useState(false);

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

  const handleStressSearch = async (q: string) => {
    setStressQuery(q);
    setStressSearchErr("");
    if (q.trim().length < 4) { setStressResults([]); return; }
    setStressSearching(true);
    try {
      const res = await api.searchMembers(q.trim());
      setStressResults(res.results);
    } catch { setStressSearchErr("Search failed. Try again."); }
    finally { setStressSearching(false); }
  };

  const handleSelectStressUser = async (m: MemberSearchResult) => {
    setSelectedStressUser(m);
    setStressResults([]);
    setStressQuery(m.name || m.aoraneId || "");
    setMemberStress(null);
    setStressLookupLoading(true);
    try {
      const stress = await api.getMemberStress(m.userId);
      setMemberStress(stress);
    } catch { setMemberStress(null); }
    finally { setStressLookupLoading(false); }
  };

  const clearStressLookup = () => {
    setStressQuery("");
    setStressResults([]);
    setSelectedStressUser(null);
    setMemberStress(null);
    setStressSearchErr("");
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
      <div className="p-6 max-w-6xl mx-auto">
        {/* Hero Greeting Card */}
        <div className="mb-6 rounded-2xl p-6 border border-primary/15 bg-gradient-to-br from-primary/5 via-secondary/5 to-transparent relative overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle at 90% 20%, rgba(0,119,182,0.15), transparent 40%)" }} />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">
                {greeting.text}, {firstName} <span className="inline-block">{greeting.emoji}</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-1.5 max-w-md">
                Here's what's happening with <span className="font-semibold text-foreground">{org?.name || "your organization"}</span> today.
              </p>
            </div>
            {analytics && analytics.totalMembers > 0 && (
              <div className="rounded-xl bg-card/70 backdrop-blur border border-border px-4 py-3 min-w-[160px]">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Org Health Index</div>
                <div className="kpi-number text-2xl text-primary mt-1">{analytics.avgHealthScore}<span className="text-base text-muted-foreground font-normal">/100</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Enrollment Code Banner — only after active subscription */}
        {!subscriptionLoading && (
          isPaidActive ? (
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
          ) : (
            <div className="mb-6 rounded-xl p-5 border border-amber-200 bg-amber-50">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-amber-900 text-sm font-semibold mb-1">Activate Your Subscription</div>
                  <div className="text-amber-800 text-xs">
                    Your Organization Enrollment Code will be available once your plan is active. Complete payment to start onboarding employees.
                  </div>
                </div>
                <a href="/billing" className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                  Go to Billing
                </a>
              </div>
            </div>
          )
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard label="Total Members" value={loading ? "..." : overview?.memberCount || 0}
            sub="Active enrolled users" icon={Users} color="#0077B6" />
          <StatCard label="Seats Used" value={`${org?.usedSeats || 0}/${org?.totalSeats || 0}`}
            sub={`${seatPct.toFixed(0)}% utilized`} icon={Server} color="#1B998B" />
          <StatCard label="Active (7 days)" value={analyticsLoading ? "..." : analytics?.activeLast7Days || 0}
            sub="Users with health data" icon={TrendingUp} color="#F59E0B" />
          <StatCard label="Avg Health Score" value={analyticsLoading ? "..." : analytics?.avgHealthScore || 0}
            sub="Out of 100" icon={Activity} color="#10B981" />
        </div>

        {/* Stress Level Panel — Real Data from mobile stress tracker */}
        {!analyticsLoading && analytics && analytics.totalMembers > 0 && (() => {
          const hasRealData = analytics.stressTrackedCount > 0;
          // Use real avgStressScore if available, else fall back to proxy
          const stressIdx = hasRealData ? analytics.avgStressScore! : Math.max(0, 100 - (analytics.avgHealthScore || 0));
          const level = stressIdx < 30 ? "Low" : stressIdx < 55 ? "Moderate" : stressIdx < 75 ? "High" : "Critical";
          const colors: Record<string, { bg: string; text: string; bar: string; badge: string }> = {
            Low:      { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", bar: "#10B981", badge: "bg-emerald-100 text-emerald-700" },
            Moderate: { bg: "bg-amber-50 border-amber-200",   text: "text-amber-800",   bar: "#F59E0B", badge: "bg-amber-100 text-amber-700" },
            High:     { bg: "bg-orange-50 border-orange-200", text: "text-orange-800",  bar: "#F97316", badge: "bg-orange-100 text-orange-700" },
            Critical: { bg: "bg-red-50 border-red-200",       text: "text-red-800",     bar: "#EF4444", badge: "bg-red-100 text-red-700" },
          };
          const c = colors[level];
          const totalTracked = analytics.totalMembers;
          return (
            <div className={`mb-6 rounded-2xl border p-5 ${c.bg}`}>
              <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.bar + "20" }}>
                    <Zap size={18} style={{ color: c.bar }} />
                  </div>
                  <div>
                    <div className={`font-display font-bold text-lg ${c.text}`}>Workforce Stress Level</div>
                    <div className={`text-xs ${c.text} opacity-70`}>
                      {hasRealData
                        ? `Real-time data from ${analytics.stressTrackedCount} member${analytics.stressTrackedCount !== 1 ? "s" : ""} using Stress Tracker — last 30 days`
                        : "Estimated from health score (no stress logs yet)"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`kpi-number text-4xl ${c.text}`}>{stressIdx}<span className="text-base font-normal opacity-60">%</span></div>
                  <span className={`pill-chip font-semibold ${c.badge}`}>{level}</span>
                </div>
              </div>
              <div className="h-2 bg-black/10 rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stressIdx}%`, background: c.bar }} />
              </div>
              {hasRealData ? (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "High Stress", count: analytics.highStressCount, color: "#EF4444", pct: Math.round((analytics.highStressCount / analytics.stressTrackedCount) * 100) },
                    { label: "Moderate", count: analytics.moderateStressCount, color: "#F59E0B", pct: Math.round((analytics.moderateStressCount / analytics.stressTrackedCount) * 100) },
                    { label: "Low / Calm", count: analytics.lowStressCount, color: "#10B981", pct: Math.round((analytics.lowStressCount / analytics.stressTrackedCount) * 100) },
                  ].map(({ label, count, color, pct }) => (
                    <div key={label} className="rounded-xl bg-white/60 px-3 py-2 text-center">
                      <div className="font-display font-bold text-xl" style={{ color }}>{count}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
                      <div className="text-[11px] font-medium" style={{ color }}>{pct}%</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Healthy", count: analytics.healthyCount, color: "#10B981", pct: Math.round((analytics.healthyCount / totalTracked) * 100) },
                    { label: "At Risk", count: analytics.atRiskCount, color: "#F59E0B", pct: Math.round((analytics.atRiskCount / totalTracked) * 100) },
                    { label: "Inactive", count: analytics.inactiveCount, color: "#EF4444", pct: Math.round((analytics.inactiveCount / totalTracked) * 100) },
                  ].map(({ label, count, color, pct }) => (
                    <div key={label} className="rounded-xl bg-white/60 px-3 py-2 text-center">
                      <div className="font-display font-bold text-xl" style={{ color }}>{count}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
                      <div className="text-[11px] font-medium" style={{ color }}>{pct}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Employee Stress Lookup */}
        {!analyticsLoading && (
          <div className="mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Brain size={18} className="text-violet-600" />
              </div>
              <div>
                <div className="font-display font-bold text-lg text-violet-900">Employee Stress Lookup</div>
                <div className="text-xs text-violet-600/70">Search by name or Aorane ID — individual stress data (DPDP compliant)</div>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                {stressSearching
                  ? <Loader2 size={15} className="text-violet-400 animate-spin" />
                  : <Search size={15} className="text-violet-400" />
                }
              </div>
              <input
                type="text"
                value={stressQuery}
                onChange={(e) => handleStressSearch(e.target.value)}
                placeholder="Type employee name or Aorane ID (min 4 chars)…"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-violet-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder-gray-400"
              />
              {(stressQuery || selectedStressUser) && (
                <button
                  onClick={clearStressLookup}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            {/* Search Error */}
            {stressSearchErr && (
              <div className="text-xs text-red-500 mb-2">{stressSearchErr}</div>
            )}

            {/* Search Results Dropdown */}
            {stressResults.length > 0 && !selectedStressUser && (
              <div className="bg-white border border-violet-200 rounded-xl shadow-lg overflow-hidden mb-3 max-h-48 overflow-y-auto">
                {stressResults.map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => handleSelectStressUser(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-violet-50 flex items-center gap-3 transition-colors border-b border-violet-50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(m.name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{m.name || "Unknown"}</div>
                      <div className="text-[11px] text-gray-400">{m.aoraneId ? `ID: ${m.aoraneId}` : ""} {m.city || ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {stressQuery.trim().length >= 4 && !stressSearching && stressResults.length === 0 && !selectedStressUser && (
              <div className="text-xs text-gray-400 mb-2">No members found matching "{stressQuery}"</div>
            )}

            {/* Selected Employee Stress Card */}
            {selectedStressUser && (
              <div className="bg-white rounded-2xl border border-violet-100 p-4">
                {stressLookupLoading ? (
                  <div className="flex items-center gap-2 py-3 justify-center">
                    <Loader2 size={16} className="text-violet-400 animate-spin" />
                    <span className="text-sm text-violet-400">Loading stress data…</span>
                  </div>
                ) : memberStress ? (() => {
                  const score = memberStress.latestScore;
                  const levelColors: Record<string, { bg: string; text: string; bar: string; badge: string }> = {
                    "Low":      { bg: "bg-emerald-50",  text: "text-emerald-700", bar: "#10B981", badge: "bg-emerald-100 text-emerald-700" },
                    "Moderate": { bg: "bg-amber-50",    text: "text-amber-700",   bar: "#F59E0B", badge: "bg-amber-100 text-amber-700" },
                    "High":     { bg: "bg-orange-50",   text: "text-orange-700",  bar: "#F97316", badge: "bg-orange-100 text-orange-700" },
                    "Critical": { bg: "bg-red-50",      text: "text-red-700",     bar: "#EF4444", badge: "bg-red-100 text-red-700" },
                    "No Data":  { bg: "bg-gray-50",     text: "text-gray-500",    bar: "#9CA3AF", badge: "bg-gray-100 text-gray-500" },
                  };
                  const c = levelColors[memberStress.level] || levelColors["No Data"];
                  return (
                    <>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {(selectedStressUser.name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-gray-800">{selectedStressUser.name || "Member"}</div>
                            <div className="text-[11px] text-gray-400">{memberStress.logsCount} check-in{memberStress.logsCount !== 1 ? "s" : ""} in last 30 days</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {memberStress.burnoutRisk && (
                            <span className="pill-chip bg-red-100 text-red-600 font-semibold text-[10px]">⚠️ Burnout Risk</span>
                          )}
                          <span className={`pill-chip font-semibold ${c.badge}`}>{memberStress.level}</span>
                          <div className={`kpi-number text-2xl ${c.text}`}>
                            {score !== null ? score : "—"}<span className="text-sm font-normal opacity-60">{score !== null ? "/100" : ""}</span>
                          </div>
                        </div>
                      </div>
                      {score !== null && (
                        <div className="mb-3">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: c.bar }} />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
                          <div className="font-bold text-base text-gray-800">{memberStress.avgScore !== null ? memberStress.avgScore : "—"}</div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">30-day Avg</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
                          <div className="font-bold text-base text-gray-800">{memberStress.logsCount}</div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Check-ins</div>
                        </div>
                      </div>
                      {memberStress.trend.length > 0 && (
                        <div className="mt-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Stress Trend (Last 14 days)</div>
                          <ResponsiveContainer width="100%" height={60}>
                            <BarChart data={memberStress.trend} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                              <YAxis domain={[0, 100]} tick={false} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [v, "Stress Score"]} />
                              <Bar dataKey="score" fill={c.bar} radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <div className="text-sm text-gray-400 text-center py-3">Could not load stress data for this member.</div>
                )}
              </div>
            )}
          </div>
        )}

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
                          { label: "Healthy", count: analytics?.healthyCount ?? 0, color: "#10B981", icon: UserCheck },
                          { label: "At Risk", count: analytics?.atRiskCount ?? 0, color: "#F59E0B", icon: AlertTriangle },
                          { label: "Inactive", count: analytics?.inactiveCount ?? 0, color: "#9CA3AF", icon: UserX },
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
