import React, { useEffect, useState } from "react";
import { 
  Terminal, 
  Cpu, 
  Network, 
  Wallet, 
  Server, 
  Activity,
  Globe,
  Lock,
  Zap,
  ChevronRight,
  Shield,
  Bitcoin,
  MonitorPlay,
  HardDrive,
  Gamepad2,
  Coins,
  ArrowRight
} from "lucide-react";

// Inline UI components to avoid dependency issues while maintaining shadcn-like API
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' }>(({ className = '', variant = 'default', ...props }, ref) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
  const variants = {
    default: "bg-[#00ff41] text-black hover:bg-[#00ff41]/80 hover:shadow-[0_0_15px_rgba(0,255,65,0.4)]",
    outline: "border border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41]/10",
    ghost: "text-[#00ff41] hover:bg-[#00ff41]/10 hover:text-[#00ff41]"
  };
  return <button ref={ref} className={`${baseStyle} ${variants[variant]} ${className}`} {...props} />;
});
Button.displayName = "Button";

const Badge = ({ className = '', variant = 'default', children, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'outline' }) => {
  const baseStyle = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants = {
    default: "border-transparent bg-[#00ff41] text-black hover:bg-[#00ff41]/80",
    outline: "border-[#00ff41]/50 text-[#00ff41]"
  };
  return <div className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>{children}</div>;
};

