import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import EnquiryModal from "@/components/EnquiryModal";
import { useSiteSettings } from "@/lib/useSiteSettings";
import { api } from "@/lib/api";

// ==========================================
// CONSTANTS & STATIC DATA
// ==========================================
const PRIMARY = "#05473C";
const TEAL = "#00C79A";
const TEAL_LIGHT = "#A8F0DC";

const segments = [
  { icon: "corporate_fare", title: "Corporates & Enterprises", benefits: ["Real-time employee wellness dashboard", "Reduce sick leave with proactive alerts", "Export health reports for HR & insurance"] },
  { icon: "local_hospital", title: "Hospitals & Clinics", benefits: ["Monitor staff fitness & shift readiness", "Patient follow-up & engagement tools", "Baseline health data for all staff members"] },
  { icon: "fitness_center", title: "Gyms & Fitness Centers", benefits: ["Member activity & progress score tracking", "Automated engagement and retention nudges", "Flexible subscription seat management"] },
  { icon: "self_improvement", title: "Yoga & Wellness Studios", benefits: ["Stress score & mindfulness trend tracking", "Personalized wellness journey per member", "Session reminders & targeted health nudges"] },
  { icon: "school", title: "Schools & Colleges", benefits: ["Student & staff health monitoring", "Sports performance data & activity tracking", "Monthly health report cards for leadership"] },
  { icon: "policy", title: "Insurance & TPAs", benefits: ["Verified health data for claim processing", "Proactive risk assessment by population", "Corporate portfolio health analytics"] },
];

// What the dashboard tracks — one accent color throughout (see design roadmap:
// a single accent read as more premium than the previous five-color mix).
const whatWeTrack = [
  { icon: "favorite", title: "Health Score", desc: "Daily 100-point composite — nutrition, exercise, sleep, stress & hydration." },
  { icon: "psychology", title: "Stress & Burnout Risk", desc: "5-pillar stress assessment that flags rising risk early." },
  { icon: "restaurant", title: "Nutrition", desc: "Calories, protein, carbs & micronutrients against ICMR RDA guidance." },
  { icon: "directions_run", title: "Activity & Exercise", desc: "Steps, workout minutes, and active-vs-sedentary time." },
  { icon: "bedtime", title: "Sleep Quality", desc: "Hours slept against WHO/CDC benchmarks, with weekly trend." },
  { icon: "bloodtype", title: "Vitals & BMI", desc: "India-calibrated BMI, blood glucose, BP and medicine adherence." },
];

// Fallback pricing — used only if the live /business/public/plans call
// hasn't returned yet (or fails). Kept in sync with the real seat-plan
// defaults in the API so the page never shows a broken price.
// Shown only until the live GET /business/public/plans call resolves (or if
// it fails) — kept matching plan_pricing's org_pro/org_max feature list so a
// slow/cold API start never shows a visitor different features than what
// they'd see a second later once the real data loads.
const fallbackPlans: Record<string, { label: string; pricePerSeat: number; yearlyPricePerSeat: number; features: string[] }> = {
  pro: { label: "Pro", pricePerSeat: 199, yearlyPricePerSeat: 169, features: ["Basic aggregate health dashboard", "Enrollment code management", "Employee search", "GST-ready invoice", "Email support"] },
  max: { label: "Max", pricePerSeat: 249, yearlyPricePerSeat: 211, features: ["Everything in Pro", "Advanced health analytics & charts", "Health risk distribution alerts", "Weekly & monthly team reports", "Priority support", "Custom announcements to employees"] },
};

const faqs = [
  {
    q: "Can we see individual employees' health data?",
    a: "No. Aorane Business only shows aggregate, anonymized insights (like department-level average health scores or stress trends). Individual employee health data stays private to that employee, in line with India's DPDPA 2023.",
  },
  {
    q: "How is Aorane Business priced?",
    a: "Pricing is per-seat, based on the number of employees or members you enroll. Contact us for a quote based on your organization size — a free trial is available to get started.",
  },
  {
    q: "How long does setup take?",
    a: "Most organizations are up and running within a day. You get a bulk enrollment code your employees use to join via the Aorane app — no individual onboarding calls needed.",
  },
  {
    q: "Do employees need to install a separate app?",
    a: "No. Employees use the same free Aorane consumer app they may already have — they just enter your organization's enrollment code once to link their account. That's also why engagement doesn't depend on a separate work login.",
  },
  {
    q: "Is Aorane Business suitable for hospitals, gyms, and schools, or only corporates?",
    a: "Aorane Business is built to serve Corporates, Hospitals, Gyms, Yoga Studios, Schools, and Insurance companies — anywhere an organization wants to understand aggregate wellness trends across a group of people.",
  },
  {
    q: "Can we cancel or downgrade anytime?",
    a: "Yes, there are no long-term lock-in contracts required. You can adjust your seat count or cancel at any time from your account settings.",
  },
  {
    q: "Does Aorane help with ESG or CSRD workforce reporting?",
    a: "Yes. Your Reports page includes an ESG/CSRD readiness summary that maps your organization's aggregate wellbeing data (program coverage, health score, stress-risk share, and rest & recovery) to ESRS S1 (Own Workforce) categories. It's a self-assessment aid to help your compliance team get started — not a certified audit.",
  },
];

