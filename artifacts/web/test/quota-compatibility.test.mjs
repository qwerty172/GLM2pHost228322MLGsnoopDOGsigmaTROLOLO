import { test } from "node:test";
import assert from "node:assert/strict";

const {
  specsFromPcSpecs,
  computeQuotaHostTier,
  getQuotaCompatibility,
  validateQuotaFormFields,
} = await import("../src/lib/quota-compatibility.ts");

function baseQuota(overrides = {}) {
  return {
    id: "q1",
    ownerType: "host",
    ownerId: "h1",
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
    startAt: "2026-01-01T00:00:00Z",
    endAt: null,
    budgetLzt: null,
    escrowRemainingLzt: null,
    sponsorHostPerMinuteLzt: null,
    sponsorPlayerPerMinuteLzt: null,
    royaltyBasis: null,
    royaltyValue: null,
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
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function baseFormFields(overrides = {}) {
  return {
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
    budgetLzt: 100,
    sponsorHostPerMinute: 1,
    sponsorPlayerPerMinute: 1,
    ...overrides,
  };
}

test("specsFromPcSpecs returns nulls when pcSpecs missing", () => {
  assert.deepEqual(specsFromPcSpecs(null), {
    gpuVram: null,
    cpuCores: null,
    ramGb: null,
    downloadMbps: null,
    uploadMbps: null,
  });
  assert.deepEqual(specsFromPcSpecs(undefined), {
    gpuVram: null,
    cpuCores: null,
    ramGb: null,
    downloadMbps: null,
    uploadMbps: null,
  });
});

test("specsFromPcSpecs parses GPU VRAM and maps optional fields", () => {
  assert.deepEqual(
    specsFromPcSpecs({
      gpu: "RTX 4070 12 GB",
      ramGb: 32,
      cpuCores: 8,
      downloadMbps: 100,
      uploadMbps: 50,
    }),
    {
      gpuVram: 12,
      cpuCores: 8,
      ramGb: 32,
      downloadMbps: 100,
      uploadMbps: 50,
    },
  );
  assert.equal(
    specsFromPcSpecs({ gpu: "Unknown GPU", ramGb: 16 }).gpuVram,
    null,
  );
});

test("computeQuotaHostTier applies stream overhead to thresholds", () => {
  const quota = {
    minGpuVram: null,
    minCpuCores: 4,
    minRamGb: null,
    minDownloadMbps: null,
    minUploadMbps: null,
    recGpuVram: null,
    recCpuCores: 8,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
  };

  assert.equal(
    computeQuotaHostTier(
      { gpuVram: null, cpuCores: 5, ramGb: null, downloadMbps: null, uploadMbps: null },
      quota,
    ),
    "below_min",
  );
  assert.equal(
    computeQuotaHostTier(
      { gpuVram: null, cpuCores: 6, ramGb: null, downloadMbps: null, uploadMbps: null },
      quota,
    ),
    "meets_min",
  );
  assert.equal(
    computeQuotaHostTier(
      { gpuVram: null, cpuCores: 10, ramGb: null, downloadMbps: null, uploadMbps: null },
      quota,
    ),
    "above_rec",
  );
});

test("getQuotaCompatibility treats empty requirements as compatible", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1050 4 GB", ramGb: 8, cpuCores: 4 },
    baseQuota(),
  );
  assert.deepEqual(result, { tier: "above_rec", compatible: true, reason: null });
});

test("getQuotaCompatibility reports below_min with Russian reason", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1050 4 GB", ramGb: 8, cpuCores: 4, uploadMbps: 10 },
    baseQuota({ minUploadMbps: 10 }),
  );
  assert.equal(result.tier, "below_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /Мбит\/с отдачи/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const pcSpecs = { gpu: "RTX 3060 12 GB", ramGb: 32, cpuCores: 8, uploadMbps: 30 };
  const quota = baseQuota({
    minCpuCores: 4,
    recCpuCores: 12,
    requiredTier: "recommended",
  });

  const result = getQuotaCompatibility(pcSpecs, quota);
  assert.equal(result.tier, "meets_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /ядер CPU/);
});

test("validateQuotaFormFields rejects invalid session and spec pairs", () => {
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({ minSessionMinutes: "60", maxSessionMinutes: "30" }),
    ),
    "Минимальная длительность сессии не может быть больше максимальной",
  );
  assert.equal(
    validateQuotaFormFields(baseFormFields({ minCpuCores: "8", recCpuCores: "4" })),
    "Рекомендуемые ядер CPU должны быть не ниже минимальных",
  );
});

test("validateQuotaFormFields validates royalty and sponsor fields", () => {
  assert.equal(
    validateQuotaFormFields(baseFormFields({ royaltyValue: -1 })),
    "Значение роялти не может быть отрицательным",
  );
  assert.equal(
    validateQuotaFormFields(baseFormFields({ royaltyValue: 150, royaltyBasis: "percent" })),
    "Процент роялти не может быть больше 100",
  );
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({
        kind: "sponsor",
        budgetLzt: 0,
        sponsorHostPerMinute: 0,
        sponsorPlayerPerMinute: 0,
      }),
    ),
    "Бюджет спонсора должен быть больше 0 LZT",
  );
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({
        kind: "sponsor",
        budgetLzt: 100,
        sponsorHostPerMinute: 0,
        sponsorPlayerPerMinute: 0,
      }),
    ),
    "Спонсорская квота должна платить хосту или игроку за минуту",
  );
});

test("validateQuotaFormFields returns null for valid input", () => {
  assert.equal(validateQuotaFormFields(baseFormFields()), null);
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({
        kind: "sponsor",
        minCpuCores: "4",
        recCpuCores: "8",
        minSessionMinutes: "15",
        maxSessionMinutes: "120",
      }),
    ),
    null,
  );
});
