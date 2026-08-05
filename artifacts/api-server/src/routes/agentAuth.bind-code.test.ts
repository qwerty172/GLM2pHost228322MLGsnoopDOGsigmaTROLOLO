import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

// Lock in bind-agent-key contract: hostToken alone must not be accepted.
const BindAgentKeyBody = z.object({
  bindCode: z.string().min(1),
  pubkey: z.string().regex(/^[0-9a-f]+$/i, "pubkey must be hex"),
  challenge: z.string().min(1),
  signature: z.string().regex(/^[0-9a-f]+$/i, "signature must be hex"),
});

describe("bind-agent-key body", () => {
  it("rejects legacy hostToken-only payloads", () => {
    const legacy = {
      hostToken: "tok_secret",
      pubkey: "aa".repeat(32),
      challenge: "challenge",
      signature: "bb".repeat(64),
    };
    expect(BindAgentKeyBody.safeParse(legacy).success).toBe(false);
  });

  it("accepts bindCode payloads", () => {
    const body = {
      bindCode: "bind_abc123",
      pubkey: "aa".repeat(32),
      challenge: "challenge",
      signature: "bb".repeat(64),
    };
    expect(BindAgentKeyBody.safeParse(body).success).toBe(true);
  });
});
