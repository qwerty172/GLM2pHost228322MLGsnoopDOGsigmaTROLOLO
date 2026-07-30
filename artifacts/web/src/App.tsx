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
import { SiteNav } from "@/components/site-nav";
import { HostAuthGuard } from "@/components/host-auth-guard";
import ProfilePage from "@/pages/profile";
import Embed from "@/pages/embed";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function HostRoutes() {
  return (
    <HostAuthGuard>
      <HostLayout>
        <Switch>
          <Route path="/host" component={Dashboard} />
          <Route path="/host/setup" component={SetupSession} />
          <Route path="/host/library" component={HostLibrary} />
          <Route component={NotFound} />
        </Switch>
      </HostLayout>
    </HostAuthGuard>
  );
}

/** Standalone wallet page — accessible to all users (no HostAuthGuard). */
function StandaloneWallet() {
  return (
    <div className="min-h-screen flex flex-col text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/wallet" />
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        <WalletPage />
      </main>
    </div>
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
      {/* Standalone wallet — accessible to any user, no auth guard */}
      <Route path="/wallet" component={StandaloneWallet} />
      {/* Invite resolve живёт внутри Play — один loader «Подключаемся…». */}
      <Route path="/play/i/:inviteCode" component={Play} />
      <Route path="/play/:playerToken" component={Play} />
      {/* Embeddable third-party widget (task-125) — no auth guard, standalone. */}
      <Route path="/embed" component={Embed} />
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
