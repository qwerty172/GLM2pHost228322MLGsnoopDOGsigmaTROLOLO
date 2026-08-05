import { test } from "node:test";
import assert from "node:assert/strict";

const {
  specsFromPcSpecs,
  computeQuotaHostTier,
  getQuotaCompatibility,
  validateQuotaFormFields,
} = await import("../src/lib/quota-compatibility.ts");

/** @returns {import("@workspace/api-client-react").Quota} */
function makeQuota(overrides = {}) {
  return {
    id: "q1",
    ownerType: "user",
    ownerId: "u1",
    ownerDisplayName: "Host",
    hasApiKey: false,
    apiKeyMasked: null,
    kind: "royalty",
    status: "active",
    title: "Test",
    description: "",
    gameId: null,
    gameTitle: null,
    visibility: "public",
    accessCode: null,
    minSessionMinutes: null,
    maxSessionMinutes: null,
    startAt: "2026-01-01T00:00:00.000Z",
    endAt: null,
    budgetLzt: null,
    escrowRemainingLzt: null,
    sponsorHostPerMinuteLzt: null,
    sponsorPlayerPerMinuteLzt: null,
    royaltyBasis: "percent",
    royaltyValue: 10,
    royaltySource: null,
    minGpuVram: null,
    minCpuCores: null,
    minRamGb: null,
    minDownloadMbps: null,
    minUploadMbps: null,
    recGpuVram: null,
    recCpuCores: null,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
    requiredTier: "min",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const strongPc = {
  gpu: "RTX 4070 12 GB",
  ramGb: 32,
  cpuCores: 12,
  uploadMbps: 50,
  downloadMbps: 100,
};

const baseFormFields = {
  minGpuVram: "",
  minCpuCores: "",
  minRamGb: "",
  minDownloadMbps: "",
  minUploadMbps: "",
  recGpuVram: "",
  recCpuCores: "",
  recRamGb: "",
  recDownloadMbps: "",
  recUploadMbps: "",
  minSessionMinutes: "",
  maxSessionMinutes: "",
  kind: "royalty",
  royaltyValue: 10,
  royaltyBasis: "percent",
  budgetLzt: 0,
  sponsorHostPerMinute: 0,
  sponsorPlayerPerMinute: 0,
};

test("specsFromPcSpecs returns nulls for missing pcSpecs", () => {
  assert.deepEqual(specsFromPcSpecs(null), {
    gpuVram: null,
    cpuCores: null,
    ramGb: null,
    downloadMbps: null,
    uploadMbps: null,
  });
});

test("specsFromPcSpecs parses GPU VRAM and optional network fields", () => {
  assert.deepEqual(
    specsFromPcSpecs({
      gpu: "GTX 1050 4 GB",
      ramGb: 16,
      cpuCores: 8,
      uploadMbps: 20,
      downloadMbps: 40,
    }),
    {
      gpuVram: 4,
      cpuCores: 8,
      ramGb: 16,
      downloadMbps: 40,
      uploadMbps: 20,
    },
  );
});

test("computeQuotaHostTier applies stream overhead to min and rec thresholds", () => {
  const specs = specsFromPcSpecs({
    gpu: "RTX 3060 8 GB",
    ramGb: 10,
    cpuCores: 6,
    uploadMbps: 12,
    downloadMbps: 30,
  });
  const quota = {
    minGpuVram: 6,
    minCpuCores: 4,
    minRamGb: 8,
    minDownloadMbps: 20,
    minUploadMbps: 5,
    recGpuVram: 8,
    recCpuCores: 6,
    recRamGb: 12,
    recDownloadMbps: 30,
    recUploadMbps: 10,
  };

  assert.equal(computeQuotaHostTier(specs, quota), "meets_min");
});

test("computeQuotaHostTier returns above_rec when all thresholds clear", () => {
  const specs = specsFromPcSpecs(strongPc);
  const quota = {
    minGpuVram: 6,
    minCpuCores: 4,
    minRamGb: 8,
    minDownloadMbps: 20,
    minUploadMbps: 5,
    recGpuVram: 8,
    recCpuCores: 6,
    recRamGb: 16,
    recDownloadMbps: 50,
    recUploadMbps: 10,
  };

  assert.equal(computeQuotaHostTier(specs, quota), "above_rec");
});

test("getQuotaCompatibility is compatible when quota has no hardware requirements", () => {
  assert.deepEqual(getQuotaCompatibility(strongPc, makeQuota()), {
    tier: "above_rec",
    compatible: true,
    reason: null,
  });
});

test("getQuotaCompatibility reports below_min with Russian reason", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1050 4 GB", ramGb: 8, cpuCores: 4, uploadMbps: 5 },
    makeQuota({ minCpuCores: 6 }),
  );

  assert.equal(result.tier, "below_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /Нужно 8\+ ядер CPU/);
});

test("getQuotaCompatibility rejects recommended tier when host only meets minimum", () => {
  const result = getQuotaCompatibility(
    { gpu: "RTX 3060 8 GB", ramGb: 10, cpuCores: 6, uploadMbps: 12 },
    makeQuota({
      minCpuCores: 4,
      recCpuCores: 8,
      requiredTier: "recommended",
    }),
  );

  assert.equal(result.tier, "meets_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /Нужно 10\+ ядер CPU/);
});

test("validateQuotaFormFields catches session duration and min/rec ordering", () => {
  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      minSessionMinutes: "120",
      maxSessionMinutes: "60",
    }),
    "Минимальная длительность сессии не может быть больше максимальной",
  );

  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      minCpuCores: "8",
      recCpuCores: "4",
    }),
    "Рекомендуемые ядер CPU должны быть не ниже минимальных",
  );
});

test("validateQuotaFormFields validates royalty and sponsor quotas", () => {
  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      kind: "royalty",
      royaltyValue: 150,
      royaltyBasis: "percent",
    }),
    "Процент роялти не может быть больше 100",
  );

  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      kind: "sponsor",
      budgetLzt: 0,
      sponsorHostPerMinute: 1,
      sponsorPlayerPerMinute: 0,
    }),
    "Бюджет спонсора должен быть больше 0 LZT",
  );

  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      kind: "sponsor",
      budgetLzt: 1000,
      sponsorHostPerMinute: 0,
      sponsorPlayerPerMinute: 0,
    }),
    "Спонсорская квота должна платить хосту или игроку за минуту",
  );

  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      kind: "sponsor",
      budgetLzt: 1000,
      sponsorHostPerMinute: 2,
      sponsorPlayerPerMinute: 1,
    }),
    null,
  );
});
