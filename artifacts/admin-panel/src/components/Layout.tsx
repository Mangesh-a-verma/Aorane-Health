import React, { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, Building2, Flag, UtensilsCrossed,
  Tag, Megaphone, Droplet, Languages, ClipboardList, LogOut,
  Menu, X, ShieldAlert, ChevronRight, CreditCard, BarChart3,
  DollarSign, MonitorPlay, Paintbrush2, Brain, Bell, Search,
  Sun, Moon, IndianRupee, Sliders, Rocket, UserCircle, Sparkles, MessageSquare,
} from "lucide-react";

type NavItem = { path: string; icon: React.ElementType; label: string; color: string };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Core",
    items: [
      { path: "/dashboard",     icon: LayoutDashboard, label: "Dashboard",     color: "#0077B6" },
      { path: "/users",         icon: Users,           label: "Users",         color: "#1B998B" },
      { path: "/organizations", icon: Building2,       label: "Organizations", color: "#8B5CF6" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { path: "/revenue",        icon: IndianRupee, label: "Revenue & Business", color: "#10B981" },
      { path: "/plan-pricing",   icon: Sliders,     label: "Plan Pricing",       color: "#0077B6" },
      { path: "/subscriptions",  icon: CreditCard,  label: "Subscriptions",      color: "#8B5CF6" },
      { path: "/analytics",      icon: BarChart3,   label: "Analytics",          color: "#F59E0B" },
      { path: "/platform-costs", icon: DollarSign,  label: "Platform Costs",     color: "#6B7280" },
    ],
  },
  {
    label: "Content",
    items: [
      { path: "/ads",           icon: MonitorPlay,   label: "Ads Manager",   color: "#EC4899" },
      { path: "/ai-config",     icon: Brain,         label: "AI Config",     color: "#6366F1" },
      { path: "/branding",      icon: Paintbrush2,   label: "Branding",      color: "#8B5CF6" },
      { path: "/feature-flags", icon: Flag,          label: "Feature Flags", color: "#F59E0B" },
      { path: "/food-items",         icon: UtensilsCrossed, label: "Food Database",      color: "#10B981" },
      { path: "/ai-food-discovery",  icon: Sparkles,        label: "AI Food Discovery", color: "#8B5CF6" },
      { path: "/promo-codes",   icon: Tag,           label: "Promo Codes",   color: "#EF4444" },
      { path: "/announcements", icon: Megaphone,     label: "Announcements", color: "#3B82F6" },
    ],
  },
  {
    label: "Emergency",
    items: [
      { path: "/blood-requests",   icon: Droplet,        label: "Blood Emergency",  color: "#DC2626" },
      { path: "/support-tickets",  icon: MessageSquare,  label: "Support Tickets",  color: "#F59E0B" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/languages",          icon: Languages,     label: "Languages",         color: "#7C3AED" },
      { path: "/audit-logs",         icon: ClipboardList, label: "Audit Logs",        color: "#6B7280" },
      { path: "/upcoming-features",  icon: Rocket,        label: "Upcoming Features", color: "#25D366" },
    ],
  },
];

function NavLink({ path, icon: Icon, label, color }: NavItem) {
  const [isActive] = useRoute(path);
  return (
    <Link href={path}>
      <div className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 group relative
        ${isActive ? "text-white" : "text-white/40 hover:text-white/75"}`}
        style={{ background: isActive ? "rgba(255,255,255,0.07)" : "transparent" }}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
               style={{ backgroundColor: color }} />
        )}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200`}
             style={{ background: isActive ? "rgba(255,255,255,0.09)" : "transparent" }}>
          <Icon size={14} style={{ color: isActive ? color : undefined }} />
        </div>
        <span className={`text-[13px] flex-1 ${isActive ? "font-medium" : "font-normal"}`}>{label}</span>
        {isActive && <ChevronRight size={12} style={{ color }} className="opacity-50" />}
      </div>
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("aorane_theme");
    const isDark = stored !== "light";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("aorane_theme", next ? "dark" : "light");
  }

  const initials = admin?.fullName?.charAt(0)?.toUpperCase() ?? "A";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#090e1c" }}>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
             onClick={() => setOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[224px] flex flex-col transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}
        style={{ background: "#090e1c", borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-3">
            <Link href="/">
              <a className="flex items-center cursor-pointer" aria-label="Admin home">
                <img src={import.meta.env.BASE_URL + 'logo-full.png'} alt="Aorane" style={{ height: 88, width: "auto", objectFit: "contain", background: "white", borderRadius: 8, padding: 4 }} />
              </a>
            </Link>
            <div>
              <div className="text-[9px] font-mono tracking-[0.25em] mt-0.5"
                   style={{ color: "rgba(255,255,255,0.45)" }}>
                SUPER ADMIN
              </div>
            </div>
            <button className="lg:hidden ml-auto" style={{ color: "rgba(255,255,255,0.4)" }}
                    onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5">
                <span className="text-[9px] font-mono font-semibold tracking-[0.22em] uppercase"
                      style={{ color: "rgba(255,255,255,0.2)" }}>
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
        <div className="px-3 pb-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2.5"
               style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                 style={{ background: "linear-gradient(135deg,#0077B6,#1B998B)" }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{admin?.fullName ?? "Admin"}</div>
              <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.32)" }}>
                {admin?.role ?? "Super Admin"}
              </div>
            </div>
          </div>
          <Link href="/profile">
            <div className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95 cursor-pointer mb-2"
                 style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)" }}>
              <UserCircle size={12} />
              My Profile
            </div>
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95"
            style={{ background: "linear-gradient(135deg,#0077B6,#1B998B)", color: "white" }}
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
          className="flex items-center justify-between px-5 h-[60px] shrink-0 z-30"
          style={{
            background: "rgba(9,14,28,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex items-center gap-3">
            <button className="lg:hidden" style={{ color: "rgba(255,255,255,0.5)" }}
                    onClick={() => setOpen(true)}>
              <Menu size={18} />
            </button>
            <div className="relative hidden sm:block">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(255,255,255,0.28)" }} />
              <input
                placeholder="Search anything..."
                className="pl-9 pr-4 py-1.5 text-xs rounded-xl outline-none transition-all w-52"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.75)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono"
                 style={{
                   background: "rgba(16,185,129,0.09)",
                   color: "#34d399",
                   border: "1px solid rgba(16,185,129,0.14)",
                 }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All Systems OK
            </div>

            <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.08)" }} />

            <button onClick={toggleTheme}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <button className="w-7 h-7 rounded-lg flex items-center justify-center relative"
                    style={{ color: "rgba(255,255,255,0.45)" }}>
              <Bell size={14} />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center"
                    style={{ background: "#0077B6", color: "white" }}>
                3
              </span>
            </button>

            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                 style={{ background: "linear-gradient(135deg,#0077B6,#1B998B)" }}>
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
