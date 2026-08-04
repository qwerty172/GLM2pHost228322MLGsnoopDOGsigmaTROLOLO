import { describe, expect, it } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  it("exports a pino logger with info level by default", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});
