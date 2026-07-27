import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CRYPTO_UNAVAILABLE_MESSAGE,
  ENCRYPTION_UNAVAILABLE_MESSAGE,
  respondCryptoUnavailable,
  respondEncryptionUnavailable,
} from "../lib/cryptoRouteHelpers.js";

describe("cryptoRouteHelpers", () => {
  it("crypto copy mentions temporary unavailability in Russian", () => {
    assert.match(CRYPTO_UNAVAILABLE_MESSAGE, /временно недоступн/i);
    assert.match(CRYPTO_UNAVAILABLE_MESSAGE, /узлы блокчейна/i);
  });

  it("encryption copy mentions temporary unavailability in Russian", () => {
    assert.match(ENCRYPTION_UNAVAILABLE_MESSAGE, /временно недоступн/i);
  });

  it("respondCryptoUnavailable returns 503 JSON", () => {
    const body: Record<string, string> = {};
    let status = 0;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: Record<string, string>) {
        Object.assign(body, payload);
      },
    };
    respondCryptoUnavailable(res as never);
    assert.equal(status, 503);
    assert.equal(body.error, "crypto_unavailable");
    assert.equal(body.message, CRYPTO_UNAVAILABLE_MESSAGE);
  });

  it("respondEncryptionUnavailable returns 503 JSON", () => {
    const body: Record<string, string> = {};
    let status = 0;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: Record<string, string>) {
        Object.assign(body, payload);
      },
    };
    respondEncryptionUnavailable(res as never);
    assert.equal(status, 503);
    assert.equal(body.error, "encryption_unavailable");
    assert.equal(body.message, ENCRYPTION_UNAVAILABLE_MESSAGE);
  });
});
