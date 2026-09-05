import React, { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import { api, type Member, type MemberSearchResult, type MemberDetail } from "@/lib/api";
import {
  Users, Search, UserCheck, RefreshCw, Fingerprint, X,
  Download, ChevronRight, Activity, Calendar, UserMinus, Loader2,
  ShieldCheck, PauseCircle, PlayCircle, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CardShell, EmptyState, NeuCard, PageHeader, PrivacyNote } from "@/components/portal/primitives";

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
  // Seat administration data only - no health columns. An exported CSV is the
  // easiest thing in the product to forward to someone who should never have
  // had the data in the first place.
  const headers = ["Name", "Role", "Joined At"];
  const rows = members.map(m => [
    m.fullName || "Unknown",
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

/* ============ MEMBER DETAIL DRAWER ============ */
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

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <SheetTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Member Profile
          </SheetTitle>
          <SheetDescription className="sr-only">Member details and administrative actions</SheetDescription>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading member data...</p>
            </div>
          ) : error ? (
            <div className="m-5 text-sm text-destructive tone-danger rounded-xl px-4 py-3">{error}</div>
          ) : detail ? (
            <div className="px-5 py-5 space-y-5">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-[var(--portal-neu-raised-sm)]`}>
                  {getInitials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-xl text-foreground truncate">{name || "Member"}</h2>
                  <div className="text-sm text-muted-foreground capitalize mt-0.5">{detail.member.role || "Member"}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="success">Active</Badge>
                    {detail.user?.aoraneId && (
                      <Badge variant="outline" className="font-mono-data">ID: {detail.user.aoraneId.slice(-6)}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {detail.user?.aoraneId && (
                <div className="neu-inset rounded-2xl px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Aorane ID</div>
                  <div className="font-mono-data text-base font-bold text-primary tracking-widest">
                    {detail.user.aoraneId.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3")}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <NeuCard variant="flat" className="p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                    <UserCheck size={11} className="text-primary" /> Seat
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {detail.member?.isActive ? "Active" : "Suspended"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">{detail.member?.role || "member"}</div>
                </NeuCard>
                <NeuCard variant="flat" className="p-3.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                    <Calendar size={11} className="text-[oklch(0.79_0.13_78)]" /> Plan
                  </div>
                  <div className="text-2xl font-bold text-foreground capitalize">{detail.user?.plan || "free"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Subscription tier</div>
                </NeuCard>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="neu-inset-sm rounded-xl p-3">
                  <Calendar size={12} className="text-primary mb-1" />
                  <div className="text-[10px] text-muted-foreground font-medium uppercase">Joined</div>
                  <div className="font-bold text-sm text-foreground">
                    {detail.member?.joinedAt ? new Date(detail.member.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </div>
                </div>
                <div className="neu-inset-sm rounded-xl p-3">
                  <UserCheck size={12} className="text-[oklch(0.68_0.12_162)] mb-1" />
                  <div className="text-[10px] text-muted-foreground font-medium uppercase">Gender</div>
                  <div className="font-bold text-sm text-foreground capitalize">{detail.profile?.gender || "—"}</div>
                </div>
              </div>

              <div className="mt-2">
                <PrivacyNote>
                  Seat and profile details only. This member's health data — scores, stress,
                  sleep, BMI — is never shown to administrators individually; it appears only
                  inside org-level aggregates, per the DPDP Act 2023.
                </PrivacyNote>
              </div>
            </div>
          ) : null}
        </div>

        {detail && (
          <div className="border-t border-border/60 px-5 py-4 space-y-2 shrink-0">
            <Button
              variant="neu"
              className="w-full"
              onClick={handleToggleActive}
              disabled={toggling || isActiveCurrent === null}
            >
              {toggling ? <Loader2 size={14} className="animate-spin" /> : isActiveCurrent ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
              {isActiveCurrent ? "Disable Member" : "Enable Member"}
            </Button>
            {detail.user?.plan && detail.user.plan !== "free" && (
              <Button
                variant="neu"
                className="w-full text-[oklch(0.55_0.13_80)]"
                onClick={handleCancelSubscription}
                disabled={cancellingSubscription}
              >
                {cancellingSubscription ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                Cancel Subscription
              </Button>
            )}
            <Button
              variant="neu"
              className="w-full text-[oklch(0.55_0.16_50)]"
              onClick={handleSuspend}
              disabled={suspending}
            >
              {suspending ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
              Suspend Access
            </Button>
            <Button
              variant="neu"
              className="w-full text-destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
              Remove from Organization
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ============ SEARCH RESULT CARD (Aorane ID search) ============ */
function SearchResultCard({ r, idx, onClick }: { r: MemberSearchResult; idx: number; onClick?: () => void }) {
  const planVariant: Record<string, "outline" | "soft" | "lavender" | "success"> = {
    free: "outline",
    max: "soft",
    pro: "lavender",
    family: "success",
  };
  const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
  return (
    <NeuCard
      variant="flat"
      className="p-4 hover:shadow-[var(--portal-neu-raised)] transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-sm`}>
            {getInitials(r.name)}
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">{r.name || "—"}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {r.gender === "male" ? "Male" : r.gender === "female" ? "Female" : r.gender || "—"}
              {r.age ? `, ${r.age} yrs` : ""}
            </div>
          </div>
        </div>
        <Badge variant={planVariant[r.plan] || "outline"} className="uppercase">{r.plan}</Badge>
      </div>
      <div className="neu-inset rounded-2xl px-3.5 py-2.5 mb-2">
        <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-0.5">Aorane ID</div>
        <div className="font-mono-data text-base font-bold text-primary tracking-widest">
          {r.aoraneId ? r.aoraneId.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3") : "Not generated yet"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="neu-inset-sm rounded-xl px-3 py-2">
          <div className="text-[10px] text-muted-foreground font-medium uppercase">Plan</div>
          <div className="text-sm font-bold text-foreground capitalize">{r.plan || "free"}</div>
        </div>
        <div className="neu-inset-sm rounded-xl px-3 py-2">
          <div className="text-[10px] text-muted-foreground font-medium uppercase">City</div>
          <div className="text-sm font-medium text-foreground">{r.city || "—"}</div>
        </div>
      </div>
    </NeuCard>
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
        <PageHeader
          eyebrow="People"
          title="Members"
          description="Oversee wellness metrics and enrollment across your organization."
          actions={
            <>
              {members.length > 0 && (
                <Button variant="neu" onClick={() => exportCSV(filtered)}>
                  <Download size={14} /> Export CSV
                </Button>
              )}
              <Button variant="neu" onClick={fetchMembers}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </Button>
            </>
          }
        />

        {/* Stat tiles */}
        <section className="grid grid-cols-2 sm:grid-cols-2 lg:w-1/2 gap-4">
          <NeuCard className="p-4 sm:p-5">
            <p className="truncate text-xs font-medium text-muted-foreground">Total</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{members.length}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">enrolled members</p>
          </NeuCard>
          <NeuCard className="p-4 sm:p-5">
            <p className="truncate text-xs font-medium text-muted-foreground">Suspended</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{suspendedMembers.length}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">access on hold</p>
          </NeuCard>
        </section>

        <NeuCard variant="glass" className="p-5">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">DPDP Act 2023 Notice</span>
            <Badge variant="success">Verified</Badge>
          </div>
          <PrivacyNote>
            This page shows seat administration data only — who holds a seat, their role and
            plan. No member health metric is shown here for an individual, at any admin
            permission level. Health data reaches this portal only as org-level aggregates,
            per the Digital Personal Data Protection Act 2023.
          </PrivacyNote>
        </NeuCard>

        {/* Aorane ID Search */}
        <CardShell
          title="Aorane ID Search"
          description="Search your members by Aorane ID or name"
          action={<Badge variant="soft" className="uppercase">Members only</Badge>}
          contentClassName="space-y-4"
        >
          <div className="neu-inset flex h-11 items-center gap-2 rounded-2xl px-3.5">
            <Fingerprint size={16} className="shrink-0 text-primary" />
            <input
              type="search"
              value={aoraneQuery}
              onChange={(e) => handleAoraneSearch(e.target.value)}
              placeholder="Aorane ID (12 digits) or member name…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground font-mono-data"
            />
            {aoraneQuery && (
              <button onClick={() => { setAoraneQuery(""); setSearchResults(null); }} className="shrink-0 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {searchLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin text-primary" />
              Searching...
            </div>
          )}

          {searchError && (
            <div className="text-sm text-destructive tone-danger rounded-lg px-3 py-2">{searchError}</div>
          )}

          {searchResults !== null && !searchLoading && (
            <div>
              {searchResults.length === 0 ? (
                <EmptyState icon={<Search />} title="No members found" description="Try a different search query." />
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
        </CardShell>

        {/* All Members */}
        <CardShell
          title="All Members"
          action={<Badge variant="outline">{members.length}</Badge>}
          contentClassName="space-y-5"
        >
          <div className="neu-inset flex h-11 items-center gap-2 rounded-2xl px-3.5">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {error && (
            <div className="tone-danger rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="neu-flat rounded-2xl p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-muted" />
                    <div className="flex-1">
                      <div className="h-3 bg-muted rounded mb-2 w-3/4" />
                      <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title={search ? "No members found" : "No members have joined yet"}
              description={search ? "Try a different search query." : "Share your organization enrollment code to invite members."}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((m, idx) => {
                const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                return (
                  <NeuCard
                    key={m.memberId}
                    variant="flat"
                    className="p-4 hover:shadow-[var(--portal-neu-raised)] transition-shadow cursor-pointer group"
                    onClick={() => openDetail(m, idx)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {getInitials(m.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate">{m.fullName || "Unknown User"}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <UserCheck size={11} className="text-primary" />
                          <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground/70 mt-1.5">
                          Joined {new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  </NeuCard>
                );
              })}
            </div>
          )}
        </CardShell>

        {/* Suspended Members */}
        {suspendedMembers.length > 0 && (
          <CardShell
            title="Suspended Members"
            description="These members have suspended access. Their seat is reserved. You can restore them at any time."
            action={
              <Badge variant="warning" className="tabular-nums">
                <EyeOff size={11} /> {suspendedMembers.length}
              </Badge>
            }
          >
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {suspendedMembers.map((m, idx) => {
                const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                return (
                  <NeuCard key={m.memberId} variant="inset" className="p-4 opacity-80">
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-sm shrink-0 grayscale`}>
                        {getInitials(m.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate">{m.fullName || "Unknown User"}</div>
                        <Badge variant="warning" className="mt-1">Suspended</Badge>
                        <div className="text-[11px] text-muted-foreground/70 mt-1">
                          Joined {new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="neu"
                        onClick={() => handleRestore(m.userId)}
                        disabled={restoringId === m.userId}
                        className="shrink-0 text-[oklch(0.5_0.13_162)]"
                      >
                        {restoringId === m.userId ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                        Restore
                      </Button>
                    </div>
                  </NeuCard>
                );
              })}
            </div>
          </CardShell>
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
