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

/** Resolve API base URL for pairing — optional deep-link hint avoids double consume races. */
async function resolvePairingApiBaseUrl(hint?: string | null): Promise<string> {
  const cfg = await window.agent.getConfig();
  let apiBaseUrl = ($("apiBaseUrl") as HTMLInputElement).value.trim() || cfg.apiBaseUrl;
  const fromHint = hint?.trim();
  if (fromHint) {
    apiBaseUrl = fromHint;
    ($("apiBaseUrl") as HTMLInputElement).value = fromHint;
    if (!cfg.apiBaseUrl?.trim()) {
      await window.agent.setConfig({ ...cfg, apiBaseUrl: fromHint });
    }
    try {
      await window.agent.consumePendingApiBaseUrl();
    } catch {
      /* ignore */
    }
    return apiBaseUrl;
  }
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
export async function submitPairingCode(
  forcedCode?: string,
  apiBaseUrlHint?: string | null,
): Promise<void> {
  const code = (forcedCode ?? pairingCodeInput.value).trim();
  const cfg = await window.agent.getConfig();
  const apiBaseUrl = await resolvePairingApiBaseUrl(apiBaseUrlHint);
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
  let apiHint: string | null = null;
  try {
    apiHint = await window.agent.consumePendingApiBaseUrl();
  } catch {
    apiHint = null;
  }
  await submitPairingCode(pending, apiHint);
}

/** Handle live `agent:deep-link` while the agent is already running (M-266). */
export async function handlePairingDeepLink(payload: {
  apiBaseUrl: string | null;
  pairCode: string | null;
}): Promise<void> {
  if (!payload.pairCode?.trim()) return;
  pairingCodeInput.value = payload.pairCode;
  pairingStatusEl.textContent = "Код с дашборда — подключаем…";
  await submitPairingCode(payload.pairCode, payload.apiBaseUrl);
}

pairingSubmitBtn.addEventListener("click", () => void submitPairingCode());
pairingCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitPairingCode();
});

window.agent.onDeepLink((payload) => {
  void handlePairingDeepLink(payload);
});

void initPairingFromDeepLink();
