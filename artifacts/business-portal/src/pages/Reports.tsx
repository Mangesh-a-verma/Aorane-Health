import React, { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { api, type CorporateReport } from "@/lib/api";

export type { CorporateReport as ReportData };
import {
  FileText, Download, Mail, TrendingUp,
  Activity, Utensils, Droplets, Moon, Brain, Pill,
  Users, BarChart3, Sparkles, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, Loader2, UserPlus, Copy, Share2,
  ClipboardList, QrCode, Award,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardShell, EmptyState, NeuCard, ProgressBar } from "@/components/portal/primitives";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-");
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  return `${months[parseInt(mon) - 1]} ${year}`;
}

function getPrevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getNextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getGradeTone(grade: string | null): "success" | "soft" | "warning" | "danger" | "outline" {
  if (grade === "A+") return "success";
  if (grade === "A") return "soft";
  if (grade === "B") return "soft";
  if (grade === "C") return "warning";
  if (grade === "D") return "danger";
  return "outline";
}

function ScoreBar({ score, label, icon: Icon }: { score: number; label: string; icon: React.ElementType }) {
  const tone = score >= 75 ? "mint" : score >= 50 ? "amber" : "primary";
  const textColor = score >= 75 ? "text-[oklch(0.5_0.13_162)]" : score >= 50 ? "text-[oklch(0.55_0.13_80)]" : "text-destructive";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
      <Icon size={16} className="text-muted-foreground shrink-0" />
      <span className="text-sm text-foreground w-36 shrink-0">{label}</span>
      <ProgressBar value={score} tone={tone} className="flex-1 h-2" />
      <span className={`text-sm font-bold tabular-nums w-12 text-right ${score >= 50 ? textColor : "text-destructive"}`}>{score}/100</span>
    </div>
  );
}

function GradeCard({ grade, count, label, tone }: { grade: string; count: number; label: string; tone: string }) {
  return (
    <div className={`neu-flat rounded-2xl p-4 text-center flex-1 min-w-[80px] ${tone}`}>
      <div className="text-2xl font-black">{count}</div>
      <div className="text-[11px] font-bold mt-1 uppercase tracking-wide">{grade}</div>
      <div className="text-[10px] mt-0.5 opacity-70">{label}</div>
    </div>
  );
}

// ─── AI Insights Renderer ─────────────────────────────────────────────────────

