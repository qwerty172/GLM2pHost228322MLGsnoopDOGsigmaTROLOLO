import { describe, expect, it } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  it("exports pino logger", () => {
    expect(logger).toBeTruthy();
    expect(typeof logger.info).toBe("function");
  });
});
