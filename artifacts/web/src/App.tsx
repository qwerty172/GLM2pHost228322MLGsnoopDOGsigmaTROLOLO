import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/host/dashboard";
import SetupSession from "@/pages/host/setup";
import HostLibrary from "@/pages/host/library";
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
import ExchangePage from "@/pages/exchange";
import { HostLayout } from "@/components/layout";
import { HostAuthGuard } from "@/components/host-auth-guard";
import ProfilePage from "@/pages/profile";
import ExchangePage from "@/pages/exchange";

const queryClient = new QueryClient();

function HostRoutes() {
  return (
    <HostAuthGuard>
      <HostLayout>
        <Switch>
          <Route path="/host" component={Dashboard} />
          <Route path="/host/setup" component={SetupSession} />
          <Route path="/host/library" component={HostLibrary} />
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
      <Route path="/profile" component={ProfilePage} />
      <Route path="/games/:slug" component={GameDetailPage} />
      <Route path="/admin/games" component={AdminGamesPage} />
      <Route path="/hosts" component={HostsPage} />
      <Route path="/exchange" component={ExchangePage} />
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
      <Route path="/exchange">
        <HostAuthGuard>
          <ExchangePage />
        </HostAuthGuard>
      </Route>
      <Route path="/play/:playerToken" component={Play} />
      {/* Browser-host page is a player-side feature (the human running it
          authenticates via their own wallet, not a hostToken). Route it
          before /host so HostAuthGuard does not gate it. */}
      <Route path="/host/play/:sessionId" component={BrowserPlay} />
      {/* Enumerate all host-panel paths explicitly so Wouter v3 does NOT
          shift the router base (wildcard /host* strips the prefix and breaks
          the nested Switch whose routes use full absolute paths). */}
      <Route path="/host" component={HostRoutes} />
      <Route path="/host/setup" component={HostRoutes} />
      <Route path="/host/library" component={HostRoutes} />
      <Route path="/wallet" component={HostRoutes} />
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
