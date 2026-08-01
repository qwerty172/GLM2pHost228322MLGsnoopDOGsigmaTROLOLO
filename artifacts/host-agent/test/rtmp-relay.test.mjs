import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Pure helpers compiled from main process TS.
const { buildGdigrabInput, buildRtmpUrl } = await import("../dist/main/main/rtmp-relay-helpers.js");

describe("rtmp-relay helpers", () => {
  it("buildGdigrabInput falls back to desktop", () => {
    assert.equal(buildGdigrabInput(), "desktop");
    assert.equal(buildGdigrabInput("   "), "desktop");
  });

  it("buildGdigrabInput escapes gdigrab title metacharacters", () => {
    assert.equal(
      buildGdigrabInput("Game: window, title=1"),
      "title=Game  window  title 1",
    );
  });

  it("buildGdigrabInput preserves normal titles", () => {
    assert.equal(
      buildGdigrabInput("Counter-Strike 2"),
      "title=Counter-Strike 2",
    );
  });

  it("buildRtmpUrl appends stream key", () => {
    assert.equal(
      buildRtmpUrl("rtmp://live.twitch.tv/app/", "secret"),
      "rtmp://live.twitch.tv/app/secret",
    );
  });

  it("buildRtmpUrl substitutes {stream_key} placeholder", () => {
    assert.equal(
      buildRtmpUrl("rtmp://a/b/{stream_key}", "k"),
      "rtmp://a/b/k",
    );
  });
});
