import { Mail, Phone, MapPin, Linkedin, Instagram, Youtube, Facebook } from "lucide-react";
import { Link } from "wouter";
import { useSiteSettings } from "@/lib/useSiteSettings";

export default function Footer() {
  const year = new Date().getFullYear();
  const s = useSiteSettings();

  const socials = [
    { url: s.socialLinkedin,  Icon: Linkedin,  label: "LinkedIn" },
    { url: s.socialInstagram, Icon: Instagram, label: "Instagram" },
    { url: s.socialYoutube,   Icon: Youtube,   label: "YouTube" },
    { url: s.socialFacebook,  Icon: Facebook,  label: "Facebook" },
  ].filter((x) => x.url && x.url.trim().length > 0);

  const cols = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "Dashboard", href: "#dashboard" },
        { label: "Android App", href: s.androidPlayStoreUrl || "#pricing" },
        { label: "For Business", href: "/business" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Aorane", href: "/about" },
        { label: "Blog", href: "/blog" },
        { label: "Careers", href: "/careers" },
        { label: "Contact Us", href: "/contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "DPDPA Compliance", href: "/privacy#dpdpa" },
        { label: "Data Deletion", href: "mailto:privacy@aorane.com?subject=Data Deletion Request" },
        { label: "Contact Legal", href: "mailto:legal@aorane.com" },
      ],
    },
  ];

  return (
    <footer style={{ background: "#F5F6F8", borderTop: "1px solid #E5E7EB" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" style={{ height: 56, width: "auto", objectFit: "contain" }} />
            </div>
            <p className="text-sm leading-relaxed max-w-xs mb-6" style={{ color: "#6B7280" }}>
              India's most comprehensive AI-powered health management platform. Built for Bharat.
            </p>
            <div className="space-y-2.5 text-sm" style={{ color: "#6B7280" }}>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" style={{ color: "#10B981" }} />
                <a href={`mailto:${s.supportEmail || "support@aorane.com"}`} className="transition-colors hover:text-gray-900">{s.supportEmail || "support@aorane.com"}</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" style={{ color: "#10B981" }} />
                <a href={`tel:${(s.supportPhone || "+917307826291").replace(/\s/g, "")}`} className="transition-colors hover:text-gray-900">{s.supportPhone || "+91 73078 26291"}</a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#10B981" }} />
                <span>Indra Nagar, Near Lekhraj Metro,<br />Lucknow, Uttar Pradesh 226016</span>
              </div>
            </div>
            {socials.length > 0 && (
              <div className="flex gap-3 mt-6">
                {socials.map(({ url, Icon, label }) => (
                  <a key={label} href={url!} target="_blank" rel="noopener noreferrer" aria-label={label}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: "#E5E7EB", color: "#6B7280" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#0747A6"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#E5E7EB"; (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-4" style={{ color: "#111827" }}>{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => {
                  const isInternal = l.href.startsWith("/") && !l.href.includes("://") && !l.href.includes("#");
                  const cls = "text-sm transition-colors hover:text-gray-900";
                  return (
                    <li key={l.label}>
                      {isInternal ? (
                        <Link href={l.href} className={cls} style={{ color: "#6B7280" }}>
                          {l.label}
                        </Link>
                      ) : (
                        <a href={l.href} className={cls} style={{ color: "#6B7280" }}>
                          {l.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: "1px solid #E5E7EB" }}>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            © {year} {s.companyName || "Aorane"}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs flex items-center gap-1" style={{ color: "#9CA3AF" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#10B981" }} />
              All systems operational
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: "#0747A6", background: "#EFF6FF" }}>
              ISO 27001 CERTIFIED
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: "#6B7280", background: "#E5E7EB" }}>
              DPDPA COMPLIANT
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
