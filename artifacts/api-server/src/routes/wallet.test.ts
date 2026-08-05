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

const USER_TOKEN = "user-wallet-token";
const PLAYER_ID = "player-1";
const WITHDRAWAL_ID = "550e8400-e29b-41d4-a716-446655440001";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function makeQueryableChain() {
  const limitResult = vi.fn(async () => nextResult());
  const orderByResult = vi.fn(() => ({
    limit: limitResult,
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  }));
  return {
    orderBy: orderByResult,
    limit: limitResult,
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
}

function makeFromChain() {
  return {
    where: vi.fn(() => makeQueryableChain()),
    orderBy: vi.fn(async () => nextResult()),
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
}

function chainSelect() {
  return {
    from: vi.fn(() => makeFromChain()),
  };
}

function makeWhere() {
  return Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(async () => nextResult()),
  });
}

const mockDb = {
  select: vi.fn(() => chainSelect()),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  })),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
};

const mockResolveOwnerByToken = vi.fn<
  (
    token: string,
  ) => Promise<{
    id: string;
    type: "host" | "player" | "dev_key";
    displayName: string;
    internalBalanceLzt: number;
    withdrawableBalanceLzt: number;
    creditLimitLzt: number;
    creditDebtLzt: number;
    creditReceivableLzt: number;
    lifetimeDepositUsdtCents: number;
    premiumUntil: Date | null;
    token: string;
    createdAt: Date;
  } | null>
>();

const mockEnsureDepositAddressesForOwner = vi.fn(async () => [
  {
    currency: "USDT_TRC20",
    label: "TRC20",
    address: "TTestAddress123",
    network: "TRON",
    minDeposit: "10",
  },
]);

const mockRecordWithdrawalDebit = vi.fn(async () => true);

vi.mock("../lib/rateLimit", () => ({
  rateLimit: () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
  ipKey: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
  },
  playersTable: {
    id: "id",
    playerToken: "playerToken",
  },
  withdrawalsTable: {
    id: "id",
    ownerType: "ownerType",
    ownerId: "ownerId",
    currency: "currency",
    address: "address",
    amount: "amount",
    status: "status",
    requestedAt: "requestedAt",
    completedAt: "completedAt",
  },
  depositsTable: {
    id: "id",
    ownerType: "ownerType",
    ownerId: "ownerId",
    currency: "currency",
    netAmount: "netAmount",
    status: "status",
    detectedAt: "detectedAt",
  },
  billingEventsTable: {
    id: "id",
    hostId: "hostId",
    playerId: "playerId",
    hostCreditLzt: "hostCreditLzt",
    playerDebitLzt: "playerDebitLzt",
    bucket: "bucket",
    minutes: "minutes",
    billedAt: "billedAt",
  },
  ledgerTable: {
    id: "id",
    ownerType: "ownerType",
    ownerId: "ownerId",
    kind: "kind",
    bucket: "bucket",
    deltaLzt: "deltaLzt",
    note: "note",
    createdAt: "createdAt",
  },
}));

vi.mock("../lib/walletOwner", () => ({
  resolveOwnerByToken: (token: string) => mockResolveOwnerByToken(token),
  ensureDepositAddressesForOwner: (...args: unknown[]) =>
    mockEnsureDepositAddressesForOwner(...args),
}));

vi.mock("../lib/economy", () => ({
  recordWithdrawalDebit: (...args: unknown[]) =>
    mockRecordWithdrawalDebit(...args),
}));

const { default: walletRouter } = await import("./wallet");

let baseUrl = "";
let server: Server;

let ipCounter = 0;

async function request(
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: unknown;
    ip?: string;
  } = {},
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.ip ? { "X-Forwarded-For": opts.ip } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
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

function testIp(): string {
  ipCounter += 1;
  return `10.3.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

function playerOwner() {
  return {
    id: PLAYER_ID,
    type: "player" as const,
    displayName: "Test Player",
    internalBalanceLzt: 10_000,
    withdrawableBalanceLzt: 5_000,
    creditLimitLzt: 3_000,
    creditDebtLzt: 0,
    creditReceivableLzt: 0,
    lifetimeDepositUsdtCents: 5_000,
    premiumUntil: null,
    token: USER_TOKEN,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

beforeAll(async () => {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(express.json());
  app.use(walletRouter);
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
  mockRecordWithdrawalDebit.mockResolvedValue(true);
  mockEnsureDepositAddressesForOwner.mockResolvedValue([
    {
      currency: "USDT_TRC20",
      label: "TRC20",
      address: "TTestAddress123",
      network: "TRON",
      minDeposit: "10",
    },
  ]);
  mockDb.select.mockImplementation(() => chainSelect());
  mockDb.insert.mockImplementation(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  }));
  mockDb.transaction.mockImplementation(async (fn) => fn(mockDb));
});

describe("GET /wallet/:userToken", () => {
  it("returns 404 when user is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("GET", `/wallet/unknown-token`);
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "User not found" });
  });

  it("returns wallet overview for a valid player", async () => {
    mockResolveOwnerByToken.mockResolvedValue(playerOwner());
    queueResults(
      [],
      [{ total: "1.500000" }],
    );
    const res = await request("GET", `/wallet/${USER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      ownerType: "player",
      ownerId: PLAYER_ID,
      displayName: "Test Player",
      internalBalanceLzt: 10_000,
      withdrawableBalanceLzt: 5_000,
      balanceLzt: 10_000,
      cashLzt: 5_000,
      pendingWithdrawalsLzt: 300,
      lztPerUsdt: 200,
      depositAddresses: [
        {
          currency: "USDT_TRC20",
          label: "TRC20",
          address: "TTestAddress123",
          network: "TRON",
          minDeposit: 10,
        },
      ],
      recentWithdrawals: [],
    });
    expect(mockEnsureDepositAddressesForOwner).toHaveBeenCalledWith(
      "player",
      PLAYER_ID,
    );
  });
});

