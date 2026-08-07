import { $ } from "./dom.js";
import { loadLibrary, startLibraryPolling } from "./library.js";
import { showSigninBanner } from "./auth.js";
import { showAutoQuotaCard } from "./quota.js";
import { log } from "./ui.js";

const pairingCodeInput = document.getElementById("pairing-code") as HTMLInputElement;
const pairingSubmitBtn = document.getElementById("pairing-submit") as HTMLButtonElement;
const pairingStatusEl = document.getElementById("pairing-status") as HTMLParagraphElement;
export const pairingCard =
  (document.getElementById("pairing-card") as HTMLElement | null) ??
  (document.getElementById("pairing-card-inner") as HTMLElement);

async function applyPendingApiBaseUrl(): Promise<string> {
  const cfg = await window.agent.getConfig();
  let apiBaseUrl = ($("apiBaseUrl") as HTMLInputElement).value.trim() || cfg.apiBaseUrl;
  try {
    const pending = await window.agent.consumePendingApiBaseUrl();
    if (pending) {
      apiBaseUrl = pending;
      ($("apiBaseUrl") as HTMLInputElement).value = pending;
      if (!cfg.apiBaseUrl?.trim()) {
        await window.agent.setConfig({ ...cfg, apiBaseUrl: pending });
      }
    }
  } catch {
    /* ignore */
  }
  return apiBaseUrl;
}

/** Submit a 6-digit pairing code — auto-filled from dashboard deep link (U-34). */
export async function submitPairingCode(forcedCode?: string): Promise<void> {
  const code = (forcedCode ?? pairingCodeInput.value).trim();
  const cfg = await window.agent.getConfig();
  const apiBaseUrl = await applyPendingApiBaseUrl();
  if (!/^\d{6}$/.test(code)) {
    pairingStatusEl.textContent = "Введи 6 цифр с сайта";
    return;
  }
  if (!apiBaseUrl) {
    pairingStatusEl.textContent = "Сначала укажи URL платформы в расширенных настройках";
    return;
  }
  pairingSubmitBtn.disabled = true;
  pairingStatusEl.textContent = "Подключаем…";
  try {
    let agentPubkey: string | undefined;
    try {
      agentPubkey = (await window.agent.getAgentPubkey()) ?? undefined;
    } catch {
      agentPubkey = undefined;
    }
    const resp = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/auth/agent-pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, agentPubkey }),
    });
    const data = (await resp.json()) as { hostToken?: string; displayName?: string; error?: string };
    if (!resp.ok || !data.hostToken) {
      pairingStatusEl.textContent = data.error ?? "Неверный или просроченный код";
      return;
    }
    const newCfg = { ...cfg, hostToken: data.hostToken, apiBaseUrl };
    await window.agent.setConfig(newCfg);
    ($("hostToken") as HTMLInputElement).value = data.hostToken;
    ($("apiBaseUrl") as HTMLInputElement).value = apiBaseUrl;
    pairingCodeInput.value = "";
    pairingStatusEl.textContent = `Подключено: ${data.displayName ?? "хост"}`;
    if (pairingCard) pairingCard.hidden = true;
    if (data.displayName) showSigninBanner(data.displayName, apiBaseUrl);
    log(`Вход по коду выполнен: ${data.displayName ?? data.hostToken.slice(0, 8)}…`);
    await loadLibrary(newCfg);
    startLibraryPolling(newCfg);
    showAutoQuotaCard();
  } catch {
    pairingStatusEl.textContent = "Ошибка сети — проверь URL платформы";
  } finally {
    pairingSubmitBtn.disabled = false;
  }
}

async function consumePendingPairCode(): Promise<string | null> {
  try {
    return await window.agent.consumePendingPairCode();
  } catch {
    return null;
  }
}

export async function initPairingFromDeepLink(): Promise<void> {
  const pending = await consumePendingPairCode();
  if (!pending) return;
  pairingCodeInput.value = pending;
  pairingStatusEl.textContent = "Код с дашборда — подключаем…";
  await submitPairingCode(pending);
}

pairingSubmitBtn.addEventListener("click", () => void submitPairingCode());
pairingCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitPairingCode();
});

window.agent.onDeepLink((payload) => {
  if (payload.apiBaseUrl) {
    void applyPendingApiBaseUrl();
  }
  if (payload.pairCode) {
    pairingCodeInput.value = payload.pairCode;
    pairingStatusEl.textContent = "Код с дашборда — подключаем…";
    void submitPairingCode(payload.pairCode);
  }
});

