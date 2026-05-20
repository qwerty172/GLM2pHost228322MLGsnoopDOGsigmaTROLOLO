import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/host/dashboard";
import SetupSession from "@/pages/host/setup";
import WalletPage from "@/pages/wallet";
import Play from "@/pages/play";
import BrowserPlay from "@/pages/host/browser-play";
import GamesPage from "@/pages/games";
import GameDetailPage from "@/pages/game-detail";
import AdminGamesPage from "@/pages/admin/games";
import HostsPage from "@/pages/hosts";
import QuotasPage from "@/pages/quotas";
import QuotaDetailPage from "@/pages/quota-detail";
import QuotaNewPage from "@/pages/quota-new";
import QuotaEditPage from "@/pages/quota-edit";
import { HostLayout } from "@/components/layout";
import { HostAuthGuard } from "@/components/host-auth-guard";

const queryClient = new QueryClient();

function HostRoutes() {
  return (
    <HostAuthGuard>
      <HostLayout>
        <Switch>
          <Route path="/host" component={Dashboard} />
          <Route path="/host/setup" component={SetupSession} />
          <Route path="/wallet" component={WalletPage} />
          <Route component={NotFound} />
        </Switch>
      </HostLayout>
    </HostAuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/games" component={GamesPage} />
      <Route path="/games/:slug" component={GameDetailPage} />
      <Route path="/admin/games" component={AdminGamesPage} />
      <Route path="/hosts" component={HostsPage} />
      <Route path="/quotas" component={QuotasPage} />
      <Route path="/quotas/new">
        <HostAuthGuard>
          <QuotaNewPage />
        </HostAuthGuard>
      </Route>
      <Route path="/quotas/:id/edit">
        {(params) => (
          <HostAuthGuard>
            <QuotaEditPage key={params.id} />
          </HostAuthGuard>
        )}
      </Route>
      <Route path="/quotas/:id" component={QuotaDetailPage} />
      <Route path="/play/:playerToken" component={Play} />
      {/* Browser-host page is a player-side feature (the human running it
          authenticates via their own wallet, not a hostToken). Route it
          before /host* so HostAuthGuard does not gate it. */}
      <Route path="/host/play/:sessionId" component={BrowserPlay} />
      <Route path="/host*" component={HostRoutes} />
      <Route path="/wallet*" component={HostRoutes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster theme="dark" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
