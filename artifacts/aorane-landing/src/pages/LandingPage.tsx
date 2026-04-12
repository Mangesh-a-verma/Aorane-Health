import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StatsBar from "@/components/StatsBar";
import BentoSection from "@/components/BentoSection";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";

export default function LandingPage() {
  const [audience, setAudience] = useState<"b2c" | "b2b">("b2c");

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Navbar audience={audience} onAudienceChange={setAudience} />
      <HeroSection audience={audience} />
      <StatsBar />
      <BentoSection />
      <FeaturesSection audience={audience} />
      <PricingSection />
      <TrustSection />
      <Footer />
    </div>
  );
}
