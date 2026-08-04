import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import EnquiryModal from "@/components/EnquiryModal";
import { useSiteSettings } from "@/lib/useSiteSettings";

// ==========================================
// CONSTANTS & STATIC DATA
// ==========================================
const PRIMARY = "#05473C";
const TEAL = "#00C79A";
const TEAL_LIGHT = "#A8F0DC";
const BG = "#F5F8F6";

const segments = [
  { icon: "corporate_fare", title: "Corporates & Enterprises", benefits: ["Real-time employee wellness dashboard", "Reduce sick leave with proactive alerts", "Export health reports for HR & insurance"] },
  { icon: "local_hospital", title: "Hospitals & Clinics", benefits: ["Monitor staff fitness & shift readiness", "Patient follow-up & engagement tools", "Baseline health data for all staff members"] },
  { icon: "fitness_center", title: "Gyms & Fitness Centers", benefits: ["Member activity & progress score tracking", "Automated engagement and retention nudges", "Flexible subscription seat management"] },
  { icon: "self_improvement", title: "Yoga & Wellness Studios", benefits: ["Stress score & mindfulness trend tracking", "Personalized wellness journey per member", "Session reminders & targeted health nudges"] },
  { icon: "school", title: "Schools & Colleges", benefits: ["Student & staff health monitoring", "Sports performance data & activity tracking", "Monthly health report cards for leadership"] },
  { icon: "policy", title: "Insurance & TPAs", benefits: ["Verified health data for claim processing", "Proactive risk assessment by population", "Corporate portfolio health analytics"] },
];

const features = [
  {
    icon: "dashboard",
    title: "Real-Time Health Dashboard",
    desc: "One unified view of your entire organization's health. Track water intake, nutrition, exercise, sleep quality, and stress levels for every member — updated in real time.",
    points: ["Live health scores for every member or employee", "Department-wise analytics and trend comparisons", "Exportable PDF health reports for HR and compliance audits"],
    metricLabels: ["Engagement", "Completion", "Improvement", "Avg Session"],
    metricValues: ["85%", "92%", "12%↑", "30 min"],
  },
  {
    icon: "psychology",
    title: "AI-Powered Health Insights",
    desc: "Aorane's intelligent health engine analyzes behavioral patterns and sends proactive alerts before problems escalate — helping you act early, not just observe.",
    points: ["Predictive burnout and absenteeism detection by AI", "Smart food and exercise recommendations per individual", "Aorane AI health scorecard with 100-point scoring system"],
    metricLabels: ["Accuracy", "Alert Speed", "Risk Detection", "Uptime"],
    metricValues: ["94%", "< 1min", "Early", "99.9%"],
  },
  {
    icon: "manage_accounts",
    title: "Seamless Seat Management",
    desc: "Add or remove members in seconds. Control access, apply promo codes, and manage billing — all from one clean interface with no technical knowledge required.",
    points: ["Add and remove members in under 30 seconds", "Promo codes and flexible monthly or annual billing", "Role-based access control for admins and HR managers"],
    metricLabels: ["Setup Time", "Members", "Uptime", "Support"],
    metricValues: ["5 min", "Unlimited", "99.9%", "24/7"],
  },
];

// UPDATED PLANS ARRAY
const plans = [
  {
    plan: "Max",
    perSeatPrice: 249,
    minSeats: 10,
    features: [
      "Health Update",
      "Limited AI Analysis",
      "BMI-India Calibrated (Asia-Pacific)",
      "Live Team Health Dashboard",
      "Email Support",
    ],
  },
  {
    plan: "Pro",
    perSeatPrice: 199,
    minSeats: 20,
    highlighted: true,
    features: [
      "ALL MAX Features & Free CRM",
      "AI Analysis (No Limit)",
      "Team Stress Level Monitor",
      "Monthly Health Report",
      "24/7 Priority Support",
    ],
  },
  {
    plan: "Custom",
    perSeatPrice: 0,
    minSeats: 250,
    isEnterprise: true,
    features: [
      "Coming Soon"
    ],
  },
];

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
    a: "No. Employees use the same free Aorane consumer app they may already have — they just enter your organization's enrollment code once to link their account.",
  },
  {
    q: "Is Aorane Business suitable for hospitals, gyms, and schools, or only corporates?",
    a: "Aorane Business is built to serve Corporates, Hospitals, Gyms, Yoga Studios, Schools, and Insurance companies — anywhere an organization wants to understand aggregate wellness trends across a group of people.",
  },
  {
    q: "Can we cancel or downgrade anytime?",
    a: "Yes, there are no long-term lock-in contracts required. You can adjust your seat count or cancel at any time from your account settings.",
  },
];