// ==========================================
// UTILITY COMPONENTS & HOOKS
// ==========================================
function useCountUp(target: number, duration = 1400, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

function Icon({ name, size = 24, color = PRIMARY, className = "" }: { name: string; size?: number; color?: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined select-none inline-block ${className}`} style={{ fontSize: size, color, lineHeight: 1 }}>
      {name}
    </span>
  );
}

// Single, consistent scroll-reveal used everywhere instead of the previous
// mix of marquee/float/fadeUp keyframes — one calm pattern instead of
// several competing ones. Respects prefers-reduced-motion.
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const variants: Variants = reduceMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// REDESIGNED ADVANCED PRICING CARD
function PricingCard({
  plan, perSeatPrice, minSeats, features, highlighted = false, isEnterprise = false, savePercent,
}: {
  plan: string; perSeatPrice: number; minSeats: number; features: string[];
  highlighted?: boolean; isEnterprise?: boolean; savePercent?: number;
}) {
  const [, navigate] = useLocation();

  return (
    <div className={`relative overflow-hidden flex flex-col h-full rounded-[2.5rem] p-8 md:p-10 transition-all duration-500 ease-out border backdrop-blur-2xl
      ${highlighted
        ? "bg-gradient-to-br from-[#05473C]/95 to-[#05473C]/95 border-white/20 text-white shadow-[0_32px_64px_rgba(0,93,144,0.3)] scale-100 lg:scale-105 z-10 hover:-translate-y-1 hover:shadow-[0_40px_72px_rgba(0,93,144,0.4)]"
        : "bg-white/40 border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:-translate-y-2 hover:border-[#05473C]/40 hover:shadow-[0_24px_48px_rgba(5,71,60,0.12)] hover:bg-white/70"}`}>

      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-50" />

      {highlighted && (
        <div className="absolute top-6 right-6 bg-white/20 backdrop-blur-md text-white rounded-full px-4 py-1.5 text-[10px] font-extrabold tracking-widest uppercase border border-white/20 shadow-sm">
          Most Popular
        </div>
      )}
      {isEnterprise && (
        <div className="absolute top-6 right-6 bg-amber-500/10 backdrop-blur-md text-amber-700 border border-amber-500/20 rounded-full px-4 py-1.5 text-[10px] font-extrabold tracking-widest uppercase shadow-sm">
          🚧 Coming Soon
        </div>
      )}

      <div className="mb-8">
        <div className={`text-sm font-extrabold tracking-widest uppercase mb-2 ${highlighted ? "text-white/80" : "text-[#05473C]"}`}>
          {plan}
        </div>

        {isEnterprise ? (
          <div className="mt-4">
            <div className={`text-4xl md:text-5xl font-display font-medium leading-none tracking-tight ${highlighted ? "text-white" : "text-gray-900"}`}>
              Custom
            </div>
            <div className={`text-sm mt-3 font-semibold ${highlighted ? "text-white/70" : "text-gray-500"}`}>
              Tailored for massive scale
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-1.5 mt-2">
              <span className={`text-4xl md:text-5xl font-display font-medium leading-none tracking-tight ${highlighted ? "text-white" : "text-gray-900"}`}>
                ₹{perSeatPrice}
              </span>
              <span className={`text-sm font-semibold mb-1.5 ${highlighted ? "text-white/70" : "text-gray-500"}`}>/seat/month</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-sm font-bold ${highlighted ? "text-[#00C79A]" : "text-[#05473C]"}`}>
                Minimum {minSeats} seats
              </span>
              {!!savePercent && (
                <span className={`text-[11px] font-extrabold uppercase tracking-wide rounded-full px-2.5 py-1 ${highlighted ? "bg-white/15 text-[#00C79A]" : "bg-[#00C79A]/10 text-[#05473C]"}`}>
                  Save {savePercent}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <ul className="flex-grow flex flex-col gap-4 m-0 p-0 list-none mb-10">
        {features.map((f, i) => (
          <li key={i} className={`flex items-start gap-3 text-[15px] font-semibold leading-relaxed ${highlighted ? "text-white/95" : "text-gray-700"}`}>
            <Icon name={isEnterprise ? "hourglass_empty" : "check_circle"} size={20} color={highlighted ? TEAL_LIGHT : TEAL} className="mt-0.5 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        {isEnterprise ? (
          <button
            onClick={() => { window.location.href = "mailto:sales@aorane.com?subject=Enterprise Plan Early Access"; }}
            className="w-full py-4 rounded-full font-bold text-[15px] transition-all duration-300 bg-amber-50/80 backdrop-blur-sm text-amber-700 border border-amber-200/60 hover:bg-amber-100"
          >
            Join Waitlist →
          </button>
        ) : (
          <button
            onClick={() => navigate("/register")}
            className={`w-full py-4 rounded-full font-bold text-[15px] transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]
              ${highlighted
                ? "bg-white text-[#05473C] shadow-[0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.25)]"
                : "bg-white/60 backdrop-blur-md text-[#05473C] border border-[#05473C]/20 shadow-sm hover:shadow-md hover:bg-white hover:border-[#05473C]/40"}`}
          >
            Start Free Trial
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// MAIN LANDING COMPONENT
// ==========================================
export default function Landing() {
  const [, navigate] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [investorOpen, setInvestorOpen] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeIndustry, setActiveIndustry] = useState(0);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [livePlans, setLivePlans] = useState<typeof fallbackPlans | null>(null);
  const [engagement, setEngagement] = useState<{ sampleSufficient: boolean; engagementRatePercent: number | null } | null>(null);
  const engagementRef = useRef<HTMLDivElement>(null);
  const [engagementStarted, setEngagementStarted] = useState(false);
  const settings = useSiteSettings();

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Live pricing — falls back silently to fallbackPlans on any failure,
  // so the page is never blocked on the network call.
  useEffect(() => {
    let cancelled = false;
    api.getPublicPlans()
      .then((data) => {
        if (cancelled) return;
        const next: typeof fallbackPlans = { ...fallbackPlans };
        if (data.plans.pro) next.pro = { ...data.plans.pro };
        if (data.plans.max) next.max = { ...data.plans.max };
        setLivePlans(next);
      })
      .catch(() => { /* keep fallbackPlans — no error shown to the visitor */ });
    return () => { cancelled = true; };
  }, []);

  // Live, platform-wide engagement rate — only rendered once the backend
  // confirms the sample size is large enough to be meaningful (see
  // MIN_SAMPLE_SIZE_FOR_PUBLIC_STAT in the API). Never fabricated client-side.
  useEffect(() => {
    let cancelled = false;
    api.getPublicEngagementStat()
      .then((data) => { if (!cancelled) setEngagement(data); })
      .catch(() => { /* falls back to the industry-benchmark copy only */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setEngagementStarted(true); },
      { threshold: 0.4 }
    );
    if (engagementRef.current) observer.observe(engagementRef.current);
    return () => observer.disconnect();
  }, []);

  const engagementCount = useCountUp(engagement?.engagementRatePercent ?? 0, 1200, engagementStarted && !!engagement?.sampleSufficient);

  const plansForDisplay = livePlans ?? fallbackPlans;
  const maxSave = plansForDisplay.max.pricePerSeat > 0
    ? Math.round((1 - plansForDisplay.max.yearlyPricePerSeat / plansForDisplay.max.pricePerSeat) * 100) : 0;
  const proSave = plansForDisplay.pro.pricePerSeat > 0
    ? Math.round((1 - plansForDisplay.pro.yearlyPricePerSeat / plansForDisplay.pro.pricePerSeat) * 100) : 0;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="font-inter bg-[#F5F8F6] text-gray-900 overflow-x-hidden antialiased selection:bg-[#05473C]/20 selection:text-[#05473C]">
      <Helmet>
        <title>AORANE Business Portal — Employee Wellness Management Platform</title>
        <meta name="description" content="Manage your workforce health with AI-powered analytics. Monitor employee stress, track wellness KPIs, generate DPDPA-compliant reports & integrate with your HRMS. Trusted by Indian enterprises." />
        <link rel="canonical" href="https://business.aorane.com/" />
        <meta property="og:title" content="AORANE Business Portal — Employee Wellness Management" />
        <meta property="og:description" content="AI-powered employee health monitoring, stress analytics & compliance reports for Indian enterprises." />
        <meta property="og:url" content="https://business.aorane.com/" />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-16px); } }
      `}</style>

      {/* STICKY NAVIGATION */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-500 ease-in-out border-b
        ${scrolled ? "bg-white/80 backdrop-blur-2xl shadow-sm border-gray-200/50 py-2" : "bg-transparent border-transparent py-4"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <a href={import.meta.env.BASE_URL} className="flex items-center gap-3 no-underline group">
            <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" className="h-10 md:h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
            <span className="text-sm font-bold font-jakarta text-gray-500 tracking-wider uppercase">Business</span>
          </a>

          <div className="hidden lg:flex items-center gap-10">
            {["Solutions", "Pricing", "FAQ"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-[15px] font-semibold text-gray-600 hover:text-[#05473C] transition-colors duration-300">
                {l}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <button onClick={() => navigate("/login")} className="text-[15px] font-bold text-[#05473C] hover:text-[#004a73] px-4 py-2 transition-colors">
              Log In
            </button>
            <button
              onClick={() => navigate("/register")}
              className="bg-gradient-to-r from-[#05473C] to-[#00C79A] text-white rounded-full px-6 py-2.5 font-bold text-[15px] shadow-lg hover:shadow-xl hover:shadow-[#05473C]/20 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              Get Started Free
            </button>
          </div>

          <button className="lg:hidden p-2 text-gray-800" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            <Icon name={mobileNavOpen ? "close" : "menu"} size={28} />
          </button>
        </div>

        <div className={`lg:hidden absolute top-full left-0 w-full bg-white/95 backdrop-blur-xl border-b border-gray-200 overflow-hidden transition-all duration-300 ease-out ${mobileNavOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="p-6 flex flex-col gap-4">
            {["Solutions", "Pricing", "FAQ"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-base font-semibold text-gray-800 p-2 hover:bg-gray-50 rounded-xl" onClick={() => setMobileNavOpen(false)}>{l}</a>
            ))}
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => navigate("/login")} className="flex-1 py-3 border-2 border-[#05473C] text-[#05473C] rounded-full font-bold text-sm">Log In</button>
              <button onClick={() => navigate("/register")} className="flex-1 py-3 bg-gradient-to-r from-[#05473C] to-[#00C79A] text-white rounded-full font-bold text-sm shadow-md">Get Started</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* HERO SECTION */}
        <section id="solutions" className="relative overflow-hidden pt-20 pb-28 px-6 lg:pt-32 lg:pb-32">
          <div className="mesh-blob mesh-drift-1 w-[600px] h-[600px] top-0 right-0 -translate-y-1/2 translate-x-1/3" style={{ background: "radial-gradient(circle at 30% 30%, rgba(0,199,154,0.35), transparent 65%)" }} />
          <div className="mesh-blob mesh-drift-2 w-[500px] h-[500px] bottom-0 left-0 translate-y-1/3 -translate-x-1/4" style={{ background: "radial-gradient(circle at 40% 60%, rgba(5,71,60,0.15), transparent 65%)" }} />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              <Reveal>
                <div className="inline-flex items-center gap-2 glass-panel-soft text-[#05473C] rounded-full px-4 py-2 mb-8">
                  <Icon name="bolt" size={16} color={TEAL} />
                  <span className="text-xs md:text-sm font-bold tracking-wide">India's Leading Corporate Health Platform</span>
                </div>
                <h1 className="font-display text-4xl md:text-6xl lg:text-[64px] font-medium leading-[1.08] text-gray-900 tracking-tight mb-6">
                  Your Team's Health Is Your Biggest <span className="italic gradient-text-teal">Business Asset</span>
                </h1>
                <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-10 max-w-lg font-medium">
                  Most workplace wellness tools ask employees to log in for work. Aorane doesn't — it runs on the health tracking your people already do for themselves, so your dashboard reflects real behavior, not survey fatigue.
                </p>
                <div className="flex flex-wrap gap-4 mb-10">
                  <button onClick={() => navigate("/register")} className="text-white rounded-full px-8 py-4 font-bold text-lg shadow-[0_8px_30px_rgba(5,71,60,0.35)] hover:shadow-[0_12px_40px_rgba(5,71,60,0.45)] transition-all duration-300 hover:-translate-y-1 active:translate-y-0" style={{ background: "linear-gradient(135deg, #05473C, #082F28)" }}>
                    Get Started Free
                  </button>
                  <button onClick={() => setExpertOpen(true)} className="glass-panel-soft text-[#05473C] rounded-full px-8 py-4 font-bold text-lg hover:bg-white/50 transition-all duration-300">
                    Book a Demo
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "DPDPA-Aligned", icon: "verified" },
                    { label: "5-min Setup", icon: "timer" },
                    { label: "Made in India", icon: "location_on" },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center gap-2 glass-panel-soft rounded-full px-4 py-2">
                      <Icon name={b.icon} size={16} color={TEAL} />
                      <span className="text-xs font-bold tracking-widest uppercase text-gray-700">{b.label}</span>
                    </div>
                  ))}
                </div>
              </Reveal>

              <div className="hidden lg:block relative" style={{ animation: "float 8s ease-in-out infinite" }}>
                <div className="glass-panel rounded-[32px] overflow-hidden">
                  <div className="px-5 py-3.5 flex items-center gap-2.5" style={{ background: "linear-gradient(135deg, #05473C, #082F28)" }}>
                    {[1, 2, 3].map(k => <div key={k} className="w-3 h-3 rounded-full bg-white/30" />)}
                    <span className="text-white/80 text-xs font-medium ml-2 font-jakarta">Aorane Business Dashboard</span>
                    <span className="text-white/40 text-[10px] font-medium ml-auto uppercase tracking-wide">Sample view</span>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {[
                        { label: "Active Members", value: "248", icon: "group" },
                        { label: "Avg Health Score", value: "82/100", icon: "favorite" },
                        { label: "Water Goals Met", value: "91%", icon: "water_drop" },
                        { label: "Sick Days Saved", value: "34", icon: "event_available" },
                      ].map((m, i) => (
                        <div key={i} className="bg-white/70 rounded-2xl p-5 border border-white/60 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-[#05473C]/10 flex items-center justify-center">
                              <Icon name={m.icon} size={16} color={PRIMARY} />
                            </div>
                            <span className="text-xs text-gray-500 font-semibold">{m.label}</span>
                          </div>
                          <div className="text-2xl font-bold text-gray-900 font-mono-num">{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white/70 rounded-2xl p-6 border border-white/60">
                      <div className="text-xs font-bold text-gray-400 mb-4 tracking-widest uppercase">Team Health — Last 7 Days</div>
                      <div className="flex items-end gap-2 h-16">
                        {[65, 72, 68, 80, 76, 88, 82].map((h, i) => (
                          <div key={i} className={`flex-1 rounded-t-md transition-all duration-700 ${i === 6 ? '' : 'bg-[#05473C]/10 hover:bg-[#05473C]/20'}`} style={i === 6 ? { height: `${h}%`, background: "linear-gradient(180deg, #05473C, #00C79A)" } : { height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-10 w-[45%] glass-panel rounded-2xl p-5 hover:-translate-y-2 transition-transform duration-500">
                  <div className="text-[10px] font-extrabold text-gray-400 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                    <Icon name="auto_awesome" size={14} color="#05473C" /> AI Insight
                  </div>
                  <div className="text-sm text-gray-800 leading-snug font-medium mb-3">3 team members at burnout risk — recommend a wellness break.</div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[68%] rounded-full" style={{ background: "linear-gradient(90deg, #05473C, #00C79A)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ENGAGEMENT — the core differentiator, stated honestly (see Differentiation
            & Whitespace Strategy). Replaces the old marquee ticker + fabricated
            stat bar with one truthful comparison, plus a real live number once
            the platform has enough enrolled members for it to be meaningful.
            Kept deliberately compact and left-aligned throughout (mobile and
            desktop) instead of the previous wide two-column grid, which left
            too much empty space and mixed text alignments across breakpoints. */}
        <div ref={engagementRef} className="bg-white py-10 md:py-14 px-6 border-y border-gray-100">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="glass-panel-soft rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
                <div className="flex-shrink-0 flex md:flex-col items-center md:items-start gap-4 md:gap-2 md:w-44 text-left">
                  {engagement?.sampleSufficient && engagement.engagementRatePercent !== null ? (
                    <>
                      <div className="text-4xl md:text-5xl font-display font-medium text-[#05473C] leading-none tracking-tight tabular-nums">
                        {engagementCount}%
                      </div>
                      <div className="text-xs text-gray-500 font-semibold leading-snug">
                        active in the last 7 days — live
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-[#05473C]/10 flex items-center justify-center flex-shrink-0">
                        <Icon name="bolt" size={24} color={PRIMARY} />
                      </div>
                      <div className="text-xs text-gray-500 font-semibold leading-snug">
                        Built for participation<br className="hidden md:block" /> without a mandatory login.
                      </div>
                    </>
                  )}
                </div>

                <div className="md:border-l md:border-gray-200 md:pl-8 text-left">
                  <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-3.5 py-1.5 mb-3 font-bold text-[11px] tracking-wide uppercase">
                    <Icon name="query_stats" size={14} /> Why engagement is different here
                  </div>
                  <p className="text-base md:text-lg text-gray-800 leading-relaxed font-medium mb-2">
                    Most workplace wellness programs see just <span className="font-bold text-[#05473C]">20–35% employee participation</span> — because they ask people to log in for work. <span className="text-gray-500 text-sm font-normal">(Industry research, 2026)</span>
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Aorane employees join with the same app they already use for themselves — so your dashboard reflects what people actually do, not who filled in a survey.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* SOLUTIONS — industry tab picker replaces the old three stacked
            sections (segments grid + feature blocks + 8 metric cards). */}
        <section id="solutions-detail" className="py-24 md:py-32 px-6 max-w-7xl mx-auto">
          <Reveal className="text-center mb-14 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs md:text-sm tracking-wide">
              <Icon name="category" size={16} />
              Industry Solutions
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight mb-6">
              Built for Every Health-Focused Business
            </h2>
            <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Pick your industry to see how Aorane fits your team.
            </p>
          </Reveal>

          <Reveal delay={0.05} className="mb-14 -mx-6 px-6 md:mx-0 md:px-0 relative">
            <div className="overflow-x-auto thin-scrollbar md:overflow-visible">
              <div className="neu-surface flex md:inline-flex md:justify-center gap-1 w-max md:w-auto mx-auto md:mx-auto">
                {segments.map((seg, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndustry(i)}
                    data-active={activeIndustry === i}
                    className="neu-pill flex items-center gap-2 px-4 md:px-5 py-2.5 text-[13px] md:text-sm font-bold whitespace-nowrap flex-shrink-0"
                  >
                    <Icon name={seg.icon} size={18} color={activeIndustry === i ? PRIMARY : "#9CA3AF"} />
                    {seg.title}
                  </button>
                ))}
              </div>
            </div>
            {/* Fade hint on mobile so a partially-visible last tab reads as
                "scroll for more" instead of looking like clipped/broken text. */}
            <div className="pointer-events-none absolute top-0 right-0 h-[calc(100%-0px)] w-12 bg-gradient-to-l from-[#F5F8F6] via-[#F5F8F6]/70 to-transparent md:hidden" />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-[2.5rem] p-8 md:p-16 border border-gray-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#05473C]/10 flex items-center justify-center mb-8">
                  <Icon name={segments[activeIndustry].icon} size={28} color={TEAL} />
                </div>
                <h3 className="text-2xl md:text-3xl font-display font-medium text-gray-900 tracking-tight mb-6">
                  {segments[activeIndustry].title}
                </h3>
                <ul className="flex flex-col gap-4 m-0 p-0 list-none mb-8">
                  {segments[activeIndustry].benefits.map((b, j) => (
                    <li key={j} className="flex items-start gap-3 text-base text-gray-700 leading-relaxed font-medium">
                      <Icon name="check_circle" size={22} color={TEAL} className="mt-0.5 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate("/register")} className="inline-flex items-center gap-2 bg-[#05473C] text-white rounded-full px-7 py-3.5 font-bold text-[15px] hover:bg-[#043a30] transition-colors">
                  Get Started Free <Icon name="arrow_forward" size={18} color="white" />
                </button>
              </div>

              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-white/50 ring-1 ring-black/5">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-[#05473C]/10 flex items-center justify-center">
                    <Icon name="dashboard" size={24} color={PRIMARY} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">Team Health Dashboard</div>
                    <div className="text-xs text-gray-400 font-medium">Sample view</div>
                  </div>
                </div>
                <div className="mb-8">
                  {[1, 0.78, 0.58, 0.42].map((w, k) => (
                    <div key={k} className={`h-2.5 rounded-full mb-3 last:mb-0 ${k === 0 ? 'bg-gradient-to-r from-[#05473C] to-[#00C79A]' : 'bg-gray-100'}`} style={{ width: `${w * 100}%` }} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {whatWeTrack.slice(0, 4).map((item, k) => (
                    <div key={k} className="bg-gray-50 rounded-2xl p-4 border border-gray-100/50 flex items-start gap-3">
                      <Icon name={item.icon} size={20} color={PRIMARY} className="mt-0.5 flex-shrink-0" />
                      <div className="text-[13px] font-bold text-gray-700 leading-snug">{item.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* What the dashboard tracks — one accent color, six items */}
          <Reveal delay={0.15} className="mt-16">
            <div className="text-center mb-10">
              <h3 className="text-xl md:text-2xl font-display font-medium text-gray-900 tracking-tight">
                What your dashboard tracks
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {whatWeTrack.map((item, i) => (
                <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500">
                  <div className="w-11 h-11 rounded-[12px] bg-[#05473C]/10 flex items-center justify-center mb-4">
                    <Icon name={item.icon} size={22} color={PRIMARY} />
                  </div>
                  <h4 className="text-base font-extrabold text-gray-900 mb-2 font-jakarta">{item.title}</h4>
                  <p className="text-[13px] text-gray-500 leading-relaxed font-medium">{item.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* PRIVACY & DATA CONTROL */}
        <section className="py-24 md:py-32 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs tracking-wide uppercase">
                    <Icon name="shield" size={16} /> Privacy & Security
                  </div>
                  <h3 className="text-3xl md:text-4xl font-display font-medium text-gray-900 tracking-tight mb-6">
                    Your Data. Your Team's Control.
                  </h3>
                  <p className="text-[17px] text-gray-600 leading-relaxed mb-8">
                    Aorane is built with privacy-by-design. Employees always own their health data — your organization sees aggregated insights, not personal records, unless the member explicitly opts in.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {["DPDPA 2023 Aligned", "AES-256 Encrypted", "Indian Servers Only", "ISO 27001 Ready"].map((badge, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 border border-gray-200 shadow-sm text-xs font-bold text-[#05473C] uppercase tracking-wide">
                        <Icon name="verified" size={14} /> {badge}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {[
                    { icon: "person_off", title: "Anonymized by Default", desc: "Your org dashboard shows only team-level aggregates. Individual data is never shared without member consent." },
                    { icon: "manage_accounts", title: "Member-Controlled Sharing", desc: "Each employee decides what to share. HR/admins only access data the member explicitly approves." },
                    { icon: "lock", title: "Role-Based Access Control", desc: "Admins, HR managers, and department heads each see only what they're permitted — no data leakage." },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4 bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-10 h-10 rounded-[12px] bg-[#05473C]/10 flex items-center justify-center flex-shrink-0">
                        <Icon name={item.icon} size={20} color={TEAL} />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-gray-900 mb-1">{item.title}</div>
                        <div className="text-[13px] text-gray-500 leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ESG & COMPLIANCE — Phase 2 of the differentiation roadmap. Positions
            Aorane as a shortcut to ESRS S1 (Own Workforce) reporting, using
            language that matches what the authenticated Reports page actually
            generates — no claim here outruns the product. */}
        <section className="py-20 md:py-28 px-6 bg-white border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs tracking-wide uppercase">
                    <Icon name="fact_check" size={16} /> ESG & Compliance
                  </div>
                  <h3 className="text-2xl md:text-3xl font-display font-medium text-gray-900 tracking-tight mb-5">
                    A Head Start on ESG Workforce Reporting
                  </h3>
                  <p className="text-[15px] md:text-base text-gray-600 leading-relaxed mb-6">
                    New ESG frameworks like the EU's CSRD ask companies to disclose workforce wellbeing data under ESRS S1 (Own Workforce). Aorane Business maps your existing aggregate health data into those categories automatically — a self-assessment aid your compliance team can start from, not a substitute for a certified audit.
                  </p>
                  <ul className="flex flex-col gap-3 m-0 p-0 list-none">
                    {[
                      "Workforce wellbeing program coverage",
                      "Aggregate health & safety score",
                      "Work-related stress / burnout-risk share",
                      "Rest & recovery (sleep) indicator",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-700 font-medium">
                        <Icon name="check_circle" size={18} color={TEAL} className="mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-gray-50 rounded-3xl p-6 md:p-8 border border-gray-100">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Sample — ESRS S1 mapping</div>
                  {[
                    { ref: "ESRS S1-11", label: "Wellbeing Program Coverage", value: "—" },
                    { ref: "ESRS S1-14", label: "Aggregate Health Score", value: "—" },
                    { ref: "ESRS S1-14", label: "Stress / Burnout-Risk Share", value: "—" },
                    { ref: "ESRS S1-15", label: "Rest & Recovery Indicator", value: "—" },
                  ].map((row, i) => (
                    <div key={i} className={`flex items-center justify-between py-3.5 ${i !== 0 ? "border-t border-gray-200" : ""}`}>
                      <div>
                        <div className="text-[10px] font-bold text-[#05473C]/70 uppercase tracking-wide">{row.ref}</div>
                        <div className="text-sm font-semibold text-gray-800">{row.label}</div>
                      </div>
                      <div className="text-lg font-bold text-gray-300 font-mono-num">{row.value}</div>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
                    Populated automatically from your organization's real data on the Reports page once employees are enrolled.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* WHY WE'RE DIFFERENT — one score + family reach + a shareable badge.
            Phase 4 of the differentiation roadmap. Family visibility here
            describes a real, already-live capability of the Aorane consumer
            app (via its Family plan) — worded carefully so it never implies
            it's automatically bundled into a business seat. */}
        <section className="py-20 md:py-28 px-6 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-6xl mx-auto">
            <Reveal className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-display font-medium text-gray-900 tracking-tight">
                What No Other Workplace Wellness Platform Offers
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Reveal delay={0.05}>
                <div className="bg-white rounded-3xl p-8 md:p-10 border border-gray-100 shadow-sm h-full">
                  <div className="w-12 h-12 rounded-2xl bg-[#05473C]/10 flex items-center justify-center mb-6">
                    <Icon name="family_restroom" size={24} color={PRIMARY} />
                  </div>
                  <h3 className="text-xl font-display font-medium text-gray-900 mb-3">One Score, Reaching the Whole Household</h3>
                  <p className="text-[15px] text-gray-600 leading-relaxed mb-4">
                    Most workplace wellness platforms stop at the employee. Aorane's app already supports family health visibility through its Family plan — so employees who want to can extend the same tracking to the people they take care of at home, entirely on their own terms.
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    A personal, opt-in feature of the Aorane app — not something added to your business seats.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="bg-white rounded-3xl p-8 md:p-10 border border-gray-100 shadow-sm h-full">
                  <div className="w-12 h-12 rounded-2xl bg-[#05473C]/10 flex items-center justify-center mb-6">
                    <Icon name="workspace_premium" size={24} color={PRIMARY} />
                  </div>
                  <h3 className="text-xl font-display font-medium text-gray-900 mb-3">A Badge You Can Actually Show Off</h3>
                  <p className="text-[15px] text-gray-600 leading-relaxed mb-4">
                    Once your organization clears real, transparent usage thresholds — meaningful weekly engagement and a healthy average team score — you unlock an "Aorane Health-Certified Workplace" badge to embed on your careers page or LinkedIn.
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Computed monthly from your own real data — available from your Reports page after signup.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* PRICING SECTION — with neumorphic monthly/annual toggle, wired to
            real seat-plan pricing from the API when available. */}
        <section id="pricing" className="py-24 md:py-32 px-6 relative overflow-hidden">
          <div className="absolute top-1/4 left-0 w-96 h-96 bg-[#05473C]/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-[#05473C]/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="max-w-7xl mx-auto relative z-10">
            <Reveal className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs md:text-sm tracking-wide backdrop-blur-md border border-[#05473C]/10">
                <Icon name="payments" size={16} /> Transparent Pricing
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight mb-6">
                Per-Seat Pricing. Zero Hidden Costs.
              </h2>
              <p className="text-lg md:text-xl text-gray-500 font-medium mb-3">Pay only for your team size. Cancel anytime.</p>
              <p className="text-sm text-gray-400 font-medium mb-10">
                No enterprise-only minimums — plans start from just 10 seats, so growing teams and SMEs aren't priced out.
              </p>

              <div className="neu-surface inline-flex gap-1">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  data-active={billingCycle === "monthly"}
                  className="neu-pill px-6 py-2.5 text-sm font-bold"
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  data-active={billingCycle === "yearly"}
                  className="neu-pill px-6 py-2.5 text-sm font-bold flex items-center gap-2"
                >
                  Annual
                  {proSave > 0 && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wide bg-[#00C79A]/15 text-[#05473C] rounded-full px-2 py-0.5">
                      Save {proSave}%
                    </span>
                  )}
                </button>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
                <PricingCard
                  plan={plansForDisplay.pro.label}
                  perSeatPrice={billingCycle === "monthly" ? plansForDisplay.pro.pricePerSeat : plansForDisplay.pro.yearlyPricePerSeat}
                  minSeats={20}
                  features={plansForDisplay.pro.features}
                  savePercent={billingCycle === "yearly" ? proSave : undefined}
                />
                <PricingCard
                  plan={plansForDisplay.max.label}
                  perSeatPrice={billingCycle === "monthly" ? plansForDisplay.max.pricePerSeat : plansForDisplay.max.yearlyPricePerSeat}
                  minSeats={10}
                  features={plansForDisplay.max.features}
                  highlighted
                  savePercent={billingCycle === "yearly" ? maxSave : undefined}
                />
                <PricingCard
                  plan="Custom"
                  perSeatPrice={0}
                  minSeats={250}
                  features={["Coming Soon"]}
                  isEnterprise
                />
              </div>

              <p className="text-center text-gray-500 text-sm mt-12 font-medium">
                Promo codes accepted at checkout. All prices exclusive of 18% GST.{" "}
                <a href="mailto:sales@aorane.com?subject=Enterprise Plan Enquiry" className="text-[#05473C] font-bold hover:underline decoration-2 underline-offset-4">
                  Contact Sales
                </a>{" "}
                for 251+ seat Enterprise plans.
              </p>
            </Reveal>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-white py-24 md:py-32 px-6 border-y border-gray-100">
          <div className="max-w-5xl mx-auto text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs md:text-sm tracking-wide">
                <Icon name="route" size={16} /> Quick Onboarding
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight mb-6">
                Get Your Team Healthy in 3 Simple Steps
              </h2>
              <p className="text-lg md:text-xl text-gray-500 mb-20 font-medium">From signup to full team visibility in under 10 minutes.</p>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 relative">
              <div className="hidden md:block absolute top-[44px] left-[20%] right-[20%] h-1 bg-gradient-to-r from-[#05473C] to-[#00C79A] opacity-10 z-0" />

              {[
                { step: "01", icon: "how_to_reg", title: "Register & Set Up", desc: "Create your business account and add your organization details in under 5 minutes." },
                { step: "02", icon: "group_add", title: "Invite Your Team", desc: "Share a unique join code. Employees use the app they already have and connect instantly." },
                { step: "03", icon: "insights", title: "Track & Improve", desc: "Monitor health scores, send wellness nudges, and receive AI-powered insights every day." },
              ].map((s, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 md:p-10 relative z-10 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 ease-out h-full">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#05473C] to-[#00C79A] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#05473C]/20">
                      <Icon name={s.icon} size={28} color="white" />
                    </div>
                    <div className="text-[11px] font-extrabold text-gray-400 tracking-[0.2em] uppercase mb-4">Step {s.step}</div>
                    <h3 className="text-xl font-display font-medium text-gray-900 mb-3">{s.title}</h3>
                    <p className="text-sm md:text-[15px] text-gray-500 leading-relaxed font-medium">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white py-24 md:py-32 px-6 border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
            <Reveal className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight">
                Frequently Asked Questions
              </h2>
            </Reveal>
            <div className="space-y-4">
              {faqs.map((f, i) => (
                <div key={i} className="glass-panel-soft rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-6 text-left"
                  >
                    <span className="font-bold text-gray-900">{f.q}</span>
                    <Icon name={openFaq === i ? "remove" : "add"} size={22} color="#05473C" />
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-6 text-gray-600 text-[15px] leading-relaxed">{f.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="py-20 md:py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <Reveal>
              <div className="bg-gradient-to-r from-[#05473C] to-[#00C79A] rounded-[3rem] p-10 md:p-20 text-center relative overflow-hidden shadow-2xl">
                <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                <h2 className="text-3xl md:text-5xl font-display font-medium text-white tracking-tight mb-6 relative z-10 leading-tight max-w-4xl mx-auto">
                  Give Your Team a Wellness Platform They'll Actually Use
                </h2>
                <p className="text-lg md:text-xl text-white/80 mb-12 relative z-10 font-medium max-w-2xl mx-auto">
                  No mandatory logins. No survey fatigue. Just real, everyday health data — for your whole organization.
                </p>
                <div className="flex flex-wrap gap-4 justify-center relative z-10">
                  <button
                    onClick={() => navigate("/register")}
                    className="bg-white text-[#05473C] rounded-full px-10 py-4 font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    Get Started Free
                  </button>
                  <button
                    onClick={() => setExpertOpen(true)}
                    className="bg-white/10 backdrop-blur-md text-white border-2 border-white/30 hover:bg-white/20 hover:border-white/50 rounded-full px-10 py-4 font-bold text-lg transition-all duration-300"
                  >
                    Talk to an Expert
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200 pt-20 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-8 mb-16">
            <div className="lg:col-span-2">
              <a href={import.meta.env.BASE_URL} className="inline-block mb-6 transition-transform hover:scale-105">
                <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" className="h-12 w-auto object-contain" />
              </a>
              <p className="text-[15px] text-gray-500 leading-relaxed max-w-sm mb-8 font-medium">
                The unified intelligence platform for managing health and wellness at scale across any organization.
              </p>
              <div className="flex gap-3">
                {["language", "alternate_email", "phone_in_talk"].map((icon, i) => (
                  <div key={i} className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-[#05473C] hover:border-[#05473C] hover:text-white text-gray-500 transition-all duration-300 shadow-sm">
                    <Icon name={icon} size={18} className="inherit" />
                  </div>
                ))}
              </div>
            </div>

            {[
              {
                title: "Product",
                links: [
                  { label: "Enterprise Dashboard", href: "#solutions" },
                  { label: "Employee Portal", href: "/login" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "API & Integrations", href: "mailto:business@aorane.in?subject=API Integration Enquiry" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "About Aorane", href: "https://aorane.com/about" },
                  { label: "Careers", href: "https://aorane.com/careers" },
                  { label: "Security Practices", href: "https://aorane.com/security" },
                  { label: "Sub-processor List", href: "https://aorane.com/sub-processors" },
                  { label: "Medical Disclaimer", href: "https://aorane.com/medical-disclaimer" },
                  { label: "Contact Us", href: "https://aorane.com/contact" },
                ],
              },
              {
                title: "Support",
                links: [
                  { label: "Help Center", href: "mailto:support@aorane.com?subject=Help Center" },
                  { label: "Contact Sales", href: "mailto:business@aorane.in?subject=Sales Enquiry" },
                  { label: "Terms of Service", href: "https://aorane.com/terms" },
                  { label: "Privacy Policy", href: "https://aorane.com/privacy" },
                  { label: "Cookie Policy", href: "https://aorane.com/cookie-policy" },
                  { label: "Refund & Cancellation", href: "https://aorane.com/refund-policy" },
                  { label: "Grievance Redressal", href: "https://aorane.com/privacy#contact" },
                  { label: "Feedback", href: "mailto:feedback@aorane.com?subject=Feedback" },
                ],
              },
              {
                title: "Enterprise Agreements",
                links: [
                  { label: "Master Service Agreement", href: "https://aorane.com/master-service-agreement" },
                  { label: "Data Processing Agreement", href: "https://aorane.com/data-processing-agreement" },
                  { label: "Business Associate Agreement", href: "https://aorane.com/business-associate-agreement" },
                  { label: "Service Level Agreement", href: "https://aorane.com/sla" },
                  { label: "Children's Privacy Addendum", href: "https://aorane.com/childrens-privacy" },
                  { label: "International Transfer Addendum", href: "https://aorane.com/international-transfer-addendum" },
                  { label: "ABDM / NDHM Compliance Note", href: "https://aorane.com/abdm-compliance" },
                ],
              },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-[13px] font-extrabold text-gray-900 mb-6 uppercase tracking-widest">{col.title}</h4>
                <ul className="flex flex-col gap-4 m-0 p-0 list-none">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a
                        href={link.href}
                        target={link.href.startsWith("http") ? "_blank" : undefined}
                        rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="text-[15px] font-medium text-gray-500 hover:text-[#05473C] transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
                {col.title === "Company" && (
                  <button
                    onClick={() => setInvestorOpen(true)}
                    className="text-[15px] font-medium text-gray-500 hover:text-[#05473C] transition-colors duration-200 mt-4 block text-left"
                  >
                    Investor Relations
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-sm font-medium text-gray-400 m-0">© {new Date().getFullYear()} {settings.companyName || "Aorane"}. All rights reserved.</p>
            <div className="flex flex-wrap gap-6 items-center justify-center">
              <div className="flex gap-4 border-r border-gray-200 pr-6">
                {[
                  { url: settings.socialLinkedin,  icon: "business_center", label: "LinkedIn" },
                  { url: settings.socialInstagram, icon: "photo_camera",    label: "Instagram" },
                  { url: settings.socialYoutube,   icon: "smart_display",   label: "YouTube" },
                  { url: settings.socialFacebook,  icon: "thumb_up",        label: "Facebook" },
                ].filter((x) => x.url).map((s) => (
                  <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="text-gray-400 hover:text-[#05473C] transition-colors">
                    <Icon name={s.icon} size={20} />
                  </a>
                ))}
              </div>
              <div className="flex gap-4">
                {["ISO 27001 Ready", "DPDPA Aligned", "Made in India 🇮🇳"].map((badge, i) => (
                  <span key={i} className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest">{badge}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <div className="relative z-50">
        <EnquiryModal
          open={investorOpen}
          onClose={() => setInvestorOpen(false)}
          type="investor_deck"
          title="Download Investor Deck"
          subtitle="Share your details and we'll send the deck instantly. We'll also follow up with our investor relations team."
          source="business_portal_investor"
          primaryColor={PRIMARY}
          successDownload
        />
        <EnquiryModal
          open={expertOpen}
          onClose={() => setExpertOpen(false)}
          type="expert"
          title="Talk to a Wellness Expert"
          subtitle="Book a free 30-minute consultation with our team to design a wellness program for your organization."
          source="business_portal_expert"
          primaryColor={PRIMARY}
        />
      </div>
    </div>
  );
}
