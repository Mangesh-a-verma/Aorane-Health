import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { ArrowLeft, Shield, Mail, Phone } from "lucide-react";

export default function PrivacyPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const updated = "April 1, 2025";
  return (
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(135deg, #020917 0%, #041428 40%, #020f1e 100%)" }}>
      <Helmet>
        <title>Privacy Policy | AORANE</title>
        <meta name="description" content="AORANE Privacy Policy — how we collect, use and protect your health data. DPDPA 2023 compliant. Your health data stays private and secure." />
        <link rel="canonical" href="https://aorane.com/privacy" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      {/* Subtle bg orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(7,71,166,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)" }} />
      </div>

      {/* Navbar */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,9,23,0.85)", backdropFilter: "blur(16px)" }}
           className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft size={15} />
          <span>Back to Home</span>
        </Link>
        <a href="/" className="flex items-center">
          <img
            src={import.meta.env.BASE_URL + "logo-full.png?v=3"}
            alt="Aorane"
            style={{ height: 44, width: "auto", objectFit: "contain" }}
          />
        </a>
        <div className="w-24" />
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14 relative">

        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-semibold"
               style={{ background: "rgba(7,71,166,0.15)", border: "1px solid rgba(7,71,166,0.3)", color: "#60A5FA" }}>
            <Shield size={12} /> DPDPA 2023 Compliant
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ background: "linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.7) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Privacy Policy
          </h1>
          <p className="text-white/40 text-sm">Last updated: {updated}</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>1</span>
              Introduction
            </h2>
            <p>Aorane ("Aorane", "we", "us", or "our") is committed to protecting your personal health information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application, web platform, and related services (collectively, the "Platform").</p>
            <p className="mt-3">By using Aorane, you agree to the collection and use of information in accordance with this policy. This policy is compliant with India's Digital Personal Data Protection Act, 2023 (DPDPA).</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>2</span>
              Information We Collect
            </h2>
            <h3 className="text-white/90 font-medium mb-2">2.1 Personal Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Mobile phone number (used for OTP-based authentication)</li>
              <li>Full name, date of birth, gender</li>
              <li>City and state of residence</li>
              <li>Profile photograph (optional)</li>
            </ul>
            <h3 className="text-white/90 font-medium mb-2 mt-4">2.2 Health & Medical Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Height, weight, BMI, blood group</li>
              <li>Food and dietary logs</li>
              <li>Exercise and activity data</li>
              <li>Medicine schedules and reminders</li>
              <li>Water intake, sleep patterns, stress levels</li>
              <li>Menstrual cycle data (for applicable users)</li>
              <li>Blood test reports uploaded by you</li>
              <li>Health conditions and medical history you choose to share</li>
            </ul>
            <h3 className="text-white/90 font-medium mb-2 mt-4">2.3 Technical Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Device type, operating system, app version</li>
              <li>IP address and approximate location</li>
              <li>Usage patterns and feature interactions</li>
              <li>Push notification tokens</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>3</span>
              How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To provide personalised AI-powered health suggestions and meal plans</li>
              <li>To generate health scorecards and wellness reports</li>
              <li>To send medicine reminders, water reminders, and health alerts</li>
              <li>To calculate health scores, BMI, and risk predictions</li>
              <li>To enable family health management features</li>
              <li>To process subscriptions and billing (for paid plans)</li>
              <li>To improve the accuracy and relevance of our AI models</li>
              <li>To comply with legal and regulatory requirements</li>
            </ul>
            <p className="mt-3">We do <strong className="text-white">not</strong> sell your personal or health data to any third party.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>4</span>
              Data Sharing
            </h2>
            <p>We may share your information only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong className="text-white">With your employer/organisation</strong> — if you are enrolled under a corporate wellness programme, basic health metrics (as per your privacy settings) may be shared with your organisation's administrator. Sensitive data (medicines, stress, sleep) is never shared without explicit consent.</li>
              <li><strong className="text-white">AI Service Providers</strong> — anonymised health data is sent to AI providers (NVIDIA, Google) solely for generating health suggestions. No personally identifiable information is shared.</li>
              <li><strong className="text-white">Payment Processors</strong> — billing information is handled by Razorpay, subject to their privacy policy.</li>
              <li><strong className="text-white">Legal Requirements</strong> — if required by law, court order, or government authority.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>5</span>
              Data Storage & Security
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All data is stored in secure, encrypted databases hosted within India (Supabase — AWS Mumbai region)</li>
              <li>Data is encrypted at rest and in transit (TLS 1.3)</li>
              <li>Authentication uses OTP-based verification with rate limiting and brute-force protection</li>
              <li>Access to health data is restricted to you and authorised Aorane personnel only</li>
              <li>We perform regular security audits and vulnerability assessments</li>
            </ul>
          </section>

          <section id="dpdpa" style={{ scrollMarginTop: 80 }}>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(16,185,129,0.25)", color: "#34D399" }}>6</span>
              Your Rights (DPDPA 2023)
            </h2>
            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#34D399" }}>🇮🇳 Digital Personal Data Protection Act, 2023</p>
              <p style={{ color: "rgba(255,255,255,0.6)" }}>Under India's DPDPA 2023, you have full control over your personal data.</p>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong className="text-white">Access</strong> — request a copy of your personal data we hold</li>
              <li><strong className="text-white">Correct</strong> — update incorrect or incomplete data via your profile settings</li>
              <li><strong className="text-white">Erase</strong> — request deletion of your account and all associated data</li>
              <li><strong className="text-white">Restrict</strong> — control what data is shared with your organisation via Privacy Settings</li>
              <li><strong className="text-white">Withdraw Consent</strong> — stop using specific features at any time</li>
              <li><strong className="text-white">Nominate</strong> — designate a person to exercise rights on your behalf</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at <a href="mailto:privacy@aorane.com" className="hover:underline" style={{ color: "#60A5FA" }}>privacy@aorane.com</a></p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>7</span>
              Data Retention
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your data is retained while your account is active</li>
              <li>Upon account deletion, all personal data is permanently deleted within 30 days</li>
              <li>Anonymised, aggregated health statistics may be retained for research purposes</li>
              <li>Payment records are retained for 7 years as required by Indian tax law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>8</span>
              Children's Privacy
            </h2>
            <p>Aorane is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact us immediately at <a href="mailto:privacy@aorane.com" className="hover:underline" style={{ color: "#60A5FA" }}>privacy@aorane.com</a></p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>9</span>
              Cookies & Tracking
            </h2>
            <p>Our web portal uses minimal cookies for authentication sessions only. We do not use advertising cookies or cross-site tracking. Analytics, if any, are anonymised.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>10</span>
              Changes to This Policy
            </h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via the app or email. Continued use of Aorane after changes constitutes acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>11</span>
              Contact Us
            </h2>
            <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-white font-medium text-sm">Data Protection Officer — Aorane</p>
              <div className="flex items-center gap-2 text-sm">
                <Mail size={13} style={{ color: "#60A5FA" }} />
                <a href="mailto:privacy@aorane.com" className="hover:underline" style={{ color: "#60A5FA" }}>privacy@aorane.com</a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail size={13} style={{ color: "#60A5FA" }} />
                <a href="mailto:support@aorane.com" className="hover:underline" style={{ color: "#60A5FA" }}>support@aorane.com</a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone size={13} style={{ color: "#10B981" }} />
                <span>+91 73078 26291</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} className="py-8 text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
        <div className="flex items-center justify-center gap-6 mb-3">
          <a href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</a>
          <a href="/contact" className="hover:text-white/60 transition-colors">Contact</a>
        </div>
        © {new Date().getFullYear()} Aorane. All rights reserved.
      </footer>
    </div>
  );
}
