import { describe, it, expect } from "vitest";
import {
  sessionIdFromLedgerRef,
  mapLedgerKindForWallet,
  formatBlockReserveDescription,
} from "./walletLedgerFormat";

describe("sessionIdFromLedgerRef", () => {
  it("returns session id unchanged", () => {
    expect(sessionIdFromLedgerRef("abc-123")).toBe("abc-123");
  });

  it("strips renew suffix", () => {
    expect(sessionIdFromLedgerRef("abc-123:renew:key-1")).toBe("abc-123");
  });
});

describe("mapLedgerKindForWallet", () => {
  it("maps block_reserve to block_purchase", () => {
    expect(mapLedgerKindForWallet("block_reserve")).toBe("block_purchase");
  });
});

describe("formatBlockReserveDescription", () => {
  it("formats initial block reserve with game", () => {
    expect(
      formatBlockReserveDescription("block reserve: 15 мин", "Rogue Fable III", -120),
    ).toBe("Блок 15 мин — Rogue Fable III");
  });

  it("formats renew note", () => {
    expect(
      formatBlockReserveDescription("block renew: +10 мин", "Test Game", -80),
    ).toBe("Продление блока 10 мин — Test Game");
  });

  it("formats generic block reserve amount", () => {
    expect(
      formatBlockReserveDescription("block reserve 80 LZT", null, -80),
    ).toBe("Блок 80 LZT");
  });
});
