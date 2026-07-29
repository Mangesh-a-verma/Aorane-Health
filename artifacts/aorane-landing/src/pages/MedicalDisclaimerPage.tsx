import { useState, useEffect, useRef, type ReactNode, type ComponentType } from "react";
import { Helmet } from "react-helmet-async";
import {
  AlertTriangle, Mail, Globe, ChevronDown, FileText,
  Brain, Heart, Pill, Zap, Shield, Scale, RefreshCw, Phone
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const sections = [
  { id: "introduction", num: "01", title: "Introduction & Purpose",               icon: FileText,      accent: "#0747A6" },
  { id: "no-advice",    num: "02", title: "No Medical Advice or Relationship",    icon: Heart,         accent: "#DC2626" },
  { id: "emergencies",  num: "03", title: "Medical Emergencies",                  icon: AlertTriangle, accent: "#D97706" },
  { id: "ai",           num: "04", title: "AI Limitations",                       icon: Brain,         accent: "#0747A6" },
  { id: "tracking",     num: "05", title: "Health, Medication & Wellness",        icon: Pill,          accent: "#0747A6" },
  { id: "future",       num: "06", title: "Future Services & Third-Party",        icon: Zap,           accent: "#0747A6" },
  { id: "liability",    num: "07", title: "Assumption of Risk & Liability",       icon: Scale,         accent: "#0747A6" },
  { id: "severability", num: "08", title: "Severability & Updates",               icon: RefreshCw,     accent: "#0747A6" },
  { id: "contact",      num: "09", title: "Contact Information",                  icon: Mail,          accent: "#00B388" },
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

function WarningBox({ title, children, color = "#D97706", bg = "#fffbeb", border = "#fde68a" }: { title?: string; children: ReactNode; color?: string; bg?: string; border?: string }) {
  return (
    <div className="rounded-xl p-4 border flex gap-3" style={{ background: bg, borderColor: border }}>
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color }} />
      <div>
        {title && <p className="font-bold text-sm mb-1" style={{ color }}>{title}</p>}
        <div className="text-sm" style={{ color: color + "dd" }}>{children}</div>
      </div>
    </div>
  );
}

