import { Activity, Mail, Phone, MapPin, Twitter, Linkedin, Instagram, Youtube } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  const cols = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "Dashboard", href: "#dashboard" },
        { label: "Android App", href: "https://play.google.com/store" },
        { label: "Business Portal", href: "https://business.aorane.com" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Aorane", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Press Kit", href: "#" },
        { label: "Contact Us", href: "mailto:support@aorane.com" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "DPDPA Compliance", href: "/privacy#6" },
        { label: "Data Deletion", href: "mailto:privacy@aorane.com?subject=Data Deletion Request" },
        { label: "Contact Legal", href: "mailto:legal@aorane.com" },
      ],
    },
  ];

  return (
    <footer className="bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={import.meta.env.BASE_URL + 'logo-full.png'} alt="Aorane" style={{ height: 120, width: "auto", objectFit: "contain" }} />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mb-6">
              India's most comprehensive AI-powered health management platform. Built for Bharat.
            </p>
            <div className="space-y-2.5 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#10B981]" />
                <a href="mailto:support@aorane.com" className="hover:text-white transition-colors">support@aorane.com</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#10B981]" />
                <a href="tel:+917307826291" className="hover:text-white transition-colors">+91 73078 26291</a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span>Indra Nagar, Near Lekhraj Metro,<br />Lucknow, Uttar Pradesh 226016</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {[Twitter, Linkedin, Instagram, Youtube].map((Icon, i) => (
                <a key={i} href="#"
                  className="w-9 h-9 bg-white/8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-[#0747A6] hover:text-white transition-all">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {year} Aorane Health Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse" />
              All systems operational
            </span>
            <span className="text-xs font-bold text-[#0747A6] bg-[#0747A6]/15 px-2 py-0.5 rounded-full">
              in.aorane.app
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
