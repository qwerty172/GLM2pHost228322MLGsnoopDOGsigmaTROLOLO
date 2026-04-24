import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Gamepad2, ArrowRight, Zap, Cpu, DollarSign } from "lucide-react";
import { useState } from "react";

export default function Landing() {
  const [shareLink, setShareLink] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (shareLink) {
      // Basic extraction if they paste full URL or just token
      const token = shareLink.split("/play/").pop() || shareLink;
      if (token) {
        window.location.href = `${import.meta.env.BASE_URL}play/${token}`;
      }
    }
  };

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-tight text-primary text-xl">
            <Activity className="h-6 w-6" />
            STREAMLINE
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/games"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              data-testid="link-games-library"
            >
              Games Library
            </Link>
            <Link href="/host" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Host Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src={`${import.meta.env.BASE_URL}hero.png`} 
              alt="Futuristic server room" 
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
          
          <div className="container relative z-10 mx-auto px-6 text-center">
            <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary mb-8 animate-in fade-in slide-in-from-bottom-4">
              <Zap className="mr-2 h-4 w-4" />
              P2P Cloud Gaming Protocol v0.1.0 Active
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/50 animate-in fade-in slide-in-from-bottom-6 delay-150 fill-mode-both">
              YOUR HARDWARE.
              <br />
              THEIR GAMES.
            </h1>
            
            <p className="max-w-2xl mx-auto text-xl text-muted-foreground mb-10 animate-in fade-in slide-in-from-bottom-8 delay-300 fill-mode-both">
              Rent out your idle gaming rig to players worldwide. Earn crypto per minute. Players connect instantly via WebRTC—no installs required.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 delay-500 fill-mode-both">
              <Link href="/host">
                <Button size="lg" className="h-14 px-8 text-lg font-bold uppercase tracking-wider w-full sm:w-auto">
                  <Cpu className="mr-2 h-5 w-5" />
                  Become a Host
                </Button>
              </Link>
              
              <form onSubmit={handleJoin} className="flex w-full sm:w-auto max-w-sm">
                <Input 
                  placeholder="Paste Share Link or Token" 
                  className="h-14 rounded-r-none border-r-0 bg-background/50 backdrop-blur"
                  value={shareLink}
                  onChange={(e) => setShareLink(e.target.value)}
                />
                <Button type="submit" variant="secondary" className="h-14 rounded-l-none px-6">
                  Play <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </section>

        {/* Games Grid */}
        <section className="py-20 border-y border-border/50 bg-muted/20">
          <div className="container mx-auto px-6">
            <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Gamepad2 className="h-6 w-6 text-primary" />
                POPULAR TITLES
              </h2>
              <Link href="/games">
                <Button variant="outline" size="sm" data-testid="button-browse-all-games">
                  Browse the full library
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { img: "game-1.png", title: "Cyberpunk 2077", req: "1440p / RTX 4090" },
                { img: "game-2.png", title: "Elden Ring", req: "1080p / RTX 3080" },
                { img: "game-3.png", title: "Helldivers 2", req: "1440p / RX 7900" },
              ].map((game, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/50">
                  <div className="aspect-[3/4] w-full">
                    <img 
                      src={`${import.meta.env.BASE_URL}${game.img}`} 
                      alt={game.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent p-6 flex flex-col justify-end">
                    <h3 className="text-xl font-bold">{game.title}</h3>
                    <p className="text-sm text-primary font-mono mt-1">{game.req}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-32">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Ultra-Low Latency</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Direct peer-to-peer WebRTC connections. No middleman servers. Raw performance straight to the player's browser.
                </p>
              </div>
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <DollarSign className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Earn Crypto</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Get paid per minute of gameplay. Instant withdrawals to USDT, Solana, or Nano. Turn idle GPUs into yield.
                </p>
              </div>
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Gamepad2 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Zero Friction</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Players just click a link and start playing in their browser. No clients, no launchers, no friction.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-muted-foreground">
            <Activity className="h-5 w-5" />
            STREAMLINE PROTOCOL
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            SYS.VERSION 0.1.0 // P2P
          </p>
        </div>
      </footer>
    </div>
  );
}
