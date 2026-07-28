import { describe, it, expect } from "vitest";
import { HealthCheckResponse } from "@workspace/api-zod";

describe("routes smoke (contract)", () => {
  it("healthz response shape", () => {
    expect(HealthCheckResponse.parse({ status: "ok" })).toEqual({ status: "ok" });
  });
});
