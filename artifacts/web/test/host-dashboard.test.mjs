import { test } from "node:test";
import assert from "node:assert/strict";

const {
  HEARTBEAT_FRESH_MS,
  HOST_TOKEN_STORAGE_PREFIX,
  BROWSER_HOST_URL_STORAGE_PREFIX,
  HOST_AGENT_DOWNLOADED_STORAGE_KEY,
  HOST_AGENT_EXE_DOWNLOAD_URL,
  AUDIO_MODE_LABELS,
  EVENT_LEVEL_STYLES,
  getAgentDiagnosis,
  resolveHeartbeatState,
  isAgentOnline,
  isAgentOnceSeen,
  agentNeedsAdvancedPanel,
  getAgentEventLevelStyle,
  buildPlayerPlayLink,
  resolveTestSessionOpenTarget,
  buildTestSessionFullUrl,
  buildBrowserHostStorageKeys,
  computeQuickStartSteps,
  resolveGuidedNextAction,
  hasCompletedFirstStream,
  ONBOARDING_TOTAL_STEPS,
  readHostAgentDownloaded,
  markHostAgentDownloaded,
  evaluateHostReadiness,
  compareAgentVersions,
  evaluateAgentVersionCompatibility,
  isAgentVersionBlockingStream,
} = await import("../src/pages/host/dashboard-helpers.ts");

const offlineAgent = { status: "offline" };
const onlineAgent = {
  status: "online",
  version: "1.2.3",
  audioMode: "standard",
  port: 18080,
};
const freshHeartbeat = { status: "fresh", lastSeenAt: "2026-01-01T12:00:00.000Z" };
const staleHeartbeat = { status: "stale", lastSeenAt: "2026-01-01T10:00:00.000Z" };

test("HEARTBEAT_FRESH_MS and storage prefixes are stable", () => {
  assert.equal(HEARTBEAT_FRESH_MS, 45_000);
  assert.equal(HOST_TOKEN_STORAGE_PREFIX, "streamline.browserHostToken:");
  assert.equal(BROWSER_HOST_URL_STORAGE_PREFIX, "streamline.browserHostUrl:");
  assert.equal(HOST_AGENT_DOWNLOADED_STORAGE_KEY, "streamline.hostAgentDownloaded");
  assert.equal(HOST_AGENT_EXE_DOWNLOAD_URL, "/api/downloads/host-agent.exe");
});

test("AUDIO_MODE_LABELS maps all audio modes to Russian labels", () => {
  assert.equal(AUDIO_MODE_LABELS.off, "Без звука");
  assert.equal(AUDIO_MODE_LABELS.voice, "Голос ~12kbps");
  assert.equal(AUDIO_MODE_LABELS.standard, "Стандарт ~32kbps");
  assert.equal(AUDIO_MODE_LABELS.quality, "Качество ~64kbps");
});

test("resolveHeartbeatState returns unknown when host is not loaded", () => {
  assert.deepEqual(resolveHeartbeatState(undefined, false), { status: "unknown" });
});

test("resolveHeartbeatState classifies never, fresh and stale heartbeats", () => {
  const now = new Date("2026-01-01T12:00:00.000Z").getTime();
  assert.deepEqual(resolveHeartbeatState(null, true, now), { status: "never" });
  assert.deepEqual(
    resolveHeartbeatState("2026-01-01T11:59:30.000Z", true, now),
    { status: "fresh", lastSeenAt: "2026-01-01T11:59:30.000Z" },
  );
  assert.deepEqual(
    resolveHeartbeatState("2026-01-01T11:00:00.000Z", true, now),
    { status: "stale", lastSeenAt: "2026-01-01T11:00:00.000Z" },
  );
});

test("isAgentOnline treats local ping or fresh heartbeat as online", () => {
  assert.equal(isAgentOnline(onlineAgent, { status: "never" }), true);
  assert.equal(isAgentOnline(offlineAgent, freshHeartbeat), true);
  assert.equal(isAgentOnline(offlineAgent, { status: "never" }), false);
});

test("agentNeedsAdvancedPanel flags offline, stale and never heartbeats", () => {
  assert.equal(agentNeedsAdvancedPanel(offlineAgent, { status: "never" }), true);
  assert.equal(agentNeedsAdvancedPanel(offlineAgent, staleHeartbeat), true);
  assert.equal(agentNeedsAdvancedPanel(onlineAgent, freshHeartbeat), false);
});

