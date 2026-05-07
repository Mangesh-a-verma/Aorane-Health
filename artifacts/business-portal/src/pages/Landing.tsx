import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import EnquiryModal from "@/components/EnquiryModal";
import { useSiteSettings } from "@/lib/useSiteSettings";

const PRIMARY = "#005d90";
const TEAL = "#006b56";
const TEAL_LIGHT = "#6dfad4";
const BG = "#f7f9fe";

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

function Icon({ name, size = 24, color = PRIMARY }: { name: string; size?: number; color?: string }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, color, lineHeight: 1, display: "inline-block", userSelect: "none" }}
    >
      {name}
    </span>
  );
}

function StatCard({ icon, value, suffix, label, started }: {
  icon: string; value: number; suffix: string; label: string; started: boolean;
}) {
  const count = useCountUp(value, 2000, started);
  return (
    <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
      <div style={{ marginBottom: 12 }}><Icon name={icon} size={36} color={TEAL_LIGHT} /></div>
      <div style={{ fontSize: "clamp(36px,4vw,52px)", fontWeight: 800, color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>
        {count}{suffix}
      </div>
      <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, marginTop: 8, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function PricingCard({
  plan, perSeatPrice, minSeats, maxSeats, features, crmFree,
  highlighted = false, isEnterprise = false,
}: {
  plan: string; perSeatPrice: number; minSeats: number;
  maxSeats?: number; features: string[]; crmFree: boolean;
  highlighted?: boolean; isEnterprise?: boolean;
}) {
  const [, navigate] = useLocation();

  return (
    <div style={{
      background: highlighted
        ? `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`
        : "rgba(255,255,255,0.9)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderRadius: 24,
      border: highlighted ? "none" : "1.5px solid rgba(0,93,144,0.1)",
      padding: "2.5rem 2rem",
      display: "flex", flexDirection: "column" as const, gap: 20,
      boxShadow: highlighted ? "0 24px 64px rgba(0,93,144,0.25)" : "0 4px 24px rgba(0,0,0,0.06)",
      transform: highlighted ? "scale(1.04)" : "scale(1)",
      position: "relative" as const, overflow: "hidden",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}>
      {highlighted && (
        <div style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.18)", color: "white", borderRadius: 99, padding: "4px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const }}>
          Most Popular
        </div>
      )}
      {isEnterprise && (
        <div style={{ position: "absolute", top: 18, right: 18, background: "rgba(251,191,36,0.15)", color: "#b45309", borderRadius: 99, padding: "4px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, border: "1px solid rgba(251,191,36,0.3)" }}>
          🚧 Coming Soon
        </div>
      )}

      {/* Plan name */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: highlighted ? "rgba(255,255,255,0.7)" : TEAL, marginBottom: 8 }}>
          {plan}
        </div>

        {/* Seat range */}
        <div style={{ fontSize: 13, fontWeight: 600, color: highlighted ? "rgba(255,255,255,0.65)" : "#6b7280", marginBottom: 14 }}>
          {isEnterprise ? `${minSeats}+ seats` : `Min ${minSeats} seats`}
        </div>

        {/* Price display */}
        {isEnterprise ? (
          <div>
            <div style={{ fontSize: "clamp(28px,3vw,38px)", fontWeight: 800, color: highlighted ? "white" : "#181c20", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>
              Custom Pricing
            </div>
            <div style={{ fontSize: 13, color: highlighted ? "rgba(255,255,255,0.6)" : "#6b7280", marginTop: 6 }}>
              Tailored to your team size & needs
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              <span style={{ fontSize: "clamp(32px,3vw,44px)", fontWeight: 800, color: highlighted ? "white" : "#181c20", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>
                ₹{perSeatPrice}
              </span>
              <span style={{ color: highlighted ? "rgba(255,255,255,0.65)" : "#6b7280", fontSize: 13, marginBottom: 7 }}>/seat/month</span>
            </div>
          </div>
        )}
      </div>

      {/* Business CRM badge */}
      <div style={{
        background: crmFree
          ? (highlighted ? "rgba(255,255,255,0.12)" : "rgba(0,107,86,0.07)")
          : (highlighted ? "rgba(255,255,255,0.07)" : "rgba(0,93,144,0.05)"),
        borderRadius: 12, padding: "10px 14px",
        border: `1.5px solid ${crmFree
          ? (highlighted ? "rgba(255,255,255,0.18)" : "rgba(0,107,86,0.15)")
          : (highlighted ? "rgba(255,255,255,0.1)" : "rgba(0,93,144,0.1)")}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: highlighted ? "rgba(255,255,255,0.9)" : "#374151" }}>
          Business CRM
        </span>
        {crmFree ? (
          <span style={{ fontSize: 12, fontWeight: 800, color: highlighted ? "#86efac" : TEAL, background: highlighted ? "rgba(134,239,172,0.12)" : "rgba(0,107,86,0.08)", borderRadius: 99, padding: "3px 10px" }}>
            FREE 🎁
          </span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: highlighted ? "rgba(255,255,255,0.6)" : "#6b7280" }}>
            ₹499/month add-on
          </span>
        )}
      </div>

      {/* Features list */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 9, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: highlighted ? "rgba(255,255,255,0.85)" : "#374151" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: highlighted ? TEAL_LIGHT : TEAL, flexShrink: 0, marginTop: 2 }}>check_circle</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isEnterprise ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginTop: 4 }}>
          <div style={{ background: "rgba(251,191,36,0.1)", border: "1.5px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>🚧 Coming Soon</div>
            <div style={{ fontSize: 11, color: "#b45309", lineHeight: 1.5 }}>Enterprise self-serve is under development. Contact us for early access.</div>
          </div>
          <button
            onClick={() => { window.location.href = "mailto:sales@aorane.com?subject=Enterprise Plan Early Access"; }}
            style={{ background: "transparent", color: PRIMARY, border: `2px solid ${PRIMARY}`, borderRadius: 99, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%", transition: "opacity 0.2s" }}
          >
            Contact Sales →
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate("/register")}
          style={{
            background: highlighted ? "rgba(255,255,255,0.18)" : `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
            color: "white", border: highlighted ? "2px solid rgba(255,255,255,0.35)" : "none",
            borderRadius: 99, padding: "14px 0", fontWeight: 700, fontSize: 15,
            cursor: "pointer", width: "100%", transition: "opacity 0.2s", marginTop: 4,
          }}
        >
          Start Free Trial
        </button>
      )}
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const [statsStarted, setStatsStarted] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [investorOpen, setInvestorOpen] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const settings = useSiteSettings();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
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

  const plans = [
    {
      plan: "Max",
      perSeatPrice: 199,
      minSeats: 10,
      maxSeats: 999,
      crmFree: true,
      features: [
        "All Max app features for every member",
        "Daily Health Score — 100-point scale",
        "Nutrition: Calories, Protein, Carbs, Fiber",
        "Micronutrients: Calcium, Iron, B12, Vit C & D (ICMR RDA 2024)",
        "Exercise tracking (WHO MET-minutes)",
        "Smart water intake — activity-adjusted goals",
        "Medicine adherence (WHO protocol)",
        "Sleep quality monitoring (CDC/WHO 7–9h)",
        "BMI — Asia-Pacific Indian-calibrated",
        "Real-time team health dashboard",
        "Enrollment code management",
        "Department-wise analytics",
        "Exportable PDF health reports",
        "GST-ready invoicing",
        "Business CRM — FREE",
        "Email support",
      ],
    },
    {
      plan: "Pro",
      perSeatPrice: 249,
      minSeats: 20,
      maxSeats: 999,
      crmFree: true,
      highlighted: true,
      features: [
        "Everything in Max",
        "All Pro app features for every member",
        "Advanced analytics & health trends",
        "AI burnout & absenteeism prediction",
        "Health risk alerts — early warning system",
        "Custom wellness programs",
        "Weekly & monthly automated reports",
        "5-Pillar stress assessment",
        "Blood group & emergency health profiles",
        "Member bulk management",
        "Business CRM — FREE",
        "Priority support",
      ],
    },
    {
      plan: "Enterprise",
      perSeatPrice: 249,
      minSeats: 251,
      crmFree: true,
      isEnterprise: true,
      features: [
        "Everything in Pro",
        "Dedicated account manager",
        "Custom HRMS / ERP integrations",
        "SLA guarantee — 99.9% uptime",
        "On-premise / private cloud deployment",
        "DPDPA & compliance reports",
        "Executive leadership health dashboards",
        "Custom wellness program design",
        "White-label option on request",
        "Business CRM — FREE",
      ],
    },
  ];

  const testimonials = [
    { quote: "Aorane transformed how we manage our 300-employee wellness program. Sick leave dropped by 28% within 3 months of rollout.", name: "Priya Sharma", role: "HR Director", company: "TechVenture Pune", initials: "PS" },
    { quote: "Our gym members are more engaged than ever. The health scoring and automated reminders have significantly improved member retention.", name: "Rahul Mehta", role: "Founder", company: "FitZone Mumbai", initials: "RM" },
    { quote: "As a hospital, monitoring staff health is critical. Aorane gives us real-time visibility into our entire team's wellness that we never had before.", name: "Dr. Anita Kulkarni", role: "Chief Medical Officer", company: "LifeCare Hospital Nagpur", initials: "AK" },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: BG, color: "#181c20", overflowX: "hidden" }}>
      <Helmet>
        <title>AORANE Business Portal — Employee Wellness Management Platform</title>
        <meta name="description" content="Manage your workforce health with AI-powered analytics. Monitor employee stress, track wellness KPIs, generate DPDPA-compliant reports & integrate with your HRMS. Trusted by Indian enterprises." />
        <link rel="canonical" href="https://business.aorane.com/" />
        <meta property="og:title" content="AORANE Business Portal — Employee Wellness Management" />
        <meta property="og:description" content="AI-powered employee health monitoring, stress analytics & compliance reports for Indian enterprises." />
        <meta property="og:url" content="https://business.aorane.com/" />
      </Helmet>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-14px); } }
        .card-lift { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-lift:hover { transform: translateY(-8px); box-shadow: 0 32px 64px -12px rgba(0,93,144,0.13); }
        .btn-glow:hover { opacity: 0.92; transform: scale(1.03); box-shadow: 0 8px 32px rgba(0,93,144,0.4); }
        .nav-link { color: #404850; font-size: 14px; font-weight: 600; text-decoration: none; transition: color 0.2s; }
        .nav-link:hover { color: ${PRIMARY}; }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-mockup { display: none !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .investor-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
          .segment-grid { grid-template-columns: 1fr 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .testimonial-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .segment-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* STICKY NAVIGATION */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: scrolled ? "rgba(247,249,254,0.95)" : "rgba(247,249,254,0.85)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(191,199,209,0.25)",
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.07)" : "none",
        transition: "all 0.3s ease",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <a href={import.meta.env.BASE_URL} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" style={{ height: 56, width: "auto", objectFit: "contain" }} />
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#6b7280", letterSpacing: "0.05em" }}>
              Business
            </span>
          </a>
          {/* Desktop Nav */}
          <div className="hide-mobile" style={{ display: "flex", alignItems: "center", gap: 36 }}>
            {["Solutions", "Features", "Pricing", "About"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="nav-link">{l}</a>
            ))}
          </div>
          <div className="hide-mobile" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", color: PRIMARY, fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "10px 20px" }}>
              Log In
            </button>
            <button
              onClick={() => navigate("/register")}
              className="btn-glow"
              style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, color: "white", border: "none", borderRadius: 99, padding: "11px 26px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,93,144,0.28)", transition: "all 0.2s" }}
            >
              Get Started Free
            </button>
          </div>
          {/* Mobile Hamburger */}
          <button
            className="show-mobile"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: 8, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name={mobileNavOpen ? "close" : "menu"} size={26} color="#181c20" />
          </button>
        </div>
        {mobileNavOpen && (
          <div style={{ background: "white", borderTop: "1px solid rgba(191,199,209,0.3)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {["Solutions", "Features", "Pricing", "About"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="nav-link" onClick={() => setMobileNavOpen(false)}>{l}</a>
            ))}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={() => navigate("/login")} style={{ flex: 1, background: "none", border: `2px solid ${PRIMARY}`, color: PRIMARY, fontWeight: 700, fontSize: 14, cursor: "pointer", borderRadius: 99, padding: "12px 0" }}>Log In</button>
              <button onClick={() => navigate("/register")} style={{ flex: 1, background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, color: "white", border: "none", borderRadius: 99, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Get Started Free</button>
            </div>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section id="solutions" style={{
        position: "relative", overflow: "hidden",
        padding: "80px 24px 120px",
        backgroundImage: "radial-gradient(at 0% 0%, hsla(196,100%,93%,0.9) 0, transparent 50%), radial-gradient(at 55% 0%, hsla(164,79%,92%,0.65) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(202,84%,94%,0.75) 0, transparent 50%)",
        backgroundColor: BG,
      }}>
        <div style={{ position: "absolute", top: -100, right: -100, width: 500, height: 500, background: "rgba(109,250,212,0.12)", borderRadius: "50%", filter: "blur(100px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 320, height: 320, background: "rgba(0,93,144,0.07)", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            {/* Left — Text */}
            <div style={{ animation: "fadeUp 0.8s ease forwards" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,107,86,0.09)", borderRadius: 99, padding: "8px 18px", marginBottom: 28 }}>
                <Icon name="bolt" size={15} color={TEAL} />
                <span style={{ fontSize: 13, fontWeight: 700, color: TEAL, letterSpacing: 0.3 }}>India's Leading Corporate Health Platform</span>
              </div>
              <h1 style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 800, lineHeight: 1.08, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.025em", margin: "0 0 24px" }}>
                Your Team's Health Is Your Biggest{" "}
                <span style={{ color: PRIMARY }}>Business Asset</span>
              </h1>
              <p style={{ fontSize: "clamp(16px,1.5vw,20px)", color: "#404850", lineHeight: 1.75, margin: "0 0 40px", maxWidth: 540 }}>
                Aorane Business gives Corporates, Hospitals, Gyms & Wellness Centers a unified platform to monitor, motivate and manage employee & member health — in real time.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 40 }}>
                <button
                  onClick={() => navigate("/register")}
                  className="btn-glow"
                  style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, color: "white", border: "none", borderRadius: 99, padding: "18px 40px", fontWeight: 700, fontSize: 17, cursor: "pointer", boxShadow: "0 8px 32px rgba(0,93,144,0.28)", transition: "all 0.2s" }}
                >
                  Get Started Free
                </button>
                <button
                  style={{ background: "transparent", color: PRIMARY, border: `2px solid rgba(0,93,144,0.22)`, borderRadius: 99, padding: "18px 40px", fontWeight: 700, fontSize: 17, cursor: "pointer", transition: "all 0.2s" }}
                >
                  Book a Demo
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {[
                  { label: "HIPAA-Ready", icon: "verified" },
                  { label: "5-min Setup", icon: "timer" },
                  { label: "Made in India", icon: "location_on" },
                  { label: "Razorpay Secured", icon: "lock" },
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(241,244,249,0.9)", borderRadius: 99, padding: "8px 16px", border: "1px solid rgba(191,199,209,0.25)" }}>
                    <Icon name={b.icon} size={15} color={TEAL} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#404850" }}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Mockup */}
            <div className="hero-mockup" style={{ position: "relative", animation: "float 6s ease-in-out infinite" }}>
              <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,93,144,0.18)", border: "1px solid rgba(255,255,255,0.7)", background: "white" }}>
                <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                  {[1, 2, 3].map(k => <div key={k} style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />)}
                  <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginLeft: 8 }}>Aorane Business Dashboard</span>
                </div>
                <div style={{ padding: 24, background: "#f7f9fe" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {[
                      { label: "Active Members", value: "248", icon: "group", color: PRIMARY },
                      { label: "Avg Health Score", value: "82/100", icon: "favorite", color: TEAL },
                      { label: "Water Goals Met", value: "91%", icon: "water_drop", color: "#0077b6" },
                      { label: "Sick Days Saved", value: "34", icon: "event_available", color: "#006b56" },
                    ].map((m, i) => (
                      <div key={i} style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name={m.icon} size={16} color={m.color} />
                          </div>
                          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{m.label}</span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#181c20", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Team Health — Last 7 Days</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 52 }}>
                      {[65, 72, 68, 80, 76, 88, 82].map((h, i) => (
                        <div key={i} style={{ flex: 1, background: i === 6 ? `linear-gradient(to top, ${PRIMARY}, ${TEAL})` : `${PRIMARY}22`, borderRadius: "4px 4px 0 0", height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating AI card */}
              <div style={{ position: "absolute", bottom: -20, left: -28, width: "40%", background: "white", borderRadius: 16, padding: 16, boxShadow: "0 16px 48px rgba(0,0,0,0.13)", border: "2px solid #181c20" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>AI Insight</div>
                <div style={{ fontSize: 12, color: "#181c20", lineHeight: 1.6, fontWeight: 500 }}>3 team members at burnout risk — recommend a wellness break.</div>
                <div style={{ marginTop: 10, height: 4, background: "#f3f4f6", borderRadius: 99 }}>
                  <div style={{ height: "100%", width: "68%", background: `linear-gradient(to right, ${PRIMARY}, ${TEAL})`, borderRadius: 99 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF TICKER */}
      <div style={{ background: "white", borderTop: "1px solid rgba(191,199,209,0.2)", borderBottom: "1px solid rgba(191,199,209,0.2)", padding: "20px 0", overflow: "hidden" }}>
        <div style={{ display: "flex", animation: "marquee 28s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
          {[...Array(2)].flatMap(() => ["Corporates", "Hospitals", "Gyms", "Yoga Studios", "Wellness Clinics", "Schools & Colleges", "Insurance Companies"]).map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 24, padding: "0 44px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(64,72,80,0.45)" }}>{item}</span>
              <span style={{ color: "rgba(0,93,144,0.2)", fontSize: 20 }}>•</span>
            </span>
          ))}
        </div>
      </div>

      {/* BUSINESS SEGMENTS */}
      <section id="solutions-detail" style={{ padding: "96px 24px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,107,86,0.09)", borderRadius: 99, padding: "8px 18px", marginBottom: 20 }}>
            <Icon name="category" size={15} color={TEAL} />
            <span style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>Industry Solutions</span>
          </div>
          <h2 style={{ fontSize: "clamp(26px,4vw,48px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.025em", margin: "0 0 16px" }}>
            Built for Every Health-Focused Business
          </h2>
          <p style={{ fontSize: 18, color: "#6b7280", maxWidth: 580, margin: "0 auto", lineHeight: 1.75 }}>
            No matter your industry — Aorane Business fits seamlessly into your existing ecosystem.
          </p>
        </div>
        <div className="segment-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
          {segments.map((seg, i) => (
            <div key={i} className="card-lift" style={{
              background: "rgba(255,255,255,0.82)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              borderRadius: 20, border: "1.5px solid rgba(255,255,255,0.8)", padding: "36px 32px",
              display: "flex", flexDirection: "column" as const, gap: 20,
              boxShadow: "0 4px 24px rgba(0,0,0,0.055)",
            }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(109,250,212,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={seg.icon} size={26} color={TEAL} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", marginBottom: 16, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>
                  {seg.title}
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 10 }}>
                  {seg.benefits.map((b, j) => (
                    <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: TEAL, flexShrink: 0, marginTop: 6 }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PLATFORM FEATURES */}
      <section id="features" style={{ background: "white", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,93,144,0.08)", borderRadius: 99, padding: "8px 18px", marginBottom: 20 }}>
              <Icon name="auto_awesome" size={15} color={PRIMARY} />
              <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>Platform Features</span>
            </div>
            <h2 style={{ fontSize: "clamp(26px,4vw,48px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.025em", margin: "0 0 16px" }}>
              Everything You Need to Run a Healthy Business
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 80 }}>
            {features.map((feat, i) => (
              <div key={i} className="features-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", direction: i % 2 === 1 ? "rtl" : "ltr" }}>
                <div style={{ direction: "ltr" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${PRIMARY}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={feat.icon} size={26} color={PRIMARY} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, letterSpacing: 1.5, textTransform: "uppercase" as const }}>Feature 0{i + 1}</span>
                  </div>
                  <h3 style={{ fontSize: "clamp(20px,2.5vw,32px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.02em", margin: "0 0 16px" }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.8, margin: "0 0 28px" }}>{feat.desc}</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 14 }}>
                    {feat.points.map((p, j) => (
                      <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 15, color: "#374151", lineHeight: 1.65 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: TEAL, flexShrink: 0, marginTop: 2 }}>check_circle</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ direction: "ltr", background: i % 2 === 0 ? "linear-gradient(135deg, #eef6ff 0%, #f0fff8 100%)" : "linear-gradient(135deg, #f0fff8 0%, #eef6ff 100%)", borderRadius: 24, padding: 32, border: "1px solid rgba(191,199,209,0.2)" }}>
                  <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${PRIMARY}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name={feat.icon} size={20} color={PRIMARY} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#181c20" }}>{feat.title}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>Live View</div>
                      </div>
                    </div>
                    {[1, 0.78, 0.58, 0.42].map((w, k) => (
                      <div key={k} style={{ height: 9, background: k === 0 ? `linear-gradient(to right, ${PRIMARY}, ${TEAL})` : "#f3f4f6", borderRadius: 99, marginBottom: 10, width: `${w * 100}%` }} />
                    ))}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                      {feat.metricValues.map((v, k) => (
                        <div key={k} style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: PRIMARY, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{v}</div>
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{feat.metricLabels[k]}</div>
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

      {/* WHAT BUSINESSES CAN SEE */}
      <section style={{ padding: "96px 24px", background: BG }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,93,144,0.08)", borderRadius: 99, padding: "8px 18px", marginBottom: 20 }}>
              <Icon name="monitoring" size={15} color={PRIMARY} />
              <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>Employee Health Data</span>
            </div>
            <h2 style={{ fontSize: "clamp(26px,4vw,48px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.025em", margin: "0 0 16px" }}>
              What Your Business Dashboard Shows
            </h2>
            <p style={{ fontSize: 18, color: "#6b7280", maxWidth: 600, margin: "0 auto", lineHeight: 1.75 }}>
              Track your team's health across 8+ categories — real-time, secure, and privacy-first. Every metric is backed by ICMR, WHO & CDC standards.
            </p>
          </div>

          {/* Health data categories grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 56 }} className="segment-grid">
            {[
              { icon: "favorite", color: "#ef4444", bg: "rgba(239,68,68,0.08)", title: "Health Score", desc: "Daily 100-point composite score — nutrition, exercise, sleep, stress & hydration combined.", badge: "Live" },
              { icon: "psychology", color: "#7c3aed", bg: "rgba(124,58,237,0.08)", title: "Stress Level", desc: "5-pillar burnout risk assessment. Flags high-stress members for early HR intervention.", badge: "AI" },
              { icon: "restaurant", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", title: "Nutrition Tracking", desc: "Calories, Protein, Carbs, Fiber, Calcium, Iron, Vitamin B12, Vitamin C & D — ICMR RDA 2024.", badge: "9 Nutrients" },
              { icon: "directions_run", color: "#10b981", bg: "rgba(16,185,129,0.08)", title: "Exercise & Activity", desc: "Steps, workout minutes, WHO MET-minutes, active vs. sedentary time per member.", badge: "WHO" },
              { icon: "water_drop", color: "#0077b6", bg: "rgba(0,119,182,0.08)", title: "Water Intake", desc: "Daily hydration goal completion %. Activity-adjusted targets per individual.", badge: "Daily" },
              { icon: "bedtime", color: "#4f46e5", bg: "rgba(79,70,229,0.08)", title: "Sleep Quality", desc: "Total hours, CDC/WHO 7–9h benchmark compliance, and weekly sleep trend per member.", badge: "CDC" },
              { icon: "monitor_weight", color: PRIMARY, bg: `rgba(0,93,144,0.08)`, title: "BMI & Body Profile", desc: "Asia-Pacific Indian-calibrated BMI. Blood group & emergency health profile on record.", badge: "India" },
              { icon: "bloodtype", color: TEAL, bg: `rgba(0,107,86,0.08)`, title: "Blood & Vitals", desc: "Blood glucose, BP logs, and medicine adherence tracking — WHO protocol compliant.", badge: "Optional" },
            ].map((item, i) => (
              <div key={i} className="card-lift" style={{ background: "white", borderRadius: 20, padding: "28px 24px", border: "1.5px solid rgba(191,199,209,0.25)", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={item.icon} size={22} color={item.color} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: item.color, background: item.bg, borderRadius: 99, padding: "3px 10px", letterSpacing: 0.5 }}>{item.badge}</span>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#181c20", margin: "0 0 8px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Privacy & Security strip */}
          <div style={{ background: `linear-gradient(135deg, rgba(0,93,144,0.04) 0%, rgba(0,107,86,0.04) 100%)`, borderRadius: 24, padding: "clamp(32px,4vw,52px)", border: "1.5px solid rgba(0,93,144,0.12)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="hero-grid">
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,107,86,0.09)", borderRadius: 99, padding: "7px 16px", marginBottom: 20 }}>
                  <Icon name="shield" size={14} color={TEAL} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEAL }}>Privacy & Security</span>
                </div>
                <h3 style={{ fontSize: "clamp(20px,3vw,32px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.02em", margin: "0 0 16px" }}>
                  Your Data. Your Team's Control.
                </h3>
                <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.8, margin: "0 0 28px" }}>
                  Aorane is built with privacy-by-design. Employees always own their health data — your organization sees aggregated insights, not personal records, unless the member explicitly opts in.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {["DPDPA 2023 Compliant", "AES-256 Encrypted", "Indian Servers Only", "ISO 27001 Ready"].map((badge, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "white", borderRadius: 99, padding: "7px 14px", border: "1.5px solid rgba(0,107,86,0.2)", fontSize: 12, fontWeight: 700, color: TEAL }}>
                      <Icon name="verified" size={13} color={TEAL} />
                      {badge}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
                {[
                  { icon: "person_off", title: "Anonymized by Default", desc: "Your org dashboard shows only team-level aggregates. Individual data is never shared without member consent." },
                  { icon: "manage_accounts", title: "Member-Controlled Sharing", desc: "Each employee decides what to share. HR/admins only access data the member explicitly approves." },
                  { icon: "lock", title: "Role-Based Access Control", desc: "Admins, HR managers, and department heads each see only what they're permitted — no data leakage." },
                  { icon: "history", title: "Full Audit Trail", desc: "Every data access is logged. Complete transparency on who viewed what, and when." },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, background: "white", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(191,199,209,0.25)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(0,107,86,0.08)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name={item.icon} size={18} color={TEAL} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#181c20", marginBottom: 4 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <div ref={statsRef} style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, padding: "72px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <StatCard icon="business" value={500} suffix="+" label="Businesses Onboarded" started={statsStarted} />
            <StatCard icon="timeline" value={50000} suffix="+" label="Health Logs Per Day" started={statsStarted} />
            <StatCard icon="star" value={98} suffix="%" label="Satisfaction Rate" started={statsStarted} />
            <StatCard icon="bolt" value={5} suffix=" min" label="Average Setup Time" started={statsStarted} />
          </div>
        </div>
      </div>

      {/* PRICING SECTION */}
      <section id="pricing" style={{ padding: "96px 24px", background: BG }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,107,86,0.09)", borderRadius: 99, padding: "8px 18px", marginBottom: 20 }}>
              <Icon name="payments" size={15} color={TEAL} />
              <span style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>Transparent Pricing</span>
            </div>
            <h2 style={{ fontSize: "clamp(26px,4vw,48px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.025em", margin: "0 0 16px" }}>
              Per-Seat Pricing. Zero Hidden Costs.
            </h2>
            <p style={{ fontSize: 18, color: "#6b7280", margin: "0 0 32px" }}>Pay only for your team size. Cancel anytime.</p>
          </div>
          <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, alignItems: "center" }}>
            {plans.map((p, i) => <PricingCard key={i} {...p} />)}
          </div>
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, marginTop: 24 }}>
            Promo codes accepted at checkout. All prices exclusive of 18% GST.{" "}
            <span style={{ color: PRIMARY, cursor: "pointer", fontWeight: 600 }} onClick={() => { window.location.href = "mailto:sales@aorane.com?subject=Enterprise Plan Enquiry"; }}>
              Contact Sales
            </span>{" "}
            for 251+ seat Enterprise plans.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: "white", padding: "96px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,93,144,0.08)", borderRadius: 99, padding: "8px 18px", marginBottom: 20 }}>
            <Icon name="route" size={15} color={PRIMARY} />
            <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>Quick Onboarding</span>
          </div>
          <h2 style={{ fontSize: "clamp(26px,4vw,48px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.025em", margin: "0 0 16px" }}>
            Get Your Team Healthy in 3 Simple Steps
          </h2>
          <p style={{ fontSize: 18, color: "#6b7280", marginBottom: 64 }}>From signup to full team visibility in under 10 minutes.</p>
          <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, position: "relative" }}>
            <div className="hide-mobile" style={{ position: "absolute", top: 36, left: "22%", right: "22%", height: 2, background: `linear-gradient(to right, ${PRIMARY}, ${TEAL})`, opacity: 0.2, zIndex: 0 }} />
            {[
              { step: "01", icon: "how_to_reg", title: "Register & Set Up", desc: "Create your business account and add your organization details in under 5 minutes." },
              { step: "02", icon: "group_add", title: "Invite Your Team", desc: "Share a unique join code. Employees download the Aorane app and connect instantly." },
              { step: "03", icon: "insights", title: "Track & Improve", desc: "Monitor health scores, send wellness nudges, and receive AI-powered insights every day." },
            ].map((s, i) => (
              <div key={i} className="card-lift" style={{ background: BG, borderRadius: 20, padding: 32, position: "relative", zIndex: 1, border: "1.5px solid rgba(191,199,209,0.3)" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <Icon name={s.icon} size={28} color="white" />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" as const }}>Step {s.step}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", margin: "0 0 12px" }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.75, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INVESTOR / MARKET SECTION */}
      <section id="about" style={{ padding: "96px 24px", background: BG }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ background: "white", borderRadius: 28, padding: "clamp(32px,5vw,64px)", boxShadow: "0 8px 48px rgba(0,0,0,0.06)", border: "1.5px solid rgba(191,199,209,0.2)" }}>
            <div className="investor-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,93,144,0.08)", borderRadius: 99, padding: "8px 18px", marginBottom: 24 }}>
                  <Icon name="trending_up" size={15} color={PRIMARY} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>Market Opportunity</span>
                </div>
                <h2 style={{ fontSize: "clamp(22px,3.5vw,42px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.025em", margin: "0 0 20px" }}>
                  The ₹35,000 Crore Opportunity in Corporate Wellness
                </h2>
                <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.85, margin: "0 0 32px" }}>
                  India's workplace wellness market is growing at 12% CAGR. Aorane is positioned to capture the digital health management segment for 6.5 crore+ organized workforce employees — a market largely untapped by mobile-first platforms.
                </p>
                <blockquote style={{ borderLeft: `3px solid ${TEAL_LIGHT}`, paddingLeft: 20, margin: "0 0 32px", fontStyle: "italic", color: "#6b7280", fontSize: 15, lineHeight: 1.8 }}>
                  "Digital health platforms serving B2B segments show 3–5x better retention than B2C health apps."
                  <footer style={{ marginTop: 8, fontStyle: "normal", fontWeight: 600, fontSize: 13, color: "#9ca3af" }}>— Industry Research Report, 2024</footer>
                </blockquote>
                <button onClick={() => setInvestorOpen(true)} style={{ background: "transparent", border: `2px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 99, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon name="download" size={18} color={PRIMARY} />
                  Download Investor Deck
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
                {[
                  { icon: "groups", value: "6.5 Cr+", label: "Organized workforce in India", color: PRIMARY },
                  { icon: "show_chart", value: "12% CAGR", label: "Corporate wellness market growth", color: TEAL },
                  { icon: "currency_rupee", value: "₹35,000 Cr", label: "Total addressable market by 2028", color: "#7c3aed" },
                ].map((stat, i) => (
                  <div key={i} className="card-lift" style={{ background: BG, borderRadius: 18, padding: "24px 28px", display: "flex", alignItems: "center", gap: 20, border: "1.5px solid rgba(191,199,209,0.28)" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${stat.color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name={stat.icon} size={26} color={stat.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 800, color: stat.color, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>{stat.value}</div>
                      <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ background: "white", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ fontSize: "clamp(26px,4vw,48px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#181c20", letterSpacing: "-0.025em", margin: "0 0 16px" }}>
              What Our Business Partners Say
            </h2>
          </div>
          <div className="testimonial-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
            {testimonials.map((t, i) => (
              <div key={i} className="card-lift" style={{ background: BG, borderRadius: 20, padding: 36, border: "1.5px solid rgba(191,199,209,0.3)" }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                  {[...Array(5)].map((_, k) => <Icon key={k} name="star" size={18} color="#f59e0b" />)}
                </div>
                <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.8, margin: "0 0 28px", fontStyle: "italic" }}>"{t.quote}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {t.initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#181c20" }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>{t.role} · {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${TEAL} 100%)`, borderRadius: 28, padding: "clamp(48px,6vw,80px) clamp(24px,5vw,60px)", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, background: "rgba(255,255,255,0.06)", borderRadius: "50%", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -50, left: -50, width: 200, height: 200, background: "rgba(255,255,255,0.06)", borderRadius: "50%", pointerEvents: "none" }} />
            <h2 style={{ fontSize: "clamp(26px,4vw,52px)", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "white", letterSpacing: "-0.025em", margin: "0 0 20px", position: "relative", zIndex: 1 }}>
              Ready to Transform Your Organization's Health Culture?
            </h2>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", margin: "0 0 44px", position: "relative", zIndex: 1 }}>
              Join 500+ businesses already prioritizing their biggest asset — their people.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, position: "relative", zIndex: 1 }}>
              <button
                onClick={() => navigate("/register")}
                className="btn-glow"
                style={{ background: "white", color: PRIMARY, border: "none", borderRadius: 99, padding: "18px 44px", fontWeight: 700, fontSize: 17, cursor: "pointer", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: "all 0.2s" }}
              >
                Get Started Free
              </button>
              <button
                onClick={() => setExpertOpen(true)}
                style={{ background: "rgba(255,255,255,0.14)", color: "white", border: "2px solid rgba(255,255,255,0.3)", borderRadius: 99, padding: "18px 44px", fontWeight: 700, fontSize: 17, cursor: "pointer", backdropFilter: "blur(10px)", transition: "all 0.2s" }}
              >
                Talk to an Expert
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#f1f4f9", borderTop: "1px solid rgba(191,199,209,0.3)", padding: "72px 24px 32px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 56 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <a href={import.meta.env.BASE_URL} style={{ textDecoration: "none", display: "inline-flex" }}>
                  <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" style={{ height: 56, width: "auto", objectFit: "contain" }} />
                </a>
              </div>
              <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.85, maxWidth: 280, margin: "0 0 24px" }}>
                The unified intelligence platform for managing health and wellness at scale across any organization.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                {["language", "alternate_email", "phone_in_talk"].map((icon, i) => (
                  <div key={i} style={{ width: 38, height: 38, borderRadius: 10, background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "1px solid rgba(191,199,209,0.4)" }}>
                    <Icon name={icon} size={18} color="#6b7280" />
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
                <h4 style={{ fontSize: 13, fontWeight: 800, color: "#181c20", marginBottom: 20, letterSpacing: 0.5, textTransform: "uppercase" as const }}>{col.title}</h4>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 12 }}>
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a
                        href={link.href}
                        target={link.href.startsWith("http") ? "_blank" : undefined}
                        rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        style={{ fontSize: 14, color: "#6b7280", textDecoration: "none", transition: "color 0.2s" }}
                        onMouseOver={e => (e.currentTarget.style.color = PRIMARY)}
                        onMouseOut={e => (e.currentTarget.style.color = "#6b7280")}
                      >{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(191,199,209,0.35)", paddingTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>© {new Date().getFullYear()} {settings.companyName || "Aorane"}. All rights reserved.</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { url: settings.socialLinkedin,  icon: "business_center", label: "LinkedIn" },
                { url: settings.socialInstagram, icon: "photo_camera",    label: "Instagram" },
                { url: settings.socialYoutube,   icon: "smart_display",   label: "YouTube" },
                { url: settings.socialFacebook,  icon: "thumb_up",        label: "Facebook" },
              ].filter((x) => x.url).map((s) => (
                <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer" aria-label={s.label} style={{ width: 32, height: 32, borderRadius: 8, background: "white", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(191,199,209,0.4)", textDecoration: "none" }}>
                  <Icon name={s.icon} size={16} color="#6b7280" />
                </a>
              ))}
              {["ISO 27001 Certified", "GDPR Compliant", "Made in India 🇮🇳"].map((badge, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: 1 }}>{badge}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

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
  );
}