function AIInsights({ text }: { text: string }) {
  const sections = text.split(/^## /m).filter(Boolean);
  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const [heading, ...rest] = section.split("\n");
        const body = rest.join("\n").trim();
        const lines = body.split("\n").filter(Boolean);
        return (
          <div key={i} className="neu-inset rounded-2xl p-4">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full tone-primary text-[10px] flex items-center justify-center font-black">{i + 1}</span>
              {heading?.trim()}
            </h4>
            <div className="space-y-1.5">
              {lines.map((line, j) => {
                const clean = line.replace(/^[-•*]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1").trim();
                if (!clean) return null;
                const isBullet = /^[-•*]/.test(line.trim());
                return (
                  <div key={j} className={`text-sm text-muted-foreground ${isBullet ? "flex items-start gap-2" : "leading-relaxed"}`}>
                    {isBullet && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />}
                    <span>{clean}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty State — No Members ─────────────────────────────────────────────────

function NoMembersState({ orgCode, orgName }: { orgCode: string; orgName: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(orgCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const steps = [
    { icon: Share2, title: "Share Enrollment Code", desc: "Send this code to your employees via email or WhatsApp. They'll enter it in the AORANE mobile app." },
    { icon: UserPlus, title: "Employees Join", desc: "Employees download the AORANE app, go to Profile → Join Organisation, and enter the code." },
    { icon: ClipboardList, title: "They Log Health Data", desc: "Members log food, water, exercise, sleep, and medicines daily in the app." },
    { icon: BarChart3, title: "Report Generates", desc: "Once members have logged data, this report page will automatically populate with aggregated analytics." },
  ];

  return (
    <div className="flex flex-col items-center py-10 px-4 max-w-2xl mx-auto">
      <span className="grid size-20 place-items-center rounded-3xl tone-primary mb-5">
        <Users size={36} />
      </span>

      <h2 className="text-xl font-bold text-foreground text-center">No members enrolled yet</h2>
      <p className="text-sm text-muted-foreground text-center mt-2 max-w-md leading-relaxed">
        Health reports will appear once employees join <strong>{orgName}</strong> and start logging their health data. Here's how to get started:
      </p>

      <NeuCard className="w-full mt-8 p-6">
        <div className="flex items-center gap-2 mb-1">
          <QrCode size={15} className="text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Your Enrollment Code</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 font-mono-data text-3xl font-black text-foreground tracking-widest neu-inset rounded-2xl px-5 py-3 text-center">
            {orgCode}
          </div>
          <Button variant="brand" onClick={handleCopy} className="flex-col h-auto gap-1 py-3">
            {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
            <span className="text-[10px] font-semibold">{copied ? "Copied!" : "Copy"}</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          Employees enter this code in <strong>AORANE App → Profile → Join Organisation</strong>. Their health data will then appear in your reports.
        </p>
      </NeuCard>

      <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {steps.map((step, i) => (
          <NeuCard key={i} variant="flat" className="p-4 flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl tone-primary mt-0.5">
              <step.icon size={15} />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="w-4 h-4 rounded-full tone-primary text-[9px] flex items-center justify-center font-black shrink-0">{i + 1}</span>
                {step.title}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
            </div>
          </NeuCard>
        ))}
      </div>

      <div className="w-full mt-5 flex items-start gap-2 text-xs text-muted-foreground neu-inset rounded-2xl p-4">
        <TrendingUp size={13} className="mt-0.5 shrink-0 text-primary/60" />
        <span>
          Reports are generated automatically once members log health data. All data is anonymized and aggregated per <strong>DPDP Act 2023</strong> — individual employee data is never shared.
        </span>
      </div>
    </div>
  );
}

// ─── Empty State — Members enrolled but no data this month ───────────────────

function NoDataThisMonth({ month, totalMembers }: { month: string; totalMembers: number }) {
  return (
    <div className="flex flex-col items-center py-14 px-4 text-center max-w-md mx-auto">
      <span className="grid size-16 place-items-center rounded-3xl tone-amber mb-4">
        <ClipboardList size={28} />
      </span>
      <h2 className="text-lg font-bold text-foreground">No health data for {formatMonthLabel(month)}</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        You have <strong>{totalMembers} member{totalMembers !== 1 ? "s" : ""}</strong> enrolled, but none of them logged health data in {formatMonthLabel(month)}. Encourage your team to use the AORANE app daily.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 w-full">
        {[
          { icon: Utensils, label: "Log Food", tone: "tone-amber" },
          { icon: Droplets, label: "Log Water", tone: "tone-teal" },
          { icon: Activity, label: "Log Exercise", tone: "tone-mint" },
        ].map((item, i) => (
          <div key={i} className={`neu-flat rounded-2xl p-3 flex flex-col items-center gap-2 text-center ${item.tone}`}>
            <item.icon size={20} />
            <span className="text-xs font-semibold">{item.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-5">
        The report will auto-populate once members start logging.
      </p>
    </div>
  );
}

// ─── Print Styles (injected once) — DO NOT restyle: this drives the actual
// printed/PDF output, not the on-screen UI. ─────────────────────────────────

const PRINT_STYLE = `
@media print {
  body > * { display: none !important; }
  #corporate-report-print { display: block !important; }
  @page { margin: 15mm; size: A4; }
}
#corporate-report-print { display: none; }
`;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { org } = useAuth();
  const [month, setMonth] = useState(() => getPrevMonth(currentMonth()));
  const [emailSent, setEmailSent] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const isCurrentOrFuture = month >= currentMonth();

  const { data: reportData, isLoading: reportLoading, error: reportError } = useQuery({
    queryKey: ["corporate-report", month],
    queryFn: () => api.getReportData(month),
    staleTime: 5 * 60 * 1000,
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ["corporate-insights", month],
    queryFn: () => api.getReportInsights(month),
    enabled: !!reportData?.report?.activeMembers,
    staleTime: 30 * 60 * 1000,
  });

  const { data: esgData, isLoading: esgLoading } = useQuery({
    queryKey: ["esg-summary", month],
    queryFn: () => api.getEsgSummary(month),
    enabled: !!reportData?.report?.activeMembers,
    staleTime: 30 * 60 * 1000,
  });

  const { data: certData, isLoading: certLoading } = useQuery({
    queryKey: ["certification-status", org?.id],
    queryFn: () => api.getCertificationStatus(org!.id),
    enabled: !!org?.id,
    staleTime: 30 * 60 * 1000,
  });

  const emailMutation = useMutation({
    mutationFn: () => api.sendReportEmail(month),
    onSuccess: () => {
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 5000);
    },
  });

  const handleDownloadPDF = () => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body > *:not(#corporate-report-print) { display: none !important; }
        #corporate-report-print { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
        .no-print { display: none !important; }
        @page { margin: 12mm; size: A4; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1000);
  };

  const report = reportData?.report;
  const insights = insightsData?.insights as string | null | undefined;
  const esg = esgData?.esg;
  const cert = certData;
  const [certLinkCopied, setCertLinkCopied] = useState(false);
  const certBadgeUrl = org?.id
    ? `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api/business/public/certification/${org.id}/badge.svg`
    : "";
  const gradeTone = getGradeTone(report?.grade ?? null);

  // Derived state flags
  const hasMembers   = report && report.totalMembers > 0;
  const hasData      = report && report.activeMembers > 0;
  const showFullReport = hasMembers && hasData;

  return (
    <Layout>
      <style>{PRINT_STYLE}</style>

      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="no-print grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Insights</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <FileText size={22} className="text-primary" /> Health Reports
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Aggregate employee health analytics — DPDP Act 2023 compliant.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="neu-flat flex items-center gap-1 rounded-2xl p-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth(getPrevMonth(month))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-semibold text-foreground min-w-[110px] text-center">{formatMonthLabel(month)}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => !isCurrentOrFuture && setMonth(getNextMonth(month))} disabled={isCurrentOrFuture}>
                <ChevronRight size={16} />
              </Button>
            </div>
            <Button variant="neu" onClick={handleDownloadPDF} disabled={!showFullReport || reportLoading}>
              <Download size={15} /> Download PDF
            </Button>
            <Button variant="brand" onClick={() => emailMutation.mutate()} disabled={!showFullReport || emailMutation.isPending || emailSent}>
              {emailMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : emailSent ? <CheckCircle size={15} /> : <Mail size={15} />}
              {emailSent ? "Sent!" : "Email Report"}
            </Button>
          </div>
        </div>

        {emailMutation.isError && (
          <NeuCard variant="flat" className="no-print p-3 flex items-center gap-2 text-sm tone-danger">
            <AlertCircle size={14} />
            {(emailMutation.error as Error)?.message || "Email failed. Try again."}
          </NeuCard>
        )}

        {/* Loading */}
        {reportLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating report…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {reportError && (
          <NeuCard variant="flat" className="p-4 flex items-center gap-3 text-sm tone-danger">
            <AlertCircle size={16} />
            Failed to load report data. Please try again.
          </NeuCard>
        )}

        {/* Case 1: No members enrolled at all */}
        {!reportLoading && !reportError && report && !hasMembers && (
          <NeuCard className="p-4">
            <NoMembersState
              orgCode={org?.orgCode ?? "—"}
              orgName={org?.name ?? report.org?.name ?? "your organisation"}
            />
          </NeuCard>
        )}

        {/* Case 2: Members exist but no data this month */}
        {!reportLoading && !reportError && hasMembers && !hasData && (
          <NeuCard className="p-4">
            <NoDataThisMonth month={month} totalMembers={report!.totalMembers} />
          </NeuCard>
        )}

        {/* Case 3: Full report */}
        {showFullReport && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <NeuCard className="p-5 text-center">
                <div className="text-4xl font-black text-primary">{report!.averages?.healthScore ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1 font-semibold">AVG HEALTH SCORE</div>
                <Badge variant={gradeTone} className="mt-2">{report!.grade} — {report!.gradeLabel}</Badge>
              </NeuCard>
              <NeuCard variant="flat" className="p-5 text-center tone-mint">
                <div className="text-4xl font-black">{report!.activeMembers}</div>
                <div className="text-xs mt-1 font-semibold opacity-80">ACTIVE MEMBERS</div>
                <div className="text-xs mt-2">of {report!.totalMembers} enrolled</div>
              </NeuCard>
              <NeuCard variant="flat" className="p-5 text-center tone-lavender">
                <div className="text-4xl font-black">{report!.compliance.exercisePct}%</div>
                <div className="text-xs mt-1 font-semibold opacity-80">EXERCISE COMPLIANCE</div>
                <div className="text-xs mt-2">≥ 30 min/day</div>
              </NeuCard>
              <NeuCard variant="flat" className="p-5 text-center tone-teal">
                <div className="text-4xl font-black">{report!.compliance.waterPct}%</div>
                <div className="text-xs mt-1 font-semibold opacity-80">HYDRATION GOAL MET</div>
                <div className="text-xs mt-2">≥ 8 glasses/day</div>
              </NeuCard>
            </div>

            {/* Health Pillars */}
            <CardShell title="Health Pillars (Employee Average)" action={<BarChart3 size={16} className="text-primary" />}>
              <ScoreBar score={report!.averages?.exerciseScore  ?? 0} label="Physical Activity"  icon={Activity}  />
              <ScoreBar score={report!.averages?.foodScore      ?? 0} label="Nutrition & Diet"   icon={Utensils}  />
              <ScoreBar score={report!.averages?.waterScore     ?? 0} label="Hydration"          icon={Droplets}  />
              <ScoreBar score={report!.averages?.sleepScore     ?? 0} label="Sleep Quality"      icon={Moon}      />
              <ScoreBar score={report!.averages?.stressScore    ?? 0} label="Stress Management"  icon={Brain}     />
              <ScoreBar score={report!.averages?.medicineScore  ?? 0} label="Medicine Adherence" icon={Pill}      />
            </CardShell>

            {/* Grade Distribution */}
            <CardShell title="Employee Grade Distribution" action={<Users size={16} className="text-primary" />}>
              <div className="flex gap-3 flex-wrap">
                <GradeCard grade="A+" count={report!.gradeDistribution?.excellent        ?? 0} label="Excellent"        tone="tone-mint" />
                <GradeCard grade="A"  count={report!.gradeDistribution?.veryGood         ?? 0} label="Very Good"        tone="tone-primary" />
                <GradeCard grade="B"  count={report!.gradeDistribution?.good             ?? 0} label="Good"             tone="tone-teal" />
                <GradeCard grade="C"  count={report!.gradeDistribution?.average          ?? 0} label="Average"          tone="tone-amber" />
                <GradeCard grade="D/F" count={report!.gradeDistribution?.needsImprovement ?? 0} label="Needs Attention" tone="tone-danger" />
              </div>
            </CardShell>

            {/* AI Health Guide */}
            <CardShell
              title="AI Health Guide for HR Team"
              description="Powered by NVIDIA LLaMA 3.3 — 1 analysis per month, tailored to your team data"
              action={<Sparkles size={16} className="text-primary" />}
            >
              {insightsLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                  <Loader2 size={16} className="animate-spin" />
                  Generating AI health guide…
                </div>
              )}
              {!insightsLoading && insights && <AIInsights text={insights} />}
              {!insightsLoading && !insights && (
                <div className="text-sm text-muted-foreground text-center py-6">
                  AI guide could not be generated for this month. Check back later.
                </div>
              )}
            </CardShell>

            <NeuCard variant="flat" className="flex items-start gap-2 text-xs text-muted-foreground p-4">
              <TrendingUp size={13} className="mt-0.5 shrink-0 text-primary/60" />
              <span>
                <strong>Data note:</strong> Report covers {report!.dataPoints.toLocaleString()} health log entries from {report!.activeMembers} active members in {formatMonthLabel(month)}.
                All data is anonymized and aggregated per <strong>DPDP Act 2023</strong>. Individual employee data is never shared.
              </span>
            </NeuCard>

            {/* ESG / CSRD readiness */}
            <CardShell
              title="ESG / CSRD Readiness Summary"
              description="Your workforce wellbeing data, mapped to ESRS S1 (Own Workforce) disclosure categories"
              action={<FileText size={15} className="text-primary" />}
              className="no-print"
            >
              {esgLoading ? (
                <div className="text-sm text-muted-foreground">Loading ESG summary…</div>
              ) : esg && esg.hasData ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {esg.categories.map((c) => (
                      <NeuCard key={c.key} variant="flat" className="p-4">
                        <div className="text-[10px] font-bold text-primary/70 uppercase tracking-wide mb-1">{c.esrsRef}</div>
                        <div className="text-xl font-bold text-foreground mb-1">{c.value}</div>
                        <div className="text-xs font-semibold text-foreground mb-1">{c.title}</div>
                        <div className="text-[11px] text-muted-foreground leading-relaxed">{c.detail}</div>
                      </NeuCard>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed tone-amber rounded-xl p-3">
                    <strong>Note:</strong> {esg.disclaimer}
                  </p>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Not enough enrolled member data yet to build an ESG summary for this month.</div>
              )}
            </CardShell>

            {/* Certification badge */}
            <CardShell
              title="Aorane Health-Certified Workplace"
              description="A shareable badge for your careers page or LinkedIn, based on this month's real usage"
              action={<Award size={15} className="text-primary" />}
              className="no-print"
            >
              {certLoading ? (
                <div className="text-sm text-muted-foreground">Checking certification status…</div>
              ) : cert ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                    <img src={certBadgeUrl} alt="Aorane Health certification badge" className="h-14 w-auto" />
                    <div className="flex-1 text-xs text-muted-foreground">
                      {cert.certified ? (
                        <span>Certified for {cert.month}. Copy the link below to embed this badge on your careers page.</span>
                      ) : (
                        <span>
                          Not yet certified for {cert.month} — needs at least {cert.thresholds.minEngagementPct}% weekly engagement (currently {cert.engagementPct}%) and an average health score of {cert.thresholds.minAvgHealthScore}+ (currently {cert.avgHealthScore}).
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="neu-inset flex items-center gap-2 rounded-xl px-3 py-2">
                    <code className="flex-1 text-[11px] text-muted-foreground truncate">{certBadgeUrl}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(certBadgeUrl).then(() => {
                          setCertLinkCopied(true);
                          setTimeout(() => setCertLinkCopied(false), 2500);
                        });
                      }}
                      className="shrink-0 text-primary"
                    >
                      <Copy size={12} /> {certLinkCopied ? "Copied!" : "Copy link"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Certification status unavailable right now.</div>
              )}
            </CardShell>
          </>
        )}
      </div>

      {/* ── Print View (hidden, shown only on print) — untouched ─────────── */}
      <div id="corporate-report-print" ref={printRef} style={{ fontFamily: "Arial, sans-serif", color: "#0d1f33" }}>
        {showFullReport && (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            {/* Print Header */}
            <div style={{ background: "linear-gradient(135deg, #0077B6, #023E8A, #1B998B)", padding: "32px 40px", borderRadius: "12px", marginBottom: "24px" }}>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>AORANE</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em", marginTop: "2px" }}>INDIA'S HEALTH INTELLIGENCE PLATFORM</div>
              <div style={{ marginTop: "20px", padding: "14px 20px", background: "rgba(255,255,255,0.12)", borderRadius: "10px" }}>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff" }}>{org?.name}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
                  {org?.city ? `${org.city}, ${org.state}` : org?.state || "India"} • Monthly Health Report
                </div>
              </div>
              <div style={{ marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{formatMonthLabel(month)}</div>
                <div style={{ background: report!.gradeColor || "#0077B6", padding: "5px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                  {report!.grade} — {report!.gradeLabel}
                </div>
              </div>
            </div>

            {/* Print Stats */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
              {[
                { label: "Avg Health Score", value: `${report!.averages?.healthScore ?? 0}/100`, color: "#0077B6" },
                { label: "Active Members",   value: String(report!.activeMembers),               color: "#10b981" },
                { label: "Exercise Compliance", value: `${report!.compliance.exercisePct}%`,     color: "#7c3aed" },
                { label: "Hydration Goal",   value: `${report!.compliance.waterPct}%`,           color: "#0284c7" },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", padding: "16px", background: "#f9fafb", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "26px", fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "4px", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Print Pillars */}
            <div style={{ background: "#f9fafb", borderRadius: "10px", padding: "20px", marginBottom: "24px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px", color: "#0d1f33" }}>Health Pillars</div>
              {[
                { label: "Physical Activity",  score: report!.averages?.exerciseScore  ?? 0 },
                { label: "Nutrition & Diet",   score: report!.averages?.foodScore      ?? 0 },
                { label: "Hydration",          score: report!.averages?.waterScore     ?? 0 },
                { label: "Sleep Quality",      score: report!.averages?.sleepScore     ?? 0 },
                { label: "Stress Management",  score: report!.averages?.stressScore    ?? 0 },
                { label: "Medicine Adherence", score: report!.averages?.medicineScore  ?? 0 },
              ].map((p, i) => {
                const c = p.score >= 75 ? "#10b981" : p.score >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: "12px", width: "140px", color: "#374151" }}>{p.label}</span>
                    <div style={{ flex: 1, height: "8px", background: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${p.score}%`, height: "8px", background: c, borderRadius: "4px" }} />
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: c, width: "50px", textAlign: "right" }}>{p.score}/100</span>
                  </div>
                );
              })}
            </div>

            {/* Print AI Insights */}
            {insights && (
              <div style={{ background: "#f0f9ff", borderRadius: "10px", padding: "20px", marginBottom: "24px", border: "1px solid #bae6fd" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px", color: "#0d1f33" }}>AI Health Guide</div>
                <div style={{ fontSize: "12px", lineHeight: "1.7", color: "#374151", whiteSpace: "pre-wrap" }}>
                  {insights.replace(/## /g, "\n\n").replace(/\*\*/g, "").trim()}
                </div>
              </div>
            )}

            {/* Print Footer */}
            <div style={{ background: "#0d1f33", borderRadius: "10px", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>AORANE</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
                Confidential — DPDP Act 2023 Compliant &nbsp;•&nbsp; aorane.com
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