test("getAgentDiagnosis suggests remote agent when heartbeat is fresh but ping fails", () => {
  const rows = getAgentDiagnosis(offlineAgent, freshHeartbeat);
  assert.ok(rows.some((r) => r.likelyCause.includes("другом компьютере")));
});

test("getAgentDiagnosis suggests restart when heartbeat is stale", () => {
  const rows = getAgentDiagnosis(offlineAgent, staleHeartbeat);
  assert.ok(rows.some((r) => r.symptom.includes("перестал отвечать")));
});

test("getAgentDiagnosis suggests first-time setup when agent never connected", () => {
  const rows = getAgentDiagnosis(offlineAgent, { status: "never" });
  assert.ok(rows.some((r) => r.symptom.includes("ни разу")));
  assert.ok(rows.some((r) => r.symptom.includes("18080")));
});

test("getAgentEventLevelStyle falls back to info for unknown levels", () => {
  assert.equal(getAgentEventLevelStyle("fatal").label, "FATAL");
  assert.equal(getAgentEventLevelStyle("error").label, "ERROR");
  assert.deepEqual(getAgentEventLevelStyle("custom"), EVENT_LEVEL_STYLES.info);
});

test("buildPlayerPlayLink uses invite code or player token", () => {
  assert.equal(
    buildPlayerPlayLink({
      origin: "https://play.example.com",
      baseUrl: "/",
      playerToken: "tok",
      inviteCode: "ABC123",
    }),
    "https://play.example.com/play/i/ABC123",
  );
  assert.equal(
    buildPlayerPlayLink({
      origin: "https://play.example.com",
      baseUrl: "/app/",
      playerToken: "player-tok",
    }),
    "https://play.example.com/app/play/player-tok",
  );
});

test("resolveTestSessionOpenTarget routes external URLs to host play page", () => {
  assert.deepEqual(
    resolveTestSessionOpenTarget({
      session: { id: "sess-1", playerToken: "tok" },
      isExternalUrl: true,
      hostBoundUrl: "https://game.example",
    }),
    { kind: "host-play", sessionId: "sess-1" },
  );
  assert.deepEqual(
    resolveTestSessionOpenTarget({
      session: { id: "sess-2", inviteCode: "INV", playerToken: "tok" },
      isExternalUrl: false,
    }),
    { kind: "player-play", path: "play/i/INV" },
  );
  assert.deepEqual(
    resolveTestSessionOpenTarget({
      session: { id: "sess-3", playerToken: "tok" },
    }),
    { kind: "player-play", path: "play/tok" },
  );
});

test("buildTestSessionFullUrl normalizes base URL slashes", () => {
  assert.equal(
    buildTestSessionFullUrl("https://app.test", "/", {
      kind: "host-play",
      sessionId: "s1",
    }),
    "https://app.test/host/play/s1",
  );
  assert.equal(
    buildTestSessionFullUrl("https://app.test", "/app/", {
      kind: "player-play",
      path: "play/tok",
    }),
    "https://app.test/app/play/tok",
  );
});

test("buildBrowserHostStorageKeys scopes localStorage keys by session", () => {
  assert.deepEqual(buildBrowserHostStorageKeys("sess-9"), {
    hostTokenKey: "streamline.browserHostToken:sess-9",
    browserHostUrlKey: "streamline.browserHostUrl:sess-9",
  });
});

test("computeQuickStartSteps tracks onboarding progress", () => {
  const early = computeQuickStartSteps({
    agent: offlineAgent,
    heartbeat: { status: "never" },
    agentKeyBound: false,
    libraryCount: 0,
    hasActiveSession: false,
    agentDownloaded: false,
  });
  assert.equal(early.doneCount, 0);
  assert.equal(early.allDone, false);
  assert.equal(early.steps[0].done, false);
  assert.equal(early.steps[1].done, false);

  const afterDownload = computeQuickStartSteps({
    agent: offlineAgent,
    heartbeat: { status: "never" },
    agentKeyBound: false,
    libraryCount: 0,
    hasActiveSession: false,
    agentDownloaded: true,
  });
  assert.equal(afterDownload.steps[0].done, true);
  assert.equal(afterDownload.doneCount, 1);

  const ready = computeQuickStartSteps({
    agent: onlineAgent,
    heartbeat: { status: "never" },
    agentKeyBound: true,
    libraryCount: 2,
    hasActiveSession: true,
    agentDownloaded: false,
  });
  assert.equal(ready.doneCount, 4);
  assert.equal(ready.allDone, true);
  assert.equal(ready.steps[0].done, true);
  assert.match(ready.steps[1].hint, /localhost:18080/);
});

