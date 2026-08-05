import { session } from "./state.js";
import { log } from "./ui.js";

export const agentKeyStatusEl = document.getElementById("agent-key-status") as HTMLParagraphElement;
const bindKeyBtn = document.getElementById("bind-agent-key") as HTMLButtonElement;
const agentLoginBtn = document.getElementById("agent-login") as HTMLButtonElement;
const updatePcSpecsBtn = document.getElementById("update-pc-specs") as HTMLButtonElement;
const pcSpecsInfoEl = document.getElementById("pc-specs-info") as HTMLParagraphElement;

export async function initAgentKey(): Promise<void> {
  try {
    const pubkey = await window.agent.getAgentPubkey();
    if (pubkey) {
      agentKeyStatusEl.textContent = `Ключ: ${pubkey.slice(0, 16)}…${pubkey.slice(-8)} (готов к привязке)`;
    } else {
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

  const bindCodeInput = document.getElementById("agentBindCode") as HTMLInputElement | null;
  if (bindCodeInput && !bindCodeInput.value.trim()) {
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

  // Run upload speed test silently in the background on every startup so that
  // pcSpecs.uploadMbps is always up-to-date for quota matching.
  try {
    const cfg = await window.agent.getConfig();
    if (cfg.hostToken && cfg.apiBaseUrl) {
      void runUploadSpeedtest(cfg.apiBaseUrl, cfg.hostToken);
    }
  } catch {
    // Non-fatal — do not block startup
  }
}

bindKeyBtn.addEventListener("click", async () => {
  const cfg = session.currentConfig ?? (await window.agent.getConfig());
  const bindCodeInput = document.getElementById("agentBindCode") as HTMLInputElement | null;
  const bindCode = bindCodeInput?.value.trim() ?? "";
  if (!bindCode) {
    log("Bind key: нужен код привязки из дашборда (кнопка «Получить код»).");
    return;
  }
  if (!cfg.apiBaseUrl) {
    log("Bind key: сначала сохрани Platform URL.");
    return;
  }
  bindKeyBtn.disabled = true;
  agentKeyStatusEl.textContent = "Привязываем ключ…";
  const result = await window.agent.bindAgentKey(
    cfg.hostToken,
    cfg.apiBaseUrl,
    bindCode,
  );
  bindKeyBtn.disabled = false;
  if (result.ok) {
    agentKeyStatusEl.textContent = "Ключ успешно привязан к аккаунту.";
    log("Ключ агента привязан к аккаунту.");
    if (bindCodeInput) bindCodeInput.value = "";
  } else {
    agentKeyStatusEl.textContent = `Ошибка привязки: ${result.error ?? "Unknown error"}`;
    log(`Bind key error: ${result.error ?? "Unknown"}`);
  }
});

agentLoginBtn.addEventListener("click", async () => {
  const cfg = session.currentConfig ?? (await window.agent.getConfig());
  if (!cfg.apiBaseUrl) {
    log("Login: сначала сохрани Platform URL.");
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
    agentKeyStatusEl.textContent = `Ошибка входа: ${result.error ?? "Unknown error"}`;
    log(`Agent login error: ${result.error ?? "Unknown"}`);
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
    log("Update specs: сначала сохрани Host Token и Platform URL.");
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
    log(`Update PC specs error: ${result.error ?? "Unknown"}`);
  }
});