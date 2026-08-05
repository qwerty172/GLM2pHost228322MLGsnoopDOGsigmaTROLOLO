import { test } from "node:test";
import assert from "node:assert/strict";

const { cn } = await import("../src/lib/utils.ts");

test("cn merges plain class strings", () => {
  assert.equal(cn("foo", "bar"), "foo bar");
});

test("cn ignores falsy values", () => {
  assert.equal(cn("foo", false, null, undefined, "", "bar"), "foo bar");
});

test("cn supports conditional class objects", () => {
  assert.equal(cn("base", { active: true, hidden: false }), "base active");
});

test("cn resolves conflicting tailwind utilities via tailwind-merge", () => {
  assert.equal(cn("px-2", "px-4"), "px-4");
  assert.equal(cn("text-red-500", "text-blue-500"), "text-blue-500");
});

test("cn handles arrays and nested inputs", () => {
  assert.equal(cn(["foo", ["bar", { baz: true }]]), "foo bar baz");
});