test("isAgentOnceSeen is true for online agent, fresh or stale heartbeat", () => {
  assert.equal(isAgentOnceSeen(offlineAgent, { status: "never" }), false);
  assert.equal(isAgentOnceSeen(offlineAgent, { status: "unknown" }), false);
  assert.equal(isAgentOnceSeen(onlineAgent, { status: "never" }), true);
  assert.equal(isAgentOnceSeen(offlineAgent, freshHeartbeat), true);
  assert.equal(isAgentOnceSeen(offlineAgent, staleHeartbeat), true);
});

test("readHostAgentDownloaded and markHostAgentDownloaded use localStorage", () => {
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  assert.equal(readHostAgentDownloaded(storage), false);
  markHostAgentDownloaded(storage);
  assert.equal(readHostAgentDownloaded(storage), true);
  assert.equal(storage.data[HOST_AGENT_DOWNLOADED_STORAGE_KEY], "1");
});

test("hasCompletedFirstStream is true when any session exists", () => {
  assert.equal(hasCompletedFirstStream([]), false);
  assert.equal(hasCompletedFirstStream(null), false);
  assert.equal(hasCompletedFirstStream([{ status: "ended" }]), true);
  assert.equal(hasCompletedFirstStream([{ status: "active" }]), true);
});

test("resolveGuidedNextAction returns one phase at a time until first stream (U-13)", () => {
  const base = {
    agent: offlineAgent,
    heartbeat: { status: "never" },
    agentKeyBound: false,
    libraryCount: 0,
    hasActiveSession: false,
    agentDownloaded: false,
    hasFirstStream: false,
  };

  const download = resolveGuidedNextAction(base);
  assert.equal(download.phase, "download");
  assert.equal(download.cta, "download");
  assert.equal(download.stepNumber, 1);

  const wait = resolveGuidedNextAction({ ...base, agentDownloaded: true });
  assert.equal(wait.phase, "wait-agent");
  assert.equal(wait.cta, "wait");

  const addGame = resolveGuidedNextAction({
    ...base,
    agent: onlineAgent,
    agentDownloaded: true,
  });
  assert.equal(addGame.phase, "add-game");
  assert.equal(addGame.cta, "add-game");
  assert.equal(addGame.stepNumber, 3);

  const goOnline = resolveGuidedNextAction({
    ...base,
    agent: onlineAgent,
    agentKeyBound: true,
    libraryCount: 1,
    agentDownloaded: true,
  });
  assert.equal(goOnline.phase, "go-online");
  assert.equal(goOnline.cta, "open-agent");
  assert.equal(goOnline.stepNumber, 4);

  const testStreamReady = resolveGuidedNextAction({
    ...base,
    agent: onlineAgent,
    agentKeyBound: true,
    libraryCount: 1,
    goOnlineAck: true,
    agentDownloaded: true,
  });
  assert.equal(testStreamReady.phase, "test-stream");
  assert.equal(testStreamReady.cta, "test-stream");
  assert.equal(testStreamReady.stepNumber, ONBOARDING_TOTAL_STEPS);

  const testStreamViaSession = resolveGuidedNextAction({
    ...base,
    agent: onlineAgent,
    agentKeyBound: true,
    libraryCount: 1,
    hasActiveSession: true,
    agentDownloaded: true,
  });
  assert.equal(testStreamViaSession.phase, "test-stream");

  const done = resolveGuidedNextAction({
    ...base,
    hasFirstStream: true,
  });
  assert.equal(done.phase, "complete");
  assert.equal(done.cta, "none");
});

