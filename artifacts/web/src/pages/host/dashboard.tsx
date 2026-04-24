import { useAuth } from "@/hooks/use-auth";
import { useGetHostStats, useGetHostActivity, useListHostSessions, useEndSession, getGetHostStatsQueryKey, getGetHostActivityQueryKey, getListHostSessionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Copy, MonitorPlay, PowerOff, Clock, DollarSign, Download, HardDrive, Gamepad2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { hostToken } = useAuth();
  
  const { data: stats, isLoading: statsLoading } = useGetHostStats(hostToken || "", { query: { enabled: !!hostToken, queryKey: getGetHostStatsQueryKey(hostToken || "") } });
  const { data: activity, isLoading: activityLoading } = useGetHostActivity(hostToken || "", { query: { enabled: !!hostToken, queryKey: getGetHostActivityQueryKey(hostToken || "") } });
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useListHostSessions(hostToken || "", { query: { enabled: !!hostToken, queryKey: getListHostSessionsQueryKey(hostToken || "") } });
  
  const endSession = useEndSession();

  const handleCopyLink = (playerToken: string) => {
    const link = `${window.location.origin}${import.meta.env.BASE_URL}play/${playerToken}`;
    navigator.clipboard.writeText(link);
    toast.success("Share link copied to clipboard");
  };

  const handleEndSession = (id: string) => {
    if (!hostToken) return;
    endSession.mutate(
      { id, data: { hostToken } },
      {
        onSuccess: () => {
          toast.success("Session ended successfully");
          refetchSessions();
        },
        onError: () => {
          toast.error("Failed to end session");
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Host Dashboard</h1>
          <p className="text-muted-foreground">Manage your hardware node and active sessions.</p>
        </div>
        <a
          href="/api/downloads/host-agent.zip"
          download="cloud-gaming-host-agent.zip"
          data-testid="link-download-host-agent"
        >
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Host Agent
          </Button>
        </a>
      </div>

      <Card className="bg-card/50 backdrop-blur border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-primary" />
            Get the host agent
          </CardTitle>
          <CardDescription>
            The agent runs on your Windows PC and streams your game window to
            players over WebRTC. Download the portable bundle, extract it, and
            double-click <span className="font-mono text-xs">start.bat</span>.
            Node.js 20+ is required (see <span className="font-mono text-xs">INSTALL.txt</span> inside the ZIP).
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <MonitorPlay className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.activeSessions || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently streaming</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Streamed</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : `${stats?.totalMinutesStreamed || 0}m`}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime minutes</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">7d Earnings</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : `$${(stats?.earnings7d || 0).toFixed(2)}`}
            </div>
            <p className="text-xs text-muted-foreground">Past 7 days</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : `$${(stats?.creditBalance || 0).toFixed(2)}`}
            </div>
            <p className="text-xs text-muted-foreground">Available to withdraw</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-4 bg-card/50 backdrop-blur border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              Node Sessions
            </CardTitle>
            <CardDescription>Your current and recent gaming sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : sessions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border/50 rounded-lg bg-background/30">
                <Gamepad2 className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium mb-2">No sessions found</p>
                <p className="text-sm text-muted-foreground/60 mb-4 max-w-sm">Create a session to generate a share link and start hosting.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions?.map((session) => (
                  <div key={session.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{session.appName}</span>
                        <Badge variant={
                          session.status === 'active' ? 'default' : 
                          session.status === 'pending' ? 'secondary' : 'outline'
                        } className={session.status === 'active' ? 'animate-pulse bg-primary/20 text-primary hover:bg-primary/20' : ''}>
                          {session.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span>{session.resolution}</span>
                        <span>•</span>
                        <span>{session.bitrateKbps} kbps</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(session.createdAt))} ago</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {session.status !== 'ended' && (
                        <>
                          <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={() => handleCopyLink(session.playerToken)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Link
                          </Button>
                          <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => handleEndSession(session.id)} disabled={endSession.isPending}>
                            <PowerOff className="h-4 w-4 mr-2" />
                            End
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Activity Feed
            </CardTitle>
            <CardDescription>Recent events on your node.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : activity?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No activity yet.</div>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {activity?.map((item) => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      {item.kind.includes('session') ? <MonitorPlay className="h-4 w-4 text-primary" /> : <DollarSign className="h-4 w-4 text-secondary" />}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border/50 bg-background/50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-sm text-foreground">{item.title}</div>
                        <time className="text-xs font-mono text-muted-foreground">{formatDistanceToNow(new Date(item.timestamp))} ago</time>
                      </div>
                      <div className="text-xs text-muted-foreground flex justify-between items-center">
                        <span>{item.subtitle}</span>
                        {item.amount && item.currency && (
                          <span className="font-mono text-primary font-bold">
                            {item.amount > 0 ? '+' : ''}{item.amount} {item.currency}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
