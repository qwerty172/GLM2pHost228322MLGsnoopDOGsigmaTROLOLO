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

async function finishPairingSuccess(
  cfg: Awaited<ReturnType<typeof window.agent.getConfig>>,
  apiBaseUrl: string,
  hostToken: string,
  displayName?: string,
): Promise<void> {
  const newCfg = { ...cfg, hostToken, apiBaseUrl };
  await window.agent.setConfig(newCfg);
  ($("hostToken") as HTMLInputElement).value = hostToken;
  ($("apiBaseUrl") as HTMLInputElement).value = apiBaseUrl;
  pairingCodeInput.value = "";
  pairingStatusEl.textContent = `Подключено: ${displayName ?? "хост"}`;
  if (pairingCard) pairingCard.hidden = true;
  if (displayName) showSigninBanner(displayName, apiBaseUrl);
  log(`Вход по коду выполнен: ${displayName ?? hostToken.slice(0, 8)}…`);
  await loadLibrary(newCfg);
  startLibraryPolling(newCfg);
  showAutoQuotaCard();
}

/** Redeem an opaque deep-link ticket — bind + hostToken without secrets in the URL (U-34). */
export async function redeemDeepLinkTicket(forcedTicket?: string): Promise<boolean> {
  const ticket = forcedTicket ?? (await consumePendingDeeplinkTicket());
  if (!ticket) return false;
  const cfg = await window.agent.getConfig();
  const apiBaseUrl = await applyPendingApiBaseUrl();
  if (!apiBaseUrl) {
    pairingStatusEl.textContent = "Сначала укажи URL платформы в расширенных настройках";
    return false;
  }
  pairingSubmitBtn.disabled = true;
  pairingStatusEl.textContent = "Подключаем…";
  try {
    const result = await window.agent.redeemDeeplinkTicket(apiBaseUrl, ticket);
    if (!result.ok || !result.hostToken) {
      pairingStatusEl.textContent = result.error ?? "Неверный или просроченный код";
      return false;
    }
    await finishPairingSuccess(cfg, apiBaseUrl, result.hostToken, result.displayName);
    return true;
  } catch {
    pairingStatusEl.textContent = "Ошибка сети — проверь URL платформы";
    return false;
  } finally {
    pairingSubmitBtn.disabled = false;
  }
}

/** Submit a 6-digit pairing code — legacy manual path. */
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
    await finishPairingSuccess(cfg, apiBaseUrl, data.hostToken, data.displayName);
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

async function consumePendingDeeplinkTicket(): Promise<string | null> {
  try {
    return await window.agent.consumePendingDeeplinkTicket();
  } catch {
    return null;
  }
}

export async function initPairingFromDeepLink(): Promise<void> {
  const pendingTicket = await consumePendingDeeplinkTicket();
  if (pendingTicket) {
    pairingStatusEl.textContent = "Код с дашборда — подключаем…";
    await redeemDeepLinkTicket(pendingTicket);
    return;
  }
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
  if (payload.ticket) {
    pairingStatusEl.textContent = "Код с дашборда — подключаем…";
    void redeemDeepLinkTicket(payload.ticket);
    return;
  }
  if (payload.pairCode) {
    pairingCodeInput.value = payload.pairCode;
    pairingStatusEl.textContent = "Код с дашборда — подключаем…";
    void submitPairingCode(payload.pairCode);
  }
});

void initPairingFromDeepLink();