// ==========================================
// UTILITY COMPONENTS & HOOKS
// ==========================================
function useCountUp(target: number, duration = 2000, start = false) {
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

function StatCard({ icon, value, suffix, label, started }: { icon: string; value: number; suffix: string; label: string; started: boolean }) {
  const count = useCountUp(value, 2000, started);
  return (
    <div className="text-center py-8 px-4 flex flex-col items-center">
      <div className="mb-3"><Icon name={icon} size={36} color={TEAL_LIGHT} /></div>
      <div className="text-4xl md:text-5xl font-extrabold text-white font-jakarta leading-none tracking-tight">
        {count}{suffix}
      </div>
      <div className="text-white/75 text-sm md:text-base mt-3 font-medium tracking-wide">{label}</div>
    </div>
  );
}

// REDESIGNED ADVANCED PRICING CARD
function PricingCard({ plan, perSeatPrice, minSeats, features, highlighted = false, isEnterprise = false }: { plan: string; perSeatPrice: number; minSeats: number; features: string[]; highlighted?: boolean; isEnterprise?: boolean }) {
  const [, navigate] = useLocation();

  return (
    <div className={`relative overflow-hidden flex flex-col h-full rounded-[2.5rem] p-8 md:p-10 transition-all duration-500 ease-out border backdrop-blur-2xl
      ${highlighted 
        ? "bg-gradient-to-br from-[#05473C]/95 to-[#05473C]/95 border-white/20 text-white shadow-[0_32px_64px_rgba(0,93,144,0.3)] scale-100 lg:scale-105 z-10" 
        : "bg-white/40 border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[0_24px_48px_rgba(0,0,0,0.08)] hover:bg-white/60"}`}>
      
      {/* Top Glare Light Effect */}
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

      {/* Plan Header */}
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
            <div className={`text-sm font-bold mt-3 ${highlighted ? "text-[#00C79A]" : "text-[#05473C]"}`}>
              Minimum {minSeats} seats
            </div>
          </div>
        )}
      </div>

      {/* Features List (flex-grow pushes CTA to bottom perfectly) */}
      <ul className="flex-grow flex flex-col gap-4 m-0 p-0 list-none mb-10">
        {features.map((f, i) => (
          <li key={i} className={`flex items-start gap-3 text-[15px] font-semibold leading-relaxed ${highlighted ? "text-white/95" : "text-gray-700"}`}>
            <Icon name={isEnterprise ? "hourglass_empty" : "check_circle"} size={20} color={highlighted ? TEAL_LIGHT : TEAL} className="mt-0.5 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* Call to Action */}
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
  const [statsStarted, setStatsStarted] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [investorOpen, setInvestorOpen] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const settings = useSiteSettings();

  // Optimized Scroll Listener
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsStarted(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="font-inter bg-[#F5F8F6] text-gray-900 overflow-x-hidden antialiased selection:bg-[#05473C]/20 selection:text-[#05473C]">
      <Helmet>
        <title>AORANE Business Portal — Employee Wellness Management Platform</title>
        <meta name="description" content="Manage your workforce health with AI-powered analytics. Monitor employee stress, track wellness KPIs, generate DPDPA-compliant reports & integrate with your HRMS. Trusted by Indian enterprises." />
        <link rel="canonical" href="https://business.aorane.com/" />
        <meta property="og:title" content="AORANE Business Portal — Employee Wellness Management" />
        <meta property="og:description" content="AI-powered employee health monitoring, stress analytics & compliance reports for Indian enterprises." />
        <meta property="og:url" content="https://business.aorane.com/" />
      </Helmet>
      
      {/* Required tiny CSS for keyframes */}
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-16px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
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
            {["Solutions", "Features", "Pricing", "About"].map(l => (
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
            {["Solutions", "Features", "Pricing", "About"].map(l => (
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
        <section id="solutions" className="relative overflow-hidden pt-20 pb-32 px-6 lg:pt-32 lg:pb-40">
          <div className="mesh-blob mesh-drift-1 w-[600px] h-[600px] top-0 right-0 -translate-y-1/2 translate-x-1/3" style={{ background: "radial-gradient(circle at 30% 30%, rgba(0,199,154,0.35), transparent 65%)" }} />
          <div className="mesh-blob mesh-drift-2 w-[500px] h-[500px] bottom-0 left-0 translate-y-1/3 -translate-x-1/4" style={{ background: "radial-gradient(circle at 40% 60%, rgba(5,71,60,0.15), transparent 65%)" }} />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              <div style={{ animation: "fadeUp 1s ease-out forwards" }}>
                <div className="inline-flex items-center gap-2 glass-panel-soft text-[#05473C] rounded-full px-4 py-2 mb-8">
                  <Icon name="bolt" size={16} color={TEAL} />
                  <span className="text-xs md:text-sm font-bold tracking-wide">India's Leading Corporate Health Platform</span>
                </div>
                <h1 className="font-display text-4xl md:text-6xl lg:text-[64px] font-medium leading-[1.08] text-gray-900 tracking-tight mb-6">
                  Your Team's Health Is Your Biggest <span className="italic gradient-text-teal">Business Asset</span>
                </h1>
                <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-10 max-w-lg font-medium">
                  Aorane Business gives Corporates, Hospitals, Gyms & Wellness Centers a unified platform to monitor, motivate and manage employee & member health — in real time.
                </p>
                <div className="flex flex-wrap gap-4 mb-10">
                  <button onClick={() => navigate("/register")} className="text-white rounded-full px-8 py-4 font-bold text-lg shadow-[0_8px_30px_rgba(5,71,60,0.35)] hover:shadow-[0_12px_40px_rgba(5,71,60,0.45)] transition-all duration-300 hover:-translate-y-1 active:translate-y-0" style={{ background: "linear-gradient(135deg, #05473C, #082F28)" }}>
                    Get Started Free
                  </button>
                  <button className="glass-panel-soft text-[#05473C] rounded-full px-8 py-4 font-bold text-lg hover:bg-white/50 transition-all duration-300">
                    Book a Demo
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "HIPAA-Ready", icon: "verified" },
                    { label: "5-min Setup", icon: "timer" },
                    { label: "Made in India", icon: "location_on" },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center gap-2 glass-panel-soft rounded-full px-4 py-2">
                      <Icon name={b.icon} size={16} color={TEAL} />
                      <span className="text-xs font-bold tracking-widest uppercase text-gray-700">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden lg:block relative" style={{ animation: "float 8s ease-in-out infinite" }}>
                <div className="glass-panel rounded-[32px] overflow-hidden">
                  <div className="px-5 py-3.5 flex items-center gap-2.5" style={{ background: "linear-gradient(135deg, #05473C, #082F28)" }}>
                    {[1, 2, 3].map(k => <div key={k} className="w-3 h-3 rounded-full bg-white/30" />)}
                    <span className="text-white/80 text-xs font-medium ml-2 font-jakarta">Aorane Business Dashboard</span>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {[
                        { label: "Active Members", value: "248", icon: "group", color: "text-[#05473C]", bg: "bg-[#05473C]/10" },
                        { label: "Avg Health Score", value: "82/100", icon: "favorite", color: "text-[#00C79A]", bg: "bg-[#00C79A]/12" },
                        { label: "Water Goals Met", value: "91%", icon: "water_drop", color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10" },
                        { label: "Sick Days Saved", value: "34", icon: "event_available", color: "text-[#00C79A]", bg: "bg-[#00C79A]/12" },
                      ].map((m, i) => (
                        <div key={i} className="bg-white/70 rounded-2xl p-5 border border-white/60 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-8 h-8 rounded-xl ${m.bg} flex items-center justify-center`}>
                              <Icon name={m.icon} size={16} className={m.color} />
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

        {/* SOCIAL PROOF TICKER */}
        <div className="bg-white py-6 border-y border-gray-100 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          <div className="flex w-max" style={{ animation: "marquee 35s linear infinite" }}>
            {[...Array(2)].flatMap(() => ["Corporates", "Hospitals", "Gyms", "Yoga Studios", "Wellness Clinics", "Schools & Colleges", "Insurance Companies"]).map((item, i) => (
              <span key={i} className="inline-flex items-center gap-12 px-8">
                <span className="text-[13px] font-extrabold tracking-[0.2em] uppercase text-gray-400">{item}</span>
                <span className="text-[#05473C]/20 text-2xl">•</span>
              </span>
            ))}
          </div>
        </div>

        {/* BUSINESS SEGMENTS */}
        <section id="solutions-detail" className="py-24 md:py-32 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16 md:mb-24">
            <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs md:text-sm tracking-wide">
              <Icon name="category" size={16} />
              Industry Solutions
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight mb-6">
              Built for Every Health-Focused Business
            </h2>
            <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              No matter your industry — Aorane Business fits seamlessly into your existing ecosystem.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {segments.map((seg, i) => (
              <div key={i} className="bg-white/60 backdrop-blur-xl rounded-[28px] border border-white/80 p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 ease-out group">
                <div className="w-14 h-14 rounded-2xl bg-[#05473C]/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                  <Icon name={seg.icon} size={28} color={TEAL} />
                </div>
                <h3 className="text-[17px] font-display font-medium text-gray-900 mb-5 uppercase tracking-wide">
                  {seg.title}
                </h3>
                <ul className="flex flex-col gap-3.5 m-0 p-0 list-none">
                  {seg.benefits.map((b, j) => (
                    <li key={j} className="flex items-start gap-3 text-[15px] text-gray-600 leading-relaxed">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#05473C] flex-shrink-0 mt-2.5 opacity-60" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* PLATFORM FEATURES */}
        <section id="features" className="bg-white py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 md:mb-24">
              <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs md:text-sm tracking-wide">
                <Icon name="auto_awesome" size={16} />
                Platform Features
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight mb-6">
                Everything You Need to Run a Healthy Business
              </h2>
            </div>
            
            <div className="flex flex-col gap-24 md:gap-32">
              {features.map((feat, i) => (
                <div key={i} className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-[#05473C]/10 flex items-center justify-center">
                        <Icon name={feat.icon} size={24} color={PRIMARY} />
                      </div>
                      <span className="text-xs font-extrabold text-[#05473C] tracking-widest uppercase">Feature 0{i + 1}</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-display font-medium text-gray-900 tracking-tight mb-6">
                      {feat.title}
                    </h3>
                    <p className="text-[17px] text-gray-600 leading-relaxed mb-8">{feat.desc}</p>
                    <ul className="flex flex-col gap-4 m-0 p-0 list-none">
                      {feat.points.map((p, j) => (
                        <li key={j} className="flex items-start gap-3 text-base text-gray-700 leading-relaxed font-medium">
                          <Icon name="check_circle" size={22} color={TEAL} className="mt-0.5 flex-shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className={`p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm ${i % 2 === 0 ? "bg-gradient-to-br from-blue-50/50 to-green-50/50" : "bg-gradient-to-bl from-green-50/50 to-blue-50/50"} ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-shadow duration-500 border border-white/50 ring-1 ring-black/5">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-[#05473C]/10 flex items-center justify-center">
                          <Icon name={feat.icon} size={24} color={PRIMARY} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{feat.title}</div>
                          <div className="text-xs text-gray-400 font-medium">Live View</div>
                        </div>
                      </div>
                      
                      <div className="mb-8">
                        {[1, 0.78, 0.58, 0.42].map((w, k) => (
                          <div key={k} className={`h-2.5 rounded-full mb-3 last:mb-0 ${k === 0 ? 'bg-gradient-to-r from-[#05473C] to-[#00C79A]' : 'bg-gray-100'}`} style={{ width: `${w * 100}%` }} />
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        {feat.metricValues.map((v, k) => (
                          <div key={k} className="bg-gray-50 rounded-2xl p-4 border border-gray-100/50">
                            <div className="text-xl md:text-2xl font-extrabold text-[#05473C] font-jakarta mb-1">{v}</div>
                            <div className="text-[11px] font-bold text-gray-400 tracking-wide uppercase">{feat.metricLabels[k]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DATA PRIVACY & MODULES SECTION */}
        <section className="py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs md:text-sm tracking-wide">
                <Icon name="monitoring" size={16} />
                Employee Health Data
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight mb-6">
                What Your Business Dashboard Shows
              </h2>
              <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto leading-relaxed">
                Track your team's health across 8+ categories — real-time, secure, and privacy-first. Every metric is backed by ICMR, WHO & CDC standards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
              {[
                { icon: "favorite", color: "text-rose-500", bg: "bg-rose-50", title: "Health Score", desc: "Daily 100-point composite score — nutrition, exercise, sleep, stress & hydration.", badge: "Live" },
                { icon: "psychology", color: "text-violet-600", bg: "bg-violet-50", title: "Stress Level", desc: "5-pillar burnout risk assessment. Flags high-stress members for early intervention.", badge: "AI" },
                { icon: "restaurant", color: "text-amber-500", bg: "bg-amber-50", title: "Nutrition Tracking", desc: "Calories, Protein, Carbs & Micro-nutrients based on ICMR RDA 2024.", badge: "9 Nutrients" },
                { icon: "directions_run", color: "text-emerald-500", bg: "bg-emerald-50", title: "Exercise & Activity", desc: "Steps, workout minutes, WHO MET-minutes, active vs. sedentary time.", badge: "WHO" },
                { icon: "water_drop", color: "text-[#0ea5e9]", bg: "bg-sky-50", title: "Water Intake", desc: "Daily hydration goal completion %. Activity-adjusted targets per individual.", badge: "Daily" },
                { icon: "bedtime", color: "text-indigo-600", bg: "bg-indigo-50", title: "Sleep Quality", desc: "Total hours, CDC/WHO 7–9h benchmark compliance, and weekly sleep trend.", badge: "CDC" },
                { icon: "monitor_weight", color: "text-[#05473C]", bg: `bg-[#05473C]/10`, title: "BMI & Profile", desc: "Asia-Pacific Indian-calibrated BMI. Blood group & emergency profile on record.", badge: "India" },
                { icon: "bloodtype", color: "text-[#05473C]", bg: `bg-[#05473C]/10`, title: "Blood & Vitals", desc: "Blood glucose, BP logs, and medicine adherence tracking — WHO protocol.", badge: "Optional" },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-3xl p-7 border border-gray-100 shadow-sm hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1.5 transition-all duration-500 group">
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-[14px] ${item.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon name={item.icon} size={24} className={item.color} />
                    </div>
                    <span className={`text-[10px] font-extrabold ${item.color} ${item.bg} rounded-full px-3 py-1.5 tracking-wide uppercase`}>{item.badge}</span>
                  </div>
                  <h3 className="text-base font-extrabold text-gray-900 mb-2.5 font-jakarta">{item.title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed font-medium">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-[2.5rem] p-8 md:p-16 border border-gray-200 shadow-sm">
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
                    {["DPDPA 2023 Compliant", "AES-256 Encrypted", "Indian Servers Only", "ISO 27001 Ready"].map((badge, i) => (
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
            </div>
          </div>
        </section>

        {/* STATS SECTION */}
        <div ref={statsRef} className="bg-gradient-to-r from-[#05473C] to-[#00C79A] py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 divide-x divide-white/10">
              <StatCard icon="business" value={500} suffix="+" label="Businesses Onboarded" started={statsStarted} />
              <StatCard icon="timeline" value={50000} suffix="+" label="Health Logs Per Day" started={statsStarted} />
              <StatCard icon="star" value={98} suffix="%" label="Satisfaction Rate" started={statsStarted} />
              <StatCard icon="bolt" value={5} suffix=" min" label="Avg Setup Time" started={statsStarted} />
            </div>
          </div>
        </div>

        {/* PRICING SECTION - GLASSMORPHISM REDESIGN */}
        <section id="pricing" className="py-24 md:py-32 px-6 relative overflow-hidden">
          {/* Ambient background blobs for Glass Effect contrast */}
          <div className="absolute top-1/4 left-0 w-96 h-96 bg-[#05473C]/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-[#05473C]/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16 md:mb-20">
              <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs md:text-sm tracking-wide backdrop-blur-md border border-[#05473C]/10">
                <Icon name="payments" size={16} /> Transparent Pricing
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight mb-6">
                Per-Seat Pricing. Zero Hidden Costs.
              </h2>
              <p className="text-lg md:text-xl text-gray-500 font-medium">Pay only for your team size. Cancel anytime.</p>
            </div>
            
            {/* The gap-8 and items-stretch ensures all cards are equal height. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
              {plans.map((p, i) => <PricingCard key={i} {...p} />)}
            </div>
            
            <p className="text-center text-gray-500 text-sm mt-12 font-medium">
              Promo codes accepted at checkout. All prices exclusive of 18% GST.{" "}
              <a href="mailto:sales@aorane.com?subject=Enterprise Plan Enquiry" className="text-[#05473C] font-bold hover:underline decoration-2 underline-offset-4">
                Contact Sales
              </a>{" "}
              for 251+ seat Enterprise plans.
            </p>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-white py-24 md:py-32 px-6 border-y border-gray-100">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs md:text-sm tracking-wide">
              <Icon name="route" size={16} /> Quick Onboarding
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight mb-6">
              Get Your Team Healthy in 3 Simple Steps
            </h2>
            <p className="text-lg md:text-xl text-gray-500 mb-20 font-medium">From signup to full team visibility in under 10 minutes.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 relative">
              <div className="hidden md:block absolute top-[44px] left-[20%] right-[20%] h-1 bg-gradient-to-r from-[#05473C] to-[#00C79A] opacity-10 z-0" />
              
              {[
                { step: "01", icon: "how_to_reg", title: "Register & Set Up", desc: "Create your business account and add your organization details in under 5 minutes." },
                { step: "02", icon: "group_add", title: "Invite Your Team", desc: "Share a unique join code. Employees download the Aorane app and connect instantly." },
                { step: "03", icon: "insights", title: "Track & Improve", desc: "Monitor health scores, send wellness nudges, and receive AI-powered insights every day." },
              ].map((s, i) => (
                <div key={i} className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 md:p-10 relative z-10 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 ease-out">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#05473C] to-[#00C79A] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#05473C]/20">
                    <Icon name={s.icon} size={28} color="white" />
                  </div>
                  <div className="text-[11px] font-extrabold text-gray-400 tracking-[0.2em] uppercase mb-4">Step {s.step}</div>
                  <h3 className="text-xl font-display font-medium text-gray-900 mb-3">{s.title}</h3>
                  <p className="text-sm md:text-[15px] text-gray-500 leading-relaxed font-medium">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INVESTOR / MARKET SECTION */}
        <section id="about" className="py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-[3rem] p-8 md:p-16 lg:p-20 shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-gray-100">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 bg-[#05473C]/10 text-[#05473C] rounded-full px-4 py-2 mb-6 font-bold text-xs uppercase tracking-wide">
                    <Icon name="trending_up" size={16} /> Market Opportunity
                  </div>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-medium text-gray-900 tracking-tight mb-8 leading-tight">
                    The ₹35,000 Crore Opportunity in Corporate Wellness
                  </h2>
                  <p className="text-[17px] text-gray-600 leading-relaxed mb-8">
                    India's workplace wellness market is growing at 12% CAGR. Aorane is positioned to capture the digital health management segment for 6.5 crore+ organized workforce employees — a market largely untapped by mobile-first platforms.
                  </p>
                  <blockquote className="border-l-4 border-[#00C79A] pl-6 mb-10 text-[17px] italic text-gray-500 leading-relaxed font-medium">
                    "Digital health platforms serving B2B segments show 3–5x better retention than B2C health apps."
                    <footer className="mt-3 not-italic font-bold text-sm text-gray-400 uppercase tracking-wide">— Industry Research Report, 2024</footer>
                  </blockquote>
                  <button 
                    onClick={() => setInvestorOpen(true)} 
                    className="inline-flex items-center gap-2 bg-transparent border-2 border-[#05473C] text-[#05473C] hover:bg-[#05473C] hover:text-white rounded-full px-8 py-4 font-bold text-[15px] transition-all duration-300 group"
                  >
                    <Icon name="download" size={20} className="group-hover:text-white transition-colors" />
                    Download Investor Deck
                  </button>
                </div>
                
                <div className="flex flex-col gap-5">
                  {[
                    { icon: "groups", value: "6.5 Cr+", label: "Organized workforce in India", color: "text-[#05473C]", bg: "bg-[#05473C]/10" },
                    { icon: "show_chart", value: "12% CAGR", label: "Corporate wellness market growth", color: "text-[#05473C]", bg: "bg-[#05473C]/10" },
                    { icon: "currency_rupee", value: "₹35,000 Cr", label: "Total addressable market by 2028", color: "text-violet-600", bg: "bg-violet-100" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-gray-50/50 hover:bg-white rounded-3xl p-6 md:p-8 flex items-center gap-6 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out">
                      <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon name={stat.icon} size={28} className={stat.color} />
                      </div>
                      <div>
                        <div className={`text-2xl md:text-3xl font-display font-medium ${stat.color} leading-none mb-2`}>{stat.value}</div>
                        <div className="text-sm font-medium text-gray-500">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-24 md:py-32 px-6 border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-medium text-gray-900 tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>
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
            <div className="bg-gradient-to-r from-[#05473C] to-[#00C79A] rounded-[3rem] p-10 md:p-20 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              
              <h2 className="text-3xl md:text-5xl font-display font-medium text-white tracking-tight mb-6 relative z-10 leading-tight max-w-4xl mx-auto">
                Ready to Transform Your Organization's Health Culture?
              </h2>
              <p className="text-lg md:text-xl text-white/80 mb-12 relative z-10 font-medium">
                Give your team a platform that actually cares about their wellbeing.
              </p>
              
              <div className="flex flex-wrap justify-center gap-5 relative z-10">
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
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200 pt-20 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
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
                  { label: "AI Health Insights", href: "#features" },
                  { label: "API & Integrations", href: "mailto:business@aorane.in?subject=API Integration Enquiry" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "About Aorane", href: "https://aorane.com/about" },
                  { label: "Careers", href: "https://aorane.com/careers" },
                  { label: "Security & Privacy", href: "https://aorane.com/privacy" },
                  { label: "Contact Us", href: "https://aorane.com/contact" },
                ],
              },
              {
                title: "Support",
                links: [
                  { label: "Help Center", href: "mailto:support@aorane.com?subject=Help Center" },
                  { label: "Contact Sales", href: "mailto:business@aorane.in?subject=Sales Enquiry" },
                  { label: "Terms of Service", href: "https://aorane.com/terms" },
                  { label: "Feedback", href: "mailto:feedback@aorane.com?subject=Feedback" },
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
                {["ISO 27001 Certified", "GDPR Compliant", "Made in India 🇮🇳"].map((badge, i) => (
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