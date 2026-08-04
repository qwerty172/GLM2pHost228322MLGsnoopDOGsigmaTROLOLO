import type { OwnerType } from "./walletOwner";

/** Dev keys are keyed by apiKey; only that wallet may bind the key to a quota. */
export function canLinkDevKeyToQuota(
  owner: { type: OwnerType; id: string },
  devKeyId: string,
): boolean {
  return owner.type === "dev_key" && owner.id === devKeyId;
}
