import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

const requests = [];

class MockXMLHttpRequest {
  constructor() {
    this.method = null;
    this.url = null;
    this.headers = {};
    this.status = 200;
    this.sentBody = null;
    this.onload = null;
    this.onerror = null;
    this._failNetwork = false;
    requests.push(this);
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key, value) {
    this.headers[key] = value;
  }

  send(body) {
    this.sentBody = body;
    queueMicrotask(() => {
      if (this._failNetwork) {
        this.onerror?.();
        return;
      }
      this.onload?.();
    });
  }
}

globalThis.XMLHttpRequest = MockXMLHttpRequest;

const { putBlobToUrl } = await import("../src/lib/put-external-blob.ts");

afterEach(() => {
  requests.length = 0;
});

test("putBlobToUrl sends PUT with blob and custom headers", async () => {
  const blob = new Blob(["hello"], { type: "text/plain" });
  const promise = putBlobToUrl("https://s3.example/bucket/key", blob, {
    "Content-Type": "text/plain",
    "x-amz-acl": "private",
  });

  await promise;

  assert.equal(requests.length, 1);
  const xhr = requests[0];
  assert.equal(xhr.method, "PUT");
  assert.equal(xhr.url, "https://s3.example/bucket/key");
  assert.equal(xhr.headers["Content-Type"], "text/plain");
  assert.equal(xhr.headers["x-amz-acl"], "private");
  assert.equal(xhr.sentBody, blob);
});

test("putBlobToUrl resolves on 2xx status", async () => {
  const blob = new Blob(["ok"]);
  const promise = putBlobToUrl("https://upload.example/file", blob);

  requests[0].status = 204;
  await promise;
});

test("putBlobToUrl rejects on non-2xx status", async () => {
  const blob = new Blob(["fail"]);
  const promise = putBlobToUrl("https://upload.example/file", blob);

  requests[0].status = 403;
  await assert.rejects(promise, /PUT failed: 403/);
});

test("putBlobToUrl rejects on network error", async () => {
  const blob = new Blob(["x"]);
  const promise = putBlobToUrl("https://upload.example/file", blob);

  requests[0]._failNetwork = true;
  await assert.rejects(promise, /network error/);
});
