import { describe, expect, it } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  it("exports pino logger", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.child).toBe("function");
  });
});
