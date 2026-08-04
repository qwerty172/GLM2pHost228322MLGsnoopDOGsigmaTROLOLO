import { Link } from "wouter";
import { ArrowLeft, Gamepad2 } from "lucide-react";

/**
 * Мгновенная демо без API, регистрации и агента — Rogue Fable III из public/.
 */
export default function Demo() {
  const gameUrl = `${import.meta.env.BASE_URL}games/rf3/index.html`;

  return (
    <div className="fixed inset-0 bg-black">
      <iframe
        src={gameUrl}
        title="Rogue Fable III — демо"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
      <Link
        href="/"
        className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white"
        style={{
          background: "rgba(6,9,14,0.85)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        На главную
      </Link>
      <div
        className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] text-slate-400"
        style={{
          background: "rgba(6,9,14,0.85)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Gamepad2 className="h-3.5 w-3.5 text-sky-400" />
        Демо · без регистрации
      </div>
    </div>
  );
}