export default function MedicalDisclaimerPage() {
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
        <title>Medical Disclaimer | AORANE</title>
        <meta name="description" content="AORANE Medical Disclaimer — Aorane is not a medical device. Read important limitations about AI health insights, wellness tracking, and emergency guidance." />
        <link rel="canonical" href="https://aorane.com/medical-disclaimer" />
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
              <AlertTriangle size={12} />
              <span className="uppercase tracking-widest">Not a Medical Device</span>
            </div>
            <h1 className="text-5xl font-extrabold text-white mb-4 tracking-tight">
              Medical Disclaimer
            </h1>
            <p className="text-white/50 text-sm mb-8">Last updated: April 2026</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
              <Tag color="#DC2626">Not a Medical Device</Tag>
              <Tag color="#0747A6">9 Sections</Tag>
              <Tag color="#D97706">Always Consult a Doctor</Tag>
            </div>
          </div>
        </section>

        {/* Emergency banner */}
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-xs font-semibold text-red-700">
            <Phone size={13} />
            <span>Medical Emergency? Call <strong>112</strong> (India) or visit your nearest hospital immediately. Do not rely on Aorane in emergencies.</span>
          </div>
        </div>

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
                Welcome to Aorane. This Medical Disclaimer outlines important limitations regarding the health, wellness, nutrition, tracking, artificial intelligence (AI), and informational services provided through the Aorane platform.
              </p>
              <div
                className="mt-3 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wide"
                style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
              >
                ⚠️ Aorane is a health and wellness platform designed solely to assist users in organizing, tracking, and monitoring their personal wellness journey. AORANE IS NOT A MEDICAL DEVICE.
              </div>
              <p className="mt-3">
                By accessing or using our platform, you acknowledge and agree to the terms of this Medical Disclaimer.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[1]}>
              <p>
                All information, reports, Health Scores, AI-generated insights, and educational content provided by Aorane are intended strictly for informational, educational, and general wellness purposes.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3">
                {[
                  { label: "Not a Healthcare Provider", desc: "Aorane is not a doctor, clinic, hospital, or licensed medical practitioner." },
                  { label: "No Medical Advice",         desc: "Nothing provided through Aorane should be interpreted as professional medical advice, diagnosis, treatment recommendations, or clinical guidance." },
                  { label: "No Doctor-Patient Relationship", desc: "Your use of the Services does not create a doctor-patient, clinical, or professional healthcare relationship between you and Aorane." },
                  { label: "Consult Professionals",    desc: "Always seek the advice of a qualified healthcare professional regarding any medical condition, symptom, diagnosis, or treatment. Never disregard or delay seeking professional medical advice because of information obtained through Aorane." },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl border border-red-100 bg-red-50">
                    <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
                    <div>
                      <p className="font-semibold text-red-900 text-xs">{label}</p>
                      <p className="text-red-700 text-xs mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionBlock>

            <SectionBlock {...sections[2]}>
              <WarningBox
                title="🚨 In a Medical Emergency — Do NOT use Aorane"
                color="#DC2626"
                bg="#FEF2F2"
                border="#FECACA"
              >
                <p>
                  Aorane does not monitor, detect, or dispatch emergency services. If you experience a medical emergency — including but not limited to chest pain, breathing difficulties, severe bleeding, stroke symptoms, or severe allergic reactions — immediately contact your local emergency services or visit the nearest hospital.
                </p>
              </WarningBox>
              <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
                <Phone size={20} className="flex-shrink-0 text-red-500" />
                <div>
                  <p className="text-xs text-red-400 font-medium">India Emergency Number</p>
                  <p className="text-2xl font-black text-red-600 leading-none">112</p>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock {...sections[3]}>
              <p>
                Aorane utilizes AI, machine learning, and image recognition to generate Health Scores, analyze food photographs, summarize medical reports, and provide wellness recommendations.
              </p>
              <SubSection title="AI Is Not a Doctor">
                <p>AI systems are inherently probabilistic, may produce inaccurate, incomplete, or misleading outputs (&quot;hallucinations&quot;), and lack the context of your complete medical history. Aorane does not guarantee the accuracy or reliability of AI-generated insights.</p>
              </SubSection>
              <SubSection title="Food Scan & Nutrition">
                <p>AI-generated food identification, calorie estimates, and nutritional breakdowns are approximations only. Aorane does not guarantee the identification of allergens or cross-contamination risks.</p>
              </SubSection>
              <SubSection title="Medical Report Analysis">
                <p>AI-assisted analysis of blood reports, prescriptions, and medical records is strictly for informational summarization. It is not a clinical interpretation and may miss critical abnormalities. You must verify all laboratory values and medical reports with a qualified healthcare professional.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[4]}>
              <SubSection title="Medication Reminders">
                <p>Aorane may offer medication reminder tools for organizational convenience. We do not guarantee the timely delivery of reminders due to potential device, network, or OS limitations. You remain solely responsible for managing your medication schedules and dosages.</p>
              </SubSection>
              <SubSection title="Diet & Fitness">
                <p>Dietary recommendations and fitness insights are general suggestions. They are not therapeutic or clinical diet plans. Aorane does not guarantee specific outcomes such as weight loss, weight gain, or disease prevention.</p>
              </SubSection>
              <SubSection title="Specific Conditions">
                <p>Aorane is not designed to treat, manage, or monitor chronic diseases, pregnancy, fertility, or mental health conditions.</p>
              </SubSection>
              <WarningBox
                title="Mental Health Crisis"
                color="#7C3AED"
                bg="#F5F3FF"
                border="#DDD6FE"
              >
                Individuals experiencing mental health crises or suicidal thoughts must immediately contact a crisis hotline or mental health professional. iCall (India): <strong>9152987821</strong> · Vandrevala Foundation: <strong>1860-2662-345</strong>
              </WarningBox>
            </SectionBlock>

            <SectionBlock {...sections[5]}>
              <SubSection title="Blood Emergency Feature (Future)">
                <p>Any future feature facilitating blood donation requests is solely a communication tool. Aorane does not guarantee donor availability, blood compatibility, or successful donations.</p>
              </SubSection>
              <SubSection title="Healthcare Marketplace (Future)">
                <p>Future features connecting users with independent doctors, laboratories, or healthcare providers do not constitute an endorsement. Aorane does not employ these providers, supervise their clinical decisions, or guarantee the quality of their services.</p>
              </SubSection>
              <SubSection title="Third-Party Infrastructure">
                <p>Aorane relies on third-party providers (e.g., Firebase, Google Gemini, OpenAI). We are not liable for errors, outages, or inaccuracies caused by these external platforms.</p>
              </SubSection>
            </SectionBlock>

            <SectionBlock {...sections[6]}>
              <p>Your use of Aorane is entirely voluntary and at your own risk. To the fullest extent permitted by applicable law, Aorane, its affiliates, employees, and third-party partners shall not be liable for any direct, indirect, incidental, consequential, or special damages arising from:</p>
              <BulletList items={[
                "Your reliance on any information, Health Score, AI output, or report generated by Aorane",
                "Any health, dietary, fitness, or medication decisions you make",
                "Missed diagnoses, delayed medical treatments, or medical emergencies",
                "Inaccuracies, technical failures, or data loss within the platform",
              ]} />
            </SectionBlock>

            <SectionBlock {...sections[7]}>
              <p>
                If any provision of this Medical Disclaimer is deemed unlawful or unenforceable, the remaining provisions shall remain in full force and effect. Aorane reserves the right to update or modify this Medical Disclaimer at any time. Continued use of the Services following any updates constitutes your acceptance of the revised terms.
              </p>
            </SectionBlock>

            <SectionBlock {...sections[8]}>
              <p>For questions regarding this Medical Disclaimer, please contact us at:</p>
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
              © {new Date().getFullYear()} Aorane. All rights reserved. · Aorane is not a medical device or healthcare provider.
            </div>

          </main>
        </div>

        <Footer />
      </div>
    </>
  );
}