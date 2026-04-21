import React, { useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, QrCode, Settings, LogOut,
  Menu, X, Bell, ChevronRight,
  BarChart2, Megaphone, CreditCard, ShieldCheck,
} from "lucide-react";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/members", icon: Users, label: "Members" },
  { path: "/analytics", icon: BarChart2, label: "Analytics" },
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
  const { admin, org, logout, isPaidActive } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <a className="flex items-center gap-3 cursor-pointer" aria-label="Business portal home">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm shrink-0">
                <span className="text-white font-bold text-lg font-display">A</span>
              </div>
              <div className="leading-tight">
                <div className="font-display font-extrabold text-lg tracking-tight text-foreground">AORANE</div>
                <div className="font-deva text-[11px] text-primary/80 -mt-0.5">आज़ाद जीवन</div>
              </div>
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
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {isPaidActive && org?.orgCode && (
              <span className="hidden sm:inline-flex items-center pill-chip bg-secondary/10 text-secondary border border-secondary/20 font-mono-data">
                {org.orgCode}
              </span>
            )}
            <button
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
          </div>
        </header>

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
