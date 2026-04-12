import { useState } from "react";
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

export default function LandingPage() {
  const [audience, setAudience] = useState<"b2c" | "b2b">("b2c");
  const [authModal, setAuthModal] = useState<null | "signin" | "signup">(null);

  return (
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
      <FeaturesSection audience={audience} />
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
    </div>
  );
}
