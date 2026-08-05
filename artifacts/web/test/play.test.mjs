import { test } from "node:test";
import assert from "node:assert/strict";

const {
  LZT_PER_USDT,
  parseBlockMinutesParam,
  resolveGameBrowserHostUrl,
  resolveCoverImageUrl,
  isTestBrowserSession,
  computeRatePerMinLzt,
  computeSourceBalance,
  computeMinutesAffordable,
  needsSessionTopUp,
  sanitizeClipGameSlug,
  buildClipFilename,
  getControlRejectMessage,
  CONNECTING_OVERLAY_MESSAGE,
  INVITE_CORRUPTED_MESSAGE,
  RECONNECTING_OVERLAY_SUBMESSAGE,
  buildPlayerSignalWsUrl,
  getConnectionBadgeLabel,
  computeWalletBalanceForSession,
  isTouchCapableDevice,
  shouldShowConnectingOverlay,
  shouldAutoClaimFromSession,
} = await import("../src/pages/play-helpers.ts");

test("LZT_PER_USDT is stable", () => {
  assert.equal(LZT_PER_USDT, 200);
});

test("parseBlockMinutesParam accepts 10, 15, 25 and rejects other values", () => {
  assert.equal(parseBlockMinutesParam("?block=15"), 15);
  assert.equal(parseBlockMinutesParam("?block=10&x=1"), 10);
  assert.equal(parseBlockMinutesParam("?block=25"), 25);
  assert.equal(parseBlockMinutesParam("?block=20"), undefined);
  assert.equal(parseBlockMinutesParam(""), undefined);
  assert.equal(parseBlockMinutesParam("?block=NaN"), undefined);
});

test("resolveGameBrowserHostUrl handles absolute and relative paths", () => {
  assert.equal(
    resolveGameBrowserHostUrl("https://game.example/play", "/"),
    "https://game.example/play",
  );
  assert.equal(resolveGameBrowserHostUrl("/games/demo", "https://app/"), "https://app/games/demo");
  assert.equal(resolveGameBrowserHostUrl("games/foo", "/app/"), "/app/games/foo");
});

test("resolveCoverImageUrl handles absolute and relative paths", () => {
  assert.equal(resolveCoverImageUrl("https://cdn/img.png", "/"), "https://cdn/img.png");
  assert.equal(resolveCoverImageUrl("/covers/a.png", "https://app/"), "https://app/covers/a.png");
  assert.equal(resolveCoverImageUrl(null, "/"), null);
});

test("isTestBrowserSession requires test flag and browser host URL", () => {
  assert.equal(
    isTestBrowserSession({ isTest: true, gameBrowserHostUrl: "https://x" }),
    true,
  );
  assert.equal(
    isTestBrowserSession({ is_test: true, gameBrowserHostUrl: "/games/x" }),
    true,
  );
  assert.equal(isTestBrowserSession({ isTest: true }), false);
  assert.equal(isTestBrowserSession({ gameBrowserHostUrl: "https://x" }), false);
  assert.equal(isTestBrowserSession(null), false);
});

test("computeRatePerMinLzt converts USD rate to LZT", () => {
  assert.equal(computeRatePerMinLzt(0.04), 8);
  assert.equal(computeRatePerMinLzt(0.1), 20);
});

test("computeSourceBalance respects payment source", () => {
  assert.equal(computeSourceBalance("auto", 100, 50), 150);
  assert.equal(computeSourceBalance("green", 100, 50), 100);
  assert.equal(computeSourceBalance("blue", 100, 50), 50);
});

test("computeMinutesAffordable and needsSessionTopUp", () => {
  assert.equal(computeMinutesAffordable(80, 8), 10);
  assert.equal(computeMinutesAffordable(5, 8), 0);
  assert.equal(needsSessionTopUp(5, 8, false), true);
  assert.equal(needsSessionTopUp(5, 8, true), false);
  assert.equal(needsSessionTopUp(100, 0, false), false);
});

test("sanitizeClipGameSlug and buildClipFilename", () => {
  assert.equal(sanitizeClipGameSlug("Counter-Strike 2!", "fallback"), "counter-strike-2-");
  assert.equal(
    buildClipFilename("My Game", "app", new Date("2026-01-15T12:30:45.000Z").getTime()),
    "clip-my-game-2026-01-15T12-30-45.webm",
  );
});

