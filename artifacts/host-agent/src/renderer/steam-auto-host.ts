import type { HostConfig } from "../shared/messages";
import { loadLibrary } from "./library.js";
import { session } from "./state.js";
import { log } from "./ui.js";

export const autoSteamCard = document.getElementById("auto-steam-card") as HTMLElement;
const autoSteamStatus = document.getElementById("auto-steam-status") as HTMLParagraphElement;
const autoSteamPublishBtn = document.getElementById("auto-steam-publish") as HTMLButtonElement;

export async function refreshSteamAutoHost(cfg: HostConfig): Promise<void> {
  if (!cfg.hostToken || !cfg.apiBaseUrl || session.steamGames.length === 0) return;
  const payload = {
    steamGames: session.steamGames.map((g) => ({
      appId: g.appId,
      name: g.name,
      bestExePath: g.bestExePath,
    })),
  };
  try {
    const resp = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}/api/hosts/me/steam-auto-hostable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Token": cfg.hostToken,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) return;
    const data = (await resp.json()) as {
      eligible: Array<{ gameId: string; title: string; appPath: string | null }>;
    };
    session.steamEligibleItems = data.eligible ?? [];
    if (session.steamEligibleItems.length > 0) {
      autoSteamCard.hidden = false;
      autoSteamStatus.textContent = `${session.steamEligibleItems.length} игр подходят под ваш ПК (выше рекомендуемых)`;
      autoSteamPublishBtn.hidden = false;
    }
  } catch {
    /* ignore */
  }
}

autoSteamPublishBtn.addEventListener("click", async () => {
  const cfg = await window.agent.getConfig();
  if (!cfg.hostToken || !cfg.apiBaseUrl || session.steamEligibleItems.length === 0) return;
  autoSteamPublishBtn.disabled = true;
  try {
    const resp = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}/api/hosts/me/library/bulk-publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Token": cfg.hostToken,
      },
      body: JSON.stringify({
        items: session.steamEligibleItems.map((g) => ({
          gameId: g.gameId,
          appPath: g.appPath ?? undefined,
        })),
      }),
    });
    const data = (await resp.json()) as { added?: string[]; updated?: string[] };
    log(`Добавлено в библиотеку: ${(data.added?.length ?? 0) + (data.updated?.length ?? 0)} игр`);
    await loadLibrary(cfg);
  } catch {
    log("Ошибка bulk-publish");
  } finally {
    autoSteamPublishBtn.disabled = false;
  }
});