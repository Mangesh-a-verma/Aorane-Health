import { useState, useEffect, useRef, type ReactNode, type ComponentType } from "react";
import { Helmet } from "react-helmet-async";
import { FileText, Mail, Globe, ChevronDown, AlertTriangle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Shared shell for every standalone legal/compliance page (Privacy, Terms,
// Cookie Policy, Refund Policy, ...). Extracted from the original
// PrivacyPage/TermsPage markup so new legal pages stay visually consistent
// without re-typing the hero/TOC/scroll-spy boilerplate each time.

export type LegalSectionMeta = {
  id: string;
  num: string;
  title: string;
  icon: ComponentType<{ size?: number }>;
  accent: string;
};

export function Tag({ children, color = "#0747A6" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: color + "18", color }}
    >
      {children}
    </span>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-semibold text-gray-800 mb-1.5">{title}</p>
      {children}
    </div>
  );
}

export function InfoBox({ color = "#059669", bg = "#f0fdf4", border = "#bbf7d0", badge, children }: { color?: string; bg?: string; border?: string; badge?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-4 border flex gap-3" style={{ background: bg, borderColor: border }}>
      <div style={{ color }}>
        {badge && <p className="text-xs font-bold mb-1" style={{ color }}>{badge}</p>}
        <div className="text-sm" style={{ color: color + "cc" }}>{children}</div>
      </div>
    </div>
  );
}

export function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl p-4 border flex gap-3" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#D97706" }} />
      <div style={{ color: "#78350f" }}>{children}</div>
    </div>
  );
}

export function SectionBlock({ id, num, title, icon: Icon, accent, children }: LegalSectionMeta & { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="scroll-mt-24">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 group text-left py-2 focus:outline-none"
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm transition-transform group-hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
        >
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: accent }}>{num}</p>
          <h2 className="text-base font-bold text-gray-900 leading-tight">{title}</h2>
        </div>
        <ChevronDown
          size={16}
          className="flex-shrink-0 text-gray-400 transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? "3000px" : "0px" }}>
        <div className="pl-14 pb-6 pt-2 text-sm leading-relaxed text-gray-600 space-y-3">{children}</div>
      </div>
      <div className="border-b border-gray-100 mt-1 mb-5" />
    </div>
  );
}

export function ContactBlock({ email = "support@aorane.com" }: { email?: string }) {
  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100 overflow-hidden">
      <a href={`mailto:${email}`} className="flex items-center gap-3 px-5 py-4 hover:bg-white transition-colors group">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#00B38818" }}>
          <Mail size={14} style={{ color: "#00B388" }} />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">Email</p>
          <p className="font-semibold text-gray-800 group-hover:underline text-sm">{email}</p>
        </div>
      </a>
      <a href="https://www.aorane.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-4 hover:bg-white transition-colors group">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#0747A618" }}>
          <Globe size={14} style={{ color: "#0747A6" }} />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">Website</p>
          <p className="font-semibold text-gray-800 group-hover:underline text-sm">www.aorane.com</p>
        </div>
      </a>
    </div>
  );
}

/**
 * Banner for B2B contract templates (DPA, BAA, SLA, MSA) — these are sample
 * documents, not something a page view alone can bind either party to.
 * Keeps that distinction visible above the fold rather than buried in a
 * closing clause.
 */
export function TemplateNotice({ docName, email = "legal@aorane.com" }: { docName: string; email?: string }) {
  return (
    <div className="mb-8 rounded-xl border p-4 flex gap-3" style={{ background: "#EFF4FF", borderColor: "#BFDBFE" }}>
      <FileText size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#0747A6" }} />
      <div className="text-sm" style={{ color: "#0747A6" }}>
        <p className="font-bold mb-1">Sample template — not yet a signed agreement</p>
        <p style={{ color: "#0747Acc" }}>
          This is Aorane's standard {docName} template, published for review during procurement/due-diligence. It
          does not itself bind either party. To execute a copy naming your organization, contact{" "}
          <a href={`mailto:${email}`} className="font-semibold hover:underline">{email}</a> — terms may be adjusted
          by mutual written agreement before signing.
        </p>
      </div>
    </div>
  );
}

export function LegalLayout({
  path, title, metaDescription, badge, badgeIcon: BadgeIcon = FileText, heroTags, lastUpdated, sections, children,
}: {
  path: string;
  title: string;
  metaDescription: string;
  badge: string;
  badgeIcon?: ComponentType<{ size?: number }>;
  heroTags: ReactNode;
  lastUpdated: string;
  sections: LegalSectionMeta[];
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [tocOpen, setTocOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) setActiveId(e.target.id); }); },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [sections]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setTocOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>{title} | AORANE</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={`https://aorane.com${path}`} />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar audience="b2c" onAudienceChange={() => {}} onSignIn={() => {}} onSignUp={() => {}} />

        <section
          className="pt-28 pb-14 px-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #0f2744 60%, #0D1B2A 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-6 border"
              style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}
            >
              <BadgeIcon size={12} />
              <span className="uppercase tracking-widest">{badge}</span>
            </div>
            <h1 className="text-5xl font-extrabold text-white mb-4 tracking-tight">{title}</h1>
            <p className="text-white/50 text-sm mb-8">Last updated: {lastUpdated}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs">{heroTags}</div>
          </div>
        </section>

        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
          <button onClick={() => setTocOpen((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FileText size={14} />
            Table of Contents
            <ChevronDown size={14} style={{ transform: tocOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
          </button>
          {tocOpen && (
            <nav className="mt-3 space-y-1 max-h-64 overflow-y-auto">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: activeId === s.id ? s.accent + "12" : "transparent", color: activeId === s.id ? s.accent : "#6b7280" }}
                >
                  <span className="font-mono text-xs opacity-60">{s.num}</span>
                  {s.title}
                </button>
              ))}
            </nav>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-4 py-12 flex gap-10">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Contents</p>
              <nav className="space-y-0.5">
                {sections.map((s) => {
                  const active = activeId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                      style={{ background: active ? s.accent + "12" : "transparent", color: active ? s.accent : "#6b7280", fontWeight: active ? 700 : 500 }}
                    >
                      <span className="flex-shrink-0 w-1 h-5 rounded-full transition-all duration-150" style={{ background: active ? s.accent : "transparent" }} />
                      <span className="font-mono opacity-50 text-[10px]">{s.num}</span>
                      <span className="truncate leading-tight">{s.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="flex-1 min-w-0 max-w-2xl">
            {children}
            <div className="mt-8 text-center text-xs text-gray-400 pb-4">
              © {new Date().getFullYear()} Aorane. All rights reserved.
            </div>
          </main>
        </div>

        <Footer />
      </div>
    </>
  );
}
