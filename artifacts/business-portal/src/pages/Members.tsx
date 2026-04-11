import React, { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import { api, type Member, type MemberSearchResult } from "@/lib/api";
import { Users, Search, UserCheck, Droplet, RefreshCw, Fingerprint, X } from "lucide-react";

const BG_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500",
  "bg-rose-500", "bg-cyan-500", "bg-amber-500", "bg-teal-500",
];

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function SearchResultCard({ r }: { r: MemberSearchResult }) {
  const planColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    max: "bg-blue-100 text-blue-700",
    pro: "bg-purple-100 text-purple-700",
    family: "bg-green-100 text-green-700",
  };
  return (
    <div className="bg-card border border-primary/20 rounded-xl p-4 hover:shadow-md transition-all">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {getInitials(r.name)}
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">{r.name || "—"}</div>
            <div className="text-xs text-muted-foreground">{r.gender === "male" ? "Male" : r.gender === "female" ? "Female" : "Other"}{r.age ? `, ${r.age} yrs` : ""}</div>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${planColors[r.plan] || planColors.free}`}>{r.plan}</span>
      </div>
      <div className="bg-primary/5 rounded-lg px-3 py-2 mb-2">
        <div className="text-[10px] text-muted-foreground uppercase font-medium mb-0.5">AORANE ID</div>
        <div className="font-mono text-base font-bold text-primary tracking-widest">
          {r.aoraneId ? r.aoraneId.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3") : "Not generated yet"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/40 rounded-lg px-3 py-1.5">
          <div className="text-[10px] text-muted-foreground font-medium">Blood Group</div>
          <div className="text-sm font-bold text-red-500">{r.bloodGroup || "—"}</div>
        </div>
        <div className="bg-muted/40 rounded-lg px-3 py-1.5">
          <div className="text-[10px] text-muted-foreground font-medium">BMI / City</div>
          <div className="text-sm font-medium">{r.bmi || "—"} · {r.city || "—"}</div>
        </div>
      </div>
    </div>
  );
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [aoraneQuery, setAoraneQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMembers = () => {
    setLoading(true);
    setError("");
    api.members()
      .then((res) => setMembers(res.members))
      .catch(() => setError("Members load karne mein error"))
      .finally(() => setLoading(false));
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

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* AORANE ID Search */}
        <div className="bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border border-primary/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Fingerprint size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">AORANE ID Search</h2>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Members only</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Apne members ko AORANE ID ya naam se dhundho</p>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={aoraneQuery}
              onChange={(e) => handleAoraneSearch(e.target.value)}
              placeholder="AORANE ID (12 digits) ya member naam type karein..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:border-primary transition-all font-mono"
            />
            {aoraneQuery && (
              <button onClick={() => { setAoraneQuery(""); setSearchResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {searchLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Searching...
            </div>
          )}

          {searchError && (
            <div className="mt-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">{searchError}</div>
          )}

          {searchResults !== null && !searchLoading && (
            <div className="mt-4">
              {searchResults.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-5 bg-muted/30 rounded-xl">
                  Koi member nahi mila
                </div>
              ) : (
                <div>
                  <div className="text-xs text-muted-foreground mb-3">{searchResults.length} member{searchResults.length !== 1 ? "s" : ""} mila</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {searchResults.map((r) => <SearchResultCard key={r.userId} r={r} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* All Members Section */}
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">All Members</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{members.length} enrolled members</p>
            </div>
            <button onClick={fetchMembers} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-3 py-2 rounded-lg transition-all">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="relative mb-5">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name se search karein..."
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all"
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
                <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="h-3 bg-muted rounded mb-2 w-3/4" />
                      <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users size={40} className="text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">{search ? "Koi member nahi mila" : "Abhi tak koi member join nahi kiya"}</p>
              <p className="text-muted-foreground/60 text-sm mt-1">Organization code share karein to invite members</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((m, idx) => (
                <div key={m.memberId} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${BG_COLORS[idx % BG_COLORS.length]}`}>
                      {getInitials(m.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground text-sm truncate">{m.fullName || "Unknown User"}</div>
                      <div className="flex items-center gap-1.5 mt-1">
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
                      <div className="text-xs text-muted-foreground/60 mt-1.5">
                        Joined {new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
