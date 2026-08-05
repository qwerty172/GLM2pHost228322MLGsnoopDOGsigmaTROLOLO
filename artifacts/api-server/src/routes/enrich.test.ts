import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.RATE_LIMIT_STORAGE = "memory";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function chainSelect() {
  const whereResult = vi.fn(async () => nextResult());
  return {
    from: vi.fn(() => ({
      where: whereResult,
    })),
  };
}

function makeWhere() {
  return Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(async () => nextResult()),
  });
}

const mockDb = {
  select: vi.fn(() => chainSelect()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  gamesTable: {
    id: "id",
    steamAppId: "steamAppId",
    recSpecs: "recSpecs",
    specsSource: "specsSource",
    specsFetchedAt: "specsFetchedAt",
  },
}));

const originalFetch = globalThis.fetch.bind(globalThis);
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const { default: enrichRouter } = await import("./enrich");

let baseUrl = "";
let server: Server;

function mockExternalFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.startsWith(baseUrl)) {
      return originalFetch(input, init);
    }
    return handler(url, init);
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function request(path: string) {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json };
}

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(enrichRouter);
  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  queryQueue.length = 0;
  vi.clearAllMocks();
  delete process.env.RAWG_API_KEY;
  mockDb.select.mockImplementation(() => chainSelect());
  fetchMock.mockImplementation((input, init) => originalFetch(input, init));
});

afterEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => originalFetch(input, init));
});

describe("GET /games/rawg-search", () => {
  it("returns 400 when q is too short", async () => {
    const res = await request("/games/rawg-search?q=a");
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "q must be 2–100 chars" });
  });

  it("returns Steam search results when RAWG_API_KEY is not set", async () => {
    mockExternalFetch(() =>
      jsonResponse({
        items: [
          {
            id: 570,
            name: "Dota 2",
            tiny_image: "https://cdn.example/tiny.jpg",
            metascore: "90",
            platforms: { windows: true },
          },
          {
            id: 999,
            name: "Console Only",
            tiny_image: "https://cdn.example/console.jpg",
            metascore: "",
            platforms: { windows: false },
          },
        ],
      }),
    );

    const res = await request("/games/rawg-search?q=dota");
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        rawgId: "570",
        title: "Dota 2",
        coverImageUrl:
          "https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg",
        genres: [],
        rating: null,
        metacritic: 90,
        steamAppId: "570",
        source: "steam",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("store.steampowered.com/api/storesearch/"),
      expect.objectContaining({
        headers: { "User-Agent": "DecentralHub/1.0" },
      }),
    );
  });

  it("returns RAWG results when RAWG_API_KEY is configured", async () => {
    process.env.RAWG_API_KEY = "test-rawg-key";
    mockExternalFetch(() =>
      jsonResponse({
        results: [
          {
            id: 42,
            name: "Test Game",
            background_image: "https://cdn.example/cover.jpg",
            genres: [{ name: "Action" }],
            rating: 4.5,
            metacritic: 88,
          },
        ],
      }),
    );

    const res = await request("/games/rawg-search?q=portal");
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        rawgId: "42",
        title: "Test Game",
        coverImageUrl: "https://cdn.example/cover.jpg",
        genres: ["Action"],
        rating: 4.5,
        metacritic: 88,
        source: "rawg",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.rawg.io/api/games"),
      expect.any(Object),
    );
  });

  it("returns 502 when upstream search fails", async () => {
    mockExternalFetch(() => jsonResponse({}, 503));

    const res = await request("/games/rawg-search?q=failcase");
    expect(res.status).toBe(502);
    expect(res.json).toMatchObject({ error: "Game search failed" });
  });
});

describe("GET /games/steam-lookup", () => {
  it("returns 400 for non-numeric appId", async () => {
    const res = await request("/games/steam-lookup?appId=abc");
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "appId must be numeric" });
  });

  it("returns Steam metadata and updates catalog specs when game exists", async () => {
    queueResults([{ id: "game-1" }]);

    mockExternalFetch((url) => {
      if (url.includes("appdetails")) {
        return jsonResponse({
          "730": {
            success: true,
            data: {
              name: "Counter-Strike 2",
              short_description: "FPS classic",
              header_image: "https://cdn.example/cs2.jpg",
              genres: [{ description: "Action" }],
              metacritic: { score: 85 },
              pc_requirements: {
                minimum:
                  "<strong>Memory:</strong> 8 GB RAM<br><strong>Graphics:</strong> 4 GB VRAM",
                recommended:
                  "<strong>Memory:</strong> 16 GB RAM<br><strong>Graphics:</strong> 8 GB VRAM",
              },
            },
          },
        });
      }
      if (url.includes("GetNumberOfCurrentPlayers")) {
        return jsonResponse({ response: { player_count: 123456 } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await request("/games/steam-lookup?appId=730");
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      steamAppId: "730",
      title: "Counter-Strike 2",
      coverImageUrl: "https://cdn.example/cs2.jpg",
      description: "FPS classic",
      genres: ["Action"],
      metacritic: 85,
      currentPlayers: 123456,
      recSpecs: {
        gpuVram: 8,
        ramGb: 16,
      },
      minSpecs: {
        gpuVram: 4,
        ramGb: 8,
      },
    });
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("returns 502 when Steam app is missing", async () => {
    mockExternalFetch((url) => {
      if (url.includes("appdetails")) {
        return jsonResponse({
          "999999": { success: false },
        });
      }
      if (url.includes("GetNumberOfCurrentPlayers")) {
        return jsonResponse({ response: { player_count: 0 } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await request("/games/steam-lookup?appId=999999");
    expect(res.status).toBe(502);
    expect(res.json).toMatchObject({ error: "Steam lookup failed" });
  });
});
