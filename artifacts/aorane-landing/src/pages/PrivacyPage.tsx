import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Shield, Mail, Phone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
  const [audience] = useState<"b2c" | "b2b">("b2c");
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const updated = "April 1, 2025";

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
        <section className="pt-28 pb-10 px-4" style={{ background: "linear-gradient(135deg, #0747A6 0%, #1565C0 100%)" }}>
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mb-4 bg-white/20 text-white uppercase tracking-widest">
              <Shield size={12} /> DPDPA 2023 Compliant
            </span>
            <h1 className="text-4xl font-extrabold text-white mb-3">Privacy Policy</h1>
            <p className="text-white/70 text-sm">Last updated: {updated}</p>
          </div>
        </section>

        <main className="max-w-3xl mx-auto px-6 py-12">
          <div className="space-y-10 text-sm leading-relaxed text-gray-600">

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>1</span>
                Introduction
              </h2>
              <p>Aorane ("Aorane", "we", "us", or "our") is committed to protecting your personal health information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application, web platform, and related services (collectively, the "Platform").</p>
              <p className="mt-3">By using Aorane, you agree to the collection and use of information in accordance with this policy. This policy is compliant with India's Digital Personal Data Protection Act, 2023 (DPDPA).</p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>2</span>
                Information We Collect
              </h2>
              <h3 className="text-gray-800 font-semibold mb-2">2.1 Personal Information</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Mobile phone number (used for OTP-based authentication)</li>
                <li>Full name, date of birth, gender</li>
                <li>City and state of residence</li>
                <li>Profile photograph (optional)</li>
              </ul>
              <h3 className="text-gray-800 font-semibold mb-2 mt-4">2.2 Health & Medical Information</h3>
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
              <h3 className="text-gray-800 font-semibold mb-2 mt-4">2.3 Technical Information</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Device type, operating system, app version</li>
                <li>IP address and approximate location</li>
                <li>Usage patterns and feature interactions</li>
                <li>Push notification tokens</li>
              </ul>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>3</span>
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
              <p className="mt-3">We do <strong className="text-gray-900">not</strong> sell your personal or health data to any third party.</p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>4</span>
                Data Sharing
              </h2>
              <p>We may share your information only in the following circumstances:</p>
              <ul className="list-disc pl-5 space-y-1.5 mt-2">
                <li><strong className="text-gray-900">With your employer/organisation</strong> — basic health metrics may be shared with your organisation's administrator if enrolled in a corporate wellness programme. Sensitive data is never shared without explicit consent.</li>
                <li><strong className="text-gray-900">AI Service Providers</strong> — anonymised health data is sent to AI providers (NVIDIA, Google) solely for generating health suggestions.</li>
                <li><strong className="text-gray-900">Payment Processors</strong> — billing information is handled by Razorpay.</li>
                <li><strong className="text-gray-900">Legal Requirements</strong> — if required by law, court order, or government authority.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>5</span>
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
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#10B981" }}>6</span>
                Your Rights (DPDPA 2023)
              </h2>
              <div className="rounded-xl p-4 mb-4 border" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "#059669" }}>🇮🇳 Digital Personal Data Protection Act, 2023</p>
                <p className="text-gray-600">Under India's DPDPA 2023, you have full control over your personal data.</p>
              </div>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-gray-900">Access</strong> — request a copy of your personal data we hold</li>
                <li><strong className="text-gray-900">Correct</strong> — update incorrect or incomplete data via your profile settings</li>
                <li><strong className="text-gray-900">Erase</strong> — request deletion of your account and all associated data</li>
                <li><strong className="text-gray-900">Restrict</strong> — control what data is shared with your organisation</li>
                <li><strong className="text-gray-900">Withdraw Consent</strong> — stop using specific features at any time</li>
                <li><strong className="text-gray-900">Nominate</strong> — designate a person to exercise rights on your behalf</li>
              </ul>
              <p className="mt-3">To exercise these rights, contact us at <a href="mailto:privacy@aorane.com" className="font-medium hover:underline" style={{ color: "#0747A6" }}>privacy@aorane.com</a></p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>7</span>
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
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>8</span>
                Children's Privacy
              </h2>
              <p>Aorane is not intended for children under 13 years of age. If you believe a child has provided us with personal information, contact us immediately at <a href="mailto:privacy@aorane.com" className="font-medium hover:underline" style={{ color: "#0747A6" }}>privacy@aorane.com</a></p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>9</span>
                Cookies & Tracking
              </h2>
              <p>Our web portal uses minimal cookies for authentication sessions only. We do not use advertising cookies or cross-site tracking. Analytics, if any, are anonymised.</p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>10</span>
                Changes to This Policy
              </h2>
              <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via the app or email. Continued use of Aorane after changes constitutes acceptance of the revised policy.</p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>11</span>
                Contact Us
              </h2>
              <div className="rounded-xl p-5 space-y-3 border border-gray-100 bg-gray-50">
                <p className="text-gray-900 font-semibold text-sm">Data Protection Officer — Aorane</p>
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={13} style={{ color: "#0747A6" }} />
                  <a href="mailto:privacy@aorane.com" className="hover:underline" style={{ color: "#0747A6" }}>privacy@aorane.com</a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={13} style={{ color: "#0747A6" }} />
                  <a href="mailto:support@aorane.com" className="hover:underline" style={{ color: "#0747A6" }}>support@aorane.com</a>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={13} style={{ color: "#10B981" }} />
                  <span>+91 73078 26291</span>
                </div>
              </div>
            </section>

          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
