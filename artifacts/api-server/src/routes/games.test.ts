import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.RATE_LIMIT_STORAGE = "memory";

const GAME_SLUG = "test-game";
const HOST_ID = "host-1";
const GAME_ID = "game-1";

const GAME = {
  id: GAME_ID,
  slug: GAME_SLUG,
  title: "Test Game",
  coverImageUrl: "https://example.com/cover.png",
  description: "A test game",
  genre: "action",
  category: "action",
  genres: ["action", "adventure"],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  hasMods: false,
  isMultiplayer: true,
  hostSpectatesPlayer: false,
  hasQuests: false,
  browserHostUrl: "",
  saveManifest: [],
  isHidden: false,
  steamAppId: null,
  recSpecs: null,
  specsSource: null,
  specsFetchedAt: null,
};

const HOST = {
  id: HOST_ID,
  displayName: "Test Host",
  scheduleMode: "always",
  scheduleJson: [],
  tags: ["fps"],
  boundAppLabel: "Test Game",
  boundUrl: "",
  description: "A host",
  launchPriceUsd: "1.00",
  minutePriceUsd: "0.05",
  streamPlatform: "obs",
  pingMs: 20,
  ratingAvg: "4.5",
  ratingCount: 10,
  gameId: GAME_ID,
  isVds: 0,
  hostToken: "admin-host-token",
  isAdmin: 1,
};

const SESSION = {
  id: "session-1",
  hostId: HOST_ID,
  playerToken: "player-token",
  appName: "Test Game",
  ratePerMinute: "0.05",
  resolution: "1920x1080",
  bitrateKbps: 8000,
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  gameId: GAME_ID,
};

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function makeQueryableChain() {
  const orderByResult = vi.fn(async () => nextResult());
  const groupByResult = vi.fn(async () => nextResult());
  const chain = {
    orderBy: orderByResult,
    groupBy: groupByResult,
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
  return chain;
}

function chainSelect() {
  const innerJoinChain = {
    where: vi.fn(() => makeQueryableChain()),
  };
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => makeQueryableChain()),
      orderBy: vi.fn(async () => nextResult()),
      innerJoin: vi.fn(() => innerJoinChain),
    })),
  };
}

function chainSelectDistinct() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(async () => nextResult()),
    })),
  };
}

const mockDb = {
  select: vi.fn(() => chainSelect()),
  selectDistinct: vi.fn(() => chainSelectDistinct()),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  gamesTable: {
    id: "id",
    slug: "slug",
    title: "title",
    coverImageUrl: "coverImageUrl",
    description: "description",
    genre: "genre",
    category: "category",
    genres: "genres",
    createdAt: "createdAt",
    hasMods: "hasMods",
    isMultiplayer: "isMultiplayer",
    hostSpectatesPlayer: "hostSpectatesPlayer",
    hasQuests: "hasQuests",
    browserHostUrl: "browserHostUrl",
    saveManifest: "saveManifest",
    isHidden: "isHidden",
  },
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    isAdmin: "isAdmin",
    displayName: "displayName",
    scheduleMode: "scheduleMode",
    scheduleJson: "scheduleJson",
    tags: "tags",
    boundAppLabel: "boundAppLabel",
    boundUrl: "boundUrl",
    description: "description",
    launchPriceUsd: "launchPriceUsd",
    minutePriceUsd: "minutePriceUsd",
    streamPlatform: "streamPlatform",
    pingMs: "pingMs",
    ratingAvg: "ratingAvg",
    ratingCount: "ratingCount",
    gameId: "gameId",
    isVds: "isVds",
  },
  hostGamesTable: {
    gameId: "gameId",
    hostId: "hostId",
    enabled: "enabled",
    pricePerMinuteLzt: "pricePerMinuteLzt",
  },
  sessionsTable: {
    id: "id",
    hostId: "hostId",
    playerToken: "playerToken",
    appName: "appName",
    ratePerMinute: "ratePerMinute",
    resolution: "resolution",
    bitrateKbps: "bitrateKbps",
    status: "status",
    createdAt: "createdAt",
    gameId: "gameId",
  },
}));

const { default: gamesRouter } = await import("./games");

let baseUrl = "";
let server: Server;

async function request(path: string, headers?: Record<string, string>) {
  const res = await fetch(`${baseUrl}${path}`, { headers });
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
  app.use(gamesRouter);
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
  mockDb.select.mockImplementation(() => chainSelect());
  mockDb.selectDistinct.mockImplementation(() => chainSelectDistinct());
});

