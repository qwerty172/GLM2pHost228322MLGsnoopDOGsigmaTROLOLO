import { test } from "node:test";
import assert from "node:assert/strict";

const { formatGenreLabel } = await import("../src/lib/genre-names.ts");
const { PLAYER_ONBOARDING_STORAGE_KEY } = await import(
  "../src/components/player-onboarding.tsx"
);

test("formatGenreLabel maps known English genres to Russian", () => {
  assert.equal(formatGenreLabel("platformer"), "Платформер");
  assert.equal(formatGenreLabel("Metroidvania"), "Метроидвания");
  assert.equal(formatGenreLabel("browser roguelike"), "Рогалик");
});

test("formatGenreLabel capitalizes unknown genres", () => {
  assert.equal(formatGenreLabel("souls-like"), "Souls Like");
});

test("PLAYER_ONBOARDING_STORAGE_KEY follows streamline namespace", () => {
  assert.equal(PLAYER_ONBOARDING_STORAGE_KEY, "streamline.playerOnboardingDone");
});
