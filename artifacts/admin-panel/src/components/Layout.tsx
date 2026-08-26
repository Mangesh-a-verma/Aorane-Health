import React, { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { api, type AdminNotif } from "@/lib/api";
import CommandPalette from "@/components/CommandPalette";
import {
  LayoutDashboard, Users, Building2, Flag, UtensilsCrossed,
  Tag, Megaphone, Droplet, Languages, ClipboardList, LogOut,
  Menu, X, ShieldAlert, ChevronRight, CreditCard, BarChart3,
  DollarSign, MonitorPlay, Paintbrush2, Brain, Bell, Search,
  Sun, Moon, IndianRupee, Sliders, Rocket, UserCircle, Sparkles, MessageSquare, Inbox, FileText,
} from "lucide-react";

type NavItem = { path: string; icon: React.ElementType; label: string; color: string };

/* Regrouped by what an admin is actually trying to DO, not by which table the
   data lives in — the old "Revenue" group held Analytics and Subscriptions
   while "Content" held Feature Flags and Promo Codes, so related work was
   split across sections. Every path is unchanged; only the grouping, order
   and labels move, so no route or API call is affected.
   Colour is assigned per GROUP from the validated chart tokens rather than
   per item: 24 unrelated hues in one rail was the main source of the
   "colours mismatch" read. */
const NAV_GROUPS: { label: string; color: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    color: "var(--chart-1)",
    items: [
      { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", color: "var(--chart-1)" },
      { path: "/analytics", icon: BarChart3,       label: "Analytics", color: "var(--chart-1)" },
    ],
  },
  {
    label: "People",
    color: "var(--chart-2)",
    items: [
      { path: "/users",         icon: Users,      label: "Users",         color: "var(--chart-2)" },
      { path: "/organizations", icon: Building2,  label: "Organizations", color: "var(--chart-2)" },
      { path: "/subscriptions", icon: CreditCard, label: "Subscriptions", color: "var(--chart-2)" },
    ],
  },
  {
    label: "Revenue",
    color: "var(--chart-3)",
    items: [
      { path: "/revenue",        icon: IndianRupee, label: "Revenue & Business", color: "var(--chart-3)" },
      { path: "/plan-pricing",   icon: Sliders,     label: "Plan Pricing",       color: "var(--chart-3)" },
      { path: "/invoices",       icon: FileText,    label: "Business Invoices",  color: "var(--chart-3)" },
      { path: "/custom-deals",   icon: Tag,         label: "Custom Deals",       color: "var(--chart-3)" },
      { path: "/promo-codes",    icon: Tag,         label: "Promo Codes",        color: "var(--chart-3)" },
      { path: "/platform-costs", icon: DollarSign,  label: "Platform Costs",     color: "var(--chart-3)" },
    ],
  },
  {
    label: "Content & AI",
    color: "var(--chart-4)",
    items: [
      { path: "/food-items",        icon: UtensilsCrossed, label: "Food Database",     color: "var(--chart-4)" },
      { path: "/ai-food-discovery", icon: Sparkles,        label: "AI Food Discovery", color: "var(--chart-4)" },
      { path: "/ai-config",         icon: Brain,           label: "AI Config",         color: "var(--chart-4)" },
      { path: "/ads",               icon: MonitorPlay,     label: "Ads Manager",       color: "var(--chart-4)" },
      { path: "/announcements",     icon: Megaphone,       label: "Announcements",     color: "var(--chart-4)" },
      { path: "/branding",          icon: Paintbrush2,     label: "Branding",          color: "var(--chart-4)" },
    ],
  },
  {
    label: "Operations",
    color: "hsl(var(--destructive))",
    items: [
      { path: "/blood-requests",  icon: Droplet,       label: "Blood Emergency",   color: "hsl(var(--destructive))" },
      { path: "/support-tickets", icon: MessageSquare, label: "Support Tickets",   color: "hsl(var(--destructive))" },
      { path: "/enquiries",       icon: Inbox,         label: "Enquiries & Leads", color: "hsl(var(--destructive))" },
    ],
  },
  {
    label: "System",
    color: "var(--chart-6)",
    items: [
      { path: "/feature-flags",     icon: Flag,          label: "Feature Flags",     color: "var(--chart-6)" },
      { path: "/languages",         icon: Languages,     label: "Languages",         color: "var(--chart-6)" },
      { path: "/audit-logs",        icon: ClipboardList, label: "Audit Logs",        color: "var(--chart-6)" },
      { path: "/upcoming-features", icon: Rocket,        label: "Upcoming Features", color: "var(--chart-6)" },
    ],
  },
];

function NavLink({ path, icon: Icon, label, color }: NavItem) {
  const [isActive] = useRoute(path);
  return (
    <Link href={path}>
      <div
        className={`flex items-center gap-3 pl-3 pr-2.5 py-2 rounded-xl cursor-pointer transition-all duration-200 relative
          ${isActive
            ? "neu-inset-sm text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                style={{ backgroundColor: color }} />
        )}
        <Icon size={15} className="shrink-0" style={isActive ? { color } : undefined} />
        <span className="text-[13px] flex-1 truncate">{label}</span>
        {isActive && <ChevronRight size={12} style={{ color }} className="shrink-0 opacity-60" />}
      </div>
    </Link>
  );
}

function InactivityBanner({ onStay, onLogout }: { onStay: () => void; onLogout: () => void }) {
  const [secs, setSecs] = useState(60);
  useEffect(() => {
    setSecs(60);
    const t = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(t); onLogout(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [onLogout]);
  return (
    <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="shrink-0" />
        <span>
          You've been inactive for a while. Auto sign-out in{" "}
          <span className="font-bold tabular-nums">{secs}s</span>
        </span>
      </div>
      <button
        onClick={onStay}
        className="shrink-0 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors font-semibold"
      >
        Stay signed in
      </button>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { admin, logout, inactiveWarning, resetInactivityTimer } = useAuth();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState<boolean>(() => {
    try { return localStorage.getItem("aorane_theme") === "dark"; }
    catch { return false; }
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotif[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function fetchNotifications() {
    api.getAdminNotifications().then(d => {
      setNewCount(d.unreadCount ?? 0);
      setNotifications(d.notifications ?? []);
    }).catch(() => {});
  }

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    setNotifLoading(true);
    api.getAdminNotifications().then(d => {
      setNewCount(0);
      setNotifications(d.notifications ?? []);
      api.markNotificationsReadAll().catch(() => {});
    }).catch(() => {}).finally(() => setNotifLoading(false));
  }, [notifOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    if (notifOpen || avatarOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen, avatarOpen]);

  // ⌘K / Ctrl+K opens the command palette from anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("aorane_theme", next ? "dark" : "light");
  }

  const initials = admin?.fullName?.charAt(0)?.toUpperCase() ?? "A";

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
             onClick={() => setOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[224px] flex flex-col transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}
        style={{ background: "hsl(var(--sidebar))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
      >
        {/* Logo */}
        <div className="px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            {/* The full-lockup PNG bakes its wordmark in navy, which vanishes on
                the dark surface. Pairing the brand MARK (orange/green, legible
                on both) with a live text wordmark keeps it readable in either
                theme without needing a second image asset. */}
            <Link href="/">
              <a className="flex items-center gap-2.5 cursor-pointer" aria-label="Admin home">
                <img src={import.meta.env.BASE_URL + 'icon.png'} alt="Aorane"
                     style={{ height: 30, width: "auto", objectFit: "contain" }} />
                <span className="flex flex-col leading-none">
                  <span className="text-[13.5px] font-extrabold tracking-tight text-foreground">AORANE</span>
                  <span className="text-[8px] font-mono tracking-[0.2em] text-muted-foreground mt-1">SUPER ADMIN</span>
                </span>
              </a>
            </Link>
            <button className="lg:hidden ml-auto text-muted-foreground hover:text-foreground"
                    onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 px-3 mb-1.5">
                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: group.color }} />
                <span className="text-[9px] font-mono font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                  {group.label}
                </span>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => <NavLink key={item.path} {...item} />)}
              </div>
            </div>
          ))}
        </nav>

        {/* Admin footer */}
        <div className="px-3 pb-4 pt-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2.5 neu-inset-sm">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold bg-brand-gradient">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate text-foreground">{admin?.fullName ?? "Admin"}</div>
              <div className="text-[10px] truncate text-muted-foreground">
                {admin?.role ?? "Super Admin"}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-200 active:scale-95 bg-brand-gradient"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="flex items-center justify-between px-5 h-[60px] shrink-0 z-30 border-b border-border"
          style={{
            background: "color-mix(in oklab, hsl(var(--background)) 88%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-muted-foreground"
                    onClick={() => setOpen(true)}>
              <Menu size={18} />
            </button>
            <button onClick={() => setCmdOpen(true)}
                    className="hidden sm:flex items-center gap-2.5 w-64 px-3.5 py-2 rounded-xl neu-inset-sm text-left">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <span className="flex-1 text-xs text-muted-foreground">Search users, orgs, actions…</span>
              <span className="shrink-0 px-1.5 py-0.5 rounded-md font-mono text-[10px] font-semibold text-muted-foreground neu-sm">⌘K</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono tone-success">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--brand-green)" }} />
              All Systems OK
            </div>

            <div className="w-px h-4 bg-border" />

            <button onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-muted-foreground hover:text-foreground neu-interactive"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen(p => !p)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center relative transition-all neu-interactive ${notifOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Bell size={14} />
                {newCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center bg-brand-gradient text-white">
                    {newCount > 9 ? "9+" : newCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden bg-card border border-border">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                    <span className="text-xs font-bold text-foreground">Notifications</span>
                    <span className="text-[10px] text-muted-foreground">Last 30</span>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        <Inbox size={20} className="mx-auto mb-2 opacity-30" />
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map(n => {
                        const cfg = {
                          new_payment:        { icon: IndianRupee,   color: "#00BF63", bg: "#00BF6322", href: "/subscriptions" },
                          new_blood_emergency:{ icon: Droplet,       color: "#EF4444", bg: "#EF444422", href: "/blood-requests" },
                          new_enquiry:        { icon: MessageSquare, color: "#F59E0B", bg: "#F59E0B22", href: "/enquiries" },
                          new_support_ticket: { icon: FileText,      color: "#FF914D", bg: "#FF914D22", href: "/support-tickets" },
                        }[n.type] ?? { icon: Bell, color: "#6B7280", bg: "#6B728022", href: "/" };
                        const Icon = cfg.icon;
                        return (
                          <Link key={n.id} href={cfg.href} onClick={() => setNotifOpen(false)}>
                            <a className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/50 ${!n.is_read ? "bg-primary/5" : ""}`}>
                              <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center mt-0.5"
                                   style={{ background: cfg.bg }}>
                                <Icon size={12} style={{ color: cfg.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-medium truncate text-foreground">{n.title}</span>
                                  {!n.is_read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />}
                                </div>
                                <div className="text-[10px] mt-0.5 truncate text-muted-foreground">{n.message}</div>
                                <div className="text-[10px] mt-0.5 text-muted-foreground/50">
                                  {new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                            </a>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setAvatarOpen(p => !p)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold hover:opacity-80 transition-opacity bg-brand-gradient"
                title={admin?.fullName ?? "Admin"}
              >
                {initials}
              </button>
              {avatarOpen && (
                <div className="absolute right-0 top-10 w-48 rounded-2xl shadow-2xl z-50 overflow-hidden bg-card border border-border">
                  <div className="px-4 py-3 border-b border-border">
                    <div className="text-xs font-semibold text-foreground truncate">{admin?.fullName ?? "Admin"}</div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">{admin?.role ?? "Super Admin"}</div>
                  </div>
                  <Link href="/profile" onClick={() => setAvatarOpen(false)}>
                    <a className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                      <UserCircle size={13} className="text-primary" />
                      My Profile
                    </a>
                  </Link>
                  <div className="border-t border-border">
                    <button
                      onClick={() => { setAvatarOpen(false); logout(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Inactivity warning banner with countdown — auto-logout when timer hits 0 */}
        {inactiveWarning && <InactivityBanner onStay={resetInactivityTimer} onLogout={logout} />}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto page-enter bg-background">
          {children}
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onToggleTheme={toggleTheme} />
    </div>
  );
}
