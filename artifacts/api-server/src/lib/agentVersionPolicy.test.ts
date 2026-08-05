import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  compareAgentVersions,
  getMinSupportedAgentVersion,
  isAgentVersionSupported,
} from "./agentVersionPolicy";

describe("agentVersionPolicy", () => {
  const prev = process.env.MIN_SUPPORTED_AGENT_VERSION;

  beforeEach(() => {
    delete process.env.MIN_SUPPORTED_AGENT_VERSION;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.MIN_SUPPORTED_AGENT_VERSION;
    else process.env.MIN_SUPPORTED_AGENT_VERSION = prev;
  });

  it("compareAgentVersions orders semver parts", () => {
    expect(compareAgentVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareAgentVersions("0.2.0", "0.1.9")).toBe(1);
    expect(compareAgentVersions("0.0.9", "0.1.0")).toBe(-1);
    expect(compareAgentVersions("v1.0.0", "1.0.0")).toBe(0);
  });

  it("getMinSupportedAgentVersion reads env override", () => {
    expect(getMinSupportedAgentVersion()).toBe("0.1.0");
    process.env.MIN_SUPPORTED_AGENT_VERSION = "0.2.0";
    expect(getMinSupportedAgentVersion()).toBe("0.2.0");
  });

  it("isAgentVersionSupported respects minimum", () => {
    process.env.MIN_SUPPORTED_AGENT_VERSION = "0.2.0";
    expect(isAgentVersionSupported("0.2.0")).toBe(true);
    expect(isAgentVersionSupported("0.2.1")).toBe(true);
    expect(isAgentVersionSupported("0.1.9")).toBe(false);
  });
});
