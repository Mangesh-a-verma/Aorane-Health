import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import {
  Briefcase, MapPin, Clock, Send, Loader2, CheckCircle,
  TrendingUp, Code2, Megaphone, ChevronRight, Heart,
  Zap, Users, Star
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { postEnquiry } from "@/lib/useSiteSettings";

const OPENINGS = [
  {
    id: "sales",
    title: "Sales Executive",
    icon: Megaphone,
    color: "#10B981",
    bg: "#F0FDF4",
    badge: "Full-time",
    location: "Lucknow, UP (On-site / Hybrid)",
    experience: "1–3 years",
    description:
      "Drive Aorane's growth by onboarding corporates, gyms, hospitals, and individual users. You'll be the first point of contact for B2B clients and own the entire sales cycle.",
    responsibilities: [
      "Identify and reach out to corporate wellness decision-makers",
      "Conduct product demos and close deals for our Business Portal",
      "Build relationships with HR heads, hospital admins, and gym owners",
      "Maintain CRM records and weekly sales pipeline reports",
      "Work closely with the founding team on pricing strategy",
    ],
    skills: [
      "Proven B2B/B2C sales track record",
      "Excellent communication (Hindi + English)",
      "Self-motivated, target-driven mindset",
      "Health-tech / SaaS interest preferred",
    ],
  },
  {
    id: "backend",
    title: "Backend Developer",
    icon: Code2,
    color: "#0B84D6",
    bg: "#EFF8FF",
    badge: "Full-time",
    location: "Lucknow, UP (Remote-friendly)",
    experience: "2–4 years",
    description:
      "Build and scale Aorane's Express + Node.js API server. Work on health scoring engines, AI integrations, WhatsApp bot, and high-availability infrastructure.",
    responsibilities: [
      "Develop and maintain REST APIs using Node.js + Express + TypeScript",
      "Design efficient PostgreSQL schemas and Drizzle ORM queries",
      "Integrate AI providers (Gemini, DeepSeek) for health predictions",
      "Build WhatsApp bot webhook processing and real-time notifications",
      "Ensure security, performance, and HIPAA-inspired data practices",
    ],
    skills: [
      "Node.js + TypeScript (2+ years)",
      "PostgreSQL / Supabase experience",
      "REST API design and JWT auth",
      "Redis caching and background jobs",
      "Bonus: AI/ML integration experience",
    ],
  },
  {
    id: "frontend",
    title: "Frontend Developer",
    icon: TrendingUp,
    color: "#7C3AED",
    bg: "#F5F3FF",
    badge: "Full-time",
    location: "Lucknow, UP (Remote-friendly)",
    experience: "1–3 years",
    description:
      "Craft beautiful, fast health dashboards for Aorane's web portals (Admin Panel, Business Portal, Landing Page) using React, Vite, and Tailwind CSS.",
    responsibilities: [
      "Build responsive UIs for Admin Panel and Business Portal",
      "Implement data visualizations — charts, health score cards, analytics dashboards",
      "Optimize performance, loading states, and mobile responsiveness",
      "Collaborate with backend team on API integration",
      "Improve landing page conversion and user experience",
    ],
    skills: [
      "React + TypeScript + Tailwind CSS",
      "Vite or similar modern build tools",
      "REST API integration and state management",
      "UI/UX sensibility and attention to detail",
      "Bonus: React Native / Expo experience",
    ],
  },
];

const PERKS = [
  { icon: Heart, label: "Health Insurance", desc: "Full medical coverage for you" },
  { icon: Zap, label: "Fast Growth", desc: "Early team — grow with the company" },
  { icon: Users, label: "Collaborative Culture", desc: "Small team, big impact every day" },
  { icon: Star, label: "Equity Discussion", desc: "ESOPs for key early hires" },
];

export default function CareersPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "", portfolio: "", message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isValid =
    form.name.trim() &&
    /^\S+@\S+\.\S+$/.test(form.email) &&
    form.phone.trim() &&
    form.role &&
    form.message.trim().length >= 30;

  function handleRoleClick(id: string) {
    setSelectedRole(id);
    setForm((f) => ({ ...f, role: OPENINGS.find((o) => o.id === id)?.title || "" }));
    setTimeout(() => {
      document.getElementById("apply-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError("");
    const messageBody = `Role: ${form.role}\n\nPortfolio/LinkedIn: ${form.portfolio || "Not provided"}\n\nCover Letter:\n${form.message}`;
    const res = await postEnquiry({
      type: "general",
      name: form.name.trim(),
      email: form.email.trim(),
      mobile: form.phone.trim(),
      message: messageBody,
      source: "careers_page",
      companyName: `APPLYING FOR: ${form.role}`,
    });
    if (res.success) {
      setDone(true);
    } else {
      setError(res.error || "Submission failed — please try again");
    }
    setSubmitting(false);
  }

  return (
    <>
      <Helmet>
        <title>Careers at Aorane — Join the Health-Tech Team</title>
        <meta name="description" content="Join Aorane and help build India's most personal health platform. Open roles in Sales, Backend, and Frontend Development." />
      </Helmet>
      <div className="min-h-screen bg-white">
        <Navbar audience="b2c" onAudienceChange={() => {}} onSignIn={() => {}} onSignUp={() => {}} />

        {/* Hero */}
        <section className="pt-28 pb-14 px-4 sm:px-6 lg:px-8" style={{ background: "linear-gradient(135deg, #F0F7FF 0%, #FAFAFA 100%)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 bg-[#0B84D6]/10 text-[#0B84D6] uppercase tracking-widest">
                We're Hiring
              </span>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
                Build India's Future of{" "}
                <span style={{ color: "#0B84D6" }}>Digital Health</span>
              </h1>
              <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                We're a small, passionate team in Lucknow building health-tech that actually matters for 1.4 billion Indians. Join us early — your work will directly impact millions of lives.
              </p>
              <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#0B84D6]" /> Lucknow, UP</span>
                <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-[#0B84D6]" /> 3 Open Roles</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#0B84D6]" /> Full-time</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Perks */}
        <section className="py-10 px-4 sm:px-6 lg:px-8 border-b border-gray-100">
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PERKS.map((p, i) => (
              <motion.div key={p.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="flex flex-col items-center text-center p-4 rounded-2xl border border-gray-100 bg-gray-50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#EFF8FF" }}>
                  <p.icon className="w-5 h-5" style={{ color: "#0B84D6" }} />
                </div>
                <p className="text-sm font-bold text-gray-900 mb-0.5">{p.label}</p>
                <p className="text-xs text-gray-500">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Open Roles */}
        <section className="py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Open Positions</h2>
              <p className="text-gray-500 text-sm">Click on a role to apply directly below</p>
            </div>

            <div className="space-y-5">
              {OPENINGS.map((job, i) => (
                <motion.div key={job.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className={`rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${selectedRole === job.id ? "border-[#0B84D6] shadow-md" : "border-gray-100 hover:border-gray-200 hover:shadow-sm"}`}
                  onClick={() => handleRoleClick(job.id)}>
                  {/* Header row */}
                  <div className="flex items-start gap-4 p-5">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: job.bg }}>
                      <job.icon className="w-6 h-6" style={{ color: job.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-base font-extrabold text-gray-900">{job.title}</h3>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: job.bg, color: job.color }}>{job.badge}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.experience} experience</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{job.description}</p>
                    </div>
                    <button className="shrink-0 flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-xl transition-all text-white"
                      style={{ background: job.color }}>
                      Apply <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Expanded details */}
                  {selectedRole === job.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="border-t border-dashed border-gray-200 px-5 pb-5 pt-4 grid sm:grid-cols-2 gap-5"
                      style={{ background: job.bg + "80" }}>
                      <div>
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Responsibilities</p>
                        <ul className="space-y-1.5">
                          {job.responsibilities.map((r) => (
                            <li key={r} className="flex items-start gap-2 text-xs text-gray-600">
                              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: job.color }} />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Skills Required</p>
                        <ul className="space-y-1.5">
                          {job.skills.map((s) => (
                            <li key={s} className="flex items-start gap-2 text-xs text-gray-600">
                              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: job.color }} />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Application Form */}
        <section id="apply-form" className="py-14 px-4 sm:px-6 lg:px-8 bg-[#F5F9FF]">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Apply Now</h2>
              <p className="text-gray-500 text-sm">We personally review every application and reply within 48 hours.</p>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
              {done ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-9 h-9 text-green-500" />
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-2">Application Received!</h3>
                  <p className="text-gray-500 text-sm max-w-sm mx-auto">
                    Hi <strong>{form.name}</strong>, we've received your application for <strong>{form.role}</strong>. We'll get back to you at <strong>{form.email}</strong> within 48 hours.
                  </p>
                  <button
                    onClick={() => { setDone(false); setForm({ name: "", email: "", phone: "", role: "", portfolio: "", message: "" }); setSelectedRole(null); }}
                    className="mt-6 px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Submit another application
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Full Name *</label>
                      <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Your full name"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone Number *</label>
                      <input type="tel" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Email Address *</label>
                    <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Role Applying For *</label>
                    <select required value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white">
                      <option value="">Select a role...</option>
                      {OPENINGS.map((o) => (
                        <option key={o.id} value={o.title}>{o.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">LinkedIn / Portfolio / GitHub URL</label>
                    <input type="url" value={form.portfolio} onChange={(e) => setForm((f) => ({ ...f, portfolio: e.target.value }))}
                      placeholder="https://linkedin.com/in/yourprofile"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Cover Letter / Why Aorane? *
                      <span className="text-gray-400 font-normal ml-1">(min. 30 characters)</span>
                    </label>
                    <textarea required value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="Tell us about yourself, your relevant experience, and why you want to join Aorane's mission..."
                      rows={5}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
                    <p className="text-xs text-gray-400 mt-1">{form.message.length} characters</p>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
                    <strong>Note:</strong> We do not currently accept file uploads. Please include your LinkedIn/GitHub/Portfolio link above. We'll reach out to request your resume if shortlisted.
                  </div>

                  {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                  <button
                    type="submit"
                    disabled={!isValid || submitting}
                    className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: isValid && !submitting ? "#0B84D6" : "#9CA3AF", color: "white" }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {submitting ? "Submitting..." : "Submit Application"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
