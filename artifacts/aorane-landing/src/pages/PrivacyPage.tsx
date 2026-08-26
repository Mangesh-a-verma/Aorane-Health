import { useState, useEffect, useRef, type ReactNode, type ComponentType } from "react";
import { Helmet } from "react-helmet-async";
import {
  Shield, Mail, Globe, ChevronDown, Database, Brain,
  Share2, Lock, Eye, Trash2, RefreshCw, Link, FileText, Users, Info
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const sections = [
  { id: "introduction",  num: "01", title: "Introduction & Scope",                  icon: Info,       accent: "#0747A6" },
  { id: "collection",    num: "02", title: "Information We Collect",                icon: Database,   accent: "#0747A6" },
  { id: "usage",         num: "03", title: "How We Use Your Information",           icon: Brain,      accent: "#0747A6" },
  { id: "health",        num: "04", title: "Special Handling of Health Data & AI",  icon: Shield,     accent: "#059669" },
  { id: "sharing",       num: "05", title: "How We Share Your Information",         icon: Share2,     accent: "#0747A6" },
  { id: "storage",       num: "06", title: "Data Storage & International Transfers",icon: Lock,       accent: "#0747A6" },
  { id: "security",      num: "07", title: "Data Security & Retention",             icon: Lock,       accent: "#0747A6" },
  { id: "rights",        num: "08", title: "Your Privacy Rights",                   icon: Eye,        accent: "#059669" },
  { id: "thirdparty",    num: "09", title: "Third-Party Links & Integrations",      icon: Link,       accent: "#0747A6" },
  { id: "changes",       num: "10", title: "Changes to This Policy",                icon: RefreshCw,  accent: "#0747A6" },
  { id: "contact",       num: "11", title: "Contact Information",                   icon: Mail,       accent: "#00B388" },
];

function Tag({ children, color = "#0747A6" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: color + "18", color }}
    >
      {children}
    </span>
  );
}

