import React, { useState, useEffect, useRef } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api, type MemberSearchResult } from "@/lib/api";
import {
  LayoutDashboard, Users, QrCode, Settings, LogOut,
  Menu, Bell, ChevronRight, ChevronsLeft, ChevronsRight, Search, HelpCircle, Loader2, Sparkles,
  BarChart2, Megaphone, CreditCard, ShieldCheck, ShieldAlert, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, ProgressBar } from "@/components/portal/primitives";
import { cn } from "@/lib/utils";

function InactivityBanner({ onStay }: { onStay: () => void }) {
  const [secs, setSecs] = useState(60);
  useEffect(() => {
    setSecs(60);
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 tone-amber border-b border-border/60 text-xs font-medium shrink-0">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="shrink-0" />
        <span>
          Aap kuch der se inactive hain. Session{" "}
          <span className="font-bold tabular-nums">{secs}s</span>{" "}
          mein expire hoga.
        </span>
      </div>
      <Button size="sm" variant="neu" onClick={onStay} className="shrink-0">
        Active raho
      </Button>
    </div>
  );
}

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", group: "Overview" },
  { path: "/members", icon: Users, label: "Members", group: "People" },
  { path: "/codes", icon: QrCode, label: "Enrollment Codes", group: "People" },
  { path: "/communications", icon: Megaphone, label: "Communications", group: "People" },
  { path: "/analytics", icon: BarChart2, label: "Analytics", group: "Insights" },
  { path: "/reports", icon: FileText, label: "Health Reports", group: "Insights" },
  { path: "/billing", icon: CreditCard, label: "Billing", group: "Account" },
  { path: "/verify", icon: ShieldCheck, label: "Verification", group: "Account" },
  { path: "/settings", icon: Settings, label: "Settings", group: "Account" },
];
const navGroups = ["Overview", "People", "Insights", "Account"] as const;

