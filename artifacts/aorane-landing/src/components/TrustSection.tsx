import { motion } from "framer-motion";
import { Shield, Lock, FileCheck, Globe, Server, Eye } from "lucide-react";

// Every claim here must match what's actually implemented — see
// src/pages/SecurityPage.tsx, which is written directly from the codebase.
// Do not add a framework/certification claim (ISO 27001, SOC 2, a specific
// uptime %) unless it's genuinely true and verifiable; overclaiming here is
// a consumer-protection and enterprise-procurement risk, not just copy.
const compliance = [
  {
    icon: Shield,
    title: "DPDPA 2023 Aligned",
    desc: "We follow India's Digital Personal Data Protection Act (DPDPA 2023) principles — consent-based data collection, user rights, and data minimization.",
    color: "#05473C",
    bg: "#E6F4F1",
  },
  {
    icon: Lock,
    title: "Encrypted in Transit",
    desc: "All traffic runs over HTTPS/TLS. Sensitive configuration secrets are additionally encrypted at rest with AES-256-GCM. Full detail on our Security Practices page.",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    icon: FileCheck,
    title: "Role-Based Access Control",
    desc: "Admin access is tiered and enforced server-side, with an audit-log record of who performed sensitive or destructive actions.",
    color: "#10B981",
    bg: "#F0FDF9",
  },
  {
    icon: Globe,
    title: "HIPAA-Aligned Template Available",
    desc: "For U.S. enterprise/hospital engagements, we offer a HIPAA-aligned Business Associate Agreement — see our Security Practices and BAA template pages.",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    icon: Server,
    title: "Transparent Infrastructure",
    desc: "Every hosting, database, payment, and AI sub-processor we use is named and published — no hidden vendors. See the full Sub-processor List.",
    color: "#EF4444",
    bg: "#FFF1F2",
  },
  {
    icon: Eye,
    title: "Transparent Privacy",
    desc: "No data selling. No third-party ad targeting. Full audit log of who accessed your health data, along with granular privacy controls.",
    color: "#6B7280",
    bg: "#F9FAFB",
  },
];

export default function TrustSection() {
  return (
    <section id="trust" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[#05473C] glass-panel-soft px-3 py-1.5 rounded-full uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C79A]" />
            Trust & Security
          </span>
          <h2 className="font-display mt-4 text-3xl sm:text-4xl font-medium text-gray-900">
            Your health data is <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#05473C] to-[#7C3AED]">sacred to us</span>
          </h2>
          <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
            We meet the highest data protection standards — because health data is the most sensitive data there is.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {compliance.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group flex gap-4 p-5 rounded-2xl glass-panel-soft hover:shadow-xl transition-shadow duration-300 cursor-pointer"
            >
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110" 
                style={{ background: c.bg }}
              >
                <c.icon className="w-6 h-6" style={{ color: c.color }} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm group-hover:text-[#05473C] transition-colors duration-300">
                  {c.title}
                </p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  {c.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}