import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("hostLibrary", () => {
  it("exports library CRUD helpers", async () => {
    const mod = await import("./hostLibrary");
    expect(typeof mod.listLibrary).toBe("function");
    expect(typeof mod.addToLibrary).toBe("function");
    expect(typeof mod.updateEntry).toBe("function");
    expect(typeof mod.removeFromLibrary).toBe("function");
    expect(typeof mod.findHostsForGame).toBe("function");
  });
});
