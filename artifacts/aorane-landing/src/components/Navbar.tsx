import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Menu, X, ChevronDown } from "lucide-react";

interface NavbarProps {
  audience: "b2c" | "b2b";
  onAudienceChange: (a: "b2c" | "b2b") => void;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export default function Navbar({ audience, onAudienceChange, onSignIn, onSignUp }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links = audience === "b2c"
    ? [
        { label: "Features", href: "#features" },
        { label: "Health Dashboard", href: "#dashboard" },
        { label: "Pricing", href: "#pricing" },
        { label: "About", href: "#trust" },
      ]
    : [
        { label: "Solutions", href: "#features" },
        { label: "Analytics", href: "#dashboard" },
        { label: "Plans", href: "#pricing" },
        { label: "Security", href: "#trust" },
      ];

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "glass shadow-md" : "bg-transparent"}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2.5 cursor-pointer" aria-label="Aorane home">
            <img src={import.meta.env.BASE_URL + 'logo-full.png?v=3'} alt="Aorane" style={{ height: 56, width: "auto", objectFit: "contain" }} />
            <span className="hidden sm:inline-block text-xs font-semibold bg-[#00C79A]/10 text-[#05473C] px-2 py-0.5 rounded-full ml-1">Health+</span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-[#05473C] hover:bg-[#05473C]/6 transition-all"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-full p-1 gap-1">
              <a
                href="/"
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${audience === "b2c" ? "bg-[#05473C] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
              >
                For You
              </a>
              <a
                href="https://business.aorane.com"
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${audience === "b2b" ? "bg-[#05473C] text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
              >
                For Business
              </a>
            </div>
            {audience === "b2c" ? (
              <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2 cursor-default" title="Coming soon on Google Play">
                <span className="text-sm font-semibold text-gray-500">Coming soon on Play Store</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a href="https://business.aorane.com"
                  className="px-4 py-2 border border-[#05473C] text-[#05473C] rounded-xl text-sm font-semibold hover:bg-[#05473C]/8 transition-all flex items-center justify-center">
                  Sign In
                </a>
                <a href="https://business.aorane.com"
                  className="px-4 py-2 rounded-xl text-sm font-semibold shadow hover:opacity-90 transition-opacity flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #05473C, #082F28)" }}>
                  Get Started Free
                </a>
              </div>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-white/30"
          >
            <div className="px-4 py-4 flex flex-col gap-2">
              <div className="flex gap-2 mb-2">
                <a href="/"
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all text-center block ${audience === "b2c" ? "bg-[#05473C] text-white" : "bg-gray-100 text-gray-600"}`}>
                  For You
                </a>
                <a href="https://business.aorane.com"
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all text-center block ${audience === "b2b" ? "bg-[#05473C] text-white" : "bg-gray-100 text-gray-600"}`}>
                  For Business
                </a>
              </div>
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#05473C]/8">
                  {l.label}
                </a>
              ))}
              {audience === "b2c" ? (
                <div className="mt-2 w-full py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-semibold text-center">
                  Coming soon on Play Store
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <a href="https://business.aorane.com"
                    className="w-full py-2.5 border border-[#05473C] text-[#05473C] rounded-xl text-sm font-semibold text-center block">
                    Sign In to Business Portal
                  </a>
                  <a href="https://business.aorane.com"
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-center block text-white" style={{ background: "linear-gradient(135deg, #05473C, #082F28)" }}>
                    Get Started Free
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}