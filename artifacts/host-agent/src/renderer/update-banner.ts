import { session } from "./state.js";
import { teardownAsync } from "./session.js";

/** U-16: плашка «Обновление готово» + одна кнопка установки (без повторного ZIP). */
export function initUpdateBanner(): void {
  const banner = document.getElementById("update-ready-banner");
  const btn = document.getElementById("update-install-btn");
  if (!banner || !btn) return;

  window.agent.onUpdateReady(() => {
    banner.hidden = false;
  });

  btn.addEventListener("click", () => {
    void (async () => {
      // quitAndInstall bypasses renderer teardown — push cloud saves and end the
      // billing session first so players don't lose progress mid-update.
      if (session.currentSessionId || session.isStreaming) {
        await teardownAsync("Обновление агента");
      }
      await window.agent.installUpdate();
    })();
  });
}
