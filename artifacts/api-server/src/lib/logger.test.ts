import { describe, expect, it } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  it("exports a pino logger", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
  });
});
