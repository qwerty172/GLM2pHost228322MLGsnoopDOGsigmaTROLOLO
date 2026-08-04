import { describe, expect, it } from "vitest";
import { NOTIFY_CHANNEL } from "./pgNotify";

describe("pgNotify", () => {
  it("exports NOTIFY_CHANNEL constant", () => {
    expect(NOTIFY_CHANNEL).toBe("decentralhub_events");
  });
});
