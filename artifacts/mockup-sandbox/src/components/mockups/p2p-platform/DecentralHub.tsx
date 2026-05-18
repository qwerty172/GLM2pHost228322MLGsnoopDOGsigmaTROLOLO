import React from 'react';
import { 
  Terminal, 
  Gamepad2, 
  Cpu, 
  Wallet, 
  Globe, 
  Users, 
  Star, 
  ShieldCheck, 
  Bitcoin, 
  ArrowRight,
  ChevronRight,
  MessageSquare,
  Activity,
  Coins
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

export default function DecentralHub() {
  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-300 font-sans selection:bg-amber-500/30">
      {/* Custom Styles */}
      <style>{`
        .glass-panel {
          background: rgba(15, 20, 30, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .glow-text {
          text-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
        }
        .accent-gradient {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .host-card:hover {
          border-color: rgba(245, 158, 11, 0.4);
          box-shadow: 0 0 30px rgba(245, 158, 11, 0.05);
        }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <Terminal className="w-5 h-5 text-[#0a0d14]" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">NodeRent</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" /> Browse Games
            </a>
            <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Hosts
            </a>
            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <span className="text-sm font-medium text-slate-400">Exchange</span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider py-0 px-1.5 h-4 bg-slate-800/50 text-amber-500/70 border-amber-500/20">Soon</Badge>
            </div>
            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <span className="text-sm font-medium text-slate-400">Forum</span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider py-0 px-1.5 h-4 bg-slate-800/50 text-amber-500/70 border-amber-500/20">Soon</Badge>
            </div>
            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <span className="text-sm font-medium text-slate-400">Credits</span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider py-0 px-1.5 h-4 bg-slate-800/50 text-amber-500/70 border-amber-500/20">Soon</Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-400">1,248 Nodes Online</span>
            </div>
            <Button className="bg-amber-500 hover:bg-amber-400 text-[#0a0d14] font-bold rounded-lg px-6">
              Connect Wallet
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/lan-party-hero.png')] bg-cover bg-center opacity-20 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14]/80 to-transparent" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-colors mb-8 px-4 py-1.5 text-sm">
            <Activity className="w-4 h-4 mr-2" />
            Beta v0.9.4 — WebRTC Streaming Active
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tight leading-[1.1]">
            Don't rent servers.<br />
            <span className="accent-gradient glow-text">Rent rigs.</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            The world's first true P2P cloud gaming network. No corporate data centres. 
            Just real people sharing their GPUs. Play anything, pay in crypto, own the network.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto h-14 px-8 bg-amber-500 hover:bg-amber-400 text-[#0a0d14] font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:scale-105">
              Browse Available Nodes <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 border-white/10 hover:bg-white/5 text-white font-medium text-lg rounded-xl transition-all">
              Become a Host
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Hosts */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-white mb-3">Live on the Network</h2>
              <p className="text-slate-400">Top-rated community hosts ready for connection.</p>
            </div>
            <Button variant="ghost" className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Host 1 */}
            <Card className="glass-panel border-white/5 p-6 rounded-2xl host-card transition-all duration-300">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="w-14 h-14 border-2 border-emerald-500/50">
                      <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" />
                      <AvatarFallback>FX</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0a0d14] rounded-full" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      CyberSlav99
                      <ShieldCheck className="w-4 h-4 text-amber-500" />
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-slate-400">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> 4.9 (128 sessions)
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">0.45</div>
                  <div className="text-xs text-slate-400 font-medium tracking-wide">USDT / HR</div>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="bg-[#0a0d14]/50 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Cpu className="w-4 h-4" /> i9-14900K</span>
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Gamepad2 className="w-4 h-4" /> RTX 4090</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Globe className="w-4 h-4" /> Frankfurt, DE</span>
                    <span className="text-sm text-emerald-400 font-medium">12ms Ping</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-0">прокачанный аккаунт</Badge>
                  <Badge variant="secondary" className="bg-white/5 text-slate-300 hover:bg-white/10 border-0">VR Ready</Badge>
                  <Badge variant="secondary" className="bg-white/5 text-slate-300 hover:bg-white/10 border-0">1Gbps Fiber</Badge>
                </div>
              </div>

              <Button className="w-full bg-white/5 hover:bg-amber-500 hover:text-[#0a0d14] text-white border border-white/10 transition-colors">
                Connect Rig
              </Button>
            </Card>

            {/* Host 2 */}
            <Card className="glass-panel border-white/5 p-6 rounded-2xl host-card transition-all duration-300">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="w-14 h-14 border-2 border-emerald-500/50">
                      <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" />
                      <AvatarFallback>AL</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0a0d14] rounded-full" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      NeonNinja
                      <ShieldCheck className="w-4 h-4 text-amber-500" />
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-slate-400">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> 4.8 (84 sessions)
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">0.30</div>
                  <div className="text-xs text-slate-400 font-medium tracking-wide">USDT / HR</div>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="bg-[#0a0d14]/50 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Cpu className="w-4 h-4" /> Ryzen 7 7800X3D</span>
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Gamepad2 className="w-4 h-4" /> RTX 4080</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Globe className="w-4 h-4" /> Warsaw, PL</span>
                    <span className="text-sm text-emerald-400 font-medium">24ms Ping</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-white/5 text-slate-300 hover:bg-white/10 border-0">Modded GTA V</Badge>
                  <Badge variant="secondary" className="bg-white/5 text-slate-300 hover:bg-white/10 border-0">Streamer Setup</Badge>
                </div>
              </div>

              <Button className="w-full bg-white/5 hover:bg-amber-500 hover:text-[#0a0d14] text-white border border-white/10 transition-colors">
                Connect Rig
              </Button>
            </Card>

            {/* Host 3 */}
            <Card className="glass-panel border-white/5 p-6 rounded-2xl host-card transition-all duration-300">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="w-14 h-14 border-2 border-amber-500/50">
                      <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" />
                      <AvatarFallback>SA</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 border-2 border-[#0a0d14] rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      TokyoDrift
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-slate-400">
                      <span className="text-amber-500 font-medium text-xs border border-amber-500/30 px-1.5 py-0.5 rounded bg-amber-500/10">NEW HOST</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">0.25</div>
                  <div className="text-xs text-slate-400 font-medium tracking-wide">USDT / HR</div>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="bg-[#0a0d14]/50 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Cpu className="w-4 h-4" /> i7-13700K</span>
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Gamepad2 className="w-4 h-4" /> RTX 4070 Ti</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Globe className="w-4 h-4" /> Tokyo, JP</span>
                    <span className="text-sm text-emerald-400 font-medium">148ms Ping</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-white/5 text-slate-300 hover:bg-white/10 border-0">Quiet Room</Badge>
                  <Badge variant="secondary" className="bg-white/5 text-slate-300 hover:bg-white/10 border-0">Anime Games</Badge>
                </div>
              </div>

              <Button className="w-full bg-white/5 hover:bg-amber-500 hover:text-[#0a0d14] text-white border border-white/10 transition-colors">
                Connect Rig
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Wallet / Economy Integration */}
      <section className="py-24 bg-gradient-to-b from-transparent to-[#0f141e] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 mb-6 border border-amber-500/20">
              <Wallet className="w-6 h-6" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-6">Built-in Crypto Economy</h2>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              No credit cards, no subscriptions, no middlemen extracting 30%. Connect your Phantom or MetaMask, fund your NodeRent wallet with USDT, Nano, or Solana, and pay exactly for the minutes you play directly to the host.
            </p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                </div>
                <div>
                  <h4 className="text-white font-medium">Micro-transactions natively</h4>
                  <p className="text-sm text-slate-400">Stream payments per second via state channels.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                </div>
                <div>
                  <h4 className="text-white font-medium">Hosts keep 95%</h4>
                  <p className="text-sm text-slate-400">5% goes to the DAO for network maintenance.</p>
                </div>
              </li>
            </ul>

            <Button variant="outline" className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
              Read the Tokenomics <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-purple-500/20 blur-[80px] rounded-full" />
            <Card className="relative glass-panel border-white/10 p-8 rounded-3xl">
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 p-0.5">
                    <div className="w-full h-full bg-[#0a0d14] rounded-full flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 font-medium">Your Wallet</div>
                    <div className="text-white font-mono text-sm">0x7F...3a9B</div>
                  </div>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">Connected</Badge>
              </div>

              <div className="mb-8">
                <div className="text-sm text-slate-400 mb-2">Available Balance</div>
                <div className="text-5xl font-black text-white flex items-baseline gap-2">
                  124.50 <span className="text-2xl text-amber-500">USDT</span>
                </div>
                <div className="text-sm text-slate-500 mt-2">≈ 276 hours of gameplay</div>
              </div>

              <div className="space-y-3">
                <Button className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white justify-between px-6 rounded-xl">
                  <span className="flex items-center gap-2"><Bitcoin className="w-4 h-4 text-orange-400" /> Deposit Crypto</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </Button>
                <Button className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white justify-between px-6 rounded-xl">
                  <span className="flex items-center gap-2"><Coins className="w-4 h-4 text-amber-400" /> NodeRent Credits</span>
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-0 ml-auto mr-2">Soon</Badge>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Community / Forum Tease */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <MessageSquare className="w-12 h-12 text-amber-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">More than just servers.</h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">
            NodeRent is governed by the people who use it. Trade setups, share mods, form clans, and vote on protocol upgrades.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="glass-panel p-8 rounded-2xl border-white/5 text-left relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="w-24 h-24 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Clans & Guilds</h3>
              <p className="text-slate-400 text-sm mb-4">Form groups, pool resources, and rent dedicated rigs for your team.</p>
              <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5">Arriving Q3</Badge>
            </div>
            
            <div className="glass-panel p-8 rounded-2xl border-white/5 text-left relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Globe className="w-24 h-24 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Freelance Exchange</h3>
              <p className="text-slate-400 text-sm mb-4">Hire hosts to pre-install mods, farm items, or setup custom servers.</p>
              <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5">In Development</Badge>
            </div>

            <div className="glass-panel p-8 rounded-2xl border-white/5 text-left relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Terminal className="w-24 h-24 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Underground Forum</h3>
              <p className="text-slate-400 text-sm mb-4">The social layer. Discuss hardware, optimize streams, share configs.</p>
              <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5">Launching Soon</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 border-t border-white/5 bg-[#0a0d14]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">Ready to join the network?</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="h-14 px-8 bg-amber-500 hover:bg-amber-400 text-[#0a0d14] font-bold text-lg rounded-xl">
              Start Playing Now
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 border-white/10 hover:bg-white/5 text-white font-medium text-lg rounded-xl">
              Download Host Agent
            </Button>
          </div>
          <div className="mt-16 flex items-center justify-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-amber-500 transition-colors">Discord</a>
            <span className="w-1 h-1 bg-slate-700 rounded-full" />
            <a href="#" className="hover:text-amber-500 transition-colors">Twitter</a>
            <span className="w-1 h-1 bg-slate-700 rounded-full" />
            <a href="#" className="hover:text-amber-500 transition-colors">GitHub</a>
            <span className="w-1 h-1 bg-slate-700 rounded-full" />
            <a href="#" className="hover:text-amber-500 transition-colors">Docs</a>
          </div>
        </div>
      </section>
    </div>
  );
}
