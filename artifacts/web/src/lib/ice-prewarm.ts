// ICE prewarm cache — gather candidates before the player navigates to /play.

import { getPublicIceConfig } from "@workspace/api-client-react";

type PrewarmEntry = {
  pc: RTCPeerConnection;
  iceServers: RTCIceServer[];
  createdAt: number;
};

const cache = new Map<string, PrewarmEntry>();
const PREWARM_TTL_MS = 120_000;

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const json = await getPublicIceConfig();
    if (Array.isArray(json.iceServers) && json.iceServers.length > 0) {
      return json.iceServers;
    }
  } catch {
    /* fallback below */
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

function evictStale(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > PREWARM_TTL_MS) {
      try {
        entry.pc.close();
      } catch {
        /* ignore */
      }
      cache.delete(key);
    }
  }
}

/** Start ICE gathering for a host — call on Play button hover. */
export async function prewarmIce(hostId: string): Promise<void> {
  if (!hostId || cache.has(hostId)) return;
  evictStale();
  const iceServers = await fetchIceServers();
  const pc = new RTCPeerConnection({ iceServers });
  try {
    pc.createDataChannel("prewarm");
    const offer = await pc.createOffer({ iceRestart: false });
    await pc.setLocalDescription(offer);
    cache.set(hostId, { pc, iceServers, createdAt: Date.now() });
  } catch {
    try {
      pc.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Take prewarmed ICE servers (closes the throwaway PC).
 * The cached PC must not be reused — it already has a local offer and a
 * "prewarm" data channel, which breaks host-offer / player-answer signaling.
 */
export function takePrewarmedIceServers(hostId: string): RTCIceServer[] | null {
  evictStale();
  const entry = cache.get(hostId);
  if (!entry) return null;
  cache.delete(hostId);
  try {
    entry.pc.close();
  } catch {
    /* ignore */
  }
  return entry.iceServers;
}

/** @deprecated Use takePrewarmedIceServers — PC reuse breaks WebRTC negotiation. */
export function takePrewarmedConnection(
  hostId: string,
): { iceServers: RTCIceServer[] } | null {
  const iceServers = takePrewarmedIceServers(hostId);
  return iceServers ? { iceServers } : null;
}

export function discardPrewarm(hostId: string): void {
  const entry = cache.get(hostId);
  if (entry) {
    try {
      entry.pc.close();
    } catch {
      /* ignore */
    }
    cache.delete(hostId);
  }
}
