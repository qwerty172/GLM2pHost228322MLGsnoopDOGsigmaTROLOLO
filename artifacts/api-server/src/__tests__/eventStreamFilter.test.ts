import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterEventForHost,
  isEventForHost,
  redactEventPayload,
} from "../lib/eventStreamFilter.js";

const HOST = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("eventStreamFilter", () => {
  it("redacts session secrets from NOTIFY payloads", () => {
    const out = redactEventPayload({
      id: "sess-1",
      host_id: HOST,
      player_token: "secret-player-token",
      invite_code: "ABC123",
      host_token: "secret-host-token",
      status: "active",
    });
    assert.equal(out.player_token, undefined);
    assert.equal(out.invite_code, undefined);
    assert.equal(out.host_token, undefined);
    assert.equal(out.status, "active");
  });

  it("allows session_status events for the owning host only", () => {
    const event = {
      type: "session_status",
      payload: { host_id: HOST, status: "active" },
      at: "2026-08-03T00:00:00Z",
    };
    assert.equal(isEventForHost(event, HOST), true);
    assert.equal(isEventForHost(event, OTHER), false);
    assert.ok(filterEventForHost(event, HOST));
    assert.equal(filterEventForHost(event, OTHER), null);
  });

  it("allows host_last_seen rows for the matching host id", () => {
    const event = {
      type: "host_last_seen",
      payload: { id: HOST, last_seen_at: "2026-08-03T00:00:00Z" },
      at: "2026-08-03T00:00:00Z",
    };
    assert.equal(isEventForHost(event, HOST), true);
    assert.equal(isEventForHost(event, OTHER), false);
  });

  it("allows app-emitted host_last_seen events keyed by hostId", () => {
    const event = {
      type: "host_last_seen",
      payload: { hostId: HOST },
      at: "2026-08-03T00:00:00Z",
    };
    assert.equal(isEventForHost(event, HOST), true);
    assert.equal(isEventForHost(event, OTHER), false);
  });
});
