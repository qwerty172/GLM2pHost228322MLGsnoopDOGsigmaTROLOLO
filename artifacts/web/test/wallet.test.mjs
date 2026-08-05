import { test } from "node:test";
import assert from "node:assert/strict";

const {
  LZT_PER_USDT,
  TRANSAK_HOST,
  WITHDRAW_CURRENCIES,
  formatLzt,
  lztToUsdt,
  isTransakEnabled,
  buildTransakUrl,
  resolveWalletToken,
  parseWithdrawAmountLzt,
  isWithdrawOverGreen,
  validateWithdrawAmountLzt,
  canSubmitWithdraw,
  formatUsdtAddressPreview,
  findUsdtTrc20Address,
} = await import("../src/pages/wallet-helpers.ts");

test("LZT_PER_USDT is stable", () => {
  assert.equal(LZT_PER_USDT, 200);
});

test("formatLzt formats truncated integers in ru-RU locale", () => {
  assert.equal(formatLzt(1234.9), "1\u00a0234");
  assert.equal(formatLzt(0), "0");
  assert.match(formatLzt(-500), /500/);
});

test("lztToUsdt converts LZT to USDT at fixed rate", () => {
  assert.equal(lztToUsdt(200), 1);
  assert.equal(lztToUsdt(100), 0.5);
  assert.equal(lztToUsdt(0), 0);
});

test("isTransakEnabled treats non-empty trimmed api key as enabled", () => {
  assert.equal(isTransakEnabled("abc"), true);
  assert.equal(isTransakEnabled("  key  "), true);
  assert.equal(isTransakEnabled(""), false);
  assert.equal(isTransakEnabled("   "), false);
  assert.equal(isTransakEnabled(null), false);
  assert.equal(isTransakEnabled(undefined), false);
});

test("buildTransakUrl builds Transak widget URL with required params", () => {
  const url = buildTransakUrl({
    apiKey: "test-key",
    walletAddress: "TAddr123",
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, `${TRANSAK_HOST}/`);
  assert.equal(parsed.searchParams.get("apiKey"), "test-key");
  assert.equal(parsed.searchParams.get("walletAddress"), "TAddr123");
  assert.equal(parsed.searchParams.get("cryptoCurrencyCode"), "USDT");
  assert.equal(parsed.searchParams.get("network"), "tron");
  assert.equal(parsed.searchParams.get("defaultFiatAmount"), "50");
  assert.equal(parsed.searchParams.get("productsAvailed"), "BUY");
});

test("buildTransakUrl includes optional email and fiat amount", () => {
  const url = buildTransakUrl({
    apiKey: "k",
    walletAddress: "addr",
    defaultFiatAmount: 100,
    email: "user@example.com",
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("defaultFiatAmount"), "100");
  assert.equal(parsed.searchParams.get("email"), "user@example.com");
});

test("buildTransakUrl throws when api key is missing", () => {
  assert.throws(
    () => buildTransakUrl({ apiKey: "  ", walletAddress: "addr" }),
    /VITE_TRANSAK_API_KEY is not configured/,
  );
});

test("resolveWalletToken prefers player wallet over host token", () => {
  assert.equal(resolveWalletToken("player", "host"), "player");
  assert.equal(resolveWalletToken(null, "host"), "host");
  assert.equal(resolveWalletToken(undefined, undefined), "");
});

test("parseWithdrawAmountLzt parses integer amounts", () => {
  assert.equal(parseWithdrawAmountLzt("500"), 500);
  assert.equal(parseWithdrawAmountLzt(""), 0);
  assert.equal(parseWithdrawAmountLzt("abc"), 0);
});

test("isWithdrawOverGreen detects amount exceeding green balance", () => {
  assert.equal(isWithdrawOverGreen(100, 50), true);
  assert.equal(isWithdrawOverGreen(50, 50), false);
  assert.equal(isWithdrawOverGreen(0, 100), false);
});

test("validateWithdrawAmountLzt rejects invalid and over-balance amounts", () => {
  assert.deepEqual(validateWithdrawAmountLzt(0, 100), { ok: false, error: "invalid" });
  assert.deepEqual(validateWithdrawAmountLzt(-10, 100), { ok: false, error: "invalid" });
  assert.deepEqual(validateWithdrawAmountLzt(150, 100), { ok: false, error: "over_balance" });
  assert.deepEqual(validateWithdrawAmountLzt(50, 100), { ok: true });
});

test("canSubmitWithdraw gates withdraw form submission", () => {
  assert.equal(
    canSubmitWithdraw({
      withdrawAddress: "addr",
      withdrawAmountLzt: "50",
      greenLzt: 100,
      isPending: false,
    }),
    true,
  );
  assert.equal(
    canSubmitWithdraw({
      withdrawAddress: "",
      withdrawAmountLzt: "50",
      greenLzt: 100,
      isPending: false,
    }),
    false,
  );
  assert.equal(
    canSubmitWithdraw({
      withdrawAddress: "addr",
      withdrawAmountLzt: "150",
      greenLzt: 100,
      isPending: false,
    }),
    false,
  );
  assert.equal(
    canSubmitWithdraw({
      withdrawAddress: "addr",
      withdrawAmountLzt: "50",
      greenLzt: 100,
      isPending: true,
    }),
    false,
  );
});

test("formatUsdtAddressPreview shortens long addresses", () => {
  const addr = "TAbCdEfGhIjKlMnOpQrStUvWx";
  assert.equal(formatUsdtAddressPreview(addr), "TAbCdEfG…StUvWx");
  assert.equal(formatUsdtAddressPreview("short"), "short");
});

test("findUsdtTrc20Address picks USDT_TRC20 deposit address", () => {
  const addrs = [
    { currency: "SOL", address: "sol-addr" },
    { currency: "USDT_TRC20", address: "trc20-addr" },
  ];
  assert.equal(findUsdtTrc20Address(addrs), "trc20-addr");
  assert.equal(findUsdtTrc20Address([]), undefined);
  assert.equal(findUsdtTrc20Address(undefined), undefined);
});

test("WITHDRAW_CURRENCIES lists supported withdrawal networks", () => {
  assert.equal(WITHDRAW_CURRENCIES.length, 3);
  assert.deepEqual(
    WITHDRAW_CURRENCIES.map((c) => c.id),
    ["USDT_TRC20", "SOL", "NANO"],
  );
});
