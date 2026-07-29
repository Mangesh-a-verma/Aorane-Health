import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import BentoSection from "@/components/BentoSection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorks from "@/components/HowItWorks";
import PricingSection from "@/components/PricingSection";
import FAQSection from "@/components/FAQSection";
import AppDownloadSection from "@/components/AppDownloadSection";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import BusinessAuthModal from "@/components/BusinessAuthModal";
import NotifyModal from "@/components/NotifyModal";

export default function LandingPage() {
  const [audience, setAudience] = useState<"b2c" | "b2b">("b2c");
  const [authModal, setAuthModal] = useState<null | "signin" | "signup">(null);
  const [notifyOpen, setNotifyOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>AORANE — India's AI Health Intelligence Platform | Free App</title>
        <meta name="description" content="Track meals with AI food scanner, monitor stress, sleep & vitals. AI-powered health insights. Free app for individuals. Business wellness solutions for corporates. Download on Play Store." />
        <link rel="canonical" href="https://aorane.com/" />
        <meta property="og:title" content="AORANE — India's AI Health Intelligence Platform" />
        <meta property="og:description" content="AI food scanning, stress tracking, AI-powered health insights & corporate wellness. India's most comprehensive health companion. Free on Play Store." />
        <meta property="og:url" content="https://aorane.com/" />
      </Helmet>
      <div className="min-h-screen overflow-x-hidden">
        <Navbar
          audience={audience}
          onAudienceChange={setAudience}
          onSignIn={() => setAuthModal("signin")}
          onSignUp={() => setAuthModal("signup")}
        />
        <HeroSection audience={audience} onSignUp={() => setAuthModal("signup")} />
        <BentoSection />
        <FeaturesSection audience={audience} onNotifyClick={() => setNotifyOpen(true)} />
        <HowItWorks />
        <PricingSection onBusinessSignUp={() => setAuthModal("signup")} />
        <FAQSection />
        <AppDownloadSection />
        <TrustSection />
        <Footer />

        {authModal && (
          <BusinessAuthModal
            defaultTab={authModal}
            onClose={() => setAuthModal(null)}
          />
        )}

        {notifyOpen && (
          <NotifyModal onClose={() => setNotifyOpen(false)} />
        )}
      </div>
    </>
  );
}
