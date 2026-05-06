import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StatsBar from "@/components/StatsBar";
import BentoSection from "@/components/BentoSection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorks from "@/components/HowItWorks";
import TestimonialsSlider from "@/components/TestimonialsSlider";
import PricingSection from "@/components/PricingSection";
import AppDownloadSection from "@/components/AppDownloadSection";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import BusinessAuthModal from "@/components/BusinessAuthModal";
import UpcomingSection from "@/components/UpcomingSection";
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
        <StatsBar />
        <BentoSection />
        <FeaturesSection audience={audience} onNotifyClick={() => setNotifyOpen(true)} />
        <UpcomingSection onNotifyClick={() => setNotifyOpen(true)} />
        <HowItWorks />
        <TestimonialsSlider />
        <PricingSection onBusinessSignUp={() => setAuthModal("signup")} />
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
