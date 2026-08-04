import { describe, expect, it } from "vitest";
import { seedGames } from "./seedGames";

describe("seedGames", () => {
  it("exports seedGames", () => {
    expect(typeof seedGames).toBe("function");
  });
});
