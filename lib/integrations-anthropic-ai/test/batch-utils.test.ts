import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  batchProcess,
  batchProcessWithSSE,
  isRateLimitError,
} from "../src/batch/utils.ts";

describe("isRateLimitError", () => {
  it("detects HTTP 429 in Error message", () => {
    assert.equal(isRateLimitError(new Error("API error 429")), true);
  });

  it("detects RATELIMIT_EXCEEDED token", () => {
    assert.equal(isRateLimitError(new Error("RATELIMIT_EXCEEDED")), true);
  });

  it("detects quota in message (case-insensitive)", () => {
    assert.equal(isRateLimitError(new Error("Quota exceeded")), true);
  });

  it("detects rate limit in message (case-insensitive)", () => {
    assert.equal(isRateLimitError(new Error("Rate Limit hit")), true);
  });

  it("returns false for unrelated errors", () => {
    assert.equal(isRateLimitError(new Error("network timeout")), false);
    assert.equal(isRateLimitError("something else"), false);
    assert.equal(isRateLimitError(null), false);
  });
});

describe("batchProcess", () => {
  it("processes all items and preserves order", async () => {
    const results = await batchProcess(
      ["a", "b", "c"],
      async (item) => item.toUpperCase(),
      { concurrency: 2, retries: 0, minTimeout: 1, maxTimeout: 1 }
    );
    assert.deepEqual(results, ["A", "B", "C"]);
  });

  it("passes item index to processor", async () => {
    const indices: number[] = [];
    await batchProcess(
      ["x", "y"],
      async (_item, index) => {
        indices.push(index);
        return index;
      },
      { concurrency: 1, retries: 0, minTimeout: 1, maxTimeout: 1 }
    );
    assert.deepEqual(indices, [0, 1]);
  });

  it("calls onProgress after each successful item", async () => {
    const progress: Array<[number, number, unknown]> = [];
    await batchProcess(
      [1, 2],
      async (item) => item * 2,
      {
        concurrency: 1,
        retries: 0,
        minTimeout: 1,
        maxTimeout: 1,
        onProgress: (completed, total, item) => {
          progress.push([completed, total, item]);
        },
      }
    );
    assert.deepEqual(progress, [
      [1, 2, 1],
      [2, 2, 2],
    ]);
  });

  it("retries on rate-limit errors", async () => {
    let attempts = 0;
    const results = await batchProcess(
      ["only"],
      async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error("429 Too Many Requests");
        }
        return "ok";
      },
      { concurrency: 1, retries: 2, minTimeout: 1, maxTimeout: 1 }
    );
    assert.equal(attempts, 2);
    assert.deepEqual(results, ["ok"]);
  });

  it("does not retry non-rate-limit errors", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        batchProcess(
          ["fail"],
          async () => {
            attempts++;
            throw new Error("validation failed");
          },
          { concurrency: 1, retries: 5, minTimeout: 1, maxTimeout: 1 }
        ),
      /validation failed/
    );
    assert.equal(attempts, 1);
  });
});

describe("batchProcessWithSSE", () => {
  it("emits started, processing, progress and complete events", async () => {
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const sendEvent = mock.fn((event: { type: string; [key: string]: unknown }) => {
      events.push(event);
    });

    const results = await batchProcessWithSSE(
      ["a", "b"],
      async (item) => item.toUpperCase(),
      sendEvent,
      { retries: 0, minTimeout: 1, maxTimeout: 1 }
    );

    assert.deepEqual(results, ["A", "B"]);
    assert.equal(events[0]?.type, "started");
    assert.equal(events[0]?.total, 2);
    assert.equal(events.at(-1)?.type, "complete");
    assert.equal(events.at(-1)?.processed, 2);
    assert.equal(events.at(-1)?.errors, 0);

    const processing = events.filter((e) => e.type === "processing");
    const progress = events.filter((e) => e.type === "progress" && !("error" in e));
    assert.equal(processing.length, 2);
    assert.equal(progress.length, 2);
  });

  it("captures per-item failures without aborting the batch", async () => {
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const sendEvent = (event: { type: string; [key: string]: unknown }) => {
      events.push(event);
    };

    const results = await batchProcessWithSSE(
      ["ok", "bad"],
      async (item) => {
        if (item === "bad") throw new Error("boom");
        return item;
      },
      sendEvent,
      { retries: 0, minTimeout: 1, maxTimeout: 1 }
    );

    assert.deepEqual(results, ["ok", undefined]);
    const errorProgress = events.find(
      (e) => e.type === "progress" && e.index === 1 && "error" in e
    );
    assert.ok(errorProgress?.error);
    assert.equal(events.at(-1)?.errors, 1);
  });

  it("aborts retry on non-rate-limit errors (p-retry v7 FailedAttemptError)", async () => {
    let attempts = 0;
    const results = await batchProcessWithSSE(
      ["x"],
      async () => {
        attempts++;
        throw new Error("validation failed");
      },
      () => undefined,
      { retries: 5, minTimeout: 1, maxTimeout: 1 }
    );

    assert.equal(attempts, 1);
    assert.deepEqual(results, [undefined]);
  });
});
