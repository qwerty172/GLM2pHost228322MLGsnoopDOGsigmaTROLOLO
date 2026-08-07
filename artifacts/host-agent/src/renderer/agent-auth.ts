import { session } from "./state.js";
import { log } from "./ui.js";

export const agentKeyStatusEl = document.getElementById("agent-key-status") as HTMLParagraphElement;
const bindKeyBtn = document.getElementById("bind-agent-key") as HTMLButtonElement;
const agentLoginBtn = document.getElementById("agent-login") as HTMLButtonElement;
const updatePcSpecsBtn = document.getElementById("update-pc-specs") as HTMLButtonElement;
const pcSpecsInfoEl = document.getElementById("pc-specs-info") as HTMLParagraphElement;
const agentKeyCard = document.getElementById("agent-key-card") as HTMLElement | null;
const connectionTroubleshoot = document.getElementById(
  "connection-troubleshoot",
) as HTMLDetailsElement | null;

/** Whether the host account already has this agent's public key (U-06). */
export async function fetchAgentKeyBound(
  apiBaseUrl: string,
  hostToken: string,
): Promise<boolean> {
  try {
    const url = `${apiBaseUrl.replace(/\/$/, "")}/api/hosts/${encodeURIComponent(hostToken)}`;
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const data = (await resp.json()) as { agentKeyBound?: boolean };
    return !!data.agentKeyBound;
  } catch {
    return false;
  }
}

/** Primary bind path after U-02: saved hostToken from ZIP config (U-06). */
export async function tryAutoBindAgentKey(cfg: {
  hostToken: string;
  apiBaseUrl: string;
}): Promise<boolean> {
  if (!cfg.hostToken?.trim() || !cfg.apiBaseUrl?.trim()) return false;
  if (await fetchAgentKeyBound(cfg.apiBaseUrl, cfg.hostToken)) return true;
  const result = await window.agent.bindAgentKey(cfg.hostToken, cfg.apiBaseUrl);
  if (result.ok) {
    log("Ключ агента привязан автоматически (токен из ZIP).");
    return true;
  }
  log(`Автопривязка не удалась: ${result.error ?? "неизвестная ошибка"}`);
  return false;
}

export function setConnectionTroubleshootVisible(visible: boolean): void {
  if (!connectionTroubleshoot) return;
  if (visible) {
    connectionTroubleshoot.hidden = false;
  } else {
    connectionTroubleshoot.hidden = true;
    connectionTroubleshoot.open = false;
  }
}

function applyBoundAgentKeyUi(bound: boolean, hasCredentials: boolean): void {
  if (bound && hasCredentials) {
    agentKeyStatusEl.textContent = "Ключ привязан к аккаунту.";
    agentKeyCard?.setAttribute("hidden", "");
    setConnectionTroubleshootVisible(false);
    return;
  }
  agentKeyCard?.removeAttribute("hidden");
  if (!hasCredentials) {
    agentKeyStatusEl.textContent =
      "Скачай агент с дашборда — токен подставится сам. Если не вышло — раздел ниже.";
    setConnectionTroubleshootVisible(true);
    connectionTroubleshoot!.open = true;
    return;
  }
  agentKeyStatusEl.textContent = "Привязываем ключ к аккаунту…";
  setConnectionTroubleshootVisible(true);
}

