import { describe, expect, it } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  it("exposes pino logger", () => {
    expect(typeof logger.info).toBe("function");
    expect(() => logger.info("marathon smoke")).not.toThrow();
  });
});
