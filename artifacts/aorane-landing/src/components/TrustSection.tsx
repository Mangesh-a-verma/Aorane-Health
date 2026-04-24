import { motion } from "framer-motion";
import { Shield, Lock, FileCheck, Globe, Server, Eye, AlertTriangle } from "lucide-react";

const compliance = [
  {
    icon: Shield,
    title: "DPDPA 2023 Aligned",
    desc: "We follow India's Digital Personal Data Protection Act (DPDPA 2023) principles — consent-based data collection, user rights, and data minimization.",
    color: "#0747A6",
    bg: "#EEF4FF",
  },
  {
    icon: Lock,
    title: "AES-256 Encryption",
    desc: "Military-grade encryption at rest (Supabase) and in transit (TLS 1.3). Zero plaintext storage for sensitive health records.",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    icon: FileCheck,
    title: "ISO 27001 Framework",
    desc: "We follow ISO 27001 information security management practices — access controls, incident response, and regular security reviews.",
    color: "#10B981",
    bg: "#F0FDF9",
  },
  {
    icon: Globe,
    title: "HIPAA-Grade Practices",
    desc: "We implement HIPAA-grade data handling practices — minimum necessary access, audit logs, and strict access controls for health data.",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    icon: Server,
    title: "India Data Residency",
    desc: "Your health data stays in India — hosted on Supabase South Asia (Mumbai) region, with enterprise-grade backups and 99.9% uptime.",
    color: "#EF4444",
    bg: "#FFF1F2",
  },
  {
    icon: Eye,
    title: "Transparent Privacy",
    desc: "No data selling. No third-party ad targeting. Full audit log of who accessed your health data. 8 granular privacy controls.",
    color: "#6B7280",
    bg: "#F9FAFB",
  },
];

export default function TrustSection() {
  return (
    <section id="trust" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-xs font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-3 py-1 rounded-full uppercase tracking-widest">
            Trust & Security
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">
            Your health data is <span className="gradient-text">sacred to us</span>
          </h2>
          <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
            We meet the highest data protection standards — because health data is the most sensitive data there is.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {compliance.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="flex gap-4 p-5 rounded-2xl border border-gray-100 bg-white card-hover"
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                <c.icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{c.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{c.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 bg-gradient-to-r from-[#0747A6] to-[#1565C0] rounded-3xl p-8 sm:p-12 text-white text-center"
        >
          <AlertTriangle className="w-8 h-8 mx-auto mb-4 opacity-60" />
          <h3 className="text-2xl sm:text-3xl font-extrabold mb-3">Start your health journey today</h3>
          <p className="text-white/70 max-w-lg mx-auto mb-6">
            Join 2 lakh+ Indians who've transformed their health with Aorane. Free forever for individuals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 bg-white text-[#0747A6] rounded-2xl font-bold text-sm shadow hover:bg-gray-50 transition-colors"
            >
              Download Android App
            </motion.a>
            <motion.a
              href="#pricing"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 bg-white/15 text-white rounded-2xl font-bold text-sm border border-white/25 hover:bg-white/25 transition-colors"
            >
              View Business Plans
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