test("evaluateHostReadiness returns Можно тестировать when all checks pass (U-14)", () => {
  const result = evaluateHostReadiness({
    apiOk: true,
    agentKeyBound: true,
    heartbeat: freshHeartbeat,
    agent: onlineAgent,
    enabledGamesCount: 1,
    hasActiveSession: false,
    goOnlineAck: true,
    localAgentReachable: true,
    localInputOk: true,
  });
  assert.equal(result.ready, true);
  assert.equal(result.headline, "Можно тестировать");
  assert.equal(result.nextFix, null);
  assert.equal(result.checks.every((c) => c.ok), true);
});

test("evaluateHostReadiness returns one Russian next fix for first failure (U-14)", () => {
  const apiFail = evaluateHostReadiness({
    apiOk: false,
    agentKeyBound: true,
    heartbeat: freshHeartbeat,
    agent: onlineAgent,
    enabledGamesCount: 1,
    hasActiveSession: true,
    localAgentReachable: true,
    localInputOk: true,
  });
  assert.equal(apiFail.ready, false);
  assert.match(apiFail.nextFix, /сервером/);

  const noGame = evaluateHostReadiness({
    apiOk: true,
    agentKeyBound: true,
    heartbeat: freshHeartbeat,
    agent: onlineAgent,
    enabledGamesCount: 0,
    hasActiveSession: false,
    goOnlineAck: true,
    localAgentReachable: true,
    localInputOk: true,
  });
  assert.match(noGame.nextFix, /игру/);

  const noInput = evaluateHostReadiness({
    apiOk: true,
    agentKeyBound: true,
    heartbeat: freshHeartbeat,
    agent: onlineAgent,
    enabledGamesCount: 2,
    hasActiveSession: true,
    localAgentReachable: true,
    localInputOk: false,
  });
  assert.match(noInput.nextFix, /ввод/);
});

test("evaluateAgentVersionCompatibility flags outdated agent (U-17)", () => {
  const ok = evaluateAgentVersionCompatibility("0.2.0", "0.1.0");
  assert.equal(ok.compatible, true);
  assert.equal(ok.message, null);

  const bad = evaluateAgentVersionCompatibility("0.0.9", "0.1.0");
  assert.equal(bad.compatible, false);
  assert.match(bad.message, /устарела/);
  assert.match(bad.message, /0\.1\.0/);
});

test("isAgentVersionBlockingStream blocks outdated online agent (U-17)", () => {
  assert.equal(
    isAgentVersionBlockingStream({ ...onlineAgent, version: "0.0.1" }, "0.1.0"),
    true,
  );
  assert.equal(
    isAgentVersionBlockingStream({ ...onlineAgent, version: "0.1.0" }, "0.1.0"),
    false,
  );
  assert.equal(isAgentVersionBlockingStream(offlineAgent, "0.1.0"), false);
});

test("resolveGuidedNextAction shows update-agent before test-stream (U-17)", () => {
  const base = {
    agent: { ...onlineAgent, version: "0.0.1" },
    heartbeat: freshHeartbeat,
    agentKeyBound: true,
    libraryCount: 1,
    hasActiveSession: false,
    agentDownloaded: true,
    goOnlineAck: true,
    hasFirstStream: false,
    minSupportedAgentVersion: "0.1.0",
  };
  const guided = resolveGuidedNextAction(base);
  assert.equal(guided.phase, "update-agent");
  assert.equal(guided.cta, "update-agent");
  assert.match(guided.hint, /устарела/);
});

test("evaluateHostReadiness blocks outdated agent version (U-17)", () => {
  const result = evaluateHostReadiness({
    apiOk: true,
    agentKeyBound: true,
    heartbeat: freshHeartbeat,
    agent: { ...onlineAgent, version: "0.0.1" },
    enabledGamesCount: 1,
    hasActiveSession: false,
    goOnlineAck: true,
    localAgentReachable: true,
    localInputOk: true,
    minSupportedAgentVersion: "0.1.0",
  });
  assert.equal(result.ready, false);
  assert.match(result.nextFix, /Обновить агент|устарела/);
  assert.equal(result.checks.some((c) => c.id === "agent-version" && !c.ok), true);
});

test("compareAgentVersions orders semver parts (U-17)", () => {
  assert.equal(compareAgentVersions("0.2.0", "0.1.9"), 1);
  assert.equal(compareAgentVersions("0.0.9", "0.1.0"), -1);
});
