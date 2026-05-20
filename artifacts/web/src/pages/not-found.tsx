import { Link } from "wouter";
import { AlertCircle, ArrowLeft, Gamepad2 } from "lucide-react";
import { SiteNav } from "@/components/site-nav";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#06090e" }}>
      <SiteNav />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-6xl font-black text-white mb-2 tracking-tighter">404</div>
          <h1 className="text-lg font-bold text-white mb-2">Страница не найдена</h1>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            Такой страницы не существует. Возможно, ссылка устарела или была удалена.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <button
                type="button"
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                <ArrowLeft className="w-4 h-4" />
                На главную
              </button>
            </Link>
            <Link href="/games">
              <button
                type="button"
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#94a3b8",
                }}
              >
                <Gamepad2 className="w-4 h-4" />
                Каталог игр
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
