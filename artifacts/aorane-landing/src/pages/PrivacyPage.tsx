import { useEffect } from "react";
import { Link } from "wouter";
import { Activity, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
          <span className="font-bold">Aorane</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: {updated}</p>

        <div className="space-y-8 text-white/75 leading-relaxed text-sm">

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">1. Introduction</h2>
            <p>Aorane ("Aorane", "we", "us", or "our") is committed to protecting your personal health information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application, web platform, and related services (collectively, the "Platform").</p>
            <p className="mt-3">By using Aorane, you agree to the collection and use of information in accordance with this policy. This policy is compliant with India's Digital Personal Data Protection Act, 2023 (DPDPA).</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">2. Information We Collect</h2>
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
            <h2 className="text-white font-semibold text-lg mb-3">3. How We Use Your Information</h2>
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
            <h2 className="text-white font-semibold text-lg mb-3">4. Data Sharing</h2>
            <p>We may share your information only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong className="text-white">With your employer/organisation</strong> — if you are enrolled under a corporate wellness programme, basic health metrics (as per your privacy settings) may be shared with your organisation's administrator. Sensitive data (medicines, stress, sleep) is never shared without explicit consent.</li>
              <li><strong className="text-white">AI Service Providers</strong> — anonymised health data is sent to AI providers (NVIDIA, Google) solely for generating health suggestions. No personally identifiable information is shared.</li>
              <li><strong className="text-white">Payment Processors</strong> — billing information is handled by Razorpay, subject to their privacy policy.</li>
              <li><strong className="text-white">Legal Requirements</strong> — if required by law, court order, or government authority.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">5. Data Storage & Security</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All data is stored in secure, encrypted databases hosted within India (Supabase — AWS Mumbai region)</li>
              <li>Data is encrypted at rest and in transit (TLS 1.3)</li>
              <li>Authentication uses OTP-based verification with rate limiting and brute-force protection</li>
              <li>Access to health data is restricted to you and authorised Aorane personnel only</li>
              <li>We perform regular security audits and vulnerability assessments</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">6. Your Rights (DPDPA 2023)</h2>
            <p>Under India's Digital Personal Data Protection Act, 2023, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong className="text-white">Access</strong> — request a copy of your personal data we hold</li>
              <li><strong className="text-white">Correct</strong> — update incorrect or incomplete data via your profile settings</li>
              <li><strong className="text-white">Erase</strong> — request deletion of your account and all associated data</li>
              <li><strong className="text-white">Restrict</strong> — control what data is shared with your organisation via Privacy Settings</li>
              <li><strong className="text-white">Withdraw Consent</strong> — stop using specific features at any time</li>
              <li><strong className="text-white">Nominate</strong> — designate a person to exercise rights on your behalf</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at <a href="mailto:privacy@aorane.com" className="text-blue-400 hover:underline">privacy@aorane.com</a></p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">7. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your data is retained while your account is active</li>
              <li>Upon account deletion, all personal data is permanently deleted within 30 days</li>
              <li>Anonymised, aggregated health statistics may be retained for research purposes</li>
              <li>Payment records are retained for 7 years as required by Indian tax law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">8. Children's Privacy</h2>
            <p>Aorane is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact us immediately at <a href="mailto:privacy@aorane.com" className="text-blue-400 hover:underline">privacy@aorane.com</a></p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">9. Cookies & Tracking</h2>
            <p>Our web portal uses minimal cookies for authentication sessions only. We do not use advertising cookies or cross-site tracking. Analytics, if any, are anonymised.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via the app or email. Continued use of Aorane after changes constitutes acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">11. Contact Us</h2>
            <p>For any privacy-related queries, data requests, or complaints:</p>
            <div className="mt-3 space-y-1">
              <p><strong className="text-white">Data Protection Officer:</strong> Aorane</p>
              <p><strong className="text-white">Email:</strong> <a href="mailto:privacy@aorane.com" className="text-blue-400 hover:underline">privacy@aorane.com</a></p>
              <p><strong className="text-white">Support:</strong> <a href="mailto:support@aorane.com" className="text-blue-400 hover:underline">support@aorane.com</a></p>
              <p><strong className="text-white">Phone:</strong> +91 73078 26291</p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-white/30 text-xs">
        © {new Date().getFullYear()} Aorane. All rights reserved.
      </footer>
    </div>
  );
}