test("getControlRejectMessage maps known reasons to Russian text", () => {
  assert.equal(
    getControlRejectMessage("host_busy"),
    "Хост сейчас занят с другим игроком. Попробуй позже.",
  );
  assert.equal(
    getControlRejectMessage("game_unavailable"),
    "Игра временно недоступна на этом хосте.",
  );
  assert.equal(
    getControlRejectMessage("host_offline"),
    "Хост сейчас офлайн. Попробуй позже или выбери другого.",
  );
  assert.equal(
    getControlRejectMessage("custom"),
    "Хост не может принять соединение. Попробуй позже.",
  );
});

test("U-26 player overlay messages avoid WebRTC/ICE jargon", () => {
  const banned = /WebRTC|ICE|токен игрока/i;
  assert.equal(banned.test(INVITE_CORRUPTED_MESSAGE), false);
  assert.equal(banned.test(CONNECTING_OVERLAY_MESSAGE), false);
  assert.equal(banned.test(RECONNECTING_OVERLAY_SUBMESSAGE), false);
  assert.equal(banned.test(getControlRejectMessage("unknown_reason")), false);
});

test("buildPlayerSignalWsUrl uses ticket or legacy token path", () => {
  assert.equal(
    buildPlayerSignalWsUrl({
      pageProtocol: "https:",
      host: "play.example.com",
      baseUrl: "/",
      wsTicket: "t+/=",
      sessionId: "sess/id",
      playerToken: "ignored",
    }),
    "wss://play.example.com/api/signal?role=player&wsTicket=t%2B%2F%3D&sessionId=sess%2Fid",
  );
  assert.equal(
    buildPlayerSignalWsUrl({
      pageProtocol: "http:",
      host: "localhost:5173",
      baseUrl: "/app/",
      playerToken: "tok",
      playerWalletToken: "wallet+",
    }),
    "ws://localhost:5173/app/api/signal?role=player&playerToken=tok&playerWalletToken=wallet%2B",
  );
});

test("getConnectionBadgeLabel covers reconnecting and connection states", () => {
  assert.equal(getConnectionBadgeLabel("connected", true), "ПЕРЕПОДКЛЮЧЕНИЕ...");
  assert.equal(getConnectionBadgeLabel("connected", false), "ПОДКЛЮЧЕНО");
  assert.equal(getConnectionBadgeLabel("failed", false), "ОШИБКА СВЯЗИ");
  assert.equal(getConnectionBadgeLabel("unknown", false), "ПОДКЛЮЧЕНИЕ");
});

test("computeWalletBalanceForSession uses payment source from session", () => {
  const wallet = { withdrawableBalanceLzt: 100, internalBalanceLzt: 40 };
  assert.equal(computeWalletBalanceForSession(wallet, "auto"), 140);
  assert.equal(computeWalletBalanceForSession(wallet, "green"), 100);
  assert.equal(computeWalletBalanceForSession(wallet, "blue"), 40);
  assert.equal(computeWalletBalanceForSession(null, "auto"), 0);
});

test("isTouchCapableDevice (U-25) enables overlays when maxTouchPoints > 0", () => {
  assert.equal(isTouchCapableDevice(0), false);
  assert.equal(isTouchCapableDevice(1), true);
  assert.equal(isTouchCapableDevice(5), true);
});

test("shouldShowConnectingOverlay hides spinner for ended sessions", () => {
  assert.equal(shouldShowConnectingOverlay(true, "active"), true);
  assert.equal(shouldShowConnectingOverlay(true, "pending"), true);
  assert.equal(shouldShowConnectingOverlay(true, "ended"), false);
  assert.equal(shouldShowConnectingOverlay(false, "active"), false);
});

test("shouldAutoClaimFromSession requires matching wallet owner", () => {
  assert.equal(shouldAutoClaimFromSession("p1", "p1"), true);
  assert.equal(shouldAutoClaimFromSession("p1", "p2"), false);
  assert.equal(shouldAutoClaimFromSession(null, "p1"), false);
  assert.equal(shouldAutoClaimFromSession("p1", null), false);
});
