export const HOST_AUTH_ACTIVE_PATH = "/host";

export interface HostRegisterFeature {
  title: string;
  text: string;
}

export const HOST_REGISTER_FEATURES: HostRegisterFeature[] = [
  { title: "P2P стриминг", text: "WebRTC напрямую" },
  { title: "Крипто-выплаты", text: "95% дохода тебе" },
  { title: "Агент хоста", text: "Простая установка" },
];

export function canSubmitHostRegistration(displayName: string, isPending: boolean): boolean {
  return !isPending && displayName.trim().length > 0;
}

export function buildHostRegisterRequest(
  displayName: string,
): { data: { displayName: string } } | null {
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  return { data: { displayName: trimmed } };
}

export type HostTokenClipboardResult = "copied" | "registered";

export async function persistHostTokenClipboard(
  hostToken: string,
  writeClipboard: (text: string) => Promise<void>,
): Promise<HostTokenClipboardResult> {
  try {
    await writeClipboard(hostToken);
    return "copied";
  } catch {
    return "registered";
  }
}
