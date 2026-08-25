import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api, type SearchResult, type Org } from "@/lib/api";
import {
  Search, Users, Building2, CreditCard, ClipboardList,
  LayoutDashboard, Droplet, Flag, Brain, Sun, Moon, X,
} from "lucide-react";

type QuickAction = { label: string; icon: React.ElementType; color: string; run: () => void };

export default function CommandPalette({
  open, onClose, onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
}) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState<SearchResult[]>([]);
  const [orgResults, setOrgResults] = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const allOrgsRef = useRef<Org[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const QUICK_ACTIONS: QuickAction[] = [
    { label: "Go to Dashboard",     icon: LayoutDashboard, color: "#FF914D", run: () => navigate("/dashboard") },
    { label: "Go to Users",         icon: Users,           color: "#FF914D", run: () => navigate("/users") },
    { label: "Go to Organizations", icon: Building2,       color: "#8B5CF6", run: () => navigate("/organizations") },
    { label: "Go to Subscriptions", icon: CreditCard,      color: "#00BF63", run: () => navigate("/subscriptions") },
    { label: "Blood Emergency",     icon: Droplet,         color: "#DC2626", run: () => navigate("/blood-requests") },
    { label: "Feature Flags",       icon: Flag,            color: "#F59E0B", run: () => navigate("/feature-flags") },
    { label: "AI Config",           icon: Brain,           color: "#6366F1", run: () => navigate("/ai-config") },
    { label: "View Audit Logs",     icon: ClipboardList,   color: "#6B7280", run: () => navigate("/audit-logs") },
    { label: "Toggle Theme",        icon: Sun,             color: "#00BF63", run: onToggleTheme },
  ];

  useEffect(() => {
    if (open) {
      setQuery("");
      setUserResults([]);
      setOrgResults([]);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Opening (⌘K from anywhere) is handled by Layout, which owns the open
  // state; this only needs to close itself while it's already open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !query.trim()) { setUserResults([]); setOrgResults([]); return; }
    const q = query.trim().toLowerCase();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [userRes] = await Promise.all([
          api.searchUsers(q).catch(() => ({ results: [] as SearchResult[] })),
          (async () => {
            if (!allOrgsRef.current) {
              const r = await api.organizations().catch(() => ({ organizations: [] as Org[] }));
              allOrgsRef.current = r.organizations;
            }
          })(),
        ]);
        setUserResults(userRes.results.slice(0, 5));
        setOrgResults((allOrgsRef.current || []).filter(o =>
          o.name.toLowerCase().includes(q) || o.orgCode?.toLowerCase().includes(q)
        ).slice(0, 4));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;
  const hasQuery = query.trim().length > 0;
  const hasResults = userResults.length > 0 || orgResults.length > 0;

  const go = (path: string) => { navigate(path); onClose(); };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[130px] px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[600px] rounded-[22px] overflow-hidden neu-lg" style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.1)" }}>

        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search size={17} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search users, organizations, or jump to a page…"
            className="flex-1 bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground/60"
          />
          <button onClick={onClose} className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-2.5 max-h-[420px] overflow-y-auto">
          {hasQuery ? (
            loading && !hasResults ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Searching…</div>
            ) : !hasResults ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No matches for "{query}"</div>
            ) : (
              <>
                {userResults.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2.5 pt-1.5 pb-1 font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-muted-foreground">Users</div>
                    {userResults.map(u => (
                      <button key={u.userId} onClick={() => go("/users")}
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-muted/50 transition-colors text-left">
                        <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10.5px] font-bold text-white bg-brand-gradient">
                          {(u.name || u.phone || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium text-foreground truncate">{u.name || u.phone}</div>
                          <div className="text-[10.5px] text-muted-foreground truncate">{u.email || u.phone} · {u.plan} plan</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">User</span>
                      </button>
                    ))}
                  </div>
                )}
                {orgResults.length > 0 && (
                  <div>
                    <div className="px-2.5 pt-1.5 pb-1 font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-muted-foreground">Organizations</div>
                    {orgResults.map(o => (
                      <button key={o.id} onClick={() => go("/organizations")}
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-muted/50 transition-colors text-left">
                        <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center tone-purple">
                          <Building2 size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium text-foreground truncate">{o.name}</div>
                          <div className="text-[10.5px] text-muted-foreground truncate">{o.usedSeats}/{o.totalSeats} seats · {o.orgCode}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">Org</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          ) : (
            <div>
              <div className="px-2.5 pt-1.5 pb-1 font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-muted-foreground">Quick Actions</div>
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} onClick={() => { a.run(); onClose(); }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-muted/50 transition-colors text-left">
                  <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${a.color}22` }}>
                    <a.icon size={13} style={{ color: a.color }} />
                  </div>
                  <span className="text-[12.5px] text-muted-foreground">{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 px-5 py-2.5 border-t border-border text-[10px] text-muted-foreground">
          <span>Type to search users &amp; organizations</span>
          <span className="ml-auto flex items-center gap-1"><kbd className="font-mono">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
