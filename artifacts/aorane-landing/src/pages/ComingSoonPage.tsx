import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Clock, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState } from "react";

interface ComingSoonPageProps {
  title: string;
  desc: string;
}

export default function ComingSoonPage({ title, desc }: ComingSoonPageProps) {
  const [audience] = useState<"b2c" | "b2b">("b2c");

  return (
    <>
      <Helmet>
        <title>{title} — Coming Soon | Aorane</title>
      </Helmet>
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar audience={audience} onAudienceChange={() => {}} onSignIn={() => {}} onSignUp={() => {}} />

        <div className="flex-1 flex items-center justify-center px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{ background: "linear-gradient(135deg, #EEF4FF 0%, #F0FDF9 100%)", border: "1px solid #BFDBFE" }}>
              <Clock className="w-10 h-10 text-[#0747A6]" />
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mb-4"
              style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Coming Soon
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">{title}</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">{desc}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/" className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700">
                <ArrowLeft className="w-4 h-4" /> Wapas Home
              </Link>
              <Link href="/contact" className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90"
                style={{ background: "#0747A6" }}>
                Contact Us
              </Link>
            </div>
          </motion.div>
        </div>

        <Footer />
      </div>
    </>
  );
}
