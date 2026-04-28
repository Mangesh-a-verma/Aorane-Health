import React, { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { api, type Org } from "@/lib/api";
import {
  Building2, MapPin, Mail, Users, RefreshCw, Phone, Calendar,
  Search, ChevronRight, Activity, Hash, Shield, Briefcase,
} from "lucide-react";

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  corporate:  { icon: "🏢", label: "Corporate",  color: "#0077B6" },
  hospital:   { icon: "🏥", label: "Hospital",   color: "#DC2626" },
  gym:        { icon: "💪", label: "Gym",         color: "#10B981" },
  insurance:  { icon: "🛡️", label: "Insurance",  color: "#8B5CF6" },
  ngo:        { icon: "🤝", label: "NGO",         color: "#F59E0B" },
  yoga:       { icon: "🧘", label: "Yoga",        color: "#06B6D4" },
  school:     { icon: "📚", label: "School",      color: "#3B82F6" },
  other:      { icon: "✨", label: "Other",       color: "#6B7280" },
};

const ALL_TYPES = ["all", ...Object.keys(TYPE_META)];

function OrgCard({ org }: { org: Org }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[org.orgType] || TYPE_META.other;
  const seatPct = org.totalSeats > 0 ? Math.round((org.usedSeats / org.totalSeats) * 100) : 0;
  const seatColor = seatPct >= 90 ? "#EF4444" : seatPct >= 70 ? "#F59E0B" : "#10B981";

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all hover:shadow-md ${org.isActive ? "border-border" : "border-red-200 dark:border-red-900/40"}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm"
               style={{ background: `${meta.color}14` }}>
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-foreground truncate text-sm">{org.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${meta.color}18`, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    org.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                 : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  }`}>
                    {org.isActive ? "● Active" : "○ Inactive"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ChevronRight size={16} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Org Code */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1">
            <Hash size={10} className="text-muted-foreground" />
            <span className="font-mono text-[11px] font-bold tracking-widest text-foreground uppercase">{org.orgCode}</span>
          </div>
          {org.createdAt && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar size={9} />
              <span>{new Date(org.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          )}
        </div>

        {/* Seat usage bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={11} />
              <span>Seats Used</span>
            </div>
            <span className="text-xs font-bold" style={{ color: seatColor }}>
              {org.usedSeats}/{org.totalSeats} ({seatPct}%)
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
                 style={{ width: `${Math.min(seatPct, 100)}%`, background: seatColor }} />
          </div>
        </div>
      </div>

      {/* Quick info row */}
      <div className="px-4 pb-3 space-y-1.5">
        {org.contactEmail && (
          <a href={`mailto:${org.contactEmail}`}
             className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors group">
            <Mail size={11} className="shrink-0" />
            <span className="truncate group-hover:underline">{org.contactEmail}</span>
          </a>
        )}
        {(org.city || org.state) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin size={11} className="shrink-0" />
            <span>{[org.city, org.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border mx-0 p-4 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Organization</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <Briefcase size={11} className="text-muted-foreground shrink-0" />
                  <span className="font-medium capitalize">{org.orgType}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Activity size={11} className="text-muted-foreground shrink-0" />
                  <span className={org.isActive ? "text-green-600" : "text-red-500"}>
                    {org.isActive ? "Operational" : "Suspended"}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Capacity</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <Users size={11} className="text-muted-foreground shrink-0" />
                  <span>{org.usedSeats} enrolled / {org.totalSeats} total</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Shield size={11} className="text-muted-foreground shrink-0" />
                  <span>{org.totalSeats - org.usedSeats} seats available</span>
                </div>
              </div>
            </div>
          </div>
          {org.contactEmail && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <a href={`mailto:${org.contactEmail}`}
                 className="inline-flex items-center gap-2 text-xs text-primary hover:underline font-medium">
                <Mail size={11} />
                Send Email to Admin
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Organizations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const fetchOrgs = () => {
    setLoading(true);
    api.organizations().then((r) => setOrgs(r.organizations)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { fetchOrgs(); }, []);

  const filtered = useMemo(() => {
    return orgs.filter(org => {
      const matchType = typeFilter === "all" || org.orgType === typeFilter;
      const matchStatus = statusFilter === "all" || (statusFilter === "active" ? org.isActive : !org.isActive);
      const matchSearch = !search || org.name.toLowerCase().includes(search.toLowerCase())
        || org.orgCode.toLowerCase().includes(search.toLowerCase())
        || (org.city || "").toLowerCase().includes(search.toLowerCase())
        || (org.contactEmail || "").toLowerCase().includes(search.toLowerCase());
      return matchType && matchStatus && matchSearch;
    });
  }, [orgs, typeFilter, statusFilter, search]);

  const stats = useMemo(() => ({
    total: orgs.length,
    active: orgs.filter(o => o.isActive).length,
    totalSeats: orgs.reduce((s, o) => s + o.totalSeats, 0),
    usedSeats: orgs.reduce((s, o) => s + o.usedSeats, 0),
  }), [orgs]);

  const typeCount = useMemo(() => {
    const c: Record<string, number> = {};
    orgs.forEach(o => { c[o.orgType] = (c[o.orgType] || 0) + 1; });
    return c;
  }, [orgs]);

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
            <p className="text-muted-foreground text-sm">{orgs.length} registered businesses on Aorane</p>
          </div>
          <button onClick={fetchOrgs}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg transition-all">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Orgs",    value: stats.total,      icon: Building2, color: "#0077B6" },
            { label: "Active",        value: stats.active,     icon: Activity,  color: "#10B981" },
            { label: "Total Seats",   value: stats.totalSeats, icon: Users,     color: "#8B5CF6" },
            { label: "Members",       value: stats.usedSeats,  icon: Users,     color: "#F59E0B" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                   style={{ background: `${s.color}14` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-[10px] text-muted-foreground font-medium">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, code, city or email..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all"
            />
          </div>

          {/* Type tabs */}
          <div className="flex flex-wrap gap-2">
            {ALL_TYPES.map(type => {
              const meta = TYPE_META[type];
              const count = type === "all" ? orgs.length : (typeCount[type] || 0);
              const active = typeFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {meta ? meta.icon : "🌐"} {meta ? meta.label : "All"}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="flex gap-1 ml-auto">
              {(["all", "active", "inactive"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}>
                  {s === "all" ? "All Status" : s === "active" ? "● Active" : "○ Inactive"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {orgs.length} organizations
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3 mb-3">
                  <div className="w-12 h-12 bg-muted rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
                <div className="h-2 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-2xl">
            <Building2 size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No organizations found</p>
            {search || typeFilter !== "all" ? (
              <button onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}
                className="mt-3 text-xs text-primary hover:underline">
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((org) => <OrgCard key={org.id} org={org} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
