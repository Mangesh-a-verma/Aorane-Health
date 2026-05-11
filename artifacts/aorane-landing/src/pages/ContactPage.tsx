import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle, MessageSquare, Building2, HelpCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { postEnquiry } from "@/lib/useSiteSettings";

export default function ContactPage() {
  const [audience] = useState<"b2c" | "b2b">("b2c");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"general" | "expert">("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isValid = name.trim() && /^\S+@\S+\.\S+$/.test(email) && message.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError("");
    const res = await postEnquiry({
      type,
      name: name.trim(),
      email: email.trim(),
      mobile: phone.trim() || undefined,
      message: message.trim(),
      source: "contact_page",
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
        <title>Contact Aorane — Support & Business Enquiries</title>
        <meta name="description" content="Get in touch with Aorane — support, business inquiries, or general questions. We reply within 24 hours." />
      </Helmet>
      <div className="min-h-screen bg-white">
        <Navbar audience={audience} onAudienceChange={() => {}} onSignIn={() => {}} onSignUp={() => {}} />

        {/* Header */}
        <section className="pt-28 pb-10 px-4 sm:px-6 lg:px-8 bg-[#FAFAFA]">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 bg-[#0747A6]/10 text-[#0747A6] uppercase tracking-widest">
                Get in Touch
              </span>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
                We're Here — <span style={{ color: "#0747A6" }}>Let's Talk!</span>
              </h1>
              <p className="text-gray-500 text-base max-w-xl mx-auto">
                Need support, want to discuss a partnership, or just want to say hello — we personally reply to every message.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Main content */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">

            {/* Contact info */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 mb-1">Contact Information</h2>
                <p className="text-sm text-gray-500">All queries answered within 24 hours.</p>
              </div>

              <div className="space-y-4">
                <a href="mailto:support@aorane.com"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50 transition-all group">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#EEF4FF]">
                    <Mail className="w-5 h-5 text-[#0747A6]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Email (General Support)</p>
                    <p className="text-sm font-bold text-gray-900 group-hover:text-[#0747A6]">support@aorane.com</p>
                  </div>
                </a>

                <a href="mailto:business@aorane.com"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-green-200 hover:bg-green-50 transition-all group">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#F0FDF9]">
                    <Building2 className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Business & Partnerships</p>
                    <p className="text-sm font-bold text-gray-900 group-hover:text-[#10B981]">business@aorane.com</p>
                  </div>
                </a>

                <a href="tel:+917307826291"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:bg-orange-50 transition-all group">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#FFF7ED]">
                    <Phone className="w-5 h-5 text-[#F97316]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Phone (Mon–Sat, 10am–6pm)</p>
                    <p className="text-sm font-bold text-gray-900 group-hover:text-[#F97316]">+91 73078 26291</p>
                  </div>
                </a>

                <div className="flex items-start gap-4 p-4 rounded-2xl border border-gray-100 bg-white">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#F9FAFB]">
                    <MapPin className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Office Address</p>
                    <p className="text-sm font-bold text-gray-900">Indra Nagar, Near Lekhraj Metro</p>
                    <p className="text-xs text-gray-500">Lucknow, Uttar Pradesh 226016</p>
                  </div>
                </div>
              </div>

              {/* Response time note */}
              <div className="rounded-2xl p-4 text-sm" style={{ background: "#EEF4FF", border: "1px solid #BFDBFE" }}>
                <p className="font-bold text-[#0747A6] mb-1">⚡ Response Time</p>
                <p className="text-gray-600 text-xs leading-relaxed">
                  Email queries: <strong>within 24 hours</strong><br />
                  Business inquiries: <strong>4–8 hours</strong><br />
                  Technical support: <strong>Same day</strong> (weekdays)
                </p>
              </div>
            </motion.div>

            {/* Contact form */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              {done ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-9 h-9 text-green-500" />
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 mb-2">Message Received! 🎉</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto">
                      Hi <strong>{name}</strong>, we'll reply to <strong>{email}</strong> within 24 hours.
                    </p>
                    <button
                      onClick={() => { setDone(false); setName(""); setEmail(""); setPhone(""); setMessage(""); }}
                      className="mt-6 px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-900 mb-1">Send a Message</h2>
                    <p className="text-sm text-gray-500">Fill in all fields — we personally reply to every inquiry.</p>
                  </div>

                  {/* Type selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-2 block">What can we help with?</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setType("general")}
                        className="py-2.5 text-sm font-medium rounded-xl border transition-all"
                        style={type === "general" ? { background: "#0747A6", color: "white", borderColor: "#0747A6" } : { borderColor: "#E5E7EB", color: "#374151" }}>
                        <HelpCircle className="w-4 h-4 inline mr-1" />General Query
                      </button>
                      <button type="button" onClick={() => setType("expert")}
                        className="py-2.5 text-sm font-medium rounded-xl border transition-all"
                        style={type === "expert" ? { background: "#0747A6", color: "white", borderColor: "#0747A6" } : { borderColor: "#E5E7EB", color: "#374151" }}>
                        <MessageSquare className="w-4 h-4 inline mr-1" />Talk to Expert
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Your Name *</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                        placeholder="Full name"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone</label>
                      <input type="text" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765..."
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Email Address *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      placeholder="your@email.com"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Your Message *</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} required
                      placeholder="Write your message here — any question, feedback, or inquiry..."
                      rows={5}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
                  </div>

                  {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                  <button
                    type="submit"
                    disabled={!isValid || submitting}
                    className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: isValid ? "#0747A6" : "#9CA3AF", color: "white" }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {submitting ? "Sending..." : "Send Message"}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
