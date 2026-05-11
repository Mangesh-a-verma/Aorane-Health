import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";
import Organizations from "@/pages/Organizations";
import FeatureFlags from "@/pages/FeatureFlags";
import FoodItems from "@/pages/FoodItems";
import PromoCodes from "@/pages/PromoCodes";
import Announcements from "@/pages/Announcements";
import BloodRequests from "@/pages/BloodRequests";
import Languages from "@/pages/Languages";
import AuditLogs from "@/pages/AuditLogs";
import Subscriptions from "@/pages/Subscriptions";
import Analytics from "@/pages/Analytics";
import PlatformCosts from "@/pages/PlatformCosts";
import Revenue from "@/pages/Revenue";
import PlanPricing from "@/pages/PlanPricing";
import AdsManager from "@/pages/AdsManager";
import AIConfig from "@/pages/AIConfig";
import UpcomingFeatures from "@/pages/UpcomingFeatures";
import Branding from "@/pages/Branding";
import Profile from "@/pages/Profile";
import AIFoodDiscovery from "@/pages/AIFoodDiscovery";
import SupportTickets from "@/pages/SupportTickets";
import Enquiries from "@/pages/Enquiries";
import Invoices from "@/pages/Invoices";
import CustomDeals from "@/pages/CustomDeals";

const queryClient = new QueryClient();

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}

function Protected({ component: C }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => { if (!isLoading && !token) navigate("/"); }, [token, isLoading, navigate]);
  if (isLoading) return <Spinner />;
  if (!token) return null;
  return <C />;
}

function PublicOnly({ component: C }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => { if (!isLoading && token) navigate("/dashboard"); }, [token, isLoading, navigate]);
  if (isLoading) return <Spinner />;
  if (token) return null;
  return <C />;
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="text-6xl font-bold text-primary mb-4">404</div>
        <p className="text-muted-foreground mb-4">Page not found</p>
        <a href="/dashboard" className="text-primary hover:underline text-sm">Go to Dashboard</a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PublicOnly component={Login} />} />
      <Route path="/dashboard" component={() => <Protected component={Dashboard} />} />
      <Route path="/users" component={() => <Protected component={Users} />} />
      <Route path="/organizations" component={() => <Protected component={Organizations} />} />
      <Route path="/feature-flags" component={() => <Protected component={FeatureFlags} />} />
      <Route path="/food-items" component={() => <Protected component={FoodItems} />} />
      <Route path="/promo-codes" component={() => <Protected component={PromoCodes} />} />
      <Route path="/announcements" component={() => <Protected component={Announcements} />} />
      <Route path="/blood-requests" component={() => <Protected component={BloodRequests} />} />
      <Route path="/languages" component={() => <Protected component={Languages} />} />
      <Route path="/audit-logs" component={() => <Protected component={AuditLogs} />} />
      <Route path="/subscriptions" component={() => <Protected component={Subscriptions} />} />
      <Route path="/analytics" component={() => <Protected component={Analytics} />} />
      <Route path="/platform-costs" component={() => <Protected component={PlatformCosts} />} />
      <Route path="/revenue" component={() => <Protected component={Revenue} />} />
      <Route path="/plan-pricing" component={() => <Protected component={PlanPricing} />} />
      <Route path="/ads" component={() => <Protected component={AdsManager} />} />
      <Route path="/ai-config" component={() => <Protected component={AIConfig} />} />
      <Route path="/branding" component={() => <Protected component={Branding} />} />
      <Route path="/upcoming-features"   component={() => <Protected component={UpcomingFeatures} />} />
      <Route path="/profile"             component={() => <Protected component={Profile} />} />
      <Route path="/ai-food-discovery"   component={() => <Protected component={AIFoodDiscovery} />} />
      <Route path="/support-tickets"     component={() => <Protected component={SupportTickets} />} />
      <Route path="/enquiries"           component={() => <Protected component={Enquiries} />} />
      <Route path="/invoices"            component={() => <Protected component={Invoices} />} />
      <Route path="/custom-deals"        component={() => <Protected component={CustomDeals} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
