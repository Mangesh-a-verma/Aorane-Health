import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, type Analytics, type HealthAnalytics } from "@/lib/api";
import {
  Users, TrendingUp, Activity, Heart, BarChart3,
  Flame, Droplets, Dumbbell, Pill, Zap, ShieldCheck, AlertTriangle, Loader2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ComposedChart, Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardShell, EmptyState, NeuCard, PageHeader, ProgressBar, StatCard } from "@/components/portal/primitives";

const GENDER_COLORS = ["hsl(var(--primary))", "oklch(0.68 0.55 0)", "hsl(var(--muted-foreground))"];
const STATUS_COLORS = ["oklch(0.68 0.12 162)", "oklch(0.8 0.13 78)", "hsl(var(--muted-foreground))"];
const STRESS_COLORS = ["hsl(var(--destructive))", "oklch(0.8 0.13 78)", "oklch(0.68 0.12 162)"];
/** A sub-score average as a percentage, or an em dash when the metric was
 *  never tracked by anyone. "0%" would claim the staff scored zero at it. */
const pct = (value: number | null): string => (value === null ? "—" : `${Math.round(value)}%`);

const VITALS_COLORS = ["oklch(0.68 0.17 25)", "oklch(0.7 0.1 205)", "oklch(0.68 0.12 162)", "oklch(0.7 0.1 292)"];
const AGE_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "oklch(0.7 0.1 205)", "oklch(0.78 0.08 210)", "oklch(0.85 0.05 210)"];
const PLAN_COLORS = ["hsl(var(--primary))", "oklch(0.68 0.12 162)", "oklch(0.8 0.13 78)", "oklch(0.7 0.1 292)"];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};
const legendStyle = { fontSize: 12, color: "hsl(var(--muted-foreground))" };

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [health, setHealth] = useState<HealthAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAnalytics(), api.getHealthAnalytics()])
      .then(([a, h]) => { setData(a); setHealth(h); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    </Layout>
  );

  if (!data) return (
    <Layout>
      <div className="p-6 text-center text-muted-foreground">Failed to load analytics</div>
    </Layout>
  );

  const statusData = health ? [
    { name: "Healthy", value: health.healthyCount },
    { name: "At Risk", value: health.atRiskCount },
    { name: "Inactive", value: health.inactiveCount },
  ] : [];

  const stressData = health && health.stressTrackedCount > 0 ? [
    { name: "High Stress", value: health.highStressCount },
    { name: "Moderate", value: health.moderateStressCount },
    { name: "Low Stress", value: health.lowStressCount },
  ] : [];

  // A metric nobody tracked comes back null. Dropping it is the honest
  // rendering — plotting it as a 0 spoke would tell the company its staff
  // score zero at something they were never measured on.
  const allVitals: Array<{ name: string; value: number | null; color: string }> = health ? [
    { name: "Nutrition",  value: health.avgFood,     color: VITALS_COLORS[0] },
    { name: "Hydration",  value: health.avgWater,    color: VITALS_COLORS[1] },
    { name: "Exercise",   value: health.avgExercise, color: VITALS_COLORS[2] },
    { name: "Medication", value: health.avgMedicine, color: VITALS_COLORS[3] },
  ] : [];

  const trackedVitals = allVitals.filter(
    (v): v is { name: string; value: number; color: string } => v.value !== null
  );

  const vitalsData = trackedVitals.map(({ name, value }) => ({
    name, fullMark: 100, score: Math.round(value),
  }));

  const vitalsBar = trackedVitals.map(({ name, value, color }) => ({
    name, value: Math.round(value), color,
  }));

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="Insights"
          title="Analytics"
          description="Privacy-safe, aggregate health and engagement insights for your organization."
          actions={<Badge variant="soft"><BarChart3 size={11} /> Live Insights</Badge>}
        />

        {/* KPI rows */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Members" value={data.totalMembers} hint="Enrolled in org" icon={<Users />} tone="primary" />
          <StatCard label="Avg Health Score" value={health ? `${Math.round(health.avgHealthScore)}/100` : "—"} hint="Across all members" icon={<Heart />} tone="mint" />
          <StatCard label="Active (7 days)" value={health?.activeLast7Days ?? "—"} hint="Logged at least once" icon={<Activity />} tone="teal" />
          <StatCard label="Active Today" value={health?.activeToday ?? "—"} hint="Health logs today" icon={<Zap />} tone="amber" />
        </section>
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Avg BMI" value={data.avgBmi ?? "—"} hint="Org average" icon={<TrendingUp />} tone="lavender" />
          <StatCard label="Avg Stress Score" value={health?.avgStressScore != null ? `${Math.round(health.avgStressScore)}/100` : "—"} hint="Lower is better" icon={<Flame />} tone="amber" />
          <StatCard label="High Stress Members" value={health?.highStressCount ?? "—"} hint="Burnout risk zone" icon={<AlertTriangle />} tone="primary" />
          <StatCard label="Stress Tracked" value={health?.stressTrackedCount ?? "—"} hint="Have stress data" icon={<ShieldCheck />} tone="mint" />
        </section>

        <Tabs defaultValue="wellbeing">
          <TabsList className="neu-inset h-auto flex-wrap gap-1 rounded-2xl p-1.5 bg-transparent">
            <TabsTrigger value="wellbeing" className="rounded-xl px-4 py-2">Wellbeing</TabsTrigger>
            <TabsTrigger value="engagement" className="rounded-xl px-4 py-2">Engagement</TabsTrigger>
            <TabsTrigger value="demographics" className="rounded-xl px-4 py-2">Demographics</TabsTrigger>
          </TabsList>

          {/* Wellbeing */}
          <TabsContent value="wellbeing" className="mt-6 space-y-6">
            <div className="grid md:grid-cols-3 gap-5">
              <CardShell title="Health Status" description="Based on health scores">
                {health && statusData.some(s => s.value > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusData.filter(s => s.value > 0)} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                        {statusData.filter(s => s.value > 0).map((entry, i) => <Cell key={entry.name} fill={STATUS_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconSize={10} iconType="circle" wrapperStyle={legendStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Heart />} title="No health score data yet" />
                )}
              </CardShell>

              <CardShell title="Stress Distribution" description="Members with stress logs">
                {stressData.some(s => s.value > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stressData.filter(s => s.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value" stroke="none">
                        {stressData.filter(s => s.value > 0).map((entry, i) => <Cell key={entry.name} fill={STRESS_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconSize={10} iconType="circle" wrapperStyle={legendStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Flame />} title="No stress data yet" />
                )}
              </CardShell>

              <CardShell title="Avg Habit Compliance" description="Daily average score (0–100)">
                {vitalsBar.some(v => v.value > 0) ? (
                  <>
                    <div className="space-y-3">
                      {vitalsBar.map(v => (
                        <div key={v.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-foreground">{v.name}</span>
                            <span className="font-bold" style={{ color: v.color }}>{v.value}%</span>
                          </div>
                          <ProgressBar value={v.value} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                    {vitalsData.length > 0 && (
                      <div className="mt-4">
                        <ResponsiveContainer width="100%" height={130}>
                          <RadarChart data={vitalsData}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                            <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                            <Tooltip contentStyle={tooltipStyle} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState icon={<Activity />} title="No vitals data yet" />
                )}
              </CardShell>
            </div>

            {health && (
              <CardShell title="Organization Health Summary">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: Flame, label: "Avg Nutrition", value: pct(health.avgFood), tone: "tone-amber" },
                    { icon: Droplets, label: "Avg Hydration", value: pct(health.avgWater), tone: "tone-teal" },
                    { icon: Dumbbell, label: "Avg Exercise", value: pct(health.avgExercise), tone: "tone-mint" },
                    { icon: Pill, label: "Avg Medication", value: pct(health.avgMedicine), tone: "tone-lavender" },
                  ].map(({ icon: Icon, label, value, tone }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
                        <Icon size={18} />
                      </span>
                      <div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="text-lg font-bold text-foreground">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardShell>
            )}
          </TabsContent>

          {/* Engagement */}
          <TabsContent value="engagement" className="mt-6 space-y-6">
            {data.joinTrend.length > 0 && (
              <CardShell title="Member Join Trend" description="Last 30 days">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.joinTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="joinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: string) => v.slice(5)} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#joinGrad)" strokeWidth={2} name="New Members" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardShell>
            )}

            {health && health.dailyActiveTrend.length > 0 && (
              <CardShell title="Daily Active Members" description="Members who logged any health data each day — last 14 days">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={health.dailyActiveTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.68 0.12 162)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.68 0.12 162)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: string) => v.slice(5)} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="activeCount" stroke="oklch(0.68 0.12 162)" fill="url(#activeGrad)" strokeWidth={0} name="Active Members" />
                    <Line type="monotone" dataKey="activeCount" stroke="oklch(0.68 0.12 162)" strokeWidth={2.5} dot={false} name="Active Members" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardShell>
            )}

            {data.joinTrend.length === 0 && (!health || health.dailyActiveTrend.length === 0) && (
              <NeuCard className="p-10">
                <EmptyState icon={<TrendingUp />} title="No engagement trend data yet" description="Trends populate as members join and log health data." />
              </NeuCard>
            )}
          </TabsContent>

          {/* Demographics */}
          <TabsContent value="demographics" className="mt-6 space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              <CardShell title="Gender Distribution">
                {data.genderDist.some(g => g.value > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data.genderDist.filter(g => g.value > 0)} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                        {data.genderDist.filter(g => g.value > 0).map((entry, i) => <Cell key={entry.name} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconSize={10} iconType="circle" wrapperStyle={legendStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Users />} title="No data yet" />
                )}
              </CardShell>

              <CardShell title="Age Groups">
                {data.ageDist.some(a => a.value > 0) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.ageDist} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar dataKey="value" radius={[8, 8, 4, 4]} name="Members">
                        {data.ageDist.map((_, i) => <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Users />} title="No data yet" />
                )}
              </CardShell>

              <CardShell title="Member Plans">
                {data.planDist.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.planDist} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 4, 4]} name="Members" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {data.planDist.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-1.5 text-xs neu-flat rounded-full px-3 py-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                          <span className="font-semibold capitalize">{p.name}</span>
                          <span className="text-muted-foreground">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState icon={<Users />} title="No data yet" />
                )}
              </CardShell>
            </div>
          </TabsContent>
        </Tabs>

        {data.totalMembers === 0 && (
          <NeuCard className="p-10">
            <EmptyState
              icon={<Activity />}
              title="No member data yet"
              description="Analytics will populate as members join and log health data."
            />
          </NeuCard>
        )}
      </div>
    </Layout>
  );
}
