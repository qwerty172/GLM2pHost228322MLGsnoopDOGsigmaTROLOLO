import { Link, useParams } from "wouter";
import {
  useGetGameBySlug,
  getGetGameBySlugQueryKey,
} from "@workspace/api-client-react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Eye,
  Gamepad2,
  Trophy,
  Users,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function GameDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { data: game, isLoading, isError } = useGetGameBySlug(slug, {
    query: { enabled: !!slug, queryKey: getGetGameBySlugQueryKey(slug) },
  });

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-primary text-xl hover:opacity-80 transition-opacity"
          >
            <Activity className="h-6 w-6" />
            STREAMLINE
          </Link>
          <Link
            href="/games"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          {isLoading ? (
            <div className="h-72 rounded-xl bg-muted/20 animate-pulse" />
          ) : isError || !game ? (
            <div className="text-center py-20 border border-dashed border-border/60 rounded-xl">
              <Gamepad2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">Game not found</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row gap-8 mb-10">
                <div className="w-full md:w-64 flex-shrink-0 aspect-[3/4] rounded-xl overflow-hidden bg-muted/30 border border-border/50">
                  {game.coverImageUrl ? (
                    <img
                      src={
                        game.coverImageUrl.startsWith("http")
                          ? game.coverImageUrl
                          : `${import.meta.env.BASE_URL}${game.coverImageUrl.replace(/^\//, "")}`
                      }
                      alt={game.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gamepad2 className="h-16 w-16 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h1
                    className="text-4xl md:text-5xl font-black tracking-tight"
                    data-testid="text-game-title"
                  >
                    {game.title}
                  </h1>
                  {game.genre && (
                    <p className="text-primary font-mono mt-1">{game.genre}</p>
                  )}
                  <p className="text-muted-foreground mt-4 leading-relaxed">
                    {game.description || "No description provided yet."}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {game.isMultiplayer && (
                      <Badge variant="secondary">
                        <Users className="h-3.5 w-3.5 mr-1.5" /> Multiplayer
                      </Badge>
                    )}
                    {game.hasMods && (
                      <Badge variant="secondary">
                        <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Mods
                      </Badge>
                    )}
                    {game.hostSpectatesPlayer && (
                      <Badge variant="secondary">
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Host spectates
                      </Badge>
                    )}
                    {game.hasQuests && (
                      <Badge variant="secondary">
                        <Trophy className="h-3.5 w-3.5 mr-1.5" /> Quests
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <section>
                <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Live hosts
                  <Badge variant="outline">{game.liveSessions.length}</Badge>
                </h2>
                {game.liveSessions.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border/60 rounded-xl">
                    <p className="text-muted-foreground">
                      No hosts streaming this title right now.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check back later, or{" "}
                      <Link
                        href="/host"
                        className="text-primary hover:underline"
                      >
                        host it yourself
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3" data-testid="list-live-sessions">
                    {game.liveSessions.map((s) => (
                      <li
                        key={s.playerToken}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-card px-4 py-3 hover:border-primary/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {s.appName}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {s.resolution} · {s.bitrateKbps} kbps ·{" "}
                            {s.ratePerMinute.toFixed(3)} cred/min
                          </div>
                        </div>
                        <Link href={`/play/${s.playerToken}`}>
                          <Button
                            size="sm"
                            data-testid={`button-join-${s.playerToken}`}
                          >
                            Join
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
