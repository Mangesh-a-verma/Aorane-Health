import React, { useState, useEffect, useRef } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api, type MemberSearchResult } from "@/lib/api";
import {
  LayoutDashboard, Users, QrCode, Settings, LogOut,
  Menu, X, Bell, ChevronRight, Search, HelpCircle, Loader2, Sparkles,
  BarChart2, Megaphone, CreditCard, ShieldCheck, ShieldAlert, FileText,
} from "lucide-react";

function InactivityBanner({ onStay }: { onStay: () => void }) {
  const [secs, setSecs] = useState(60);
  useEffect(() => {
    setSecs(60);
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-medium shrink-0">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="shrink-0" />
        <span>
          Aap kuch der se inactive hain. Session{" "}
          <span className="font-bold tabular-nums">{secs}s</span>{" "}
          mein expire hoga.
        </span>
      </div>
      <button
        onClick={onStay}
        className="shrink-0 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors font-semibold whitespace-nowrap"
      >
        Active raho
      </button>
    </div>
  );
}

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/members", icon: Users, label: "Members" },
  { path: "/analytics", icon: BarChart2, label: "Analytics" },
  { path: "/reports", icon: FileText, label: "Health Reports" },
  { path: "/communications", icon: Megaphone, label: "Communications" },
  { path: "/codes", icon: QrCode, label: "Enrollment Codes" },
  { path: "/billing", icon: CreditCard, label: "Billing" },
  { path: "/verify", icon: ShieldCheck, label: "Verification" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

function NavItem({ path, icon: Icon, label }: { path: string; icon: React.ElementType; label: string }) {
  const [isActive] = useRoute(path);
  return (
    <Link href={path}>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 group
        ${isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
        }`}
      >
        <Icon size={18} className={isActive ? "text-primary" : "text-foreground/55 group-hover:text-foreground/80"} />
        <span className="text-sm font-medium">{label}</span>
        {isActive && <ChevronRight size={14} className="ml-auto text-primary" />}
      </div>
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { admin, org, logout, isPaidActive, inactiveWarning, resetInactivityTimer } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, navigate] = useLocation();

  // Global quick search — reuses the same real member-search API as the
  // Dashboard's Employee Stress Lookup and the Members page, just surfaced
  // in the topbar for quick access from anywhere in the portal.
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setSearchOpen(true);
    if (q.trim().length < 4) { setSearchResults([]); return; }
    setSearchLoading(true);
    api.searchMembers(q.trim())
      .then((res) => setSearchResults(res.results))
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  };

  const goToMembers = () => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate("/members");
  };

  const orgTypeLabels: Record<string, string> = {
    corporate: "Corporate",
    hospital: "Hospital",
    gym: "Gym & Fitness",
    insurance: "Insurance",
    ngo: "NGO",
    yoga: "Yoga Studio",
    school: "School",
    other: "Organization",
  };

  const seatPct = org ? Math.min(100, (org.usedSeats / Math.max(1, org.totalSeats)) * 100) : 0;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}
      >
        {/* Logo / Wordmark */}
        <div className="px-5 pt-5 pb-4 border-b border-sidebar-border">
          <Link href="/dashboard">
            <a className="flex items-center gap-2 cursor-pointer" aria-label="Business portal home">
              <img
                src={import.meta.env.BASE_URL + "logo-full.png"}
                alt="Aorane"
                className="h-9 w-auto object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="text-[11px] text-primary/80 font-medium tracking-wide leading-tight mt-0.5">Business CRM</div>
            </a>
          </Link>

          {/* Org info card */}
          {org && (
            <div className="mt-4 p-3 rounded-xl bg-sidebar-accent/60 border border-sidebar-border">
              <div className="text-foreground text-sm font-semibold truncate">{org.name}</div>
              <div className="text-muted-foreground text-[11px] mt-0.5">{orgTypeLabels[org.orgType || ""] || "Organization"}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                    style={{ width: `${seatPct}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-[10px] font-mono-data tabular-nums">
                  {org.usedSeats}/{org.totalSeats}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <div key={item.path} onClick={() => setMobileOpen(false)}>
              <NavItem {...item} />
            </div>
          ))}
        </nav>

        {/* Upgrade promo — only for orgs not already on the top plan */}
        {org && org.plan !== "max" && (
          <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/15">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-bold text-foreground">Unlock More with Max Plan</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
              Get advanced analytics, ESG reports & priority support.
            </p>
            <Link href="/billing">
              <a className="block text-center text-xs font-bold bg-primary text-primary-foreground rounded-lg py-2 hover:bg-primary/90 transition-colors">
                Upgrade Now
              </a>
            </Link>
          </div>
        )}

        {/* User footer */}
        <div className="px-3 pb-4 pt-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0 border border-primary/15">
              <span className="text-primary text-sm font-bold font-display">
                {admin?.fullName?.charAt(0).toUpperCase() || "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-foreground text-sm font-medium truncate">{admin?.fullName}</div>
              <div className="text-muted-foreground text-[11px] capitalize">{admin?.role || "admin"}</div>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-card/80 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Global quick search */}
          <div ref={searchBoxRef} className="relative flex-1 max-w-md hidden sm:block">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              {searchLoading ? <Loader2 size={15} className="text-muted-foreground animate-spin" /> : <Search size={15} className="text-muted-foreground" />}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search members by name or Aorane ID..."
              className="w-full bg-muted/60 border border-border rounded-xl pl-9 pr-14 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all"
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-mono-data text-muted-foreground/60 pointer-events-none">⌘K</span>

            {searchOpen && searchQuery.trim().length >= 4 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">Searching…</div>
                ) : searchResults.length > 0 ? (
                  <>
                    {searchResults.map((r) => (
                      <button
                        key={r.userId}
                        onClick={goToMembers}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left border-b border-border last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-xs font-bold">
                          {(r.name || r.aoraneId || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{r.name || "Unnamed member"}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{r.aoraneId}</div>
                        </div>
                      </button>
                    ))}
                    <button onClick={goToMembers} className="w-full px-4 py-2 text-xs font-semibold text-primary hover:bg-muted/40 text-center">
                      View all in Members →
                    </button>
                  </>
                ) : (
                  <div className="p-4 text-xs text-muted-foreground text-center">No members found for "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 sm:hidden" />
          <div className="flex items-center gap-1.5">
            {isPaidActive && org?.orgCode && (
              <span className="hidden md:inline-flex items-center pill-chip bg-secondary/10 text-secondary border border-secondary/20 font-mono-data mr-1">
                {org.orgCode}
              </span>
            )}
            <a
              href="mailto:support@aorane.com?subject=Business Portal Help"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Help"
              title="Contact support"
            >
              <HelpCircle size={18} />
            </a>
            <button
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
          </div>
        </header>


        {/* Inactivity warning banner */}
        {inactiveWarning && <InactivityBanner onStay={resetInactivityTimer} />}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>

        {/* Status footer */}
        <footer className="hidden md:flex items-center justify-between px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 border-t border-border bg-card/40">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>All Systems Operational</span>
            <span className="opacity-50">•</span>
            <ShieldCheck size={11} className="text-primary/70" />
            <span>DPDP Act 2023 Compliant</span>
          </div>
          <div className="font-mono-data">India (IN)</div>
        </footer>
      </div>
    </div>
  );
}
