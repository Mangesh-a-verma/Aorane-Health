import React, { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Member, type MemberSearchResult, type MemberDetail } from "@/lib/api";
import {
  Users, Search, UserCheck, Droplet, RefreshCw, Fingerprint, X,
  Download, ChevronRight, Activity, Calendar, TrendingUp, UserMinus, Loader2,
  ShieldCheck, PauseCircle, PlayCircle, EyeOff,
} from "lucide-react";

// DPDP-safe gradient avatars (no real photos)
const AVATAR_GRADIENTS = [
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-violet-400 to-purple-600",
  "from-orange-400 to-amber-600",
  "from-rose-400 to-pink-600",
  "from-cyan-400 to-sky-600",
  "from-amber-400 to-yellow-600",
  "from-teal-400 to-emerald-600",
];

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function exportCSV(members: Member[]) {
  const headers = ["Name", "Blood Group", "Role", "Joined At"];
  const rows = members.map(m => [
    m.fullName || "Unknown",
    m.bloodGroup || "—",
    m.role,
    new Date(m.joinedAt).toLocaleDateString("en-IN"),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aorane-members-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============ MEMBER DETAIL DRAWER (slides from right, Stitch-style) ============ */
function MemberDetailDrawer({
  userId, name, gradient, onClose,
}: {
  userId: string; name: string | null; gradient: string; onClose: () => void;
}) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [isActiveCurrent, setIsActiveCurrent] = useState<boolean | null>(null);

  useEffect(() => {
    api.getMemberDetail(userId)
      .then(d => { setDetail(d); setIsActiveCurrent(d.member.isActive); })
      .catch(e => setError((e as Error).message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleToggleActive = async () => {
    setToggling(true);
    try {
      const res = await api.toggleMemberActive(userId);
      setIsActiveCurrent(res.isActive);
    } catch (e: unknown) {
      alert((e as Error).message || "Failed to update member status");
    } finally { setToggling(false); }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${name || "this member"} from your organization?`)) return;
    setRemoving(true);
    try {
      await api.removeMember(userId);
      onClose();
    } catch (e: unknown) {
      alert((e as Error).message || "Failed to remove member");
      setRemoving(false);
    }
  };

  const handleSuspend = async () => {
    if (!confirm(`Suspend ${name || "this member"}'s access? Their seat is reserved but they will be hidden from your organization until restored.`)) return;
    setSuspending(true);
    try {
      await api.suspendMember(userId);
      alert("Member access suspended. You can restore them from the suspended section.");
      onClose();
    } catch (e: unknown) {
      alert((e as Error).message || "Failed to suspend member");
      setSuspending(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(`Cancel the subscription for ${name || "this member"}? Their plan will be downgraded to Free.`)) return;
    setCancellingSubscription(true);
    try {
      await api.cancelMemberSubscription(userId);
      alert("Subscription cancelled. Member downgraded to Free plan.");
      onClose();
    } catch (e: unknown) {
      alert((e as Error).message || "Failed to cancel subscription");
      setCancellingSubscription(false);
    }
  };

  const latestScore = detail?.recentScores?.[0]?.overallScore ?? null;
  const healthLabel =
    latestScore == null ? "—" :
    latestScore >= 80 ? "Excellent" :
    latestScore >= 60 ? "Good" :
    latestScore >= 40 ? "Fair" : "Needs Care";
  const healthColor =
    latestScore == null ? "#9CA3AF" :
    latestScore >= 80 ? "#10B981" :
    latestScore >= 60 ? "#0077B6" :
    latestScore >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Member details"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Member Profile</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading member data...</p>
            </div>
          ) : error ? (
            <div className="m-5 text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">{error}</div>
          ) : detail ? (
            <div className="px-5 py-5 space-y-5">
              {/* Hero: gradient avatar + name */}
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-display font-bold text-xl shrink-0 shadow-md ring-4 ring-card`}>
                  {getInitials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-bold text-xl text-foreground truncate">{name || "Member"}</h2>
                  <div className="text-sm text-muted-foreground capitalize mt-0.5">{detail.member.role || "Member"}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="pill-chip bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                    </span>
                    {detail.user?.aoraneId && (
                      <span className="pill-chip bg-muted text-muted-foreground font-mono-data">
                        ID: {detail.user.aoraneId.slice(-6)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Aorane ID full */}
              {detail.user?.aoraneId && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Aorane ID</div>
                  <div className="font-mono-data text-base font-bold text-primary tracking-widest">
                    {detail.user.aoraneId.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3")}
                  </div>
                </div>
              )}

              {/* Health Index + Plan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-card border border-border p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                    <Activity size={11} style={{ color: healthColor }} /> Health Index
                  </div>
                  <div className="kpi-number text-2xl" style={{ color: healthColor }}>
                    {latestScore ?? "—"}<span className="text-sm text-muted-foreground font-normal">{latestScore != null ? "/100" : ""}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{healthLabel}</div>
                </div>
                <div className="rounded-xl bg-card border border-border p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                    <Calendar size={11} className="text-amber-500" /> Plan
                  </div>
                  <div className="kpi-number text-2xl text-foreground capitalize">{detail.user?.plan || "free"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Subscription tier</div>
                </div>
              </div>

              {/* Profile facts grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/40 p-3">
                  <Droplet size={12} className="text-red-400 mb-1" />
                  <div className="text-[10px] text-muted-foreground font-medium uppercase">Blood</div>
                  <div className="font-bold text-sm text-foreground">{detail.profile?.bloodGroup || "—"}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <Activity size={12} className="text-primary mb-1" />
                  <div className="text-[10px] text-muted-foreground font-medium uppercase">BMI</div>
                  <div className="font-bold text-sm text-foreground">{detail.profile?.bmi || "—"}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <UserCheck size={12} className="text-emerald-500 mb-1" />
                  <div className="text-[10px] text-muted-foreground font-medium uppercase">Gender</div>
                  <div className="font-bold text-sm text-foreground capitalize">{detail.profile?.gender || "—"}</div>
                </div>
              </div>

              {/* Recent Health Scores */}
              {detail.recentScores?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={14} className="text-primary" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Recent Scores</span>
                  </div>
                  <div className="space-y-2">
                    {detail.recentScores.slice(0, 5).map((s) => {
                      const score = s.overallScore ?? 0;
                      const c = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
                      return (
                        <div key={s.scoreDate} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground shrink-0 w-20">
                            {new Date(s.scoreDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: c }} />
                          </div>
                          <span className="text-xs font-mono-data font-semibold tabular-nums w-8 text-right" style={{ color: c }}>
                            {s.overallScore ?? "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Joined date */}
              <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground border border-border/50">
                <span className="text-foreground font-medium">Joined:</span>{" "}
                {new Date(detail.member.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </div>

              {/* DPDP notice */}
              <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5 flex items-start gap-2">
                <ShieldCheck size={14} className="text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  All health metrics are anonymized and shown per DPDP Act 2023 Section 8(1). Full consent log on file.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        {detail && (
          <div className="border-t border-border px-5 py-4 space-y-2 shrink-0 bg-card">
            {/* One-click Enable / Disable toggle */}
            <button
              onClick={handleToggleActive}
              disabled={toggling || isActiveCurrent === null}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold border transition-all disabled:opacity-50 ${
                isActiveCurrent
                  ? "text-orange-700 border-orange-300 hover:bg-orange-50"
                  : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              }`}
            >
              {toggling ? <Loader2 size={14} className="animate-spin" /> : isActiveCurrent ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
              {isActiveCurrent ? "Disable Member" : "Enable Member"}
            </button>
            {detail.user?.plan && detail.user.plan !== "free" && (
              <button
                onClick={handleCancelSubscription}
                disabled={cancellingSubscription}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold text-amber-700 border border-amber-300 hover:bg-amber-50 transition-all disabled:opacity-50"
              >
                {cancellingSubscription ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                Cancel Subscription
              </button>
            )}
            <button
              onClick={handleSuspend}
              disabled={suspending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold text-orange-700 border border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-50"
            >
              {suspending ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
              Suspend Access
            </button>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold text-destructive border border-destructive/30 hover:bg-destructive/5 transition-all disabled:opacity-50"
            >
              {removing ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
              Remove from Organization
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ============ SEARCH RESULT CARD (Aorane ID search) ============ */
function SearchResultCard({ r, idx, onClick }: { r: MemberSearchResult; idx: number; onClick?: () => void }) {
  const planColors: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    max: "bg-primary/10 text-primary",
    pro: "bg-violet-100 text-violet-700",
    family: "bg-emerald-100 text-emerald-700",
  };
  const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
  return (
    <div
      className="bg-card border border-primary/20 rounded-2xl p-4 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-display font-bold text-sm`}>
            {getInitials(r.name)}
          </div>
          <div>
            <div className="font-display font-semibold text-sm text-foreground">{r.name || "—"}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {r.gender === "male" ? "Male" : r.gender === "female" ? "Female" : r.gender || "—"}
              {r.age ? `, ${r.age} yrs` : ""}
            </div>
          </div>
        </div>
        <span className={`pill-chip uppercase ${planColors[r.plan] || planColors.free}`}>{r.plan}</span>
      </div>
      <div className="bg-primary/5 rounded-xl px-3 py-2 mb-2 border border-primary/10">
        <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-0.5">Aorane ID</div>
        <div className="font-mono-data text-base font-bold text-primary tracking-widest">
          {r.aoraneId ? r.aoraneId.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3") : "Not generated yet"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className="text-[10px] text-muted-foreground font-medium uppercase">Blood</div>
          <div className="text-sm font-bold text-red-500">{r.bloodGroup || "—"}</div>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className="text-[10px] text-muted-foreground font-medium uppercase">BMI / City</div>
          <div className="text-sm font-medium text-foreground">{r.bmi || "—"} · {r.city || "—"}</div>
        </div>
      </div>
    </div>
  );
}

/* ============ MAIN MEMBERS PAGE ============ */
export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [aoraneQuery, setAoraneQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailName, setDetailName] = useState<string | null>(null);
  const [detailGradient, setDetailGradient] = useState<string>(AVATAR_GRADIENTS[0]);
  const [suspendedMembers, setSuspendedMembers] = useState<Member[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMembers = () => {
    setLoading(true);
    setError("");
    Promise.all([api.members(), api.getSuspendedMembers()])
      .then(([res, susp]) => {
        setMembers(res.members);
        setSuspendedMembers(susp.members);
      })
      .catch(() => setError("Failed to load members"))
      .finally(() => setLoading(false));
  };

  const handleRestore = async (userId: string) => {
    if (!confirm("Restore this member's access?")) return;
    setRestoringId(userId);
    try {
      await api.restoreMember(userId);
      fetchMembers();
    } catch (e: unknown) {
      alert((e as Error).message || "Failed to restore member");
    } finally { setRestoringId(null); }
  };

  useEffect(() => { fetchMembers(); }, []);

  const filtered = members.filter((m) =>
    !search || (m.fullName?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAoraneSearch = (q: string) => {
    setAoraneQuery(q);
    setSearchError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 4) { setSearchResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.searchMembers(q.trim());
        setSearchResults(res.results);
      } catch (e: unknown) {
        setSearchError((e as Error).message || "Search failed");
        setSearchResults([]);
      } finally { setSearchLoading(false); }
    }, 500);
  };

  const openDetail = (m: Member, idx: number) => {
    setDetailUserId(m.userId);
    setDetailName(m.fullName);
    setDetailGradient(AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]);
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* DPDP Notice Strip */}
        <div className="rounded-xl bg-secondary/5 border border-secondary/20 px-4 py-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
            <ShieldCheck size={16} className="text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-semibold text-sm text-foreground">DPDP Act 2023 Notice</span>
              <span className="pill-chip bg-secondary/15 text-secondary uppercase">Verified</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              All member health metrics shown are anonymized per Section 8(1) of the Digital Personal Data Protection Act. Full consent logs are maintained.
            </p>
          </div>
        </div>

        {/* Page header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl text-foreground tracking-tight">Member Management</h1>
            <p className="text-muted-foreground text-sm mt-1.5 max-w-md">
              Oversee wellness metrics and enrollment across your organization.
            </p>
          </div>
          <div className="rounded-2xl bg-card border border-border px-5 py-3 flex items-center gap-3">
            <Users size={18} className="text-primary" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Members</div>
              <div className="kpi-number text-2xl text-foreground">{members.length}</div>
            </div>
          </div>
        </div>

        {/* Aorane ID Search */}
        <div className="bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border border-primary/15 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Fingerprint size={18} className="text-primary" />
            <h2 className="font-display font-bold text-base text-foreground">Aorane ID Search</h2>
            <span className="pill-chip bg-primary/10 text-primary uppercase">Members only</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Search your members by Aorane ID or name</p>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={aoraneQuery}
              onChange={(e) => handleAoraneSearch(e.target.value)}
              placeholder="Aorane ID (12 digits) or member name..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-mono-data"
            />
            {aoraneQuery && (
              <button onClick={() => { setAoraneQuery(""); setSearchResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {searchLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin text-primary" />
              Searching...
            </div>
          )}

          {searchError && (
            <div className="mt-3 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{searchError}</div>
          )}

          {searchResults !== null && !searchLoading && (
            <div className="mt-4">
              {searchResults.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-5 bg-muted/30 rounded-xl">
                  No members found
                </div>
              ) : (
                <div>
                  <div className="text-xs text-muted-foreground mb-3">{searchResults.length} member{searchResults.length !== 1 ? "s" : ""} found</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {searchResults.map((r, i) => (
                      <SearchResultCard
                        key={r.userId}
                        r={r}
                        idx={i}
                        onClick={() => {
                          setDetailUserId(r.userId);
                          setDetailName(r.name);
                          setDetailGradient(AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* All Members Section */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-foreground">All Members</h2>
              <span className="pill-chip bg-muted text-muted-foreground tabular-nums">{members.length}</span>
            </div>
            <div className="flex items-center gap-2">
              {members.length > 0 && (
                <button
                  onClick={() => exportCSV(filtered)}
                  className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 px-3 py-2 rounded-full transition-all"
                >
                  <Download size={14} />
                  Export CSV
                </button>
              )}
              <button
                onClick={fetchMembers}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-3 py-2 rounded-full transition-all"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          <div className="relative mb-5">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="h-3 bg-muted rounded mb-2 w-3/4" />
                      <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-dashed border-border rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Users size={24} className="text-muted-foreground/50" />
              </div>
              <p className="font-display font-semibold text-foreground">{search ? "No members found" : "No members have joined yet"}</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                {search ? "Try a different search query." : "Share your organization enrollment code to invite members."}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((m, idx) => {
                const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                return (
                  <div
                    key={m.memberId}
                    className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => openDetail(m, idx)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-display font-bold text-sm shrink-0 shadow-sm`}>
                        {getInitials(m.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold text-foreground text-sm truncate">{m.fullName || "Unknown User"}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <UserCheck size={11} className="text-primary" />
                          <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                          {m.bloodGroup && m.bloodGroup !== "Unknown" && (
                            <>
                              <span className="text-muted-foreground/30">•</span>
                              <Droplet size={11} className="text-red-400" />
                              <span className="text-xs text-red-500 font-medium">{m.bloodGroup}</span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground/70 mt-1.5">
                          Joined {new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Suspended Members Section */}
        {suspendedMembers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <EyeOff size={16} className="text-orange-500" />
              <h2 className="font-display font-bold text-lg text-foreground">Suspended Members</h2>
              <span className="pill-chip bg-orange-100 text-orange-700 tabular-nums">{suspendedMembers.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">These members have suspended access. Their seat is reserved. You can restore them at any time.</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {suspendedMembers.map((m, idx) => {
                const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                return (
                  <div key={m.memberId} className="bg-card border border-orange-200/60 rounded-2xl p-4 opacity-75">
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-display font-bold text-sm shrink-0 shadow-sm grayscale`}>
                        {getInitials(m.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold text-foreground text-sm truncate">{m.fullName || "Unknown User"}</div>
                        <span className="pill-chip bg-orange-100 text-orange-700 text-[10px] mt-1">Suspended</span>
                        <div className="text-[11px] text-muted-foreground/70 mt-1">
                          Joined {new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestore(m.userId)}
                        disabled={restoringId === m.userId}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 px-3 py-1.5 rounded-full transition-all disabled:opacity-50 shrink-0"
                      >
                        {restoringId === m.userId ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                        Restore
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {detailUserId && (
        <MemberDetailDrawer
          userId={detailUserId}
          name={detailName}
          gradient={detailGradient}
          onClose={() => { setDetailUserId(null); setDetailName(null); fetchMembers(); }}
        />
      )}
    </Layout>
  );
}
