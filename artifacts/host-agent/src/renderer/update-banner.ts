/** U-16: плашка «Обновление готово» + одна кнопка установки (без повторного ZIP). */
export function initUpdateBanner(): void {
  const banner = document.getElementById("update-ready-banner");
  const btn = document.getElementById("update-install-btn");
  if (!banner || !btn) return;

  window.agent.onUpdateReady(() => {
    banner.hidden = false;
  });

  btn.addEventListener("click", () => {
    void window.agent.installUpdate();
  });
}
