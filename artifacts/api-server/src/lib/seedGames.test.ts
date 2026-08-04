import { describe, expect, it } from "vitest";
import { seedGames } from "./seedGames";

describe("seedGames", () => {
  it("seedGames is exported", () => {
    expect(typeof seedGames).toBe("function");
  });
});
