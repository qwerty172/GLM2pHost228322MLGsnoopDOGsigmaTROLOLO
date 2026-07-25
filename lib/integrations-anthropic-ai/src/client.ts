import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null | undefined;

/** Returns Anthropic client or null when AI integration is not configured. */
export function getAnthropicClient(): Anthropic | null {
  if (_client !== undefined) return _client;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (!baseURL || !apiKey) {
    _client = null;
    return null;
  }
  _client = new Anthropic({ apiKey, baseURL });
  return _client;
}

/** @deprecated Prefer getAnthropicClient() — throws only when used without config */
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    const client = getAnthropicClient();
    if (!client) {
      throw new Error("Anthropic AI integration is not configured");
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
