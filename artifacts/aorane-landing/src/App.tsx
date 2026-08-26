import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { track, ConsumerEvents } from "@workspace/analytics";
import LandingPage from "@/pages/LandingPage";
import FeaturesPage from "@/pages/FeaturesPage";
import PricingPage from "@/pages/PricingPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import MedicalDisclaimerPage from "@/pages/MedicalDisclaimerPage";
import CookiePolicyPage from "@/pages/CookiePolicyPage";
import RefundPolicyPage from "@/pages/RefundPolicyPage";
import SubprocessorsPage from "@/pages/SubprocessorsPage";
import SecurityPage from "@/pages/SecurityPage";
import DpaTemplatePage from "@/pages/DpaTemplatePage";
import BaaTemplatePage from "@/pages/BaaTemplatePage";
import SlaTemplatePage from "@/pages/SlaTemplatePage";
import MsaTemplatePage from "@/pages/MsaTemplatePage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import ComingSoonPage from "@/pages/ComingSoonPage";
import CareersPage from "@/pages/CareersPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const eventName = location === "/pricing" ? ConsumerEvents.PRICING_VIEW
      : location === "/features" ? ConsumerEvents.FEATURE_VIEW
      : ConsumerEvents.LANDING_PAGE_VIEW;
    track(eventName, { path: location });
  }, [location]);
  return null;
}

// The /business marketing page was retired in favor of a single, redesigned
// business.aorane.com — redirect anyone who still has the old link/bookmark.
function BusinessRedirect() {
  useEffect(() => {
    window.location.replace("https://business.aorane.com");
  }, []);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/features" component={FeaturesPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/business" component={BusinessRedirect} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/medical-disclaimer" component={MedicalDisclaimerPage} />
        <Route path="/cookie-policy" component={CookiePolicyPage} />
        <Route path="/refund-policy" component={RefundPolicyPage} />
        <Route path="/sub-processors" component={SubprocessorsPage} />
        <Route path="/security" component={SecurityPage} />
        <Route path="/data-processing-agreement" component={DpaTemplatePage} />
        <Route path="/business-associate-agreement" component={BaaTemplatePage} />
        <Route path="/sla" component={SlaTemplatePage} />
        <Route path="/master-service-agreement" component={MsaTemplatePage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/blog">{() => <ComingSoonPage title="Blog" desc="Health tips, research, and product updates — coming soon!" />}</Route>
        <Route path="/careers" component={CareersPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