describe("GET /wallet/:userToken/transactions", () => {
  it("returns 404 when user is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("GET", `/wallet/unknown-token/transactions`);
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "User not found" });
  });

  it("returns ledger transactions sorted newest first", async () => {
    mockResolveOwnerByToken.mockResolvedValue(playerOwner());
    const older = new Date("2026-01-01T10:00:00.000Z");
    const newer = new Date("2026-01-02T10:00:00.000Z");
    queueResults(
      [
        {
          id: 1,
          kind: "deposit_credit",
          bucket: "cash",
          deltaLzt: 400,
          note: "Deposit credited",
          createdAt: older,
        },
        {
          id: 2,
          kind: "session_tick",
          bucket: "balance",
          deltaLzt: -50,
          note: null,
          createdAt: newer,
        },
      ],
      [{ first: older }],
      [],
      [],
      [],
    );
    const res = await request("GET", `/wallet/${USER_TOKEN}/transactions`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        id: "led-2",
        kind: "session_tick",
        currency: "balance",
        amountLzt: -50,
        bucket: "balance",
        status: null,
        description: "session_tick",
        timestamp: newer.toISOString(),
      },
      {
        id: "led-1",
        kind: "deposit_credit",
        currency: "cash",
        amountLzt: 400,
        bucket: "cash",
        status: null,
        description: "Deposit credited",
        timestamp: older.toISOString(),
      },
    ]);
  });
});

describe("POST /wallet/:userToken/withdraw", () => {
  it("returns 400 when body is invalid", async () => {
    const res = await request("POST", `/wallet/${USER_TOKEN}/withdraw`, {
      ip: testIp(),
      body: { currency: "USDT_TRC20", address: "TAddr" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when amountLzt is not positive", async () => {
    const res = await request("POST", `/wallet/${USER_TOKEN}/withdraw`, {
      ip: testIp(),
      body: {
        currency: "USDT_TRC20",
        address: "TAddr",
        amountLzt: 0,
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "amountLzt must be a positive integer",
    });
  });

  it("returns 404 when user is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", `/wallet/${USER_TOKEN}/withdraw`, {
      ip: testIp(),
      body: {
        currency: "USDT_TRC20",
        address: "TAddr",
        amountLzt: 400,
      },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "User not found" });
  });

  it("returns 400 when owner is dev_key", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      ...playerOwner(),
      type: "dev_key",
    });
    const res = await request("POST", `/wallet/${USER_TOKEN}/withdraw`, {
      ip: testIp(),
      body: {
        currency: "USDT_TRC20",
        address: "TAddr",
        amountLzt: 400,
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "dev_key_no_withdrawal",
      message: "API keys cannot withdraw — deposit-only wallet",
    });
  });

  it("returns 400 when cash balance is insufficient", async () => {
    mockResolveOwnerByToken.mockResolvedValue(playerOwner());
    mockRecordWithdrawalDebit.mockResolvedValue(false);
    const res = await request("POST", `/wallet/${USER_TOKEN}/withdraw`, {
      ip: testIp(),
      body: {
        currency: "USDT_TRC20",
        address: "TAddr",
        amountLzt: 400,
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "Insufficient зелёный (cash) balance",
    });
  });

  it("creates a pending withdrawal and returns 201", async () => {
    mockResolveOwnerByToken.mockResolvedValue(playerOwner());
    const requestedAt = new Date("2026-02-01T12:00:00.000Z");
    queueResults([
      {
        id: WITHDRAWAL_ID,
        ownerType: "player",
        ownerId: PLAYER_ID,
        currency: "USDT_TRC20",
        address: "TAddr",
        amount: "2.000000",
        status: "pending",
        requestedAt,
        completedAt: null,
      },
    ]);
    const res = await request("POST", `/wallet/${USER_TOKEN}/withdraw`, {
      ip: testIp(),
      body: {
        currency: "USDT_TRC20",
        address: "TAddr",
        amountLzt: 400,
      },
    });
    expect(res.status).toBe(201);
    expect(res.json).toEqual({
      id: WITHDRAWAL_ID,
      ownerType: "player",
      ownerId: PLAYER_ID,
      currency: "USDT_TRC20",
      address: "TAddr",
      amountUsdt: 2,
      amountLzt: 400,
      status: "pending",
      requestedAt: requestedAt.toISOString(),
      completedAt: null,
    });
    expect(mockRecordWithdrawalDebit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        ownerType: "player",
        ownerId: PLAYER_ID,
        amountLzt: 400,
        amountUsdtCents: 200,
      }),
    );
  });
});
