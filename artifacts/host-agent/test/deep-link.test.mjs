import { test } from "node:test";
import assert from "node:assert/strict";

const {
  DECENTHUB_PROTOCOL_SCHEME,
  parseDecenthubUrl,
  findDecenthubUrlInArgv,
  toPendingPayload,
  deepLinkShouldRevealAgentWindow,
} = await import("../dist/main/main/deep-link.js");

test("parseDecenthubUrl reads bind deep links from dashboard (U-34)", () => {
  const url =
    "decenthub://bind?api=https%3A%2F%2Fapp.example&bind=bind_abc&pair=123456";
  const parsed = parseDecenthubUrl(url);
  assert.equal(parsed?.action, "bind");
  assert.equal(parsed?.apiBaseUrl, "https://app.example");
  assert.equal(parsed?.bindCode, "bind_abc");
  assert.equal(parsed?.pairCode, "123456");
});

test("parseDecenthubUrl accepts open action", () => {
  assert.deepEqual(parseDecenthubUrl("decenthub://open"), {
    action: "open",
    apiBaseUrl: null,
    bindCode: null,
    pairCode: null,
  });
});

test("findDecenthubUrlInArgv locates protocol argument", () => {
  const argv = ["electron.exe", "--hidden", "decenthub://bind?pair=123456"];
  assert.equal(findDecenthubUrlInArgv(argv), "decenthub://bind?pair=123456");
  assert.equal(findDecenthubUrlInArgv(["electron.exe"]), null);
});

test("toPendingPayload strips open-only links", () => {
  assert.deepEqual(toPendingPayload(parseDecenthubUrl("decenthub://open")), {
    apiBaseUrl: null,
    bindCode: null,
    pairCode: null,
  });
});

test("DECENTHUB_PROTOCOL_SCHEME is stable", () => {
  assert.equal(DECENTHUB_PROTOCOL_SCHEME, "decenthub");
});

test("deepLinkShouldRevealAgentWindow for dashboard open/bind links (U-34)", () => {
  assert.equal(deepLinkShouldRevealAgentWindow({ action: "open", apiBaseUrl: null, bindCode: null, pairCode: null }), true);
  assert.equal(
    deepLinkShouldRevealAgentWindow({
      action: "bind",
      apiBaseUrl: "https://app.example",
      bindCode: "bind_abc",
      pairCode: "123456",
    }),
    true,
  );
});
