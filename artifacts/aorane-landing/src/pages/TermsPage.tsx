import { useEffect } from "react";
import { Link } from "wouter";
import { Activity, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const updated = "April 1, 2025";
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
            <Activity size={14} className="text-white" />
          </div>
          <span className="font-bold">AORANE</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: {updated}</p>

        <div className="space-y-8 text-white/75 leading-relaxed text-sm">

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">1. Acceptance of Terms</h2>
            <p>By downloading, installing, or using the AORANE mobile application or web platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Platform.</p>
            <p className="mt-3">These Terms constitute a legally binding agreement between you and AORANE Health Technology ("AORANE", "we", "us", "our"). These Terms are governed by the laws of India.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">2. Eligibility</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must be at least 13 years of age to use AORANE</li>
              <li>If you are under 18, you must have parental or guardian consent</li>
              <li>You must have a valid Indian mobile number for OTP-based registration</li>
              <li>You must provide accurate and truthful information during registration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">3. Nature of Service — Medical Disclaimer</h2>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
              <p className="text-amber-300 font-medium">⚠️ Important Medical Disclaimer</p>
              <p className="text-amber-200/80 mt-2">AORANE is a wellness and health management tool. It is NOT a medical device and does not provide medical diagnosis, treatment, or clinical advice. Always consult a qualified healthcare professional for medical decisions.</p>
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
            <h2 className="text-white font-semibold text-lg mb-3">4. User Account & Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must not share your OTP or account credentials with anyone</li>
              <li>You are responsible for all activity that occurs under your account</li>
              <li>You must promptly notify us of any unauthorized use of your account</li>
              <li>One person may not maintain more than one active AORANE account</li>
              <li>You must not use AORANE for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">5. Subscription Plans & Billing</h2>
            <h3 className="text-white/90 font-medium mb-2">5.1 Free Plan</h3>
            <p>AORANE offers a free tier with basic health tracking features. Free features may change over time at our discretion.</p>
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
            <h2 className="text-white font-semibold text-lg mb-3">6. Corporate / Business Plans</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Organisations registering on AORANE must provide accurate GST and company details</li>
              <li>Corporate admins are responsible for managing their organisation's members</li>
              <li>Member health data shared with corporate admins is governed by your organisation's data policy and AORANE's Privacy Policy</li>
              <li>Seat-based billing is calculated on the number of active seats</li>
              <li>Corporate accounts may generate GST invoices for B2B billing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">7. Intellectual Property</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All content, design, code, and AI models on AORANE are owned by AORANE Health Technology</li>
              <li>You may not copy, distribute, or reverse-engineer any part of the Platform</li>
              <li>The AORANE name and logo are trademarks of AORANE Health Technology</li>
              <li>Content you upload (food photos, blood reports) remains yours; you grant AORANE a licence to process it for service delivery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">8. Prohibited Uses</h2>
            <p>You must not use AORANE to:</p>
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
            <h2 className="text-white font-semibold text-lg mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>AORANE is provided "as is" without warranties of any kind</li>
              <li>We are not liable for health decisions made based on AI suggestions</li>
              <li>Our total liability shall not exceed the amount paid by you in the last 3 months</li>
              <li>We are not responsible for third-party service outages (payment processors, AI providers)</li>
              <li>We do not guarantee uninterrupted availability of the Platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">10. Termination</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You may delete your account at any time from the app settings</li>
              <li>We may suspend or terminate accounts that violate these Terms</li>
              <li>Upon termination, your data is deleted per our Privacy Policy</li>
              <li>Active subscriptions are not refunded upon termination for violations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">11. Governing Law & Disputes</h2>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Uttar Pradesh, India. We encourage resolving disputes amicably — contact <a href="mailto:support@aorane.com" className="text-blue-400 hover:underline">support@aorane.com</a> first.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">12. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Material changes will be notified via the app or email with at least 15 days' notice. Continued use after the effective date constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">13. Contact</h2>
            <div className="space-y-1">
              <p><strong className="text-white">Email:</strong> <a href="mailto:support@aorane.com" className="text-blue-400 hover:underline">support@aorane.com</a></p>
              <p><strong className="text-white">Legal:</strong> <a href="mailto:legal@aorane.com" className="text-blue-400 hover:underline">legal@aorane.com</a></p>
              <p><strong className="text-white">Phone:</strong> +91 73078 26291</p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-white/30 text-xs">
        © {new Date().getFullYear()} AORANE Health Technology. All rights reserved.
      </footer>
    </div>
  );
}
