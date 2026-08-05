/** Minimum agent semver required to stream (U-17). Override via env in prod. */
const DEFAULT_MIN_SUPPORTED_AGENT_VERSION = "0.1.0";

export function getMinSupportedAgentVersion(): string {
  const fromEnv = process.env.MIN_SUPPORTED_AGENT_VERSION?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MIN_SUPPORTED_AGENT_VERSION;
}

/** Compare semver-like strings: -1 if a<b, 0 if equal, 1 if a>b */
export function compareAgentVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(/[.+_-]/)
      .map((part) => {
        const n = parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length, 3);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export function isAgentVersionSupported(version: string): boolean {
  return compareAgentVersions(version, getMinSupportedAgentVersion()) >= 0;
}
