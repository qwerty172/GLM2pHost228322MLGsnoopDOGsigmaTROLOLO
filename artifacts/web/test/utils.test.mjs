import { test } from "node:test";
import assert from "node:assert/strict";

const { cn } = await import("../src/lib/utils.ts");

test("cn merges plain class strings", () => {
  assert.equal(cn("foo", "bar"), "foo bar");
});

test("cn ignores falsy values", () => {
  assert.equal(cn("foo", false && "bar", null, undefined, "baz"), "foo baz");
});

test("cn resolves conditional class objects", () => {
  assert.equal(cn("base", { active: true, hidden: false }), "base active");
});

test("cn deduplicates conflicting tailwind utilities", () => {
  assert.equal(cn("p-2", "p-4"), "p-4");
  assert.equal(cn("text-red-500", "text-blue-500"), "text-blue-500");
});

test("cn keeps non-conflicting tailwind classes", () => {
  assert.equal(cn("p-2", "m-4", "flex"), "p-2 m-4 flex");
});
