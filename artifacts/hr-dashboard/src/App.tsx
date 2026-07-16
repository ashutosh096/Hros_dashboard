import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AttendancePage from "@/pages/attendance";
import MeetingsPage from "@/pages/meetings";
import TasksPage from "@/pages/tasks";
import TeamPage from "@/pages/team";
import AnnouncementsPage from "@/pages/announcements";
import OfficeTodayPage from "@/pages/office-today";
import SalaryPage from "@/pages/salary";
import ApplicationsPage from "@/pages/applications";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/attendance" component={AttendancePage} />
        <Route path="/meetings" component={MeetingsPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/team" component={TeamPage} />
        <Route path="/employees"><Redirect to="/team" /></Route>
        <Route path="/announcements" component={AnnouncementsPage} />
        <Route path="/office-today" component={OfficeTodayPage} />
        <Route path="/salary" component={SalaryPage} />
        <Route path="/applications" component={ApplicationsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route>
        <ProtectedRoutes />
      </Route>
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
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