function NavItem({ path, icon: Icon, label, collapsed }: {
  path: string; icon: React.ElementType; label: string; collapsed?: boolean;
}) {
  const [isActive] = useRoute(path);
  return (
    <Link href={path}>
      <div
        className={cn(
          "focus-ring group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium cursor-pointer transition-all duration-200",
          collapsed && "justify-center px-0",
          isActive ? "neu text-primary" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {isActive && !collapsed && (
          <span className="bg-gradient-brand absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full" />
        )}
        <Icon size={18} className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground")} />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
        {isActive && !collapsed && <ChevronRight size={14} className="ml-auto shrink-0 text-primary" />}
      </div>
    </Link>
  );
}

function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard">
      <a className="focus-ring flex items-center gap-2.5 rounded-2xl cursor-pointer" aria-label="Business portal home">
        <span className="bg-gradient-brand grid size-9 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-[var(--portal-neu-raised-sm)] overflow-hidden">
          <img
            src={import.meta.env.BASE_URL + "logo-full.png"}
            alt=""
            className="h-6 w-6 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-wide text-foreground">AORANE</span>
            <span className="block truncate text-[11px] font-medium text-muted-foreground">Business Portal</span>
          </span>
        )}
      </a>
    </Link>
  );
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { org } = useAuth();
  const orgTypeLabels: Record<string, string> = {
    corporate: "Corporate", hospital: "Hospital", gym: "Gym & Fitness",
    insurance: "Insurance", ngo: "NGO", yoga: "Yoga Studio",
    school: "School", other: "Organization",
  };
  const seatPct = org ? Math.min(100, (org.usedSeats / Math.max(1, org.totalSeats)) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 pb-5">
      {!collapsed && org && (
        <div className="neu-flat rounded-3xl p-4">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{org.name}</p>
            {org.isVerified && <ShieldCheck size={15} className="shrink-0 tone-mint rounded-full p-0.5" />}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{orgTypeLabels[org.orgType] || "Organization"}</p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Seats used</span>
            <span className="font-semibold text-foreground">{org.usedSeats}/{org.totalSeats}</span>
          </div>
          <ProgressBar value={seatPct} className="mt-2" />
        </div>
      )}

      <nav className="flex-1 space-y-5">
        {navGroups.map((group) => {
          const items = navItems.filter((i) => i.group === group);
          return (
            <div key={group}>
              {!collapsed && (
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                  {group}
                </p>
              )}
              <div className="space-y-1">
                {items.map((item) => (
                  <div key={item.path} onClick={onNavigate}>
                    <NavItem {...item} collapsed={collapsed} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Upgrade promo — only for orgs not already on the top plan */}
      {!collapsed && org && org.plan !== "max" && (
        <div className="neu rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={14} className="text-primary" />
            <span className="text-xs font-bold text-foreground">Unlock More with Max Plan</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
            Get advanced analytics, ESG reports &amp; priority support.
          </p>
          <div onClick={onNavigate}>
            <Link href="/billing">
              <a className="block text-center text-xs font-bold bg-gradient-brand text-primary-foreground rounded-xl py-2 hover:brightness-105 transition-all">
                Upgrade Now
              </a>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { admin, org, logout, isPaidActive, inactiveWarning, resetInactivityTimer } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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

  // Smart Alerts (notification bell) — real, computed server-side.
  const [alerts, setAlerts] = useState<{ id: string; severity: "info" | "warning" | "critical"; title: string; detail: string; href: string }[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  useEffect(() => {
    api.getAlerts()
      .then((res) => setAlerts(res.alerts))
      .catch(() => setAlerts([]))
      .finally(() => setAlertsLoading(false));
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar/70 py-5 transition-[width] duration-300 lg:flex",
          collapsed ? "w-[84px]" : "w-[268px]",
        )}
      >
        <div className={cn("mb-6 flex items-center gap-2 px-4", collapsed && "flex-col justify-center gap-3 px-2")}>
          <div className="min-w-0 flex-1">
            <BrandMark collapsed={collapsed} />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="neu-interactive focus-ring grid size-8 shrink-0 place-items-center rounded-xl text-muted-foreground"
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
        </div>
        <SidebarNav collapsed={collapsed} />
      </aside>

      {/* Mobile sidebar (slide-over) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] bg-sidebar p-0 pt-5">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="px-4 pb-6">
            <BrandMark />
          </div>
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="glass h-16 flex items-center gap-3 px-4 sm:px-6 shrink-0 border-b border-border/60">
          <Button
            variant="neu"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </Button>

          {/* Global quick search */}
          <div ref={searchBoxRef} className="relative flex-1 max-w-md hidden sm:block">
            <div className="neu-inset flex h-10 items-center gap-2 rounded-2xl px-3.5">
              {searchLoading ? <Loader2 size={15} className="shrink-0 text-muted-foreground animate-spin" /> : <Search size={15} className="shrink-0 text-muted-foreground" />}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search members by name or Aorane ID…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {searchOpen && searchQuery.trim().length >= 4 && (
              <div className="absolute top-full left-0 right-0 mt-2 neu rounded-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">Searching…</div>
                ) : searchResults.length > 0 ? (
                  <>
                    {searchResults.map((r) => (
                      <button
                        key={r.userId}
                        onClick={goToMembers}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors text-left border-b border-border/60 last:border-0"
                      >
                        <Avatar name={r.name || r.aoraneId || "?"} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{r.name || "Unnamed member"}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{r.aoraneId}</div>
                        </div>
                      </button>
                    ))}
                    <button onClick={goToMembers} className="w-full px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary/40 text-center">
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
          <Button
            variant="neu"
            size="icon"
            className="sm:hidden shrink-0"
            onClick={() => navigate("/members")}
            aria-label="Search members"
          >
            <Search size={18} />
          </Button>

          <div className="flex items-center gap-1.5 shrink-0">
            {isPaidActive && org?.orgCode && (
              <span className="hidden md:inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tone-teal font-mono-data mr-1">
                {org.orgCode}
              </span>
            )}
            <Button variant="neu" size="icon" className="hidden sm:inline-flex" asChild>
              <a
                href="mailto:support@aorane.com?subject=Business Portal Help"
                aria-label="Help"
                title="Contact support"
              >
                <HelpCircle size={18} />
              </a>
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="neu" size="icon" className="relative" aria-label="Notifications">
                  <Bell size={18} />
                  {alerts.length > 0 && (
                    <span className="absolute right-1.5 top-1.5 grid size-3.5 place-items-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                      {alerts.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="px-4 py-3 border-b border-border/60">
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                </div>
                {alertsLoading ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">Loading…</div>
                ) : alerts.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto">
                    {alerts.map((a) => (
                      <Link key={a.id} href={a.href}>
                        <a className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/60 last:border-0">
                          <span className={cn(
                            "w-2 h-2 rounded-full mt-1.5 shrink-0",
                            a.severity === "critical" ? "bg-destructive" : a.severity === "warning" ? "bg-[oklch(0.8_0.13_80)]" : "bg-primary",
                          )} />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">{a.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{a.detail}</div>
                          </div>
                        </a>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-xs text-muted-foreground text-center">You're all caught up 🎉</div>
                )}
              </PopoverContent>
            </Popover>

            <div className="hidden xl:flex items-center gap-2 pl-2 ml-1 border-l border-border/60">
              <Avatar name={admin?.fullName || "A"} tone="lavender" size="sm" />
              <div className="min-w-0">
                <div className="text-foreground text-sm font-medium truncate max-w-[140px]">{admin?.fullName}</div>
                <div className="text-muted-foreground text-[11px] capitalize">{admin?.role || "admin"}</div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={logout}
                className="text-muted-foreground hover:text-destructive"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={15} />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="xl:hidden text-muted-foreground hover:text-destructive"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </Button>
          </div>
        </header>

        {/* Inactivity warning banner */}
        {inactiveWarning && <InactivityBanner onStay={resetInactivityTimer} />}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>

        {/* Status footer */}
        <footer className="hidden md:flex items-center justify-between px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 border-t border-border/60 bg-card/40">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[oklch(0.68_0.12_162)]" />
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
