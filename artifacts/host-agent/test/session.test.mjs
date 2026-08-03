import "../test/setup-renderer-dom.mjs";
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

const { createSession, showPlayerLink } = await import("../dist/renderer/renderer/session.js");

test("createSession POSTs to /api/sessions", async () => {
  let captured;
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    captured = { url, init };
    return {
      ok: true,
      json: async () => ({ id: "sess-1", playerToken: "ptok", gameId: "g1" }),
    };
  });
  try {
    const result = await createSession(
      {
        hostToken: "htok",
        apiBaseUrl: "https://api.example.com",
        appName: "Test",
        ratePerMinute: 2,
        signalingUrl: "",
        appPath: "",
        commissionSplit: 0.7,
        resolution: { width: 1920, height: 1080 },
        bitrateKbps: 6000,
        audioMode: "off",
        killAppOnDisconnect: false,
        autoLaunchAtStartup: false,
      },
      "g1",
    );
    assert.equal(result.sessionId, "sess-1");
    assert.equal(result.playerToken, "ptok");
    assert.match(String(captured.url), /\/api\/sessions$/);
    assert.equal(captured.init.method, "POST");
  } finally {
    restore.mock.restore();
  }
});

test("showPlayerLink fills share card", () => {
  const input = elements.get("player-link");
  const card = elements.get("share-card");
  showPlayerLink({ apiBaseUrl: "https://api.example.com" }, "abc123");
  assert.match(input.value, /\/play\/abc123/);
  assert.equal(card.hidden, false);
});
