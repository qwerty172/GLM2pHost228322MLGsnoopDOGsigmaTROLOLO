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

async function submitPairingCode(): Promise<void> {
  const code = pairingCodeInput.value.trim();
  const cfg = await window.agent.getConfig();
  const apiBaseUrl = ($("apiBaseUrl") as HTMLInputElement).value.trim() || cfg.apiBaseUrl;
  if (!/^\d{6}$/.test(code)) {
    pairingStatusEl.textContent = "Введи 6 цифр с сайта";
    return;
  }
  if (!apiBaseUrl) {
    pairingStatusEl.textContent = "Сначала укажи Platform URL в расширенных настройках";
    return;
  }
  pairingSubmitBtn.disabled = true;
  pairingStatusEl.textContent = "Подключаем…";
  try {
    const resp = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/auth/agent-pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
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
    pairingStatusEl.textContent = `Подключено: ${data.displayName ?? "хост"}`;
    if (pairingCard) pairingCard.hidden = true;
    if (data.displayName) showSigninBanner(data.displayName, apiBaseUrl);
    log(`Вход по коду выполнен: ${data.displayName ?? data.hostToken.slice(0, 8)}…`);
    await loadLibrary(newCfg);
    startLibraryPolling(newCfg);
    showAutoQuotaCard();
  } catch {
    pairingStatusEl.textContent = "Ошибка сети — проверь Platform URL";
  } finally {
    pairingSubmitBtn.disabled = false;
  }
}

pairingSubmitBtn.addEventListener("click", () => void submitPairingCode());
pairingCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitPairingCode();
});