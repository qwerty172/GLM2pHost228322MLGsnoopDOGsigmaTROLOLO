import { encryptSecret, decryptSecret } from "./encryption";

export function encryptSshKey(privateKey: string): string {
  return encryptSecret(privateKey);
}

export function decryptSshKey(encrypted: string): string {
  return decryptSecret(encrypted);
}
