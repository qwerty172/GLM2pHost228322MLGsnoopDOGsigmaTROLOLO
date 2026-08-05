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

const BORROWER_TOKEN = "borrower-token";
const LENDER_TOKEN = "lender-token";
const BORROWER_ID = "borrower-1";
const LENDER_ID = "lender-1";
const REQUEST_ID = "550e8400-e29b-41d4-a716-446655440001";
const LOAN_ID = "550e8400-e29b-41d4-a716-446655440002";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function makeWhereChain() {
  const limitResult = vi.fn(async () => nextResult());
  const afterOrderBy = { limit: limitResult };
  const chain = {
    orderBy: vi.fn(() => afterOrderBy),
    limit: limitResult,
    for: vi.fn(() => ({
      then(
        resolve: (value: QueryResult) => void,
        reject?: (reason: unknown) => void,
      ) {
        return Promise.resolve(nextResult()).then(resolve, reject);
      },
    })),
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
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => makeWhereChain()),
      orderBy: vi.fn(async () => nextResult()),
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
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
};

const mockResolveOwnerByToken = vi.fn<
  (token: string) => Promise<{ id: string; type: "host" | "player" } | null>
>();

const mockAdjustUserBucket = vi.fn<
  (
    tx: unknown,
    type: string,
    id: string,
    bucket: string,
    delta: number,
  ) => Promise<boolean>
>();

const mockAdjustSystem = vi.fn(async () => undefined);
const mockWriteLedger = vi.fn(async () => undefined);
const mockRepayBorrowerDebt = vi.fn(async () => 50);

vi.mock("../lib/rateLimit", () => ({
  rateLimit: () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    maxDepositUsdtCents: "maxDepositUsdtCents",
    maxWithdrawalUsdtCents: "maxWithdrawalUsdtCents",
    creditReceivableLzt: "creditReceivableLzt",
  },
  playersTable: {
    id: "id",
    playerToken: "playerToken",
    maxDepositUsdtCents: "maxDepositUsdtCents",
    maxWithdrawalUsdtCents: "maxWithdrawalUsdtCents",
    creditReceivableLzt: "creditReceivableLzt",
  },
  loansTable: {
    id: "id",
    borrowerType: "borrowerType",
    borrowerId: "borrowerId",
    lenderType: "lenderType",
    lenderId: "lenderId",
    outstandingLzt: "outstandingLzt",
    status: "status",
    startedAt: "startedAt",
  },
  loanRequestsTable: {
    id: "id",
    status: "status",
    createdAt: "createdAt",
    borrowerType: "borrowerType",
    borrowerId: "borrowerId",
    amountLzt: "amountLzt",
    fundedAmountLzt: "fundedAmountLzt",
    termDays: "termDays",
    rateBps: "rateBps",
    fundedLoanId: "fundedLoanId",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../lib/walletOwner", () => ({
  resolveOwnerByToken: (token: string) => mockResolveOwnerByToken(token),
}));

vi.mock("../lib/economy", () => ({
  adjustSystem: (...args: unknown[]) => mockAdjustSystem(...args),
  adjustUserBucket: (...args: unknown[]) => mockAdjustUserBucket(...args),
  pledgerLimitLzt: vi.fn(
    ({
      maxDepositUsdtCents,
      maxWithdrawalUsdtCents,
    }: {
      maxDepositUsdtCents: number;
      maxWithdrawalUsdtCents: number;
    }) => Math.max(maxDepositUsdtCents, maxWithdrawalUsdtCents) * 2,
  ),
  repayBorrowerDebt: (...args: unknown[]) => mockRepayBorrowerDebt(...args),
  SYSTEM_PLATFORM_FEES: "platform_fees",
  writeLedger: (...args: unknown[]) => mockWriteLedger(...args),
}));

