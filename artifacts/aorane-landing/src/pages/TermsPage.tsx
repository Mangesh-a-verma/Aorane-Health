import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { FileText, Mail, Phone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TermsPage() {
  const [audience] = useState<"b2c" | "b2b">("b2c");
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const updated = "April 2026";

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
        <section className="pt-28 pb-10 px-4" style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #1a2e45 100%)" }}>
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mb-4 bg-white/20 text-white uppercase tracking-widest">
              <FileText size={12} /> Governed by Laws of India
            </span>
            <h1 className="text-4xl font-extrabold text-white mb-3">Terms of Service</h1>
            <p className="text-white/70 text-sm">Last updated: {updated}</p>
          </div>
        </section>

        <main className="max-w-3xl mx-auto px-6 py-12">
          <div className="space-y-10 text-sm leading-relaxed text-gray-600">

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>1</span>
                Acceptance of Terms
              </h2>
              <p>By downloading, installing, or using the Aorane mobile application or web platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Platform.</p>
              <p className="mt-3">These Terms constitute a legally binding agreement between you and Aorane. These Terms are governed by the laws of India.</p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>2</span>
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
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#F59E0B" }}>3</span>
                Nature of Service — Medical Disclaimer
              </h2>
              <div className="rounded-xl p-4 mb-4 border" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
                <p className="font-semibold mb-1" style={{ color: "#92400e" }}>⚠️ Important Medical Disclaimer</p>
                <p style={{ color: "#78350f" }}>Aorane is a wellness and health management tool. It is NOT a medical device and does not provide medical diagnosis, treatment, or clinical advice. Always consult a qualified healthcare professional for medical decisions.</p>
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
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>4</span>
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
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>5</span>
                Subscription Plans & Billing
              </h2>
              <h3 className="text-gray-800 font-semibold mb-2">5.1 Free Plan</h3>
              <p>Aorane offers a free tier with basic health tracking features. Free features may change over time at our discretion.</p>
              <h3 className="text-gray-800 font-semibold mb-2 mt-3">5.2 Paid Subscriptions</h3>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Paid plans are billed monthly or annually as selected</li>
                <li>All prices are in Indian Rupees (INR) and inclusive of applicable taxes</li>
                <li>GST at 18% is applicable on all paid plans</li>
                <li>Payments are processed securely via Razorpay</li>
                <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
              </ul>
              <h3 className="text-gray-800 font-semibold mb-2 mt-3">5.3 Refund Policy</h3>
              <p>Refund requests must be submitted within 7 days of purchase. No refunds are provided after 7 days or if significant features have been used. Refunds are processed within 5-7 business days.</p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>6</span>
                Corporate / Business Plans
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Organisations registering on Aorane must provide accurate GST and company details</li>
                <li>Corporate admins are responsible for managing their organisation's members</li>
                <li>Seat-based billing is calculated on the number of active seats</li>
                <li>Corporate accounts may generate GST invoices for B2B billing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>7</span>
                Intellectual Property
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>All content, design, code, and AI models on Aorane are owned by Aorane</li>
                <li>You may not copy, distribute, or reverse-engineer any part of the Platform</li>
                <li>The Aorane name and logo are trademarks of Aorane</li>
                <li>Content you upload remains yours; you grant Aorane a licence to process it for service delivery</li>
              </ul>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#EF4444" }}>8</span>
                Prohibited Uses
              </h2>
              <p>You must not use Aorane to:</p>
              <ul className="list-disc pl-5 space-y-1.5 mt-2">
                <li>Upload false, misleading, or fraudulent health information</li>
                <li>Impersonate another person or entity</li>
                <li>Attempt to hack, overload, or disrupt our servers</li>
                <li>Use automated tools (bots, scrapers) to access our Platform</li>
                <li>Violate any applicable Indian or international law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>9</span>
                Limitation of Liability
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Aorane is provided "as is" without warranties of any kind</li>
                <li>We are not liable for health decisions made based on AI suggestions</li>
                <li>Our total liability shall not exceed the amount paid by you in the last 3 months</li>
                <li>We are not responsible for third-party service outages</li>
              </ul>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>10</span>
                Termination
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>You may delete your account at any time from the app settings</li>
                <li>We may suspend or terminate accounts that violate these Terms</li>
                <li>Upon termination, your data is deleted per our Privacy Policy</li>
              </ul>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>11</span>
                Governing Law & Disputes
              </h2>
              <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Uttar Pradesh, India. Contact <a href="mailto:support@aorane.com" className="font-medium hover:underline" style={{ color: "#0747A6" }}>support@aorane.com</a> first to resolve amicably.</p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>12</span>
                Changes to Terms
              </h2>
              <p>We may update these Terms from time to time. Material changes will be notified via the app or email with at least 15 days' notice.</p>
            </section>

            <section>
              <h2 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0747A6" }}>13</span>
                Contact
              </h2>
              <div className="rounded-xl p-5 space-y-3 border border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={13} style={{ color: "#00B388" }} />
                  <a href="mailto:contact@aorane.com" className="hover:underline" style={{ color: "#00B388" }}>contact@aorane.com</a>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={13} style={{ color: "#00B388" }} />
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
