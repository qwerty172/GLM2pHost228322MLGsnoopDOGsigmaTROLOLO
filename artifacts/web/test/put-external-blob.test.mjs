import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

const xhrInstances = [];
let xhrBehavior = { status: 200, networkError: false };

class MockXMLHttpRequest {
  constructor() {
    this.openMethod = null;
    this.openUrl = null;
    this.headers = {};
    this.sentBody = null;
    this.status = xhrBehavior.status;
    this.onload = null;
    this.onerror = null;
    xhrInstances.push(this);
  }

  open(method, url) {
    this.openMethod = method;
    this.openUrl = url;
  }

  setRequestHeader(key, value) {
    this.headers[key] = value;
  }

  send(body) {
    this.sentBody = body;
    queueMicrotask(() => {
      if (xhrBehavior.networkError) {
        this.onerror?.();
        return;
      }
      this.status = xhrBehavior.status;
      this.onload?.();
    });
  }
}

globalThis.XMLHttpRequest = MockXMLHttpRequest;

const { putBlobToUrl } = await import("../src/lib/put-external-blob.ts");

afterEach(() => {
  xhrInstances.length = 0;
  xhrBehavior = { status: 200, networkError: false };
});

test("putBlobToUrl sends PUT with blob and custom headers", async () => {
  const blob = new Blob(["clip-data"], { type: "video/webm" });

  await putBlobToUrl("https://storage.example/upload?token=abc", blob, {
    "Content-Type": "video/webm",
    "x-amz-acl": "private",
  });

  assert.equal(xhrInstances.length, 1);
  const xhr = xhrInstances[0];
  assert.equal(xhr.openMethod, "PUT");
  assert.equal(xhr.openUrl, "https://storage.example/upload?token=abc");
  assert.deepEqual(xhr.headers, {
    "Content-Type": "video/webm",
    "x-amz-acl": "private",
  });
  assert.equal(xhr.sentBody, blob);
});

test("putBlobToUrl resolves on 2xx status", async () => {
  xhrBehavior = { status: 204, networkError: false };
  const blob = new Blob(["x"]);

  await assert.doesNotReject(() => putBlobToUrl("https://storage.example/ok", blob));
});

test("putBlobToUrl rejects on non-2xx status", async () => {
  xhrBehavior = { status: 403, networkError: false };
  const blob = new Blob(["x"]);

  await assert.rejects(
    () => putBlobToUrl("https://storage.example/forbidden", blob),
    /PUT failed: 403/,
  );
});

test("putBlobToUrl rejects on network error", async () => {
  xhrBehavior = { status: 200, networkError: true };
  const blob = new Blob(["x"]);

  await assert.rejects(
    () => putBlobToUrl("https://storage.example/offline", blob),
    /network error/,
  );
});

test("putBlobToUrl works without optional headers", async () => {
  const blob = new Blob(["plain"]);

  await putBlobToUrl("https://storage.example/minimal", blob);

  assert.deepEqual(xhrInstances[0].headers, {});
});