const { default: loansRouter } = await import("./loans");

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
  return `10.1.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

beforeAll(async () => {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(express.json());
  app.use(loansRouter);
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
  mockAdjustUserBucket.mockResolvedValue(true);
  mockDb.select.mockImplementation(() => chainSelect());
  mockDb.insert.mockImplementation(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  }));
  mockDb.update.mockImplementation(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  }));
});

describe("POST /loans/requests", () => {
  it("returns 400 when userToken or amountLzt missing", async () => {
    const res = await request("POST", "/loans/requests", {
      body: { userToken: BORROWER_TOKEN },
      ip: testIp(),
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "userToken and positive amountLzt required",
    });
  });

  it("returns 400 when termDays is below minimum", async () => {
    const res = await request("POST", "/loans/requests", {
      ip: testIp(),
      body: {
        userToken: BORROWER_TOKEN,
        amountLzt: 100,
        termDays: 30,
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "termDays must be ≥ 60" });
  });

  it("returns 404 when user is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", "/loans/requests", {
      ip: testIp(),
      body: {
        userToken: "unknown",
        amountLzt: 100,
        termDays: 90,
      },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "User not found" });
  });

  it("returns 403 when Pledger limit is zero", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: BORROWER_ID,
      type: "player",
    });
    queueResults([{ maxDep: 0, maxWd: 0 }]);
    const res = await request("POST", "/loans/requests", {
      ip: testIp(),
      body: {
        userToken: BORROWER_TOKEN,
        amountLzt: 100,
        termDays: 90,
      },
    });
    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("Pledger limit is 0"),
    });
  });

  it("returns 400 when amount exceeds Pledger limit", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: BORROWER_ID,
      type: "player",
    });
    queueResults([{ maxDep: 100, maxWd: 50 }]);
    const res = await request("POST", "/loans/requests", {
      ip: testIp(),
      body: {
        userToken: BORROWER_TOKEN,
        amountLzt: 500,
        termDays: 90,
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("exceeds Pledger limit"),
    });
  });

  it("creates a loan request and returns 201", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: BORROWER_ID,
      type: "player",
    });
    const created = {
      id: REQUEST_ID,
      borrowerType: "player",
      borrowerId: BORROWER_ID,
      amountLzt: 200,
      termDays: 90,
      rateBps: 500,
      status: "open",
    };
    queueResults([{ maxDep: 500, maxWd: 1000 }], [created]);
    const res = await request("POST", "/loans/requests", {
      ip: testIp(),
      body: {
        userToken: BORROWER_TOKEN,
        amountLzt: 200,
        termDays: 90,
        rateBps: 500,
      },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject(created);
  });
});

describe("GET /loans/requests", () => {
  it("returns open loan requests", async () => {
    const rows = [
      {
        id: REQUEST_ID,
        borrowerType: "player",
        borrowerId: BORROWER_ID,
        amountLzt: 200,
        status: "open",
      },
    ];
    queueResults(rows);
    const res = await request("GET", "/loans/requests");
    expect(res.status).toBe(200);
    expect(res.json).toEqual(rows);
  });
});

describe("POST /loans/requests/:id/fund", () => {
  it("returns 400 when userToken is missing", async () => {
    const res = await request("POST", `/loans/requests/${REQUEST_ID}/fund`, {
      ip: testIp(),
      body: {},
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "userToken required" });
  });

  it("returns 400 for invalid source", async () => {
    const res = await request("POST", `/loans/requests/${REQUEST_ID}/fund`, {
      ip: testIp(),
      body: { userToken: LENDER_TOKEN, source: "invalid" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "source must be cash or balance" });
  });

  it("returns 400 for invalid payoutMode", async () => {
    const res = await request("POST", `/loans/requests/${REQUEST_ID}/fund`, {
      ip: testIp(),
      body: {
        userToken: LENDER_TOKEN,
        payoutMode: "invalid",
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "invalid payoutMode" });
  });

  it("returns 404 when lender is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", `/loans/requests/${REQUEST_ID}/fund`, {
      ip: testIp(),
      body: { userToken: "unknown" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "User not found" });
  });

  it("returns 400 when request is not open", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: LENDER_ID,
      type: "host",
    });
    queueResults([]);
    const res = await request("POST", `/loans/requests/${REQUEST_ID}/fund`, {
      ip: testIp(),
      body: { userToken: LENDER_TOKEN },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "Request not open" });
  });

  it("funds an open request and returns 201", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: LENDER_ID,
      type: "host",
    });
    const loanRequest = {
      id: REQUEST_ID,
      borrowerType: "player",
      borrowerId: BORROWER_ID,
      amountLzt: 1000,
      fundedAmountLzt: 0,
      termDays: 90,
      rateBps: 500,
      status: "open",
      fundedLoanId: null,
    };
    const loan = {
      id: LOAN_ID,
      loanType: "p2p",
      lenderType: "host",
      lenderId: LENDER_ID,
      borrowerType: "player",
      borrowerId: BORROWER_ID,
      principalLzt: 1000,
      outstandingLzt: 1000,
      status: "active",
    };
    queueResults([loanRequest], [loan]);
    const res = await request("POST", `/loans/requests/${REQUEST_ID}/fund`, {
      ip: testIp(),
      body: {
        userToken: LENDER_TOKEN,
        source: "cash",
        payoutMode: "cash_on_close",
      },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      loan,
      fundedAmountLzt: 1000,
      fullyFunded: true,
    });
    expect(mockAdjustUserBucket).toHaveBeenCalled();
    expect(mockWriteLedger).toHaveBeenCalled();
  });
});

describe("GET /loans/mine", () => {
  it("returns 400 when userToken is missing", async () => {
    const res = await request("GET", "/loans/mine");
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "userToken required" });
  });

  it("returns 404 when user is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("GET", "/loans/mine", {
      headers: { "X-User-Token": "unknown" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "User not found" });
  });

  it("returns caller loans as borrower and lender", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: BORROWER_ID,
      type: "player",
    });
    const asBorrower = [{ id: LOAN_ID, borrowerId: BORROWER_ID }];
    const asLender = [];
    queueResults(asBorrower, asLender);
    const res = await request("GET", "/loans/mine", {
      headers: { "X-User-Token": BORROWER_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ asBorrower, asLender });
  });
});

describe("POST /loans/:id/repay", () => {
  it("returns 400 when userToken or amountLzt missing", async () => {
    const res = await request("POST", `/loans/${LOAN_ID}/repay`, {
      ip: testIp(),
      body: { userToken: BORROWER_TOKEN },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "userToken and positive amountLzt required",
    });
  });

  it("returns 400 for invalid source", async () => {
    const res = await request("POST", `/loans/${LOAN_ID}/repay`, {
      ip: testIp(),
      body: {
        userToken: BORROWER_TOKEN,
        amountLzt: 50,
        source: "invalid",
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "source must be cash or balance" });
  });

  it("returns 404 when user is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", `/loans/${LOAN_ID}/repay`, {
      ip: testIp(),
      body: {
        userToken: "unknown",
        amountLzt: 50,
      },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "User not found" });
  });

  it("returns 400 when loan is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: BORROWER_ID,
      type: "player",
    });
    queueResults([]);
    const res = await request("POST", `/loans/${LOAN_ID}/repay`, {
      ip: testIp(),
      body: {
        userToken: BORROWER_TOKEN,
        amountLzt: 50,
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "Loan not found" });
  });

  it("repays a loan and returns repaid amount", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: BORROWER_ID,
      type: "player",
    });
    mockRepayBorrowerDebt.mockResolvedValue(50);
    const loan = {
      id: LOAN_ID,
      borrowerType: "player",
      borrowerId: BORROWER_ID,
      outstandingLzt: 100,
      status: "active",
    };
    queueResults([loan]);
    const res = await request("POST", `/loans/${LOAN_ID}/repay`, {
      ip: testIp(),
      body: {
        userToken: BORROWER_TOKEN,
        amountLzt: 50,
        source: "cash",
      },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ repaidLzt: 50 });
    expect(mockRepayBorrowerDebt).toHaveBeenCalled();
  });
});
