/** Summarize ICE server entries from GET /api/public/ice-config (no credentials). */

export type IceConnectivitySummary = {
  stunCount: number;
  turnCount: number;
  hasTurn: boolean;
  hasStun: boolean;
};

function urlsOf(server: { urls?: string | string[] }): string[] {
  if (!server.urls) return [];
  return Array.isArray(server.urls) ? server.urls : [server.urls];
}

export function summarizeIceServers(
  servers: Array<{ urls?: string | string[] }> | undefined,
): IceConnectivitySummary {
  let stunCount = 0;
  let turnCount = 0;

  for (const server of servers ?? []) {
    for (const url of urlsOf(server)) {
      if (/^turns?:/i.test(url)) turnCount++;
      else if (/^stuns?:/i.test(url)) stunCount++;
    }
  }

  return {
    stunCount,
    turnCount,
    hasTurn: turnCount > 0,
    hasStun: stunCount > 0 || (servers?.length ?? 0) > 0,
  };
}
