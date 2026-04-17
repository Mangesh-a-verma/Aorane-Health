import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Brain, Activity, FileCheck, Globe, Shield, TrendingUp, Users, BarChart3, Bell, ArrowRight, CheckCircle, Calculator } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingSection from "@/components/PricingSection";

const bizFeatures = [
  { icon: Building2, color: "#0747A6", bg: "#EEF4FF", title: "Organization Portal", desc: "Manage unlimited employees across departments with live health dashboards, seat management, and enrollment code system." },
  { icon: Brain, color: "#7C3AED", bg: "#F5F3FF", title: "Population Analytics", desc: "AI-powered health risk stratification. Identify high-risk employee groups before absenteeism impacts productivity." },
  { icon: Activity, color: "#10B981", bg: "#F0FDF9", title: "Real-time Monitoring", desc: "Live department health scores, custom wellness KPIs, and automated health alerts for leadership teams." },
  { icon: FileCheck, color: "#F59E0B", bg: "#FFFBEB", title: "Compliance Reports", desc: "Auto-generate DPDPA-compliant health summary reports for leadership, HR, and statutory requirements." },
  { icon: Globe, color: "#EF4444", bg: "#FFF1F2", title: "API Integration", desc: "REST API for HRMS, attendance systems, payroll software, and custom enterprise integrations." },
  { icon: Shield, color: "#6B7280", bg: "#F9FAFB", title: "Enterprise Security", desc: "ISO 27001, DPDPA 2023 compliant. SSO support, role-based access, audit trails, and on-premise options." },
];

const metrics = [
  { val: "31%", label: "Absenteeism Reduction", sub: "vs industry avg" },
  { val: "₹2.4L", label: "Saved per 100 Employees", sub: "annually" },
  { val: "18%", label: "Productivity Gain", sub: "measured avg" },
  { val: "500+", label: "Companies Trust Aorane", sub: "across India" },
];

