import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

const { consumeTokenFromUrl } = await import("../src/hooks/use-auth.tsx");

function mockWindow({ pathname = "/", search = "", hash = "" } = {}) {
  const location = { pathname, search, hash };
  const win = { location, history: { replaceState: () => {} } };
  Object.defineProperty(globalThis, "window", { value: win, configurable: true });
  return { location, win };
}

afterEach(() => {
  mock.restoreAll();
  delete globalThis.window;
});

test("consumeTokenFromUrl does nothing when token query param is absent", () => {
  mockWindow({ search: "?foo=bar" });
  const calls = [];
  consumeTokenFromUrl((t) => calls.push(t));
  assert.deepEqual(calls, []);
});

test("consumeTokenFromUrl stores token and strips it from the URL", () => {
  const { location, win } = mockWindow({ pathname: "/host", search: "?token=abc123&tab=lib", hash: "#panel" });
  const replaceState = mock.fn();
  win.history.replaceState = replaceState;

  const calls = [];
  consumeTokenFromUrl((t) => calls.push(t));

  assert.deepEqual(calls, ["abc123"]);
  assert.equal(replaceState.mock.callCount(), 1);
  assert.deepEqual(replaceState.mock.calls[0].arguments, [{}, "", "/host?tab=lib#panel"]);
  assert.equal(location.search, "?token=abc123&tab=lib");
});

test("consumeTokenFromUrl removes lone token param leaving clean path", () => {
  const { win } = mockWindow({ pathname: "/dashboard", search: "?token=only" });
  const replaceState = mock.fn();
  win.history.replaceState = replaceState;

  consumeTokenFromUrl(() => {});

  assert.deepEqual(replaceState.mock.calls[0].arguments, [{}, "", "/dashboard"]);
});
