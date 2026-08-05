import { connectBtn, confirmGameBtn, cancelGamePickerBtn, disconnectBtn, selectedGameSelect, gamePickerCard } from "./dom.js";
import { readForm } from "./config.js";
import { session } from "./state.js";
import { log, setStatus } from "./ui.js";
import { showHostGamePicker } from "./library.js";
import { connect, teardown } from "./session.js";

async function ensureAgentVersionSupported(apiBaseUrl: string): Promise<boolean> {
  try {
    const result = await window.agent.checkVersionPolicy(apiBaseUrl);
    if (!result.ok) {
      setStatus("error", result.error ?? "Версия агента устарела");
      log(result.error ?? "Версия агента устарела");
      return false;
    }
    return true;
  } catch (err) {
    log(`Проверка версии агента не удалась: ${String(err)}`);
    return true;
  }
}

connectBtn.addEventListener("click", async () => {
  // One-session-at-a-time guard.
  if (session.currentSessionId) {
    log("Уже онлайн — сначала отключись, чтобы начать новую сессию.");
    return;
  }

  const cfg = await window.agent.setConfig(readForm());
  if (!cfg.hostToken || !cfg.apiBaseUrl) {
    setStatus("error", "Нужны токен хоста и URL платформы (или код привязки)");
    return;
  }

  if (!(await ensureAgentVersionSupported(cfg.apiBaseUrl))) {
    return;
  }

  const enabledLibGames = session.libraryEntries.filter(
    (e) => e.enabled && (e.boundUrl || e.localAvailable),
  );

  const libCount = enabledLibGames.length;

  // One game → auto. Multiple → picker. Empty → legacy path (no auto Steam modal).
  if (libCount === 1) {
    const only = enabledLibGames[0]!;
    log(`Автовыбор игры: ${only.game.title}`);
    session.currentGameId = only.gameId;
    await connect(cfg, only.gameId);
    return;
  }

  if (libCount > 1) {
    await showHostGamePicker();
    return;
  }

  // No library entries — legacy single-game binding (Steam scan is manual via button).
  session.currentGameId = null;
  await connect(cfg, null);
});

confirmGameBtn.addEventListener("click", async () => {
  const gameId = selectedGameSelect.value;
  if (!gameId) {
    log("Выбери игру из списка.");
    return;
  }
  gamePickerCard.hidden = true;
  connectBtn.disabled = false;
  const cfg = await window.agent.setConfig(readForm());
  if (!(await ensureAgentVersionSupported(cfg.apiBaseUrl))) {
    return;
  }
  session.currentGameId = gameId;
  await connect(cfg, gameId);
});

cancelGamePickerBtn.addEventListener("click", () => {
  gamePickerCard.hidden = true;
  connectBtn.disabled = false;
});

disconnectBtn.addEventListener("click", () => {
  teardown("Отключено хостом");
});