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
    id: "quota-1",
    ownerType: "player",
    ownerId: "p1",
    ownerDisplayName: "Player",
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
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
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
    sponsorPlayerPerMinute: 0,
    ...overrides,
  };
}

test("specsFromPcSpecs returns nulls for missing pcSpecs", () => {
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

test("specsFromPcSpecs parses GPU VRAM and maps host fields", () => {
  assert.deepEqual(
    specsFromPcSpecs({
      gpu: "NVIDIA GeForce RTX 3080 10GB",
      ramGb: 32,
      cpuCores: 8,
      downloadMbps: 100,
      uploadMbps: 50,
    }),
    {
      gpuVram: 10,
      cpuCores: 8,
      ramGb: 32,
      downloadMbps: 100,
      uploadMbps: 50,
    },
  );
  assert.equal(specsFromPcSpecs({ gpu: "Unknown GPU", ramGb: 16 }).gpuVram, null);
});

test("computeQuotaHostTier applies stream overhead to thresholds", () => {
  const specs = { gpuVram: 8, cpuCores: 5, ramGb: 16, downloadMbps: 100, uploadMbps: 20 };
  const quota = {
    minGpuVram: 8,
    minCpuCores: 4,
    minRamGb: 14,
    minDownloadMbps: 50,
    minUploadMbps: 10,
    recGpuVram: 12,
    recCpuCores: 8,
    recRamGb: 32,
    recDownloadMbps: 100,
    recUploadMbps: 20,
  };

  assert.equal(computeQuotaHostTier(specs, quota), "below_min");

  const meetsMin = { ...specs, cpuCores: 8, ramGb: 18, uploadMbps: 20 };
  assert.equal(computeQuotaHostTier(meetsMin, quota), "meets_min");

  const aboveRec = { gpuVram: 12, cpuCores: 10, ramGb: 34, downloadMbps: 100, uploadMbps: 25 };
  assert.equal(computeQuotaHostTier(aboveRec, quota), "above_rec");
});

test("getQuotaCompatibility treats empty requirements as compatible", () => {
  const result = getQuotaCompatibility(
    { gpu: "RTX 4090 24GB", ramGb: 64, cpuCores: 16 },
    baseQuota(),
  );
  assert.deepEqual(result, { tier: "above_rec", compatible: true, reason: null });
});

test("getQuotaCompatibility rejects below minimum with Russian reason", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1060 6GB", ramGb: 8, cpuCores: 4 },
    baseQuota({ minGpuVram: 8, minRamGb: 16 }),
  );
  assert.equal(result.tier, "below_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /VRAM/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const pcSpecs = { gpu: "RTX 3070 8GB", ramGb: 32, cpuCores: 8, uploadMbps: 30 };
  const quota = baseQuota({
    minGpuVram: 6,
    minRamGb: 16,
    minUploadMbps: 10,
    recGpuVram: 12,
    recRamGb: 32,
    recUploadMbps: 25,
    requiredTier: "recommended",
  });

  const result = getQuotaCompatibility(pcSpecs, quota);
  assert.equal(result.tier, "meets_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /VRAM|отдачи/);
});

test("validateQuotaFormFields catches session and spec ordering", () => {
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({ minSessionMinutes: "60", maxSessionMinutes: "30" }),
    ),
    "Минимальная длительность сессии не может быть больше максимальной",
  );
  assert.equal(
    validateQuotaFormFields(baseFormFields({ minRamGb: "16", recRamGb: "8" })),
    "Рекомендуемые ГБ RAM должны быть не ниже минимальных",
  );
  assert.equal(validateQuotaFormFields(baseFormFields()), null);
});

test("validateQuotaFormFields validates royalty and sponsor fields", () => {
  assert.equal(
    validateQuotaFormFields(baseFormFields({ royaltyValue: -1 })),
    "Значение роялти не может быть отрицательным",
  );
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({ royaltyBasis: "percent", royaltyValue: 150 }),
    ),
    "Процент роялти не может быть больше 100",
  );
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({
        kind: "sponsor",
        budgetLzt: 0,
        sponsorHostPerMinute: 1,
      }),
    ),
    "Бюджет спонсора должен быть больше 0 LZT",
  );
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({
        kind: "sponsor",
        sponsorHostPerMinute: 0,
        sponsorPlayerPerMinute: 0,
      }),
    ),
    "Спонсорская квота должна платить хосту или игроку за минуту",
  );
});
