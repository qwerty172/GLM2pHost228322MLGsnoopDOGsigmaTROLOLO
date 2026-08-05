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
import { initUpdateBanner } from "./update-banner.js";

void loadFormFromConfig().then(async (cfg) => {
  window.agent.onInputPanic(() => {
    log("[panic] Ввод заблокирован — завершаем сессию");
    window.agent.killApp();
    teardown("Паника: ввод заблокирован хостом");
  });
  log("Интерфейс агента загружен.");
  void initAgentKey();
  initUpdateBanner();
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
