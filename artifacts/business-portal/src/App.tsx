import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { track, BusinessEvents } from "@workspace/analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthRedirect from "@/pages/AuthRedirect";
import Dashboard from "@/pages/Dashboard";
import Members from "@/pages/Members";
import Departments from "@/pages/Departments";
import EnrollmentCodes from "@/pages/EnrollmentCodes";
import Settings from "@/pages/Settings";
import Billing from "@/pages/Billing";
import Analytics from "@/pages/Analytics";
import Communications from "@/pages/Communications";
import Verify from "@/pages/Verify";
import Reports from "@/pages/Reports";

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0FAFB]">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#0D1F33] mb-2">404</h1>
        <p className="text-[#7A90A4] mb-4">Page not found</p>
        <a href="/" className="text-[#0077B6] hover:underline text-sm">Go to Home</a>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      navigate("/login");
    }
  }, [token, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0FAFB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0077B6]/30 border-t-[#0077B6] rounded-full animate-spin" />
          <p className="text-[#7A90A4] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!token) return null;
  return <Component />;
}

function PublicOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && token) {
      navigate("/dashboard");
    }
  }, [token, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0FAFB]">
        <div className="w-8 h-8 border-2 border-[#0077B6]/30 border-t-[#0077B6] rounded-full animate-spin" />
      </div>
    );
  }

  if (token) return null;
  return <Component />;
}

function Router() {
  const [location] = useLocation();
  useEffect(() => {
    if (location === "/") track(BusinessEvents.BUSINESS_LANDING_VIEW, { path: location }, "marketing");
    else if (location === "/register") track(BusinessEvents.BUSINESS_REGISTER_START, { path: location }, "marketing");
  }, [location]);

  return (
    <Switch>
      {/* FIXED: Removed PublicOnlyRoute from Landing so it's always accessible */}
      <Route path="/" component={Landing} />
      
      <Route path="/auth" component={AuthRedirect} />
      <Route path="/login" component={() => <PublicOnlyRoute component={Login} />} />
      <Route path="/register" component={() => <PublicOnlyRoute component={Register} />} />
      
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/members" component={() => <ProtectedRoute component={Members} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={Analytics} />} />
      <Route path="/communications" component={() => <ProtectedRoute component={Communications} />} />
      <Route path="/departments" component={() => <ProtectedRoute component={Departments} />} />
      <Route path="/codes" component={() => <ProtectedRoute component={EnrollmentCodes} />} />
      <Route path="/billing" component={() => <ProtectedRoute component={Billing} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/verify" component={() => <ProtectedRoute component={Verify} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <HelmetProvider>
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
    </HelmetProvider>
  );
}

export default App;
// AORANE Landing Page v2 Fix