export function DarkTerminal() {
  const [glitchText, setGlitchText] = useState("NODERENT");
  const [stats, setStats] = useState({
    hosts: 4289,
    streams: 1832,
    earnings: 894320
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        hosts: prev.hosts + (Math.random() > 0.5 ? 1 : -1),
        streams: prev.streams + (Math.random() > 0.5 ? 2 : -1),
        earnings: prev.earnings + Math.random() * 5
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-[#00ff41] font-mono selection:bg-[#00ff41] selection:text-black overflow-x-hidden relative">
      {/* Scanlines and CRT effects */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIyIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4=')] bg-repeat" />
      <div className="fixed inset-0 pointer-events-none z-40 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)]" />

      {/* Navigation */}
      <nav className="border-b border-[#00ff41]/20 bg-black/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Terminal className="w-6 h-6" />
              <span className="text-xl font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-[#00ff41] to-[#00aa22] drop-shadow-[0_0_8px_rgba(0,255,65,0.8)]">{glitchText}</span>
            </div>
            <div className="hidden md:block">
              <div className="flex items-baseline space-x-6">
                <a href="#" className="text-[#00ff41] hover:bg-[#00ff41]/10 px-3 py-2 rounded-md text-sm font-medium transition-colors">Browse Rigs</a>
                <a href="#" className="text-[#00ff41] hover:bg-[#00ff41]/10 px-3 py-2 rounded-md text-sm font-medium transition-colors">Become a Host</a>
                <a href="#" className="text-[#00ff41]/40 cursor-not-allowed px-3 py-2 rounded-md text-sm font-medium border border-transparent border-dashed hover:border-[#00ff41]/20 relative group">
                  Exchange
                  <span className="absolute -top-2 -right-2 text-[9px] bg-[#00ff41] text-black px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">SOON</span>
                </a>
                <a href="#" className="text-[#00ff41]/40 cursor-not-allowed px-3 py-2 rounded-md text-sm font-medium border border-transparent border-dashed hover:border-[#00ff41]/20 relative group">
                  Forum
                  <span className="absolute -top-2 -right-2 text-[9px] bg-[#00ff41] text-black px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">SOON</span>
                </a>
                <a href="#" className="text-[#00ff41]/40 cursor-not-allowed px-3 py-2 rounded-md text-sm font-medium border border-transparent border-dashed hover:border-[#00ff41]/20 relative group">
                  Credits
                  <span className="absolute -top-2 -right-2 text-[9px] bg-[#00ff41] text-black px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">SOON</span>
                </a>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="rounded-none font-bold uppercase tracking-wider text-xs px-6">
                <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* 1. Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00ff41]/10 rounded-full blur-[150px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-start lg:items-center lg:text-center space-y-8">
            <Badge variant="outline" className="bg-black/50 backdrop-blur rounded-none px-4 py-1">
              <span className="w-2 h-2 bg-[#00ff41] animate-pulse mr-2" />
              P2P CLOUD GAMING PROTOCOL v1.0.4
            </Badge>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter uppercase leading-[0.9]">
              The Network<br />
              <span className="text-white">Is The Product.</span>
            </h1>
            
            <p className="max-w-2xl text-[#00ff41]/70 text-lg md:text-xl border-l-2 border-[#00ff41]/50 pl-4 lg:border-l-0 lg:pl-0">
              No corporate servers. No data centres. Just an underground network of human-owned GPUs streaming directly to you over encrypted WebRTC.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 pt-8 w-full sm:w-auto">
              <Button className="text-lg px-8 py-6 rounded-none uppercase font-bold tracking-widest border border-[#00ff41] w-full sm:w-auto">
                <Terminal className="w-5 h-5 mr-2" /> Init Connection
              </Button>
              <Button variant="outline" className="text-lg px-8 py-6 rounded-none bg-black/50 uppercase font-bold tracking-widest w-full sm:w-auto">
                <Server className="w-5 h-5 mr-2" /> Add Your GPU
              </Button>
            </div>
          </div>
        </section>

        {/* 2. Live Stats */}
        <section className="border-y border-[#00ff41]/20 bg-[#00ff41]/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              <div className="flex flex-col space-y-2">
                <p className="text-[#00ff41]/50 text-xs uppercase tracking-widest font-bold">Connected Hosts</p>
                <div className="flex items-center gap-4">
                  <Activity className="w-8 h-8 text-[#00ff41]" />
                  <p className="text-4xl lg:text-5xl font-bold text-white tracking-tighter">{stats.hosts.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
                <p className="text-[#00ff41]/50 text-xs uppercase tracking-widest font-bold">Active Sessions</p>
                <div className="flex items-center gap-4">
                  <Gamepad2 className="w-8 h-8 text-[#00ff41]" />
                  <p className="text-4xl lg:text-5xl font-bold text-white tracking-tighter">{stats.streams.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <p className="text-[#00ff41]/50 text-xs uppercase tracking-widest font-bold">Total Paid Out (USDT)</p>
                <div className="flex items-center gap-4">
                  <Bitcoin className="w-8 h-8 text-[#00ff41]" />
                  <p className="text-4xl lg:text-5xl font-bold text-white tracking-tighter">${stats.earnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. The Grid / Topology */}
        <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-bold uppercase tracking-widest text-white">Bypass The Datacenter</h2>
              <p className="text-[#00ff41]/70 leading-relaxed">
                Traditional cloud gaming relies on massive centralized server farms. NodeRent connects you directly to gamers near you. Lower latency, cheaper hourly rates, and complete censorship resistance. You pay the host directly.
              </p>
              <ul className="space-y-4 pt-4">
                <li className="flex items-start gap-3">
                  <ChevronRight className="w-5 h-5 text-[#00ff41] shrink-0 mt-0.5" />
                  <span className="text-[#00ff41]/90">Sub-20ms latency via local peer discovery</span>
                </li>
                <li className="flex items-start gap-3">
                  <ChevronRight className="w-5 h-5 text-[#00ff41] shrink-0 mt-0.5" />
                  <span className="text-[#00ff41]/90">Raw hardware access, no virtualization overhead</span>
                </li>
                <li className="flex items-start gap-3">
                  <ChevronRight className="w-5 h-5 text-[#00ff41] shrink-0 mt-0.5" />
                  <span className="text-[#00ff41]/90">Hosts set their own prices per hour</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 w-full relative h-[400px] border border-[#00ff41]/30 bg-black/50 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <Network className="w-64 h-64 text-[#00ff41]" />
              </div>
              {/* Animated dots representing nodes */}
              {[...Array(15)].map((_, i) => (
                <div key={`node-${i}`} className="absolute" style={{
                  top: `${10 + Math.random() * 80}%`,
                  left: `${10 + Math.random() * 80}%`,
                }}>
                  <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_#00ff41]" />
                  <div className="absolute top-1 left-1 w-0.5 bg-[#00ff41]/30 origin-top-left" style={{ height: `${50 + Math.random() * 100}px`, transform: `rotate(${Math.random() * 360}deg)` }} />
                </div>
              ))}
              <div className="absolute bottom-4 left-4 font-bold text-xs opacity-50 uppercase">Live Topology Map</div>
            </div>
          </div>
        </section>

        {/* 4. Live Rigs / Marketplace */}
        <section className="py-24 bg-black border-y border-[#00ff41]/20 relative">
          <div className="absolute left-0 top-0 w-1 h-full bg-[#00ff41]" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl font-bold uppercase tracking-widest text-white mb-2">Available Nodes</h2>
                <p className="text-[#00ff41]/70">Connect immediately to these idle rigs.</p>
              </div>
              <Button variant="ghost" className="uppercase font-bold text-xs tracking-widest hidden md:flex">
                View All Nodes <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: "node_alpha_7", gpu: "RTX 4090", ram: "64GB DDR5", ping: "12ms", price: "$1.80/hr", loc: "Frankfurt, DE" },
                { name: "cyber_host_99", gpu: "RTX 3080 Ti", ram: "32GB DDR4", ping: "18ms", price: "$0.90/hr", loc: "London, UK" },
                { name: "shadow_rig_x", gpu: "RX 7900 XTX", ram: "64GB DDR5", ping: "24ms", price: "$1.20/hr", loc: "Amsterdam, NL" }
              ].map((rig, i) => (
                <div key={i} className="border border-[#00ff41]/30 bg-[#050505] p-6 hover:border-[#00ff41] transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#00ff41]/10 transform translate-x-8 -translate-y-8 rotate-45 group-hover:bg-[#00ff41]/20 transition-colors" />
                  
                  <div className="flex justify-between items-start mb-6 relative">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#00ff41] rounded-full animate-pulse" />
                      <span className="font-bold text-white">{rig.name}</span>
                    </div>
                    <Badge variant="outline" className="rounded-none text-[10px] uppercase border-[#00ff41]/30">{rig.loc}</Badge>
                  </div>

                  <div className="space-y-3 text-sm text-[#00ff41]/80 mb-6">
                    <div className="flex justify-between border-b border-[#00ff41]/10 pb-1">
                      <span>GPU</span><span className="text-white">{rig.gpu}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#00ff41]/10 pb-1">
                      <span>RAM</span><span className="text-white">{rig.ram}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#00ff41]/10 pb-1">
                      <span>Ping</span><span className="text-white">{rig.ping}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-xl font-bold text-white">{rig.price}</div>
                    <Button variant="outline" className="rounded-none text-xs uppercase h-8 px-4 border-[#00ff41]/50 group-hover:border-[#00ff41] group-hover:bg-[#00ff41] group-hover:text-black">
                      Connect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Crypto Wallet Integration */}
        <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#00ff41]/5 border border-[#00ff41]/20 p-8 md:p-12 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 opacity-10">
              <Coins className="w-96 h-96" />
            </div>
            
            <div className="relative z-10 max-w-2xl">
              <Badge variant="outline" className="mb-6 rounded-none bg-black">BUILT-IN WALLET</Badge>
              <h2 className="text-3xl font-bold uppercase tracking-widest text-white mb-6">Native Crypto Settlements</h2>
              <p className="text-[#00ff41]/70 mb-8 leading-relaxed">
                Fund your account with USDT, Solana, or Nano. Streaming sessions are metered by the minute. When you disconnect, the smart contract settles the payment directly to the host's wallet. Zero chargebacks, zero hidden fees, instant payouts.
              </p>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="border border-[#00ff41]/20 bg-black/50 p-4 text-center">
                  <div className="font-bold text-white mb-1">USDT</div>
                  <div className="text-[10px] text-[#00ff41]/50">TRC20 / ERC20</div>
                </div>
                <div className="border border-[#00ff41]/20 bg-black/50 p-4 text-center">
                  <div className="font-bold text-white mb-1">SOL</div>
                  <div className="text-[10px] text-[#00ff41]/50">Solana Network</div>
                </div>
                <div className="border border-[#00ff41]/20 bg-black/50 p-4 text-center">
                  <div className="font-bold text-white mb-1">XNO</div>
                  <div className="text-[10px] text-[#00ff41]/50">Feeless</div>
                </div>
              </div>
              
              <Button className="rounded-none uppercase font-bold tracking-widest">
                <Wallet className="w-4 h-4 mr-2" /> Connect Web3 Wallet
              </Button>
            </div>
          </div>
        </section>

        {/* 6. Host / Terminal Preview */}
        <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#00ff41]/20">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold uppercase tracking-widest text-white mb-4">Run the Daemon</h2>
            <p className="text-[#00ff41]/70">Earn crypto while you sleep. The open-source host daemon runs quietly in the background and accepts secure WebRTC connections when your PC is idle.</p>
          </div>
          
          <div className="bg-black border border-[#00ff41]/40 shadow-[0_0_30px_rgba(0,255,65,0.1)] p-4 font-mono text-sm max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4 border-b border-[#00ff41]/20 pb-2 text-[#00ff41]/50">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="ml-2 text-xs">noderent-host-daemon</span>
            </div>
            <div className="space-y-1 text-[#00ff41]/80">
              <p><span className="text-blue-400">~</span>$ curl -sSL https://noderent.io/install.sh | bash</p>
              <p className="opacity-70">Downloading binaries...</p>
              <p className="opacity-70">Setting up secure tunneling...</p>
              <p className="opacity-70">Generating RSA keypair...</p>
              <p className="text-white mt-2">✅ Installation complete.</p>
              <p className="mt-2"><span className="text-blue-400">~</span>$ noderent start --gpu=auto --price=1.20</p>
              <p className="text-[#00ff41] font-bold">INFO: Daemon started. Listening on port 49152.</p>
              <p className="text-[#00ff41] font-bold">INFO: Registered on network as node_alpha_7.</p>
              <p className="text-white animate-pulse mt-2">_</p>
            </div>
          </div>
        </section>

        {/* 7. CTA */}
        <section className="py-32 bg-[#00ff41] text-black text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIyIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4=')] opacity-[0.05]" />
          <div className="relative z-10 max-w-3xl mx-auto px-4">
            <h2 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter mb-6 text-black">
              Take Back the Cloud
            </h2>
            <p className="text-black/80 text-xl font-bold mb-10">
              Stop paying corporations. Start paying each other.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button className="bg-black text-[#00ff41] hover:bg-black/80 rounded-none px-8 py-6 text-lg uppercase font-bold tracking-widest border border-black hover:border-[#00ff41]">
                Launch App
              </Button>
              <Button variant="outline" className="border-black text-black hover:bg-black/10 rounded-none px-8 py-6 text-lg uppercase font-bold tracking-widest">
                Read the Manifesto
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* 8. Footer */}
      <footer className="border-t border-[#00ff41]/20 bg-[#050505] py-12 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-6 h-6 text-[#00ff41]" />
              <span className="font-bold tracking-widest text-white text-xl">NODERENT</span>
            </div>
            <p className="text-[#00ff41]/50 text-sm max-w-sm">
              The decentralized cloud gaming protocol. Owned by the community, powered by actual hardware.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold uppercase mb-4 tracking-widest text-sm">Protocol</h4>
            <ul className="space-y-2 text-sm text-[#00ff41]/60">
              <li><a href="#" className="hover:text-[#00ff41]">Whitepaper</a></li>
              <li><a href="#" className="hover:text-[#00ff41]">Smart Contracts</a></li>
              <li><a href="#" className="hover:text-[#00ff41]">Network Stats</a></li>
              <li><a href="#" className="hover:text-[#00ff41]">Governance</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold uppercase mb-4 tracking-widest text-sm">Resources</h4>
            <ul className="space-y-2 text-sm text-[#00ff41]/60">
              <li><a href="#" className="hover:text-[#00ff41]">Host Documentation</a></li>
              <li><a href="#" className="hover:text-[#00ff41]">Client GitHub</a></li>
              <li><a href="#" className="hover:text-[#00ff41]">Discord Community</a></li>
              <li><a href="#" className="hover:text-[#00ff41]">Onion Address</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-[#00ff41]/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#00ff41]/30">
          <p>© {new Date().getFullYear()} NodeRent Protocol. GPLv3 Licensed.</p>
          <div className="flex gap-4">
            <span>SYS_STATUS: ONLINE</span>
            <span>PING: 12ms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DarkTerminal;