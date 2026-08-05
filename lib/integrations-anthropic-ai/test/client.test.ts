import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const ENV_URL = "AI_INTEGRATIONS_ANTHROPIC_BASE_URL";
const ENV_KEY = "AI_INTEGRATIONS_ANTHROPIC_API_KEY";

async function loadClientModule() {
  const base = new URL("../src/client.ts", import.meta.url).href;
  const url = `${base}?t=${Date.now()}-${Math.random()}`;
  return await import(url);
}

function clearAnthropicEnv() {
  delete process.env[ENV_URL];
  delete process.env[ENV_KEY];
}

describe("getAnthropicClient", () => {
  let prevUrl: string | undefined;
  let prevKey: string | undefined;

  beforeEach(() => {
    prevUrl = process.env[ENV_URL];
    prevKey = process.env[ENV_KEY];
    clearAnthropicEnv();
  });

  afterEach(() => {
    if (prevUrl === undefined) delete process.env[ENV_URL];
    else process.env[ENV_URL] = prevUrl;
    if (prevKey === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prevKey;
  });

  it("returns null when env vars are missing", async () => {
    const { getAnthropicClient } = await loadClientModule();
    assert.equal(getAnthropicClient(), null);
  });

  it("returns null when only base URL is set", async () => {
    process.env[ENV_URL] = "https://anthropic.example/v1";
    const { getAnthropicClient } = await loadClientModule();
    assert.equal(getAnthropicClient(), null);
  });

  it("returns null when only API key is set", async () => {
    process.env[ENV_KEY] = "sk-test-key";
    const { getAnthropicClient } = await loadClientModule();
    assert.equal(getAnthropicClient(), null);
  });

  it("returns Anthropic client when both env vars are set", async () => {
    process.env[ENV_URL] = "https://anthropic.example/v1";
    process.env[ENV_KEY] = "sk-test-key";
    const { getAnthropicClient } = await loadClientModule();
    const client = getAnthropicClient();
    assert.ok(client);
    assert.equal(typeof client!.messages, "object");
  });

  it("caches the client on subsequent calls", async () => {
    process.env[ENV_URL] = "https://anthropic.example/v1";
    process.env[ENV_KEY] = "sk-test-key";
    const { getAnthropicClient } = await loadClientModule();
    const first = getAnthropicClient();
    const second = getAnthropicClient();
    assert.equal(first, second);
  });
});

describe("anthropic proxy", () => {
  let prevUrl: string | undefined;
  let prevKey: string | undefined;

  beforeEach(() => {
    prevUrl = process.env[ENV_URL];
    prevKey = process.env[ENV_KEY];
    clearAnthropicEnv();
  });

  afterEach(() => {
    if (prevUrl === undefined) delete process.env[ENV_URL];
    else process.env[ENV_URL] = prevUrl;
    if (prevKey === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prevKey;
  });

  it("throws when integration is not configured", async () => {
    const { anthropic } = await loadClientModule();
    assert.throws(
      () => anthropic.messages,
      /Anthropic AI integration is not configured/,
    );
  });

  it("delegates to client when configured", async () => {
    process.env[ENV_URL] = "https://anthropic.example/v1";
    process.env[ENV_KEY] = "sk-test-key";
    const { anthropic, getAnthropicClient } = await loadClientModule();
    const client = getAnthropicClient();
    assert.ok(client);
    assert.equal(anthropic.messages, client!.messages);
  });
});