export async function initAgentKey(): Promise<void> {
  try {
    const pubkey = await window.agent.getAgentPubkey();
    if (!pubkey) {
      agentKeyStatusEl.textContent = "Ключ не найден. Перезапустите агент.";
    }
  } catch {
    agentKeyStatusEl.textContent = "Ошибка загрузки ключа.";
  }

  try {
    const specs = await window.agent.getPcSpecs();
    pcSpecsInfoEl.textContent = `CPU: ${specs.cpu} · GPU: ${specs.gpu} · RAM: ${specs.ramGb} GB`;
  } catch {
    pcSpecsInfoEl.textContent = "";
  }

  bindKeyBtn.disabled = false;
  agentLoginBtn.disabled = false;
  updatePcSpecsBtn.disabled = false;

  let cfg;
  try {
    cfg = await window.agent.getConfig();
  } catch {
    cfg = undefined;
  }

  const bindCodeInput = document.getElementById("agentBindCode") as HTMLInputElement | null;
  const apiBaseUrlInput = document.getElementById("apiBaseUrl") as HTMLInputElement | null;
  if (cfg && bindCodeInput && !bindCodeInput.value.trim()) {
    try {
      const pendingApi = await window.agent.consumePendingApiBaseUrl();
      if (pendingApi) {
        if (apiBaseUrlInput) apiBaseUrlInput.value = pendingApi;
        if (!cfg.apiBaseUrl?.trim()) {
          cfg = await window.agent.setConfig({ ...cfg, apiBaseUrl: pendingApi });
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const pending = await window.agent.consumePendingBindCode();
      if (pending) bindCodeInput.value = pending;
    } catch {
      /* ignore */
    }
    if (!bindCodeInput.value.trim()) {
      const hash = window.location.hash.match(/[#&]bind=([^&]+)/);
      if (hash?.[1]) bindCodeInput.value = decodeURIComponent(hash[1]);
    }
  }

  if (!cfg) {
    try {
      cfg = await window.agent.getConfig();
    } catch {
      cfg = { hostToken: "", apiBaseUrl: "" };
    }
  }

  const hasCredentials = Boolean(cfg.hostToken?.trim() && cfg.apiBaseUrl?.trim());
  let bound = false;
  const pendingBindCode = bindCodeInput?.value.trim() ?? "";
  if (!hasCredentials && pendingBindCode && cfg.apiBaseUrl?.trim()) {
    const bindOnly = await window.agent.bindAgentKey("", cfg.apiBaseUrl, pendingBindCode);
    if (bindOnly.ok) {
      bound = true;
      if (bindCodeInput) bindCodeInput.value = "";
      log("Ключ агента привязан по коду из дашборда.");
    }
  }
  if (hasCredentials) {
    bound = await tryAutoBindAgentKey(cfg);
    if (!bound && bindCodeInput?.value.trim()) {
      const manual = await window.agent.bindAgentKey(
        cfg.hostToken,
        cfg.apiBaseUrl,
        bindCodeInput.value.trim(),
      );
      if (manual.ok) {
        bound = true;
        bindCodeInput.value = "";
        log("Ключ агента привязан по коду из дашборда.");
      }
    }
    if (bound) {
      void runUploadSpeedtest(cfg.apiBaseUrl, cfg.hostToken);
    }
  }

  applyBoundAgentKeyUi(bound, hasCredentials);
}

bindKeyBtn.addEventListener("click", async () => {
  const cfg = session.currentConfig ?? (await window.agent.getConfig());
  const bindCodeInput = document.getElementById("agentBindCode") as HTMLInputElement | null;
  const bindCode = bindCodeInput?.value.trim() ?? "";
  if (!cfg.apiBaseUrl) {
    log("Привязка ключа: сначала сохрани URL платформы.");
    return;
  }
  if (!bindCode && !cfg.hostToken) {
    log("Привязка ключа: нужен код привязки из дашборда или токен хоста.");
    return;
  }
  bindKeyBtn.disabled = true;
  agentKeyStatusEl.textContent = "Привязываем ключ…";
  const result = await window.agent.bindAgentKey(
    cfg.hostToken,
    cfg.apiBaseUrl,
    bindCode || undefined,
  );
  bindKeyBtn.disabled = false;
  if (result.ok) {
    agentKeyStatusEl.textContent = "Ключ успешно привязан к аккаунту.";
    log("Ключ агента привязан к аккаунту.");
    if (bindCodeInput) bindCodeInput.value = "";
    applyBoundAgentKeyUi(true, true);
  } else {
    agentKeyStatusEl.textContent = `Ошибка привязки: ${result.error ?? "неизвестная ошибка"}`;
    log(`Ошибка привязки ключа: ${result.error ?? "неизвестно"}`);
  }
});

agentLoginBtn.addEventListener("click", async () => {
  const cfg = session.currentConfig ?? (await window.agent.getConfig());
  if (!cfg.apiBaseUrl) {
    log("Вход: сначала сохрани URL платформы.");
    return;
  }
  agentLoginBtn.disabled = true;
  agentKeyStatusEl.textContent = "Авторизуемся…";
  const result = await window.agent.agentLogin(cfg.apiBaseUrl);
  agentLoginBtn.disabled = false;
  if (result.ok) {
    agentKeyStatusEl.textContent = "Браузер открыт — дашборд загружается.";
    log("Открыт браузер с дашбордом (agent login).");
  } else {
    agentKeyStatusEl.textContent = `Ошибка входа: ${result.error ?? "неизвестная ошибка"}`;
    log(`Ошибка входа агента: ${result.error ?? "неизвестно"}`);
  }
});

async function runUploadSpeedtest(apiBaseUrl: string, hostToken: string): Promise<void> {
  try {
    const MB = 1 * 1024 * 1024;
    const payload = new Uint8Array(MB);
    crypto.getRandomValues(payload.slice(0, Math.min(65536, MB)));
    const resp = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/hosts/me/speedtest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(MB),
        "X-Host-Token": hostToken,
      },
      body: payload,
    });
    if (resp.ok) {
      const data = (await resp.json()) as { uploadMbps?: number };
      if (data.uploadMbps != null) {
        log(`Скорость аплоада: ${data.uploadMbps} Мбит/с`);
      }
    }
  } catch {
    // Non-fatal — don't block the agent on speedtest failures
  }
}

updatePcSpecsBtn.addEventListener("click", async () => {
  const cfg = session.currentConfig ?? (await window.agent.getConfig());
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    log("Обновление характеристик: сначала сохрани токен хоста и URL платформы.");
    return;
  }
  updatePcSpecsBtn.disabled = true;
  log("Измеряем скорость аплоада…");
  await runUploadSpeedtest(cfg.apiBaseUrl, cfg.hostToken);
  const result = await window.agent.updatePcSpecs(cfg.hostToken, cfg.apiBaseUrl);
  updatePcSpecsBtn.disabled = false;
  if (result.ok && result.pcSpecs) {
    const s = result.pcSpecs;
    pcSpecsInfoEl.textContent = `CPU: ${s.cpu} · GPU: ${s.gpu} · RAM: ${s.ramGb} GB`;
    log(`PC-спецификации обновлены. GPU: ${s.gpu}, RAM: ${s.ramGb}GB`);
  } else {
    log(`Ошибка обновления характеристик ПК: ${result.error ?? "неизвестно"}`);
  }
});