function SectionBlock({ id, num, title, icon: Icon, accent, children }: { id: string; num: string; title: string; icon: ComponentType<{ size?: number }>; accent: string; children: ReactNode }) {
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
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: accent }}>
            {num}
          </p>
          <h2 className="text-base font-bold text-gray-900 leading-tight">{title}</h2>
        </div>
        <ChevronDown
          size={16}
          className="flex-shrink-0 text-gray-400 transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "2000px" : "0px" }}
      >
        <div className="pl-14 pb-6 pt-2 text-sm leading-relaxed text-gray-600 space-y-3">
          {children}
        </div>
      </div>

      <div className="border-b border-gray-100 mt-1 mb-5" />
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item: string, i: number) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-semibold text-gray-800 mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function InfoBox({ color = "#059669", bg = "#f0fdf4", border = "#bbf7d0", badge, children }: { color?: string; bg?: string; border?: string; badge?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-4 border flex gap-3" style={{ background: bg, borderColor: border }}>
      <div style={{ color }}>
        {badge && <p className="text-xs font-bold mb-1" style={{ color }}>{badge}</p>}
        <div className="text-sm" style={{ color: color + "cc" }}>{children}</div>
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  const [audience] = useState<"b2c" | "b2b">("b2c");
  const [activeId, setActiveId] = useState("introduction");
  const [tocOpen, setTocOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        entries.forEach((e) => { if (e.isIntersecting) setActiveId(e.target.id); });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setTocOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>Privacy Policy | AORANE</title>
        <meta name="description" content="AORANE Privacy Policy — how we collect, use and protect your health data. DPDPA 2023 compliant." />
        <link rel="canonical" href="https://aorane.com/privacy" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar audience={audience} onAudienceChange={() => {}} onSignIn={() => {}} onSignUp={() => {}} />

        {/* Hero */}
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
              <Shield size={12} />
              <span className="uppercase tracking-widest">DPDPA 2023 Compliant</span>
            </div>
            <h1 className="text-5xl font-extrabold text-white mb-4 tracking-tight">Privacy Policy</h1>
            <p className="text-white/50 text-sm mb-8">Last updated: April 2026</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
              <Tag color="#059669">Your Data, Your Control</Tag>
              <Tag color="#0747A6">11 Sections</Tag>
              <Tag color="#7C3AED">India Jurisdiction</Tag>
            </div>
          </div>
        </section>

        {/* Mobile TOC toggle */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
          <button
            onClick={() => setTocOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700"
          >
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
                  style={{
                    background: activeId === s.id ? s.accent + "12" : "transparent",
                    color: activeId === s.id ? s.accent : "#6b7280",
                  }}
                >
                  <span className="font-mono text-xs opacity-60">{s.num}</span>
                  {s.title}
                </button>
              ))}
            </nav>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-4 py-12 flex gap-10">

          {/* Sticky sidebar TOC */}
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
                      style={{
                        background: active ? s.accent + "12" : "transparent",
                        color: active ? s.accent : "#6b7280",
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      <span
                        className="flex-shrink-0 w-1 h-5 rounded-full transition-all duration-150"
                        style={{ background: active ? s.accent : "transparent" }}
                      />
                      <span className="font-mono opacity-50 text-[10px]">{s.num}</span>
                      <span className="truncate leading-tight">{s.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 max-w-2xl">

            <SectionBlock {...sections[0]}>
              <p>
                Welcome to Aorane (&quot;Aorane&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). Aorane is committed to protecting your privacy and safeguarding the personal, health, and wellness information entrusted to us. This Privacy Policy explains how we collect, use, process, store, share, and protect your information when you access or use the Aorane mobile application, website, AI services, and related offerings (collectively, the &quot;Services&quot;).
              </p>
              <p>
                By accessing or using Aorane, you acknowledge that you have read, understood, and agree to the practices described in this Privacy Policy. If you do not agree with our policies, you must not use the Services.
              </p>
              <SubSection title="Eligibility">
                <p>Aorane is intended solely for individuals who are at least eighteen (18) years of age. We do not knowingly collect personal information from children under 18.</p>
              </SubSection>
              <SubSection title="Company Status">
                <p>Aorane currently operates as a developing health and wellness platform. Corporate structure, ownership details, and legal entity information may be updated from time to time as the business evolves.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[1]}>
              <p>We collect information to provide, secure, and personalize our Services. The types of information we collect include:</p>
              <SubSection title="Account Registration">
                <p>Full name, email address, password, and in the future, mobile number, OTP, or third-party authentication data (e.g., Truecaller, biometric logins).</p>
              </SubSection>
              <SubSection title="Authentication Information">
                <p>Login records, security tokens, device authentication data, OTP verification status, and biometric authentication events may be processed to protect user accounts and prevent unauthorized access.</p>
              </SubSection>
              <SubSection title="Profile & Health Information">
                <BulletList items={[
                  "Age, gender, height, weight, blood group",
                  "Health and wellness goals, activity levels, lifestyle data",
                  "Dietary preferences and water intake",
                ]} />
              </SubSection>
              <SubSection title="Family Account Data">
                <p>Where Family Account functionality is enabled, users may voluntarily provide health and profile information relating to family members. Users represent that they have appropriate authority and consent to provide such information.</p>
              </SubSection>
              <SubSection title="Medication & Nutrition Information">
                <p>Information regarding medicines, supplements, treatment routines, meal logs, and eating habits.</p>
              </SubSection>
              <SubSection title="Food Photographs">
                <p>Images uploaded for AI-powered food recognition and nutritional analysis.</p>
              </SubSection>
              <SubSection title="Medical Reports">
                <p>Healthcare documents such as blood reports, prescriptions, laboratory reports, and diagnostic records uploaded voluntarily for analysis.</p>
              </SubSection>
              <SubSection title="Technical Data (Auto-Collected)">
                <BulletList items={[
                  "IP address, device model, operating system, browser type",
                  "Device identifiers, crash reports, log data",
                  "Usage metrics — features used, session duration",
                ]} />
              </SubSection>
              <SubSection title="Location Information">
                <p>With your explicit permission, we may collect location data to provide weather-based wellness recommendations, localized features, and future emergency-related functionalities.</p>
              </SubSection>
              <SubSection title="Payment Information">
                <p>For premium subscriptions, transaction identifiers and billing status are collected via authorized third-party payment providers (e.g., Google Play, Apple App Store, Stripe, Razorpay).</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[2]}>
              <p>Aorane processes your information strictly for legitimate operational, security, and service-related purposes, including:</p>
              <SubSection title="Service Delivery">
                <p>Creating your account, authenticating logins, personalizing health dashboards, and generating Health Scores, wellness insights, and PDF reports.</p>
              </SubSection>
              <SubSection title="AI-Powered Analysis">
                <p>Utilizing AI to analyze food photographs, estimate nutritional values, extract data from medical reports, and generate wellness recommendations.</p>
              </SubSection>
              <SubSection title="Communication & Notifications">
                <p>Sending medication reminders, health alerts, security notices, and customer support responses.</p>
              </SubSection>
              <SubSection title="Future Features Execution">
                <p>Facilitating Family Accounts, Doctor/Healthcare Marketplaces, Laboratory Bookings, Health Predictions, and Blood Emergency Alerts.</p>
              </SubSection>
              <SubSection title="Platform Improvement & Security">
                <p>Monitoring application performance, detecting and preventing fraud, conducting analytics, and improving AI models and overall user experience.</p>
              </SubSection>
              <SubSection title="Legal Compliance">
                <p>Complying with applicable laws, regulations, and legal requests.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[3]}>
              <InfoBox
                color="#059669"
                bg="#f0fdf4"
                border="#bbf7d0"
                badge="🔒 Sensitive Personal Information"
              >
                We recognize that Health Information and Medical Reports constitute Sensitive Personal Information and handle them with extra care.
              </InfoBox>

              <SubSection title="Food Photographs">
                <p>Unless required for security, fraud prevention, or technical troubleshooting, food photographs are automatically deleted within approximately twenty-four (24) hours after processing.</p>
              </SubSection>
              <SubSection title="Medical Reports">
                <p>Original uploaded medical documents are not permanently stored unless required for requested services or legal compliance. We extract and retain only the relevant health data (e.g., laboratory values, conditions, medications) needed to provide ongoing services.</p>
              </SubSection>
              <SubSection title="AI Processing">
                <p>Your data, including food photos and extracted health metrics, may be processed using authorized third-party AI systems (e.g., Google Gemini, OpenAI) strictly to generate platform insights.</p>
              </SubSection>
              <div
                className="mt-4 text-xs px-4 py-3 rounded-lg font-semibold"
                style={{ background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}
              >
                ✅ No Sale of Data — Aorane strictly prohibits the sale of Personal Information, Health Information, Medical Reports, or Sensitive Personal Information to advertisers, data brokers, or any third parties.
              </div>
            </SectionBlock>

            <SectionBlock {...sections[4]}>
              <p>Aorane minimizes data sharing and only discloses information to trusted third parties necessary to operate the Services:</p>
              <SubSection title="Infrastructure & Cloud Providers">
                <p>We use services like Firebase, Supabase, Render, and Vercel for secure data hosting, storage, and authentication.</p>
              </SubSection>
              <SubSection title="AI & Analytics Providers">
                <p>Selected data is shared with AI providers (e.g., Google Gemini, OpenAI) and analytics platforms solely to power app features and improve performance.</p>
              </SubSection>
              <SubSection title="Communication & Payment Providers">
                <p>Shared strictly for sending notifications and securely processing subscription billing.</p>
              </SubSection>
              <SubSection title="Future Marketplace Providers">
                <p>If utilizing future services, relevant details may be shared with doctors, laboratories, or nearby users (in the case of Blood Emergency Alerts) only to fulfill your explicit requests.</p>
              </SubSection>
              <SubSection title="Legal & Business Transfers">
                <p>We may disclose data if required by law, court order, or to protect the safety and rights of Aorane and its users. Data may also be transferred during a merger, acquisition, or corporate restructuring.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[5]}>
              <p>
                Your information may be stored and processed on servers located in India, the United States, the European Union, or other jurisdictions depending on our infrastructure providers. By using Aorane, you consent to the international transfer of your data.
              </p>
              <p>
                We implement reasonable contractual and technical safeguards to ensure your information remains protected across borders. Where required by applicable law, Aorane may implement additional regional data storage, localization, or compliance measures.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[6]}>
              <SubSection title="Security Measures">
                <p>We implement robust administrative, technical, and organizational measures, including encryption and strict access controls, to protect your data against unauthorized access, alteration, or destruction. However, no digital system is entirely foolproof.</p>
              </SubSection>
              <SubSection title="Data Breach Notification">
                <p>In the event of a security incident affecting personal information, Aorane may provide notice to affected users where required by applicable law and after appropriate investigation.</p>
              </SubSection>
              <SubSection title="Data Retention">
                <p>We retain your account and health data only for as long as your account is active or as reasonably necessary to fulfill the purposes outlined in this policy, comply with legal obligations, or resolve disputes.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[7]}>
              <InfoBox
                color="#059669"
                bg="#f0fdf4"
                border="#bbf7d0"
                badge="🇮🇳 GDPR · CCPA · India DPDP Act"
              >
                Depending on your jurisdiction, you may have the following rights regarding your personal data.
              </InfoBox>

              <div className="mt-4 grid grid-cols-1 gap-3">
                {[
                  { icon: Eye,      label: "Access & Export",         desc: "Request a copy of the personal and health data we hold about you." },
                  { icon: FileText, label: "Correction",              desc: "Update or correct inaccurate profile or health information." },
                  { icon: Trash2,   label: "Deletion",                desc: "Request the deletion of your account and associated personal data, subject to legal and security retention requirements." },
                  { icon: Shield,   label: "Withdrawal of Consent",   desc: "Withdraw your consent for certain data processing activities. Note: this may limit your ability to use certain features." },
                ].map(({ icon: RIcon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#05996918" }}>
                      <RIcon size={13} style={{ color: "#059669" }} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-xs">{label}</p>
                      <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-gray-500">
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:support@aorane.com" className="font-semibold hover:underline" style={{ color: "#0747A6" }}>
                  support@aorane.com
                </a>. We may require identity verification before processing your request.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[8]}>
              <p>
                The Services may contain links to or integrations with third-party platforms (e.g., wearable fitness trackers). Aorane is not responsible for the privacy practices or content of these third parties. We encourage you to review their respective privacy policies.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[9]}>
              <p>
                We reserve the right to update or modify this Privacy Policy at any time to reflect changes in our practices, technology, or legal requirements. Material changes will be communicated via in-app notifications, website notices, or email. Your continued use of the Services following such updates constitutes your acceptance of the revised policy.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[10]}>
              <InfoBox color="#0747A6" bg="#EFF4FF" border="#BFDBFE" badge="Grievance Officer — Digital Personal Data Protection Act, 2023 (Section 13)">
                <p>
                  In accordance with the DPDP Act, 2023, Aorane has designated the following Grievance Officer to
                  address complaints regarding the processing of your personal data:
                </p>
                <div className="mt-3 text-sm not-italic" style={{ color: "#0747A6" }}>
                  <p className="font-bold">Mangesh Verma</p>
                  <p>Founder, Aorane</p>
                  <p className="mt-1">
                    Email:{" "}
                    <a href="mailto:grievance@aorane.com" className="font-semibold hover:underline">grievance@aorane.com</a>
                  </p>
                </div>
                <p className="mt-3 text-xs" style={{ color: "#0747A6cc" }}>
                  Grievances are acknowledged and resolved as required under the DPDP Act and Rules. If you are not
                  satisfied with our response, you may escalate to the Data Protection Board of India once it becomes
                  operational.
                </p>
              </InfoBox>

              <p className="mt-6">For all other questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:</p>
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100 overflow-hidden">
                <a
                  href="mailto:support@aorane.com"
                  className="flex items-center gap-3 px-5 py-4 hover:bg-white transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#00B38818" }}>
                    <Mail size={14} style={{ color: "#00B388" }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Email</p>
                    <p className="font-semibold text-gray-800 group-hover:underline text-sm">support@aorane.com</p>
                  </div>
                </a>
                <a
                  href="https://www.aorane.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-4 hover:bg-white transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#0747A618" }}>
                    <Globe size={14} style={{ color: "#0747A6" }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Website</p>
                    <p className="font-semibold text-gray-800 group-hover:underline text-sm">www.aorane.com</p>
                  </div>
                </a>
              </div>
            </SectionBlock>

            {/* Footer note */}
            <div className="mt-8 text-center text-xs text-gray-400 pb-4">
              © {new Date().getFullYear()} Aorane. All rights reserved. · Compliant with India&apos;s DPDP Act 2023.
            </div>

          </main>
        </div>

        <Footer />
      </div>
    </>
  );
}