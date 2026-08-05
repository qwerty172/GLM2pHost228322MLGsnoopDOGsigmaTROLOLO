import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

let xhrInstances = [];
let xhrConfig = {};

class MockXMLHttpRequest {
  status = 200;
  openMethod = "";
  openUrl = "";
  headers = {};
  sentBody = null;

  open(method, url) {
    this.openMethod = method;
    this.openUrl = url;
  }

  setRequestHeader(k, v) {
    this.headers[k] = v;
  }

  send(body) {
    this.sentBody = body;
    xhrInstances.push(this);
    if (xhrConfig.error) {
      setTimeout(() => this.onerror?.(), 0);
      return;
    }
    this.status = xhrConfig.status ?? 200;
    setTimeout(() => this.onload?.(), 0);
  }
}

globalThis.XMLHttpRequest = MockXMLHttpRequest;

const { putBlobToUrl } = await import("../src/lib/put-external-blob.ts");

afterEach(() => {
  xhrInstances = [];
  xhrConfig = {};
  globalThis.XMLHttpRequest = MockXMLHttpRequest;
});

test("putBlobToUrl PUTs blob to URL with custom headers", async () => {
  const blob = new Blob(["hello"], { type: "text/plain" });
  xhrConfig = { status: 200 };

  await putBlobToUrl("https://s3.example/bucket/key", blob, {
    "Content-Type": "text/plain",
    "x-amz-acl": "private",
  });

  assert.equal(xhrInstances.length, 1);
  const xhr = xhrInstances[0];
  assert.equal(xhr.openMethod, "PUT");
  assert.equal(xhr.openUrl, "https://s3.example/bucket/key");
  assert.deepEqual(xhr.headers, {
    "Content-Type": "text/plain",
    "x-amz-acl": "private",
  });
  assert.equal(xhr.sentBody, blob);
});

test("putBlobToUrl resolves on 2xx responses", async () => {
  const blob = new Blob(["data"]);
  xhrConfig = { status: 204 };

  await putBlobToUrl("https://example/upload", blob);
});

test("putBlobToUrl rejects on non-2xx status", async () => {
  const blob = new Blob(["data"]);
  xhrConfig = { status: 403 };

  await assert.rejects(
    () => putBlobToUrl("https://example/upload", blob),
    /PUT failed: 403/,
  );
});

test("putBlobToUrl rejects on network error", async () => {
  const blob = new Blob(["data"]);
  xhrConfig = { error: true };

  await assert.rejects(
    () => putBlobToUrl("https://example/upload", blob),
    /network error/,
  );
});

test("putBlobToUrl sends no extra headers by default", async () => {
  const blob = new Blob(["data"]);
  xhrConfig = { status: 200 };

  await putBlobToUrl("https://example/upload", blob);

  assert.deepEqual(xhrInstances[0].headers, {});
});