function ROICalculator() {
  const [employees, setEmployees] = useState(200);
  const [absenteeism, setAbsenteeism] = useState(12);

  const avgSalaryPerDay = 1200;
  const absentDaysReduction = 0.31;
  const annualSaving = Math.round(employees * (absenteeism / 100) * 250 * avgSalaryPerDay * absentDaysReduction);
  const monthlyCost = employees <= 50 ? 4999 : employees <= 250 ? 12999 : 24999;
  const annualCost = monthlyCost * 12;
  const roi = Math.round(((annualSaving - annualCost) / annualCost) * 100);
  const payback = Math.round((annualCost / annualSaving) * 12);

  const fmt = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-[#0747A6]/10 rounded-2xl flex items-center justify-center">
          <Calculator className="w-5 h-5 text-[#0747A6]" />
        </div>
        <div>
          <h3 className="font-extrabold text-gray-900">ROI Calculator</h3>
          <p className="text-xs text-gray-500">Estimate your Aorane Business return</p>
        </div>
      </div>

      <div className="space-y-6 mb-8">
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">Number of Employees</label>
            <span className="text-sm font-extrabold text-[#0747A6]">{employees}</span>
          </div>
          <input
            type="range" min={10} max={5000} step={10} value={employees}
            onChange={(e) => setEmployees(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#0747A6" }}
          />
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>10</span><span>5,000</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">Current Absenteeism Rate</label>
            <span className="text-sm font-extrabold text-[#0747A6]">{absenteeism}%</span>
          </div>
          <input
            type="range" min={2} max={30} step={1} value={absenteeism}
            onChange={(e) => setAbsenteeism(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#0747A6" }}
          />
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>2%</span><span>30%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#F0FDF9] rounded-2xl p-4 border border-[#10B981]/20">
          <p className="text-xs text-gray-500 mb-1">Annual Saving</p>
          <p className="text-2xl font-extrabold text-[#059669]">{fmt(annualSaving)}</p>
          <p className="text-xs text-gray-400 mt-1">from absenteeism reduction</p>
        </div>
        <div className="bg-[#EEF4FF] rounded-2xl p-4 border border-[#0747A6]/20">
          <p className="text-xs text-gray-500 mb-1">Aorane Cost</p>
          <p className="text-2xl font-extrabold text-[#0747A6]">{fmt(annualCost)}</p>
          <p className="text-xs text-gray-400 mt-1">annual plan cost</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#0747A6] to-[#1565C0] rounded-2xl p-5 text-white">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs opacity-70 mb-1">Return on Investment</p>
            <p className="text-3xl font-extrabold">{roi > 0 ? `+${roi}%` : `${roi}%`}</p>
          </div>
          <div>
            <p className="text-xs opacity-70 mb-1">Payback Period</p>
            <p className="text-3xl font-extrabold">{payback > 0 ? `${payback}mo` : "< 1mo"}</p>
          </div>
        </div>
        <p className="text-xs opacity-60 mt-3">*Based on avg daily salary of ₹1,200 and 31% absenteeism reduction from clinical studies</p>
      </div>

      <motion.a
        href="#pricing"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-4 w-full py-3.5 blue-gradient text-white rounded-2xl font-bold text-sm text-center flex items-center justify-center gap-2 shadow"
      >
        Start Free Trial for {employees} Employees
        <ArrowRight className="w-4 h-4" />
      </motion.a>
    </div>
  );
}

const caseStudies = [
  { company: "TechCorp India", employees: "850", saving: "₹32L", stat: "Absenteeism down 34%", city: "Bengaluru" },
  { company: "Pharma Pvt Ltd", employees: "320", saving: "₹11.2L", stat: "Productivity up 21%", city: "Mumbai" },
  { company: "Logistics Co.", employees: "1,200", saving: "₹48L", stat: "Insurance claims −28%", city: "Delhi" },
];

export default function BusinessPage() {
  const [audience, setAudience] = useState<"b2c" | "b2b">("b2b");

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar audience={audience} onAudienceChange={setAudience} />

      <section className="pt-16 min-h-[80vh] flex items-center px-4 sm:px-6 lg:px-8" style={{ background: "linear-gradient(135deg, #090e1c 0%, #0D1B3E 60%, #0747A6 100%)" }}>
        <div className="max-w-7xl mx-auto w-full py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <span className="inline-block text-xs font-bold text-[#10B981] bg-[#10B981]/15 px-3 py-1.5 rounded-full uppercase tracking-widest mb-6">
                Aorane Business · Enterprise Health
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.2rem] font-extrabold text-white leading-tight mb-6">
                Population Health Management for{" "}
                <span className="text-[#10B981]">Modern Indian Businesses</span>
              </h1>
              <p className="text-lg text-white/60 leading-relaxed mb-8 max-w-lg">
                Monitor workforce wellness at scale. Reduce absenteeism by 31%. ROI-proven health programs for 50 to 10,000+ employees.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <motion.a href="#pricing" whileHover={{ scale: 1.02 }} className="flex items-center justify-center gap-2 px-6 py-3.5 green-gradient text-white rounded-2xl font-bold text-sm shadow">
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </motion.a>
                <motion.a href="mailto:support@aorane.com" whileHover={{ scale: 1.02 }} className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 text-white rounded-2xl font-bold text-sm border border-white/20 hover:bg-white/20 transition-colors">
                  Book a Demo
                </motion.a>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {metrics.map((m) => (
                  <div key={m.label} className="bg-white/8 rounded-2xl p-3 border border-white/10 text-center">
                    <p className="text-xl font-extrabold text-white">{m.val}</p>
                    <p className="text-[10px] text-white/50 leading-tight mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <ROICalculator />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <span className="text-xs font-bold text-[#0747A6] bg-[#0747A6]/10 px-3 py-1 rounded-full uppercase tracking-widest">Enterprise Features</span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">
              Built for <span className="gradient-text">Indian enterprises</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bizFeatures.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="bg-white rounded-3xl border border-gray-100 p-6 card-hover">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: f.bg }}>
                  <f.icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Case Studies</h2>
            <p className="text-gray-500 mt-2">Real results from real Indian companies</p>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-6">
            {caseStudies.map((c, i) => (
              <motion.div key={c.company} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl border border-gray-100 p-6 card-hover">
                <div className="w-12 h-12 bg-[#0747A6] rounded-2xl flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <p className="font-extrabold text-gray-900 mb-0.5">{c.company}</p>
                <p className="text-xs text-gray-500 mb-4">{c.employees} employees · {c.city}</p>
                <p className="text-2xl font-extrabold text-[#10B981] mb-1">{c.saving}</p>
                <p className="text-xs text-gray-500">Annual saving</p>
                <div className="mt-4 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                  <p className="text-xs font-semibold text-[#059669]">{c.stat}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />
      <Footer />
    </div>
  );
}
