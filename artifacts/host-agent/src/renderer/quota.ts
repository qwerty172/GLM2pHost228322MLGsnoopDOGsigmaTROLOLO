import { session } from "./state.js";
import { log } from "./ui.js";

export const autoQuotaCard = document.getElementById("auto-quota-card") as HTMLElement;
export const autoQuotaCheckbox = document.getElementById("autoQuotaEnabled") as HTMLInputElement;
const autoQuotaStatusEl = document.getElementById("auto-quota-status") as HTMLDivElement;
const autoQuotaActionsEl = document.getElementById("auto-quota-actions") as HTMLDivElement;
const detachQuotaBtn = document.getElementById("detach-quota-btn") as HTMLButtonElement;

export function showAutoQuotaCard(): void {
  autoQuotaCard.hidden = false;
}

export function applyQuotaStatus(ev: { statusText: string; hasAttached: boolean }): void {
  autoQuotaStatusEl.textContent = ev.statusText;
  autoQuotaActionsEl.style.display = ev.hasAttached ? "block" : "none";
}

// Subscribe to push events from the main-process scheduler.
window.agent.onQuotaStatus((ev) => {
  applyQuotaStatus(ev);
});

autoQuotaCheckbox.addEventListener("change", async () => {
  const cfg = session.currentConfig ?? (await window.agent.getConfig());
  const enabled = autoQuotaCheckbox.checked;
  const saved = await window.agent.setConfig({ ...cfg, autoQuotaEnabled: enabled });
  session.currentConfig = saved;
  if (enabled) {
    log("Автоподбор квот включён.");
    applyQuotaStatus({ statusText: "Ищу подходящие квоты…", hasAttached: false });
    // Ask main process to run a match cycle immediately (instead of waiting 60s).
    window.agent.quotaRunCycle();
  } else {
    log("Автоподбор квот выключен.");
    applyQuotaStatus({ statusText: "Автоподбор выключен.", hasAttached: false });
  }
});

detachQuotaBtn.addEventListener("click", async () => {
  detachQuotaBtn.disabled = true;
  try {
    const result = await window.agent.quotaDetach();
    if (result.ok) {
      log("Квота отвязана. Ищу следующую…");
      applyQuotaStatus({ statusText: "Квота отвязана. Ищу следующую…", hasAttached: false });
    } else {
      log("Не удалось отвязать квоту.");
    }
  } finally {
    detachQuotaBtn.disabled = false;
  }
});