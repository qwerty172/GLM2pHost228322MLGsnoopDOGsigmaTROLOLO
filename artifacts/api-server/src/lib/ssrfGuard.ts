// Block SSRF: reject targets that resolve to private/internal networks.
export function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "0.0.0.0" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }
  // Normalize IPv4-mapped IPv6 (::ffff:1.2.3.4)
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = v4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) {
    return false; // plain IPv6 (non-local) — already checked prefixes above
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  );
}

export async function resolvesToPrivateNetwork(host: string): Promise<boolean> {
  if (isPrivateIp(host) || host === "localhost") return true;
  try {
    const dns = await import("node:dns/promises");
    const results = await dns.lookup(host, { all: true });
    return results.some((r) => isPrivateIp(r.address));
  } catch {
    return true; // unresolvable — refuse to probe
  }
}