describe("GET /games", () => {
  it("returns catalog games with live counts and aggregates", async () => {
    queueResults(
      [GAME],
      [{ appName: "Test Game", n: 2 }],
      [{ hostId: HOST_ID }],
      [
        {
          gameId: GAME_ID,
          hostId: HOST_ID,
          pricePerMinuteLzt: 50,
          isVds: 0,
        },
      ],
    );

    const res = await request("/games");
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        id: GAME_ID,
        slug: GAME_SLUG,
        title: GAME.title,
        coverImageUrl: GAME.coverImageUrl,
        description: GAME.description,
        genre: GAME.genre,
        category: GAME.category,
        genres: GAME.genres,
        createdAt: GAME.createdAt.toISOString(),
        hasMods: GAME.hasMods,
        isMultiplayer: GAME.isMultiplayer,
        hostSpectatesPlayer: GAME.hostSpectatesPlayer,
        hasQuests: GAME.hasQuests,
        browserHostUrl: GAME.browserHostUrl,
        liveSessionCount: 2,
        liveHostsCount: 1,
        vdsHostsCount: 0,
        hasVdsHosts: false,
        minPricePerMinuteLzt: 50,
      },
    ]);
  });

  it("returns 400 for invalid boolean query params", async () => {
    const res = await request("/games?hasMods=maybe");
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("treats hasMods=false as false, not a truthy filter", async () => {
    queueResults(
      [GAME],
      [],
      [],
      [],
    );

    const res = await request("/games?hasMods=false");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect((res.json as unknown[]).length).toBe(1);
  });
});

describe("GET /games/:slug", () => {
  it("returns 404 when slug is unknown", async () => {
    queueResults([]);
    const res = await request(`/games/${GAME_SLUG}`);
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Game not found" });
  });

  it("returns 404 for hidden games without admin token", async () => {
    queueResults([{ ...GAME, isHidden: true }], []);
    const res = await request(`/games/${GAME_SLUG}`);
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Game not found" });
  });

  it("returns game detail with live sessions", async () => {
    queueResults(
      [GAME],
      [{ session: SESSION, host: HOST }],
      [{ hostId: HOST_ID }],
      [
        {
          gameId: GAME_ID,
          hostId: HOST_ID,
          pricePerMinuteLzt: 40,
          isVds: 0,
        },
      ],
    );

    const res = await request(`/games/${GAME_SLUG}`);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: GAME_ID,
      slug: GAME_SLUG,
      title: GAME.title,
      liveSessionCount: 1,
      liveHostsCount: 1,
      minPricePerMinuteLzt: 40,
      liveSessions: [
        {
          hostId: HOST_ID,
          playerToken: SESSION.playerToken,
          appName: SESSION.appName,
          ratePerMinute: 0.05,
          pricePerMinuteLzt: 10,
          resolution: SESSION.resolution,
          bitrateKbps: SESSION.bitrateKbps,
          status: SESSION.status,
          hostDisplayName: HOST.displayName,
          boundAppLabel: HOST.boundAppLabel,
          boundUrl: HOST.boundUrl,
          description: HOST.description,
          tags: HOST.tags,
          launchPriceUsd: 1,
          minutePriceUsd: 0.05,
          scheduleMode: HOST.scheduleMode,
          scheduleJson: HOST.scheduleJson,
          streamPlatform: HOST.streamPlatform,
          pingMs: HOST.pingMs,
          ratingScore: 4.5,
          ratingCount: HOST.ratingCount,
        },
      ],
    });
    expect(
      (res.json as { liveSessions: Array<{ createdAt: string }> }).liveSessions[0]
        .createdAt,
    ).toBe(SESSION.createdAt.toISOString());
  });

  it("filters live sessions by host tag query param", async () => {
    queueResults(
      [GAME],
      [
        { session: SESSION, host: HOST },
        {
          session: { ...SESSION, id: "session-2", playerToken: "other" },
          host: { ...HOST, id: "host-2", tags: ["rpg"] },
        },
      ],
      [{ hostId: HOST_ID }],
      [],
    );

    const res = await request(`/games/${GAME_SLUG}?tag=fps`);
    expect(res.status).toBe(200);
    const body = res.json as { liveSessions: Array<{ hostId: string }> };
    expect(body.liveSessions).toHaveLength(1);
    expect(body.liveSessions[0].hostId).toBe(HOST_ID);
  });
});
