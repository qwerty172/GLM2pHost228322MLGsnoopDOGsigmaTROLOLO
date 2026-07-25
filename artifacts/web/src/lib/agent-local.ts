/**
 * Local host-agent HTTP surface (ping-server on 127.0.0.1).
 * Primary port is 18080; agent may fall back to 18081–18083 when busy.
 */

export const AGENT_PING_PORTS = [18080, 18081, 18082, 18083] as const;

/** Must match host-agent LOCAL_INPUT_SECRET. */
export const AGENT_INPUT_SECRET = "dh-local-input-v1";

export type AgentPingInfo = {
  port: number;
  version: string;
  audioMode: string;
};

let cachedPort: number | null = null;

async function pingPort(
  port: number,
  timeoutMs: number,
): Promise<AgentPingInfo | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/ping`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      version?: string;
      audioMode?: string;
      port?: number;
    };
    return {
      port: typeof data.port === "number" ? data.port : port,
      version: data.version ?? "?",
      audioMode: data.audioMode ?? "off",
    };
  } catch {
    return null;
  }
}

/** Probe 18080–18083 (or revalidate cache). Returns null if agent is unreachable. */
export async function discoverAgentPort(opts?: {
  force?: boolean;
  timeoutMs?: number;
}): Promise<AgentPingInfo | null> {
  const timeoutMs = opts?.timeoutMs ?? 900;

  if (!opts?.force && cachedPort != null) {
    const cached = await pingPort(cachedPort, timeoutMs);
    if (cached) {
      cachedPort = cached.port;
      return cached;
    }
    cachedPort = null;
  }

  for (const port of AGENT_PING_PORTS) {
    const info = await pingPort(port, timeoutMs);
    if (info) {
      cachedPort = info.port;
      return info;
    }
  }
  return null;
}

export function getCachedAgentPort(): number | null {
  return cachedPort;
}

export async function postAgentInput(
  event: Record<string, unknown>,
): Promise<Response> {
  const info = await discoverAgentPort();
  if (!info) {
    throw new Error("agent_offline");
  }
  return fetch(`http://127.0.0.1:${info.port}/input`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Input-Secret": AGENT_INPUT_SECRET,
    },
    body: JSON.stringify(event),
  });
}
