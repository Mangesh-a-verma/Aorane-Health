import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { ArrowLeft, FileText, Mail, Phone } from "lucide-react";

export default function TermsPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const updated = "April 1, 2025";
  return (
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(135deg, #020917 0%, #041428 40%, #020f1e 100%)" }}>
      <Helmet>
        <title>Terms of Service | AORANE</title>
        <meta name="description" content="AORANE Terms of Service — usage rules, subscription terms, medical disclaimer, and user responsibilities for India's AI health platform." />
        <link rel="canonical" href="https://aorane.com/terms" />
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
            <FileText size={12} /> Governed by Laws of India
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ background: "linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.7) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Terms of Service
          </h1>
          <p className="text-white/40 text-sm">Last updated: {updated}</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>1</span>
              Acceptance of Terms
            </h2>
            <p>By downloading, installing, or using the Aorane mobile application or web platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Platform.</p>
            <p className="mt-3">These Terms constitute a legally binding agreement between you and Aorane ("Aorane", "we", "us", "our"). These Terms are governed by the laws of India.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>2</span>
              Eligibility
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must be at least 13 years of age to use Aorane</li>
              <li>If you are under 18, you must have parental or guardian consent</li>
              <li>You must have a valid Indian mobile number for OTP-based registration</li>
              <li>You must provide accurate and truthful information during registration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(245,158,11,0.3)", color: "#FCD34D" }}>3</span>
              Nature of Service — Medical Disclaimer
            </h2>
            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <p className="font-medium mb-1" style={{ color: "#FCD34D" }}>⚠️ Important Medical Disclaimer</p>
              <p style={{ color: "rgba(255,255,255,0.65)" }}>Aorane is a wellness and health management tool. It is NOT a medical device and does not provide medical diagnosis, treatment, or clinical advice. Always consult a qualified healthcare professional for medical decisions.</p>
            </div>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>AI-generated health suggestions are for informational purposes only</li>
              <li>Health predictions and risk assessments are estimates, not clinical diagnoses</li>
              <li>Medicine reminders are based on your input — verify dosages with your doctor</li>
              <li>Blood report analysis is an AI interpretation, not a medical opinion</li>
              <li>In medical emergencies, always call 112 (India) or your local emergency services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>4</span>
              User Account & Responsibilities
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must not share your OTP or account credentials with anyone</li>
              <li>You are responsible for all activity that occurs under your account</li>
              <li>You must promptly notify us of any unauthorized use of your account</li>
              <li>One person may not maintain more than one active Aorane account</li>
              <li>You must not use Aorane for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>5</span>
              Subscription Plans & Billing
            </h2>
            <h3 className="text-white/90 font-medium mb-2">5.1 Free Plan</h3>
            <p>Aorane offers a free tier with basic health tracking features. Free features may change over time at our discretion.</p>
            <h3 className="text-white/90 font-medium mb-2 mt-3">5.2 Paid Subscriptions</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Paid plans are billed monthly or annually as selected</li>
              <li>All prices are in Indian Rupees (INR) and inclusive of applicable taxes</li>
              <li>GST at 18% is applicable on all paid plans</li>
              <li>Payments are processed securely via Razorpay</li>
              <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
            </ul>
            <h3 className="text-white/90 font-medium mb-2 mt-3">5.3 Refund Policy</h3>
            <p>Refund requests must be submitted within 7 days of purchase. No refunds are provided after 7 days or if significant features have been used. Refunds are processed within 5-7 business days to the original payment method.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>6</span>
              Corporate / Business Plans
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Organisations registering on Aorane must provide accurate GST and company details</li>
              <li>Corporate admins are responsible for managing their organisation's members</li>
              <li>Member health data shared with corporate admins is governed by your organisation's data policy and Aorane's Privacy Policy</li>
              <li>Seat-based billing is calculated on the number of active seats</li>
              <li>Corporate accounts may generate GST invoices for B2B billing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>7</span>
              Intellectual Property
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All content, design, code, and AI models on Aorane are owned by Aorane</li>
              <li>You may not copy, distribute, or reverse-engineer any part of the Platform</li>
              <li>The Aorane name and logo are trademarks of Aorane</li>
              <li>Content you upload (food photos, blood reports) remains yours; you grant Aorane a licence to process it for service delivery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(239,68,68,0.25)", color: "#FCA5A5" }}>8</span>
              Prohibited Uses
            </h2>
            <p>You must not use Aorane to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Upload false, misleading, or fraudulent health information</li>
              <li>Impersonate another person or entity</li>
              <li>Attempt to hack, overload, or disrupt our servers</li>
              <li>Use automated tools (bots, scrapers) to access our Platform</li>
              <li>Violate any applicable Indian or international law</li>
              <li>Harass or harm other users through the Platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>9</span>
              Limitation of Liability
            </h2>
            <p>To the maximum extent permitted by applicable law:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Aorane is provided "as is" without warranties of any kind</li>
              <li>We are not liable for health decisions made based on AI suggestions</li>
              <li>Our total liability shall not exceed the amount paid by you in the last 3 months</li>
              <li>We are not responsible for third-party service outages (payment processors, AI providers)</li>
              <li>We do not guarantee uninterrupted availability of the Platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>10</span>
              Termination
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You may delete your account at any time from the app settings</li>
              <li>We may suspend or terminate accounts that violate these Terms</li>
              <li>Upon termination, your data is deleted per our Privacy Policy</li>
              <li>Active subscriptions are not refunded upon termination for violations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>11</span>
              Governing Law & Disputes
            </h2>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Uttar Pradesh, India. We encourage resolving disputes amicably — contact <a href="mailto:support@aorane.com" className="hover:underline" style={{ color: "#60A5FA" }}>support@aorane.com</a> first.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>12</span>
              Changes to Terms
            </h2>
            <p>We may update these Terms from time to time. Material changes will be notified via the app or email with at least 15 days' notice. Continued use after the effective date constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(7,71,166,0.3)", color: "#60A5FA" }}>13</span>
              Contact
            </h2>
            <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 text-sm">
                <Mail size={13} style={{ color: "#60A5FA" }} />
                <a href="mailto:support@aorane.com" className="hover:underline" style={{ color: "#60A5FA" }}>support@aorane.com</a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail size={13} style={{ color: "#60A5FA" }} />
                <a href="mailto:legal@aorane.com" className="hover:underline" style={{ color: "#60A5FA" }}>legal@aorane.com</a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone size={13} style={{ color: "#10B981" }} />
                <span>+91 73078 26291</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }} className="py-8 text-center text-xs">
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
