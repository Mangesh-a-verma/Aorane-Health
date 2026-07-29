import { useState, useEffect, useRef, type ReactNode, type ComponentType } from "react";
import { Helmet } from "react-helmet-async";
import { FileText, Mail, Globe, ChevronDown, Shield, AlertTriangle, Brain, User, CreditCard, Building2, Lock, Ban, Scale, XCircle, Gavel, BookOpen, Phone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const sections = [
  { id: "introduction", num: "01", title: "Introduction & Acceptance", icon: BookOpen, accent: "#0747A6" },
  { id: "services", num: "02", title: "Description of Services", icon: Globe, accent: "#0747A6" },
  { id: "medical", num: "03", title: "Medical & Healthcare Disclaimers", icon: AlertTriangle, accent: "#D97706" },
  { id: "ai", num: "04", title: "AI & Automated Processing", icon: Brain, accent: "#0747A6" },
  { id: "eligibility", num: "05", title: "Eligibility & Account Security", icon: User, accent: "#0747A6" },
  { id: "data", num: "06", title: "User Data & Third-Party Providers", icon: Shield, accent: "#0747A6" },
  { id: "acceptable", num: "07", title: "Acceptable Use Policy", icon: Ban, accent: "#DC2626" },
  { id: "billing", num: "08", title: "Subscriptions, Billing & Cancellations", icon: CreditCard, accent: "#0747A6" },
  { id: "ip", num: "09", title: "Intellectual Property", icon: Lock, accent: "#0747A6" },
  { id: "liability", num: "10", title: "Disclaimers & Liability", icon: Scale, accent: "#0747A6" },
  { id: "indemnification", num: "11", title: "Indemnification", icon: Shield, accent: "#0747A6" },
  { id: "termination", num: "12", title: "Termination & Data Rights", icon: XCircle, accent: "#0747A6" },
  { id: "disputes", num: "13", title: "Dispute Resolution", icon: Gavel, accent: "#0747A6" },
  { id: "general", num: "14", title: "General Provisions", icon: BookOpen, accent: "#0747A6" },
  { id: "contact", num: "15", title: "Contact Information", icon: Mail, accent: "#00B388" },
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

function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 border flex gap-3"
      style={{ background: "#fffbeb", borderColor: "#fde68a" }}
    >
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#D97706" }} />
      <div style={{ color: "#78350f" }}>{children}</div>
    </div>
  );
}

