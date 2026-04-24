import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Heart, Target, Shield, Users, Zap, Award, MapPin, Mail, Phone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState } from "react";

const values = [
  { icon: Heart, color: "#EF4444", bg: "#FFF1F2", title: "Health First", desc: "Every product decision is made with user health outcomes in mind — not engagement metrics." },
  { icon: Shield, color: "#0747A6", bg: "#EEF4FF", title: "Privacy by Design", desc: "Your health data is yours. We never sell, share, or monetize personal health information." },
  { icon: Zap, color: "#F59E0B", bg: "#FFFBEB", title: "Made for India", desc: "Indian foods, Indian languages, Indian health conditions — built specifically for Bharat." },
  { icon: Users, color: "#10B981", bg: "#F0FDF9", title: "Inclusive Access", desc: "Core features are free forever. We believe health intelligence should not be a luxury." },
  { icon: Target, color: "#7C3AED", bg: "#F5F3FF", title: "AI-Powered Accuracy", desc: "NVIDIA and Gemini AI trained on Indian nutrition data for precise, personalized insights." },
  { icon: Award, color: "#F97316", bg: "#FFF7ED", title: "Trusted Science", desc: "MET-based exercise calculations, WHO nutrition guidelines, and evidence-based health recommendations." },
];

const milestones = [
  { year: "Jan 2025", event: "Aorane concept born — identified the gap in Indian health-tech" },
  { year: "Mar 2025", event: "First prototype: AI Food Scanner powered by Gemini Vision" },
  { year: "Jun 2025", event: "Business Portal launched — first version of corporate wellness" },
  { year: "Sep 2025", event: "NVIDIA health intelligence integration — Llama 3.3 70B" },
  { year: "Dec 2025", event: "Admin Panel + full platform ready" },
  { year: "Apr 2026", event: "Public beta launch — Available on Play Store" },
];

export default function AboutPage() {
  const [audience] = useState<"b2c" | "b2b">("b2c");

  return (
    <>
      <Helmet>
        <title>About Aorane — India's AI Health Platform | Built for Bharat</title>
        <meta name="description" content="The story of Aorane — how we're building India's most comprehensive AI-powered health management platform. Our mission, values, and journey." />
      </Helmet>
      <div className="min-h-screen bg-white">
        <Navbar audience={audience} onAudienceChange={() => {}} onSignIn={() => {}} onSignUp={() => {}} />

        {/* Hero */}
        <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8" style={{ background: "linear-gradient(135deg, #0747A6 0%, #1565C0 100%)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 bg-white/20 text-white uppercase tracking-widest">
                Our Story
              </span>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
                Built for India,<br />with India
              </h1>
              <p className="text-white/75 text-lg max-w-2xl mx-auto">
                Aorane started from a simple observation — Indians don't have world-class health tracking tools that truly understand their language, food, and lifestyle. We're bridging that gap.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full uppercase tracking-widest">Our Mission</span>
                <h2 className="mt-4 text-3xl font-extrabold text-gray-900">
                  Every Indian deserves a personal health intelligence system
                </h2>
                <p className="mt-4 text-gray-600 leading-relaxed">
                  Most health apps are either too basic or too expensive. Aorane is a platform that uses the power of AI to be genuinely affordable, genuinely Indian, and genuinely useful.
                </p>
                <p className="mt-3 text-gray-600 leading-relaxed">
                  Whether you eat dal-roti in Lucknow or office lunch in Mumbai — Aorane understands. Whether you're managing diabetes or just want to stay fit — Aorane helps.
                </p>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                className="rounded-3xl p-8 text-center"
                style={{ background: "linear-gradient(135deg, #EEF4FF 0%, #F0FDF9 100%)", border: "1px solid #BFDBFE" }}
              >
                <div className="text-5xl font-extrabold text-[#0747A6] mb-2">2L+</div>
                <p className="text-gray-600 text-sm font-medium mb-6">Indians using Aorane</p>
                <div className="text-5xl font-extrabold text-[#10B981] mb-2">500+</div>
                <p className="text-gray-600 text-sm font-medium mb-6">Indian foods in AI database</p>
                <div className="text-5xl font-extrabold text-[#7C3AED] mb-2">89%</div>
                <p className="text-gray-600 text-sm font-medium">User retention at 30 days</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
              <span className="text-xs font-bold text-[#0747A6] bg-[#0747A6]/10 px-3 py-1 rounded-full uppercase tracking-widest">Our Values</span>
              <h2 className="mt-3 text-3xl font-extrabold text-gray-900">What we stand for</h2>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {values.map((v, i) => (
                <motion.div key={v.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className="flex gap-4 p-5 rounded-2xl bg-white border border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: v.bg }}>
                    <v.icon className="w-5 h-5" style={{ color: v.color }} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{v.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{v.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
              <span className="text-xs font-bold text-[#F59E0B] bg-[#F59E0B]/10 px-3 py-1 rounded-full uppercase tracking-widest">Our Journey</span>
              <h2 className="mt-3 text-3xl font-extrabold text-gray-900">How We Got Here</h2>
            </motion.div>
            <div className="space-y-6">
              {milestones.map((m, i) => (
                <motion.div key={m.year} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className="flex gap-4 items-start">
                  <div className="shrink-0 w-24 text-right">
                    <span className="text-xs font-bold text-[#0747A6] bg-[#EEF4FF] px-2 py-1 rounded-lg">{m.year}</span>
                  </div>
                  <div className="flex flex-col items-center mx-2">
                    <div className="w-3 h-3 rounded-full bg-[#0747A6] mt-1 shrink-0" />
                    {i < milestones.length - 1 && <div className="w-0.5 h-10 bg-gray-200 mt-1" />}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed pt-0.5">{m.event}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact strip */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-[#FAFAFA]">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-3xl p-8 text-center" style={{ background: "linear-gradient(135deg, #0747A6 0%, #1565C0 100%)" }}>
              <h3 className="text-2xl font-extrabold text-white mb-2">Have a question?</h3>
              <p className="text-white/70 text-sm mb-6">We personally reply to every message — usually within 24 hours.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="mailto:support@aorane.com" className="flex items-center gap-2 px-5 py-3 bg-white text-[#0747A6] rounded-2xl font-bold text-sm hover:bg-gray-50 transition-colors">
                  <Mail className="w-4 h-4" /> support@aorane.com
                </a>
                <Link href="/contact" className="flex items-center gap-2 px-5 py-3 bg-white/15 text-white rounded-2xl font-bold text-sm border border-white/25 hover:bg-white/25 transition-colors">
                  Contact Form
                </Link>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-white/60 text-xs">
                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +91 73078 26291</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Indra Nagar, Lucknow, UP 226016</span>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
