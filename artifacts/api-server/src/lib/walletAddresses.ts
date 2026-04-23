import { Keypair } from "@solana/web3.js";
import {
  generateSeed,
  deriveSecretKey,
  derivePublicKey,
  deriveAddress,
} from "nanocurrency";
import { TronWeb } from "tronweb";
import { encryptSecret } from "./encryption";

export interface GeneratedAddress {
  currency: string;
  network: string;
  label: string;
  address: string;
  encryptedPrivateKey: string;
  minDeposit: string;
}

export async function generateSolanaAddress(): Promise<GeneratedAddress> {
  const kp = Keypair.generate();
  const secretBase64 = Buffer.from(kp.secretKey).toString("base64");
  return {
    currency: "SOL",
    network: "Solana",
    label: "Solana (SOL)",
    address: kp.publicKey.toBase58(),
    encryptedPrivateKey: encryptSecret(secretBase64),
    minDeposit: "0.05",
  };
}

export async function generateNanoAddress(): Promise<GeneratedAddress> {
  const seed = await generateSeed();
  const secretKey = deriveSecretKey(seed, 0);
  const publicKey = derivePublicKey(secretKey);
  const address = deriveAddress(publicKey, { useNanoPrefix: true });
  return {
    currency: "NANO",
    network: "Nano",
    label: "Nano (XNO)",
    address,
    encryptedPrivateKey: encryptSecret(`${seed}:${secretKey}`),
    minDeposit: "0.01",
  };
}

export async function generateTronUsdtAddress(): Promise<GeneratedAddress> {
  // TronWeb account creation is local (no network call required).
  const tron = new TronWeb({
    fullHost: "https://api.trongrid.io",
  });
  const account = await tron.createAccount();
  return {
    currency: "USDT_TRC20",
    network: "TRON",
    label: "USDT (TRON / TRC-20)",
    address: account.address.base58,
    encryptedPrivateKey: encryptSecret(account.privateKey),
    minDeposit: "1",
  };
}

export async function generateAllDepositAddresses(): Promise<
  GeneratedAddress[]
> {
  return Promise.all([
    generateSolanaAddress(),
    generateNanoAddress(),
    generateTronUsdtAddress(),
  ]);
}
