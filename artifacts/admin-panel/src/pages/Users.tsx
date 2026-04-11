import React, { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import { api, type User, type SearchResult } from "@/lib/api";
import { Search, Shield, Ban, CheckCircle, RefreshCw, Fingerprint, X, User as UserIcon } from "lucide-react";

const PLANS = ["free", "max", "pro", "family"];
const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  max: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  pro: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  family: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
};

function UserRow({ user, onUpdate }: { user: User; onUpdate: (id: string, d: Partial<User>) => void }) {
  const [updating, setUpdating] = useState(false);
  const act = async (data: Partial<User>) => { setUpdating(true); await onUpdate(user.id, data); setUpdating(false); };

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-muted-foreground truncate max-w-[100px]">{user.id?.slice(0,8)}...</div>
        <div className="text-sm font-medium text-foreground mt-0.5">{user.phone || "—"}</div>
      </td>
      <td className="px-4 py-3">
        <select value={user.plan} onChange={(e) => act({ plan: e.target.value })}
          disabled={updating}
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border-0 cursor-pointer ${PLAN_COLORS[user.plan] || PLAN_COLORS.free}`}>
          {PLANS.map((p) => <option key={p} value={p} className="bg-background text-foreground capitalize">{p}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
          ${user.isBanned ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : user.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
          {user.isBanned ? "Banned" : user.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => act({ isBanned: !user.isBanned })} disabled={updating}
            className={`p-1.5 rounded-lg text-xs transition-all ${user.isBanned ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"}`}
            title={user.isBanned ? "Unban" : "Ban"}>
            {user.isBanned ? <CheckCircle size={13} /> : <Ban size={13} />}
          </button>
          <button onClick={() => act({ isActive: !user.isActive })} disabled={updating}
            className="p-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-all"
            title={user.isActive ? "Deactivate" : "Activate"}>
            <Shield size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function SearchResultCard({ r }: { r: SearchResult }) {
  const genderLabel = r.gender === "male" ? "Male" : r.gender === "female" ? "Female" : "Other";
  const planColor = PLAN_COLORS[r.plan] || PLAN_COLORS.free;
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <UserIcon size={18} className="text-primary" />
          </div>
          <div>
            <div className="font-semibold text-foreground">{r.name || "—"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{r.phone}</div>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planColor}`}>{r.plan}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-muted/40 rounded-lg px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase font-medium mb-0.5">AORANE ID</div>
          <div className="font-mono text-sm font-bold text-primary tracking-widest">
            {r.aoraneId ? r.aoraneId.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3") : "Not generated"}
          </div>
        </div>
        <div className="bg-muted/40 rounded-lg px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase font-medium mb-0.5">Blood Group</div>
          <div className="text-sm font-bold text-red-500">{r.bloodGroup || "—"}</div>
        </div>
        <div className="bg-muted/40 rounded-lg px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase font-medium mb-0.5">Gender / Age</div>
          <div className="text-sm font-medium">{genderLabel}, {r.age ? `${r.age} yrs` : "—"}</div>
        </div>
        <div className="bg-muted/40 rounded-lg px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase font-medium mb-0.5">City / BMI</div>
          <div className="text-sm font-medium">{r.city || "—"} · BMI {r.bmi || "—"}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.isBanned ? "bg-red-100 text-red-600" : r.isActive ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
          {r.isBanned ? "Banned" : r.isActive ? "Active" : "Inactive"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Joined {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </span>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [aoraneQuery, setAoraneQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = () => { setLoading(true); api.users().then((r) => setUsers(r.users)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { fetchUsers(); }, []);

  const updateUser = async (id: string, data: Partial<User>) => {
    await api.updateUser(id, data);
    setUsers((u) => u.map((x) => x.id === id ? { ...x, ...data } : x));
  };

  const filtered = users.filter((u) => !search || u.phone?.includes(search) || u.id?.includes(search));

  const handleAoraneSearch = (q: string) => {
    setAoraneQuery(q);
    setSearchError("");
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!q.trim() || q.trim().length < 4) { setSearchResults(null); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.searchUsers(q.trim());
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
        {/* AORANE ID Search Section */}
        <div className="bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border border-primary/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Fingerprint size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">AORANE ID Search</h2>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">12-digit</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">AORANE ID (12 digits) ya naam se user dhundho</p>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={aoraneQuery}
              onChange={(e) => handleAoraneSearch(e.target.value)}
              placeholder="Search by AORANE ID or name..."
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
                <div className="text-center text-muted-foreground text-sm py-6 bg-muted/30 rounded-xl">
                  No user found for "{aoraneQuery}"
                </div>
              ) : (
                <div>
                  <div className="text-xs text-muted-foreground mb-3">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {searchResults.map((r) => <SearchResultCard key={r.userId} r={r} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* All Users Table */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">All Users</h1>
              <p className="text-muted-foreground text-sm">{users.length} registered users</p>
            </div>
            <button onClick={fetchUsers} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg transition-all">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Phone ya user ID se dhundho..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-all" />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["User", "Plan", "Status", "Joined", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">Koi user nahi mila</td></tr>
                  ) : (
                    filtered.map((u) => <UserRow key={u.id} user={u} onUpdate={updateUser} />)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
