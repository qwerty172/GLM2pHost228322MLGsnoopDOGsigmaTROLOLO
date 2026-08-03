import { inputGuardBadge } from "./dom.js";
import { session } from "./state.js";

export function updateInputGuardBadge(
  st: {
    foregroundAllowed: boolean;
    inputBlocked: boolean;
    browserGuard: boolean;
    active: boolean;
  },
): void {
  if (!inputGuardBadge) return;
  if (!st.active && !session.isStreaming) {
    inputGuardBadge.hidden = true;
    return;
  }
  inputGuardBadge.hidden = false;
  if (st.inputBlocked) {
    inputGuardBadge.textContent = "Ввод заблокирован — паника";
    inputGuardBadge.style.background = "rgba(239,68,68,0.15)";
    inputGuardBadge.style.color = "#fca5a5";
    inputGuardBadge.style.borderColor = "rgba(239,68,68,0.35)";
  } else if (st.browserGuard) {
    if (st.foregroundAllowed) {
      inputGuardBadge.textContent = "Ввод активен (браузер)";
      inputGuardBadge.style.background = "rgba(34,197,94,0.15)";
      inputGuardBadge.style.color = "#86efac";
      inputGuardBadge.style.borderColor = "rgba(34,197,94,0.35)";
    } else {
      inputGuardBadge.textContent = "Браузер не в фокусе — ввод заблокирован";
      inputGuardBadge.style.background = "rgba(234,179,8,0.15)";
      inputGuardBadge.style.color = "#fde047";
      inputGuardBadge.style.borderColor = "rgba(234,179,8,0.35)";
    }
  } else if (st.foregroundAllowed) {
    inputGuardBadge.textContent = "Ввод активен";
    inputGuardBadge.style.background = "rgba(34,197,94,0.15)";
    inputGuardBadge.style.color = "#86efac";
    inputGuardBadge.style.borderColor = "rgba(34,197,94,0.35)";
  } else {
    inputGuardBadge.textContent = "Игра не в фокусе — ввод заблокирован";
    inputGuardBadge.style.background = "rgba(234,179,8,0.15)";
    inputGuardBadge.style.color = "#fde047";
    inputGuardBadge.style.borderColor = "rgba(234,179,8,0.35)";
  }
}

export function startGuardPolling(): void {
  stopGuardPolling();
  session.guardPollTimer = setInterval(() => {
    void window.agent.getInputGuardStatus().then(updateInputGuardBadge).catch(() => {});
  }, 500);
}

export function stopGuardPolling(): void {
  if (session.guardPollTimer) {
    clearInterval(session.guardPollTimer);
    session.guardPollTimer = null;
  }
  if (inputGuardBadge) inputGuardBadge.hidden = true;
}