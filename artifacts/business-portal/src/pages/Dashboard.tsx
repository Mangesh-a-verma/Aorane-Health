import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { api, type Overview, type HealthAnalytics, type Member } from "@/lib/api";
import {
  Users, Server, TrendingUp, Activity, Copy, Check,
  Building2, MapPin, Mail, Phone, Shield, Heart, Droplets, Dumbbell, Pill,
  AlertTriangle, UserCheck, UserX, Loader2,
  FileText, Megaphone, QrCode, ArrowRight, Clock, CreditCard,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardShell, NeuCard, PageHeader, PrivacyNote, StatCard, Avatar } from "@/components/portal/primitives";

const chartTooltipStyle = {
  borderRadius: 16,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  fontSize: 12,
};

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
          <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-lg font-bold text-foreground text-center">{value}%</div>
        <div className="text-[11px] text-muted-foreground text-center">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { admin, org, isPaidActive, subscriptionLoading } = useAuth();
  const [, navigate] = useLocation();
  const [greeting, setGreeting] = useState(getGreeting());
  useEffect(() => {
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);
  const firstName = admin?.fullName?.split(" ")[0] || "there";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<HealthAnalytics | null>(null);
  const [recentMembers, setRecentMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);


  useEffect(() => {
    api.overview().then(setOverview).catch(console.error).finally(() => setLoading(false));
    api.getHealthAnalytics().then(setAnalytics).catch(console.error).finally(() => setAnalyticsLoading(false));
    api.members().then((res) => {
      const sorted = [...res.members].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
      setRecentMembers(sorted.slice(0, 4));
    }).catch(console.error);
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(org?.orgCode || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // The per-employee stress lookup that lived here (search a member, then
  // GET /business/members/:userId/stress) was removed along with its
  // endpoint. Health data in this CRM is aggregate-only; the Workforce
  // Stress Level panel above already shows it at org level.

  const seatPct = org ? Math.min(100, (org.usedSeats / org.totalSeats) * 100) : 0;

  const orgTypeLabels: Record<string, string> = {
    corporate: "Corporate", hospital: "Hospital", gym: "Gym & Fitness",
    insurance: "Insurance", ngo: "NGO", yoga: "Yoga Studio",
    school: "School", other: "Organization",
  };

  const healthDistData = analytics ? [
    { name: "Healthy", value: analytics.healthyCount, color: "oklch(0.68 0.12 162)" },
    { name: "At Risk", value: analytics.atRiskCount, color: "oklch(0.8 0.13 80)" },
    { name: "Inactive", value: analytics.inactiveCount, color: "hsl(var(--muted-foreground) / 0.35)" },
  ] : [];

  const trendData = (analytics?.dailyActiveTrend || []).slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    count: d.activeCount,
  }));

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="Organization overview"
          title={`${greeting.text}, ${firstName} ${greeting.emoji}`}
          description={`Here's what's happening with ${org?.name || "your organization"} today. All member insights below are aggregated and consent-based.`}
          actions={
            analytics && analytics.totalMembers > 0 ? (
              <NeuCard variant="inset" className="px-4 py-3 min-w-[160px]">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Org Health Index</div>
                <div className="flex items-end gap-2 mt-1">
                  <div className="text-2xl font-bold tracking-tight text-primary">
                    {analytics.avgHealthScore}<span className="text-base text-muted-foreground font-normal">/100</span>
                  </div>
                  {analytics.healthScoreTrendPct !== null && (
                    <span className={`text-[11px] font-semibold mb-1 flex items-center gap-0.5 ${analytics.healthScoreTrendPct >= 0 ? "text-[oklch(0.55_0.13_162)]" : "text-destructive"}`}>
                      {analytics.healthScoreTrendPct >= 0 ? "▲" : "▼"} {Math.abs(analytics.healthScoreTrendPct)}%
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">vs last 7 days</div>
              </NeuCard>
            ) : undefined
          }
        />

        {/* Enrollment Code Banner — only after active subscription */}
        {!subscriptionLoading && (
          isPaidActive ? (
            <NeuCard className="p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-muted-foreground text-sm mb-1">Organization Enrollment Code</div>
                  <div className="text-3xl font-bold tracking-widest font-mono-data text-foreground">{org?.orgCode}</div>
                  <div className="text-muted-foreground text-xs mt-1">Share this code with employees to join your organization</div>
                </div>
                <Button variant="brand" onClick={copyCode}>
                  {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Code</>}
                </Button>
              </div>
            </NeuCard>
          ) : (
            <NeuCard variant="flat" className="p-5 flex items-center gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl tone-lavender">
                <CreditCard size={18} />
              </span>
              <div className="flex-1 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-foreground text-sm font-semibold mb-1">Activate Your Subscription</div>
                  <div className="text-muted-foreground text-xs">
                    Your Organization Enrollment Code will be available once your plan is active.
                  </div>
                </div>
                <Button variant="brand" onClick={() => navigate("/billing")} className="shrink-0">
                  Go to Billing
                </Button>
              </div>
            </NeuCard>
          )
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Members" value={loading ? "…" : overview?.memberCount || 0}
            hint="Active enrolled users" icon={<Users />} tone="primary" />
          <StatCard label="Seats Used" value={`${org?.usedSeats || 0}/${org?.totalSeats || 0}`}
            hint={`${seatPct.toFixed(0)}% utilized`} icon={<Server />} tone="teal" />
          <StatCard label="Active (7 days)" value={analyticsLoading ? "…" : analytics?.activeLast7Days || 0}
            hint="Users with health data" icon={<TrendingUp />} tone="amber" />
          <StatCard label="Avg Health Score" value={analyticsLoading ? "…" : analytics?.avgHealthScore || 0}
            hint="Out of 100" icon={<Activity />} tone="mint" />
        </section>

        {/* Stress Level Panel — Real Data from mobile stress tracker */}
        {!analyticsLoading && analytics && analytics.totalMembers > 0 && (() => {
          const hasRealData = analytics.stressTrackedCount > 0;
          const stressIdx = hasRealData ? analytics.avgStressScore! : Math.max(0, 100 - (analytics.avgHealthScore || 0));
          const level = stressIdx < 30 ? "Low" : stressIdx < 55 ? "Moderate" : stressIdx < 75 ? "High" : "Critical";
          const colors: Record<string, { text: string; bar: string; badge: "success" | "warning" | "danger"; tone: string }> = {
            Low:      { text: "text-[oklch(0.5_0.13_162)]", bar: "oklch(0.68 0.12 162)", badge: "success", tone: "tone-mint" },
            Moderate: { text: "text-[oklch(0.55_0.13_80)]", bar: "oklch(0.8 0.13 80)",   badge: "warning", tone: "tone-amber" },
            High:     { text: "text-[oklch(0.55_0.16_50)]", bar: "oklch(0.68 0.17 50)",  badge: "warning", tone: "tone-amber" },
            Critical: { text: "text-destructive",           bar: "hsl(var(--destructive))", badge: "danger", tone: "tone-danger" },
          };
          const c = colors[level];
          const totalTracked = analytics.totalMembers;
          return (
            <CardShell
              title="Workforce Stress Level"
              description={hasRealData
                ? `Real-time data from ${analytics.stressTrackedCount} member${analytics.stressTrackedCount !== 1 ? "s" : ""} using Stress Tracker — last 30 days`
                : "Estimated from health score (no stress logs yet)"}
              action={
                <div className="flex items-center gap-3">
                  <div className={`text-3xl sm:text-4xl font-bold tracking-tight ${c.text}`}>{stressIdx}<span className="text-base font-normal text-muted-foreground">%</span></div>
                  <Badge variant={c.badge}>{level}</Badge>
                </div>
              }
            >
              <div className="neu-inset-sm h-2 rounded-full overflow-hidden mb-4">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stressIdx}%`, background: c.bar }} />
              </div>
              {hasRealData ? (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "High Stress", count: analytics.highStressCount, tone: "tone-danger", pct: Math.round((analytics.highStressCount / analytics.stressTrackedCount) * 100) },
                    { label: "Moderate", count: analytics.moderateStressCount, tone: "tone-amber", pct: Math.round((analytics.moderateStressCount / analytics.stressTrackedCount) * 100) },
                    { label: "Low / Calm", count: analytics.lowStressCount, tone: "tone-mint", pct: Math.round((analytics.lowStressCount / analytics.stressTrackedCount) * 100) },
                  ].map(({ label, count, tone, pct }) => (
                    <div key={label} className={`neu-flat rounded-2xl px-3 py-2.5 text-center ${tone}`}>
                      <div className="font-bold text-xl">{count}</div>
                      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
                      <div className="text-[11px] font-medium">{pct}%</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Healthy", count: analytics.healthyCount, tone: "tone-mint", pct: Math.round((analytics.healthyCount / totalTracked) * 100) },
                    { label: "At Risk", count: analytics.atRiskCount, tone: "tone-amber", pct: Math.round((analytics.atRiskCount / totalTracked) * 100) },
                    { label: "Inactive", count: analytics.inactiveCount, tone: "tone-danger", pct: Math.round((analytics.inactiveCount / totalTracked) * 100) },
                  ].map(({ label, count, tone, pct }) => (
                    <div key={label} className={`neu-flat rounded-2xl px-3 py-2.5 text-center ${tone}`}>
                      <div className="font-bold text-xl">{count}</div>
                      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
                      <div className="text-[11px] font-medium">{pct}%</div>
                    </div>
                  ))}
                </div>
              )}
            </CardShell>
          );
        })()}


        {/* Recent Enrollments + Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <CardShell
            title="Recent Enrollments"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/members")} className="text-xs font-semibold text-primary">
                View all <ArrowRight size={12} />
              </Button>
            }
          >
            {recentMembers.length > 0 ? (
              <div className="space-y-1">
                {recentMembers.map((m) => (
                  <div key={m.memberId} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-secondary/50 transition-colors">
                    <Avatar name={m.fullName || "?"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{m.fullName || "Unnamed member"}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock size={10} /> {new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">No enrollments yet</div>
            )}
          </CardShell>

          <CardShell title="Quick Actions">
            <div className="space-y-1">
              {[
                { icon: QrCode, label: "Generate Enrollment Code", desc: "Create a new code for employees to join", path: "/codes" },
                { icon: FileText, label: "Generate Health Report", desc: "Create a detailed monthly analytics report", path: "/reports" },
                { icon: Megaphone, label: "Send Announcement", desc: "Send updates to all enrolled members", path: "/communications" },
                { icon: Server, label: "Manage Seats", desc: "View and manage your seat allocation", path: "/billing" },
              ].map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl tone-primary">
                    <action.icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{action.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{action.desc}</div>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground/50 shrink-0" />
                </button>
              ))}
            </div>
          </CardShell>
        </div>

        {/* Health Metric Circles */}
        <CardShell
          title="Aggregate Health Analytics"
          description="Privacy-safe — no individual data shown. DPDP Act 2023 compliant."
          action={
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground neu-flat rounded-lg px-2.5 py-1.5">
              <Shield size={11} className="text-primary" /> Aggregate only
            </span>
          }
        >
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : (
            <>
              <div className="flex justify-around flex-wrap gap-4 py-4 neu-inset rounded-2xl">
                <HealthCircle label="Nutrition" value={analytics?.avgFood ?? 0} color="oklch(0.8 0.13 78)" icon={Heart} />
                <HealthCircle label="Hydration" value={analytics?.avgWater ?? 0} color="oklch(0.7 0.1 205)" icon={Droplets} />
                <HealthCircle label="Exercise" value={analytics?.avgExercise ?? 0} color="oklch(0.68 0.12 162)" icon={Dumbbell} />
                <HealthCircle label="Medicine" value={analytics?.avgMedicine ?? 0} color="oklch(0.7 0.1 292)" icon={Pill} />
              </div>
              {(!analytics || analytics.totalMembers === 0) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center mt-4 neu-inset rounded-xl px-3 py-2">
                  <Heart size={12} className="text-muted-foreground/60" />
                  Data appears when employees log health activities in the Aorane app
                </div>
              )}
            </>
          )}
        </CardShell>

        {/* Daily Active Users + Member Health Distribution */}
        <div className="grid md:grid-cols-2 gap-4">
          <CardShell
            title="Daily Active Users"
            action={<Badge variant="outline">Last 14 days</Badge>}
          >
            {analyticsLoading ? (
              <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [v, "Active Users"]} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No trend data yet</div>
            )}
          </CardShell>

          <CardShell
            title="Member Health Distribution"
            action={<Badge variant="outline">Health Status</Badge>}
          >
            {analyticsLoading ? (
              <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : healthDistData.some(d => d.value > 0) ? (
              <div className="flex items-center gap-6 py-2">
                <div className="relative shrink-0">
                  <PieChart width={140} height={140}>
                    <Pie data={healthDistData} cx={70} cy={70} innerRadius={44} outerRadius={68} dataKey="value" paddingAngle={3} stroke="none">
                      {healthDistData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-xl font-bold text-foreground">{analytics?.totalMembers ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">Members</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  {[
                    { label: "Healthy", count: analytics?.healthyCount ?? 0, tone: "tone-mint", icon: UserCheck },
                    { label: "At Risk", count: analytics?.atRiskCount ?? 0, tone: "tone-amber", icon: AlertTriangle },
                    { label: "Inactive", count: analytics?.inactiveCount ?? 0, tone: "text-muted-foreground", icon: UserX },
                  ].map(({ label, count, tone, icon: Icon }) => {
                    const total = analytics?.totalMembers || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <Icon size={14} className={tone.startsWith("tone-") ? "" : tone} />
                        <span className="text-sm text-foreground flex-1">{label}</span>
                        <span className="text-sm font-bold text-foreground">{count}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No distribution data yet</div>
            )}
          </CardShell>
        </div>

        {/* Bottom Row */}
        <div className="grid md:grid-cols-2 gap-4">
          <CardShell title="Organization Details">
            <div className="space-y-3">
              {[
                { icon: Building2, label: "Type", value: orgTypeLabels[org?.orgType || ""] || "—" },
                { icon: MapPin, label: "Location", value: [org?.city, org?.state].filter(Boolean).join(", ") || "—" },
                { icon: Mail, label: "Email", value: org?.contactEmail || "—" },
                { icon: Phone, label: "Phone", value: org?.contactPhone || "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon size={15} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-sm text-foreground font-medium">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardShell>

          <CardShell title="Seat Capacity">
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Seats used</span>
                <span className="text-foreground font-semibold">{org?.usedSeats} of {org?.totalSeats}</span>
              </div>
              <div className="neu-inset-sm h-3 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${seatPct}%`, background: seatPct > 90 ? "hsl(var(--destructive))" : "linear-gradient(90deg, #0077B6, #1B998B)" }} />
              </div>
              <div className="text-xs text-muted-foreground mt-2">{org && org.totalSeats - org.usedSeats} seats available</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Total", value: org?.totalSeats || 0, tone: "text-foreground" },
                { label: "Used", value: org?.usedSeats || 0, tone: "text-primary" },
                { label: "Free", value: (org?.totalSeats || 0) - (org?.usedSeats || 0), tone: "text-[oklch(0.5_0.13_162)]" },
              ].map(({ label, value, tone }) => (
                <div key={label} className="neu-flat rounded-xl p-3 text-center">
                  <div className={`text-xl font-bold ${tone}`}>{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        <NeuCard variant="glass" className="p-5">
          <PrivacyNote>
            Health values reflect what members consented to share with the organization. Individual
            member health data is never surfaced outside consented, on-demand lookups.
          </PrivacyNote>
        </NeuCard>
      </div>
    </Layout>
  );
}
