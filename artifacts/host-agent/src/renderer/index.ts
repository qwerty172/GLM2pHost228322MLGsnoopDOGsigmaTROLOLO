import "./config.js";
import "./input-guard.js";
import "./input-mapping.js";
import "./capture.js";
import "./preview.js";
import "./session.js";
import "./library.js";
import "./steam.js";
import "./steam-auto-host.js";
import "./auth.js";
import "./connect-events.js";
import "./quota.js";
import "./agent-auth.js";
import "./pairing.js";

import { loadFormFromConfig } from "./config.js";
import { initAgentKey, setConnectionTroubleshootVisible } from "./agent-auth.js";
import { loadLibrary, startLibraryPolling } from "./library.js";
import { showSigninBanner, validateHostToken } from "./auth.js";
import { showAutoQuotaCard, applyQuotaStatus, autoQuotaCheckbox } from "./quota.js";
import { runSteamScan } from "./steam.js";
import { teardown } from "./session.js";
import { log } from "./ui.js";

void loadFormFromConfig().then(async (cfg) => {
  window.agent.onInputPanic(() => {
    log("[panic] Ввод заблокирован — завершаем сессию");
    window.agent.killApp();
    teardown("Паника: ввод заблокирован хостом");
  });
  log("Интерфейс агента загружен.");
  void initAgentKey();
  if (typeof (window.agent as { onUpdateReady?: (cb: () => void) => () => void }).onUpdateReady === "function") {
    (window.agent as unknown as { onUpdateReady: (cb: () => void) => () => void }).onUpdateReady(() => {
      const banner = document.createElement("div");
      banner.style.cssText =
        "position:fixed;bottom:16px;right:16px;z-index:9999;padding:12px 16px;" +
        "background:#065f46;color:#fff;border-radius:8px;font-size:13px;cursor:pointer;" +
        "box-shadow:0 4px 12px rgba(0,0,0,0.4);";
      banner.textContent = "Обновление готово — нажми, чтобы перезапустить";
      banner.onclick = () => {
        void (window.agent as unknown as { installUpdate?: () => Promise<void> }).installUpdate?.();
      };
      document.body.appendChild(banner);
    });
  }
  void window.agent.getInjectorStatus().then((st) => {
    if (!st.ok && st.platform === "win32") {
      log(`⚠ ${st.error}`);
    }
  }).catch(() => { /* older main without the handler */ });
  if (cfg.hostToken && cfg.apiBaseUrl) {
    log("Сохранённые учётные данные найдены. Загружаем библиотеку…");

    const displayName = await validateHostToken(cfg.apiBaseUrl, cfg.hostToken);
    if (displayName) {
      showSigninBanner(displayName, cfg.apiBaseUrl);
      log(`Вход выполнен как: ${displayName}`);
      setConnectionTroubleshootVisible(false);
    } else {
      log("Не удалось проверить токен. Введи заново или проверь URL платформы.");
    }

    await loadLibrary(cfg);
    startLibraryPolling(cfg);
    showAutoQuotaCard();
    autoQuotaCheckbox.checked = !!cfg.autoQuotaEnabled;
    window.agent.quotaGetState().then((ev) => {
      if (cfg.autoQuotaEnabled) {
        applyQuotaStatus(ev);
      } else {
        applyQuotaStatus({ statusText: "Автоподбор выключен.", hasAttached: false });
      }
    }).catch(() => {
      applyQuotaStatus({ statusText: cfg.autoQuotaEnabled ? "Ищу подходящие квоты…" : "Автоподбор выключен.", hasAttached: false });
    });
    if (window.agent.platform === "win32") {
      void runSteamScan({ openModal: false });
    }
  } else {
    log("Первый запуск — скачай агент с дашборда (ZIP с токеном). Если не вышло — «Если не подключается» ниже.");
    setConnectionTroubleshootVisible(true);
  }
});
