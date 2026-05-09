import React, { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { api, type CorporateReport } from "@/lib/api";

export type { CorporateReport as ReportData };
import {
  FileText, Download, Mail, TrendingUp, TrendingDown,
  Activity, Utensils, Droplets, Moon, Brain, Pill,
  Users, BarChart3, Sparkles, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, Loader2, UserPlus, Copy, Share2,
  ClipboardList, QrCode,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

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

function getGradeStyle(grade: string | null) {
  if (grade === "A+") return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", badge: "bg-emerald-500" };
  if (grade === "A")  return { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    badge: "bg-blue-500" };
  if (grade === "B")  return { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200",     badge: "bg-sky-500" };
  if (grade === "C")  return { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   badge: "bg-amber-500" };
  if (grade === "D")  return { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     badge: "bg-red-500" };
  return { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", badge: "bg-gray-400" };
}

function ScoreBar({ score, label, icon: Icon }: { score: number; label: string; icon: React.ElementType }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <Icon size={16} className="text-muted-foreground shrink-0" />
      <span className="text-sm text-foreground w-36 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-sm font-bold tabular-nums w-12 text-right ${textColor}`}>{score}/100</span>
    </div>
  );
}

function GradeCard({ grade, count, label, color }: { grade: string; count: number; label: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 text-center border ${color} flex-1 min-w-[80px]`}>
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
          <div key={i} className="rounded-xl border border-border bg-muted/30 p-4">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-black">{i + 1}</span>
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
    {
      icon: Share2,
      title: "Share Enrollment Code",
      desc: "Send this code to your employees via email or WhatsApp. They'll enter it in the AORANE mobile app.",
    },
    {
      icon: UserPlus,
      title: "Employees Join",
      desc: "Employees download the AORANE app, go to Profile → Join Organisation, and enter the code.",
    },
    {
      icon: ClipboardList,
      title: "They Log Health Data",
      desc: "Members log food, water, exercise, sleep, and medicines daily in the app.",
    },
    {
      icon: BarChart3,
      title: "Report Generates",
      desc: "Once members have logged data, this report page will automatically populate with aggregated analytics.",
    },
  ];

  return (
    <div className="flex flex-col items-center py-10 px-4 max-w-2xl mx-auto">
      {/* Illustration area */}
      <div className="w-20 h-20 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-5">
        <Users size={36} className="text-primary/60" />
      </div>

      <h2 className="text-xl font-bold text-foreground text-center">No members enrolled yet</h2>
      <p className="text-sm text-muted-foreground text-center mt-2 max-w-md leading-relaxed">
        Health reports will appear once employees join <strong>{orgName}</strong> and start logging their health data. Here's how to get started:
      </p>

      {/* Enrollment Code Card */}
      <div className="w-full mt-8 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <div className="flex items-center gap-2 mb-1">
          <QrCode size={15} className="text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Your Enrollment Code</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 font-mono text-3xl font-black text-foreground tracking-widest bg-white rounded-xl px-5 py-3 border border-primary/20 text-center">
            {orgCode}
          </div>
          <button
            onClick={handleCopy}
            className="flex flex-col items-center gap-1 p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
          >
            {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
            <span className="text-[10px] font-semibold">{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          Employees enter this code in <strong>AORANE App → Profile → Join Organisation</strong>. Their health data will then appear in your reports.
        </p>
      </div>

      {/* Steps */}
      <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
              <step.icon size={15} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] flex items-center justify-center font-black shrink-0">{i + 1}</span>
                {step.title}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="w-full mt-5 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl p-4 border border-border">
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
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
        <ClipboardList size={28} className="text-amber-500" />
      </div>
      <h2 className="text-lg font-bold text-foreground">No health data for {formatMonthLabel(month)}</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        You have <strong>{totalMembers} member{totalMembers !== 1 ? "s" : ""}</strong> enrolled, but none of them logged health data in {formatMonthLabel(month)}. Encourage your team to use the AORANE app daily.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 w-full">
        {[
          { icon: Utensils, label: "Log Food", color: "text-orange-500 bg-orange-50 border-orange-200" },
          { icon: Droplets, label: "Log Water", color: "text-sky-500 bg-sky-50 border-sky-200" },
          { icon: Activity, label: "Log Exercise", color: "text-emerald-500 bg-emerald-50 border-emerald-200" },
        ].map((item, i) => (
          <div key={i} className={`rounded-xl border p-3 flex flex-col items-center gap-2 text-center ${item.color}`}>
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

// ─── Print Styles (injected once) ─────────────────────────────────────────────

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
  const gradeStyle = getGradeStyle(report?.grade ?? null);

  // Derived state flags
  const hasMembers   = report && report.totalMembers > 0;
  const hasData      = report && report.activeMembers > 0;
  const showFullReport = hasMembers && hasData;

  return (
    <Layout>
      <style>{PRINT_STYLE}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card/50 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              Monthly Health Report
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aggregate employee health analytics — DPDP Act 2023 compliant
            </p>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(getPrevMonth(month))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[130px] text-center">
              {formatMonthLabel(month)}
            </span>
            <button
              onClick={() => !isCurrentOrFuture && setMonth(getNextMonth(month))}
              disabled={isCurrentOrFuture}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDownloadPDF}
              disabled={!showFullReport || reportLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <Download size={15} />
              Download PDF
            </button>
            <button
              onClick={() => emailMutation.mutate()}
              disabled={!showFullReport || emailMutation.isPending || emailSent}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
            >
              {emailMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : emailSent ? (
                <CheckCircle size={15} className="text-emerald-500" />
              ) : (
                <Mail size={15} />
              )}
              {emailSent ? "Sent!" : "Email Report"}
            </button>
          </div>
        </div>

        {emailMutation.isError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            {(emailMutation.error as Error)?.message || "Email failed. Try again."}
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="p-6 space-y-6">

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
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <AlertCircle size={16} />
            Failed to load report data. Please try again.
          </div>
        )}

        {/* ── Case 1: No members enrolled at all ── */}
        {!reportLoading && !reportError && report && !hasMembers && (
          <NoMembersState
            orgCode={report.org ? (org?.orgCode ?? "—") : (org?.orgCode ?? "—")}
            orgName={org?.name ?? report.org?.name ?? "your organisation"}
          />
        )}

        {/* ── Case 2: Members exist but no data this month ── */}
        {!reportLoading && !reportError && hasMembers && !hasData && (
          <NoDataThisMonth month={month} totalMembers={report!.totalMembers} />
        )}

        {/* ── Case 3: Full report ── */}
        {showFullReport && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className={`rounded-2xl p-5 border ${gradeStyle.bg} ${gradeStyle.border} text-center`}>
                <div className={`text-4xl font-black ${gradeStyle.text}`}>{report!.averages?.healthScore ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1 font-semibold">AVG HEALTH SCORE</div>
                <div className={`mt-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white ${gradeStyle.badge}`}>
                  {report!.grade} — {report!.gradeLabel}
                </div>
              </div>
              <div className="rounded-2xl p-5 border border-emerald-200 bg-emerald-50 text-center">
                <div className="text-4xl font-black text-emerald-600">{report!.activeMembers}</div>
                <div className="text-xs text-muted-foreground mt-1 font-semibold">ACTIVE MEMBERS</div>
                <div className="text-xs text-emerald-600 mt-2">of {report!.totalMembers} enrolled</div>
              </div>
              <div className="rounded-2xl p-5 border border-violet-200 bg-violet-50 text-center">
                <div className="text-4xl font-black text-violet-600">{report!.compliance.exercisePct}%</div>
                <div className="text-xs text-muted-foreground mt-1 font-semibold">EXERCISE COMPLIANCE</div>
                <div className="text-xs text-violet-600 mt-2">≥ 30 min/day</div>
              </div>
              <div className="rounded-2xl p-5 border border-sky-200 bg-sky-50 text-center">
                <div className="text-4xl font-black text-sky-600">{report!.compliance.waterPct}%</div>
                <div className="text-xs text-muted-foreground mt-1 font-semibold">HYDRATION GOAL MET</div>
                <div className="text-xs text-sky-600 mt-2">≥ 8 glasses/day</div>
              </div>
            </div>

            {/* Health Pillars */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                Health Pillars (Employee Average)
              </h3>
              <div>
                <ScoreBar score={report!.averages?.exerciseScore  ?? 0} label="Physical Activity"  icon={Activity}  />
                <ScoreBar score={report!.averages?.foodScore      ?? 0} label="Nutrition & Diet"   icon={Utensils}  />
                <ScoreBar score={report!.averages?.waterScore     ?? 0} label="Hydration"          icon={Droplets}  />
                <ScoreBar score={report!.averages?.sleepScore     ?? 0} label="Sleep Quality"      icon={Moon}      />
                <ScoreBar score={report!.averages?.stressScore    ?? 0} label="Stress Management"  icon={Brain}     />
                <ScoreBar score={report!.averages?.medicineScore  ?? 0} label="Medicine Adherence" icon={Pill}      />
              </div>
            </div>

            {/* Grade Distribution */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Users size={16} className="text-primary" />
                Employee Grade Distribution
              </h3>
              <div className="flex gap-3 flex-wrap">
                <GradeCard grade="A+" count={report!.gradeDistribution?.excellent        ?? 0} label="Excellent"        color="bg-emerald-50 border-emerald-200 text-emerald-700" />
                <GradeCard grade="A"  count={report!.gradeDistribution?.veryGood         ?? 0} label="Very Good"        color="bg-blue-50 border-blue-200 text-blue-700"          />
                <GradeCard grade="B"  count={report!.gradeDistribution?.good             ?? 0} label="Good"             color="bg-sky-50 border-sky-200 text-sky-700"              />
                <GradeCard grade="C"  count={report!.gradeDistribution?.average          ?? 0} label="Average"          color="bg-amber-50 border-amber-200 text-amber-700"        />
                <GradeCard grade="D/F" count={report!.gradeDistribution?.needsImprovement ?? 0} label="Needs Attention" color="bg-red-50 border-red-200 text-red-700"             />
              </div>
            </div>

            {/* AI Health Guide */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-6">
              <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                AI Health Guide for HR Team
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Powered by NVIDIA LLaMA 3.3 — 1 analysis per month, tailored to your team data
              </p>

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
            </div>

            {/* Data note */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl p-4 border border-border">
              <TrendingUp size={13} className="mt-0.5 shrink-0 text-primary/60" />
              <span>
                <strong>Data note:</strong> Report covers {report!.dataPoints.toLocaleString()} health log entries from {report!.activeMembers} active members in {formatMonthLabel(month)}.
                All data is anonymized and aggregated per <strong>DPDP Act 2023</strong>. Individual employee data is never shared.
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Print View (hidden, shown only on print) ──────────── */}
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