export default function TermsPage() {
  const [audience] = useState<"b2c" | "b2b">("b2c");
  const [activeId, setActiveId] = useState("introduction");
  const [tocOpen, setTocOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id);
        });
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
        <title>Terms of Service | AORANE</title>
        <meta name="description" content="AORANE Terms of Service — usage rules, subscription terms, medical disclaimer, and user responsibilities." />
        <link rel="canonical" href="https://aorane.com/terms" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar audience={audience} onAudienceChange={() => {}} onSignIn={() => {}} onSignUp={() => {}} />

        {/* Hero */}
        <section
          className="pt-28 pb-14 px-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #0f2744 60%, #0D1B2A 100%)" }}
        >
          {/* subtle grid pattern */}
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
              <FileText size={12} />
              <span className="uppercase tracking-widest">Governed by Laws of India</span>
            </div>
            <h1 className="text-5xl font-extrabold text-white mb-4 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-white/50 text-sm mb-8">Last updated: April 2026</p>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
              <Tag color="#00B388">AI-Powered Health Platform</Tag>
              <Tag color="#0747A6">15 Sections</Tag>
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
                Welcome to Aorane ("Aorane", "we", "our", or "us"). These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "you", or "your") and Aorane governing your access to and use of the Aorane website, mobile applications, AI features, software, content, and related services (collectively, the "Services").
              </p>
              <p>
                By creating an account, downloading, accessing, or using the Services, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you must immediately discontinue use of the Services.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[1]}>
              <p>
                Aorane is an AI-powered health, wellness, nutrition, and lifestyle platform designed to assist users in tracking and understanding their well-being. The Services may include, but are not limited to:
              </p>
              <BulletList items={[
                "Health, nutrition, and medication tracking",
                "AI-assisted food image analysis and nutritional estimation",
                "Medical and diagnostic report analysis (e.g., blood reports, prescriptions)",
                "Generation of Health Scores, wellness reports, and PDF exports",
                "Future offerings such as family management, blood emergency alerts, doctor/healthcare marketplaces, and predictive health risk analysis",
              ]} />
              <p className="text-gray-500 italic text-xs mt-2">
                Aorane continuously evolves and may modify, suspend, or discontinue any feature at its sole discretion without prior notice.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[2]}>
              <WarningBox>
                <p className="font-bold mb-1">⚠️ Important Medical Disclaimer</p>
                <p className="text-sm">Aorane is strictly an informational, educational, and wellness platform. AORANE IS NOT A MEDICAL DEVICE. We do not provide medical advice, clinical diagnoses, treatment plans, or emergency services.</p>
              </WarningBox>

              <SubSection title="3.1 — Not a Medical Device or Service">
                <p>Aorane is strictly an informational, educational, and wellness platform. Use of the Services does not establish a doctor-patient or professional healthcare relationship.</p>
              </SubSection>
              <SubSection title="3.2 — Assumption of Risk">
                <p>Any recommendations, insights, or Health Scores generated by Aorane are for general wellness purposes only. You must consult a qualified healthcare professional before making any health, dietary, fitness, or medication-related decisions. Never disregard professional medical advice because of information provided by Aorane.</p>
              </SubSection>
              <SubSection title="3.3 — Emergency Situations">
                <p>Do not use Aorane in a medical emergency. If you experience a medical emergency, immediately contact local emergency services (112 in India) or visit the nearest hospital.</p>
              </SubSection>
              <SubSection title="3.4 — Health Score & PDF Reports">
                <p>Health Scores are informational wellness indicators only — not medical evaluations or diagnoses. PDF reports generated through Aorane are informational summaries and should not be treated as official medical records or clinical assessments.</p>
              </SubSection>
              <SubSection title="3.5 — Future Blood Emergency Clause">
                <p>Aorane does not guarantee donor availability, blood compatibility, response times, or successful blood donations. The Blood Emergency feature is solely a communication facilitation tool.</p>
              </SubSection>
              <SubSection title="3.6 — Future Doctor Marketplace Clause">
                <p>Healthcare professionals available through future marketplace services operate independently and are not employees, agents, or representatives of Aorane.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[3]}>
              <SubSection title="4.1 — AI Limitations">
                <p>Aorane utilizes artificial intelligence (AI), machine learning, and third-party AI models (e.g., Google Gemini, OpenAI) to generate insights, analyze food photos, and review uploaded medical reports. You acknowledge that AI systems are inherently imperfect and may produce inaccurate, incomplete, or misleading information ("hallucinations").</p>
              </SubSection>
              <SubSection title="4.2 — No Guarantee of Accuracy">
                <p>Food recognition, nutritional estimates, and medical report interpretations are automated estimates. Aorane does not guarantee the accuracy, reliability, or completeness of any AI-generated output. You are strictly responsible for independently verifying all critical information with a licensed professional before taking action.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[4]}>
              <SubSection title="5.1 — Eligibility">
                <p>You must be at least 18 years of age to use the Services. By using Aorane, you represent and warrant that you have the legal capacity to form a binding contract.</p>
              </SubSection>
              <SubSection title="5.2 — Account Security">
                <p>You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify Aorane immediately of any unauthorized access.</p>
              </SubSection>
              <SubSection title="5.3 — Family Accounts">
                <p>If you utilize family account features to manage data for dependents or family members, you represent that you have the lawful authority and necessary consent to input, manage, and share their personal and health data.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[5]}>
              <SubSection title="6.1 — Accuracy of Information">
                <p>The quality of Aorane's AI recommendations relies entirely on the accuracy of the data you provide. You agree to provide true, accurate, and current information regarding your health, medical history, and physical metrics.</p>
              </SubSection>
              <SubSection title="6.2 — User Ownership & Licensing">
                <p>You retain ownership of all personal data, food photos, and medical reports you upload ("User Content"). By uploading User Content, you grant Aorane a limited, worldwide, non-exclusive, royalty-free license to store, process, analyze, and use this data to operate, deliver, and improve the Services.</p>
              </SubSection>
              <SubSection title="6.3 — Food Photo Retention">
                <p>Food photographs are temporarily processed and generally deleted within 24 hours, except where retention is required for security, troubleshooting, or legal compliance.</p>
              </SubSection>
              <SubSection title="6.4 — Location Data">
                <p>Aorane may collect and process location information, with user permission, to provide weather-based wellness recommendations, localized features, and future emergency-related functionality.</p>
              </SubSection>
              <SubSection title="6.5 — Data Processing Providers">
                <p>Aorane utilizes third-party infrastructure, authentication, cloud hosting, analytics, AI, and communication providers to operate the Services.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[6]}>
              <p>You agree to use Aorane strictly for lawful purposes. You shall not:</p>
              <BulletList items={[
                "Submit false, misleading, or fraudulent information or medical documents",
                "Impersonate any person, healthcare professional, or entity",
                "Reverse engineer, decompile, or attempt to extract source code or proprietary AI models",
                "Use bots, scrapers, or automated systems to extract data or interact with the platform",
                "Upload content that contains malware, infringes on intellectual property, or violates privacy laws",
                "Use Aorane to distribute spam, unauthorized advertising, or solicitations",
              ]} />
              <div
                className="mt-4 text-xs px-4 py-3 rounded-lg font-medium"
                style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
              >
                Aorane reserves the right to suspend or terminate any account violating this policy, without liability or prior notice.
              </div>
            </SectionBlock>

            <SectionBlock {...sections[7]}>
              <SubSection title="8.1 — Free & Premium Services">
                <p>Aorane offers both free features and paid subscriptions. Features, pricing, and terms of premium services are subject to change.</p>
              </SubSection>
              <SubSection title="8.2 — Billing & Auto-Renewal">
                <p>By purchasing a subscription, you authorize Aorane (and its third-party payment processors) to charge your payment method. Unless cancelled prior to the end of the current billing cycle, subscriptions automatically renew at the applicable rate.</p>
              </SubSection>
              <SubSection title="8.3 — Cancellations & Refunds">
                <p>You may cancel your subscription at any time via your account settings or the applicable app store (Apple App Store / Google Play). Cancellation prevents future charges but does not grant a refund for the current billing period. All fees are non-refundable except where required by applicable law.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[8]}>
              <p>All software, designs, text, graphics, logos, algorithms, and AI models associated with Aorane are the exclusive property of Aorane or its licensors, protected by copyright, trademark, and other intellectual property laws.</p>
              <p>Aorane grants you a limited, non-exclusive, non-transferable license to access and use the Services for personal, non-commercial purposes. You may not reproduce, distribute, or commercially exploit any part of the Services without express written consent.</p>
            </SectionBlock>

            <SectionBlock {...sections[9]}>
              <SubSection title='10.1 — "As Is" Basis'>
                <p>The Services are provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied.</p>
              </SubSection>
              <SubSection title="10.2 — Limitation of Liability">
                <div
                  className="text-xs px-4 py-3 rounded-lg uppercase font-bold tracking-wide leading-relaxed"
                  style={{ background: "#F8FAFF", color: "#1e3a8a", border: "1px solid #BFDBFE" }}
                >
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, AORANE, ITS AFFILIATES, DIRECTORS, EMPLOYEES, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO PERSONAL INJURY, WRONGFUL DEATH, HEALTH COMPLICATIONS, LOSS OF DATA, OR LOSS OF PROFITS ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICES.
                </div>
              </SubSection>
              <SubSection title="10.3 — Liability Cap">
                <p>In no event shall Aorane's aggregate liability to you for all claims exceed the greater of: (a) the amount you paid Aorane in the twelve (12) months preceding the claim, or (b) One Hundred United States Dollars (USD $100).</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[10]}>
              <p>
                You agree to indemnify, defend, and hold harmless Aorane and its affiliates from any claims, damages, liabilities, costs, or expenses (including reasonable legal fees) arising out of your violation of these Terms, your misuse of the Services, your User Content, or your violation of any applicable law or third-party right.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[11]}>
              <SubSection title="12.1 — Termination by User">
                <p>You may request account deletion at any time via the app settings or by contacting support.</p>
              </SubSection>
              <SubSection title="12.2 — Termination by Aorane">
                <p>We may suspend or terminate your account immediately if you breach these Terms, engage in fraud, or pose a security risk.</p>
              </SubSection>
              <SubSection title="12.3 — Post-Termination">
                <p>Upon termination, your right to access the Services ceases. We will delete or anonymize your data in accordance with our Privacy Policy, though certain data may be retained for legal, dispute resolution, or compliance purposes.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[12]}>
              <SubSection title="13.1 — Governing Law">
                <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to conflict of law principles.</p>
              </SubSection>
              <SubSection title="13.2 — Informal Resolution">
                <p>In the event of a dispute, you agree to first contact Aorane Support to attempt an informal, good-faith resolution.</p>
              </SubSection>
              <SubSection title="13.3 — Arbitration & Jurisdiction">
                <p>If a dispute cannot be resolved informally, it shall be resolved by binding arbitration under applicable Indian laws. Where arbitration is not applicable, the exclusive jurisdiction and venue shall be the competent courts located in India.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[13]}>
              <SubSection title="14.1 — Entire Agreement">
                <p>These Terms, alongside the Privacy Policy, constitute the entire agreement between you and Aorane regarding the Services.</p>
              </SubSection>
              <SubSection title="14.2 — Severability & Waiver">
                <p>If any provision of these Terms is deemed unenforceable, the remaining provisions will remain in full force and effect. Aorane's failure to enforce any right or provision will not be considered a waiver.</p>
              </SubSection>
              <SubSection title="14.3 — Updates to Terms">
                <p>Aorane reserves the right to modify these Terms at any time. Material changes will be communicated via the platform or email. Continued use of the Services after changes take effect constitutes your acceptance of the revised Terms.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[14]}>
              <p>If you have any questions or concerns regarding these Terms, please contact us at:</p>
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
              © {new Date().getFullYear()} Aorane. All rights reserved. · Governed by the laws of India.
            </div>
          </main>
        </div>

        <Footer />
      </div>
    </>
  );
}