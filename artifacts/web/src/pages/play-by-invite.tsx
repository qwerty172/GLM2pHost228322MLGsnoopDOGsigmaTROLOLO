import { useEffect } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { Loader2 } from "lucide-react";

/**
 * Legacy route kept for bookmarks. App.tsx now mounts Play on /play/i/:code;
 * this file remains as a thin redirect if imported elsewhere.
 */
export default function PlayByInvite() {
  const [, params] = useRoute("/play/i/:inviteCode");
  const [, navigate] = useLocation();
  const search = useSearch();
  const inviteCode = params?.inviteCode ?? "";

  useEffect(() => {
    if (!inviteCode) return;
    const qs = search ? `?${search}` : "";
    navigate(`/play/i/${inviteCode}${qs}`, { replace: true });
  }, [inviteCode, navigate, search]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-sky-400">
      <Loader2 className="h-8 w-8 animate-spin mr-2" />
      <span className="text-slate-400">Подключаемся…</span>
    </div>
  );
}
