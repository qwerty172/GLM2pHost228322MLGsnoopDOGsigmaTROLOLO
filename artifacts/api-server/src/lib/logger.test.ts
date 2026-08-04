import { describe, expect, it } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  it("exports a pino logger with standard methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.child).toBe("function");
  });
});
