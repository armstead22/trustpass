import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/landing";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import Verify from "@/pages/verify";
import Dashboard from "@/pages/dashboard";
import Privacy from "@/pages/privacy";
import PartnerLogin from "@/pages/partner-login";
import PartnerDashboard from "@/pages/partner-dashboard";
import PartnerDocs from "@/pages/partner-docs";
import Admin from "@/pages/admin";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-[60vh] items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-[60vh] items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  if (!user || user.role !== "admin") return <Redirect to="/login" />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

function AppRouter() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/signup" component={Signup} />
        <Route path="/login" component={Login} />
        <Route path="/verify" component={() => <Protected><Verify /></Protected>} />
        <Route path="/dashboard" component={() => <Protected><Dashboard /></Protected>} />
        <Route path="/dashboard/privacy" component={() => <Protected><Privacy /></Protected>} />
        <Route path="/partner/login" component={PartnerLogin} />
        <Route path="/partner/dashboard" component={PartnerDashboard} />
        <Route path="/partner/docs" component={PartnerDocs} />
        <Route path="/admin" component={() => <AdminRoute><Admin /></AdminRoute>} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
