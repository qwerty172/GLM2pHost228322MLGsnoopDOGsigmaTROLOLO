import { test } from "node:test";
import assert from "node:assert/strict";

const {
  ADMIN_GAMES_SECRET_KEY,
  adminRequestInit,
  getAdminApiErrorMessage,
  gameSubmissionStatusLabel,
  formatAdminAccessError,
  resolveAdminCoverImageUrl,
} = await import("../src/pages/admin/games.tsx");

test("ADMIN_GAMES_SECRET_KEY is streamline.adminSecret", () => {
  assert.equal(ADMIN_GAMES_SECRET_KEY, "streamline.adminSecret");
});

test("adminRequestInit sets host token and optional admin secret header", () => {
  assert.deepEqual(adminRequestInit("host-tok", ""), {
    headers: { "X-Host-Token": "host-tok" },
  });
  assert.deepEqual(adminRequestInit("host-tok", "secret-xyz"), {
    headers: {
      "X-Host-Token": "host-tok",
      "X-Admin-Secret": "secret-xyz",
    },
  });
});

test("getAdminApiErrorMessage extracts API error payload", () => {
  assert.equal(
    getAdminApiErrorMessage({ data: { error: "Forbidden" } }),
    "Forbidden",
  );
  assert.equal(getAdminApiErrorMessage(new Error("network fail")), "network fail");
  assert.equal(getAdminApiErrorMessage(null), "Неизвестная ошибка");
});

test("gameSubmissionStatusLabel maps submission statuses to Russian", () => {
  assert.equal(gameSubmissionStatusLabel("pending"), "На рассмотрении");
  assert.equal(gameSubmissionStatusLabel("approved"), "Одобрено");
  assert.equal(gameSubmissionStatusLabel("rejected"), "Отклонено");
});

test("formatAdminAccessError localizes admin access denial", () => {
  assert.equal(
    formatAdminAccessError("Admin access required"),
    "У тебя нет прав администратора.",
  );
  assert.equal(formatAdminAccessError("Other error"), "Other error");
});

test("resolveAdminCoverImageUrl prefixes API paths with base URL", () => {
  assert.equal(
    resolveAdminCoverImageUrl("/api/storage/cover.png", "/app/"),
    "/app/api/storage/cover.png",
  );
  assert.equal(
    resolveAdminCoverImageUrl("https://cdn.example/cover.png", "/app/"),
    "https://cdn.example/cover.png",
  );
});
