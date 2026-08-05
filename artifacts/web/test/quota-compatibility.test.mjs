import { test } from "node:test";
import assert from "node:assert/strict";

const {
  specsFromPcSpecs,
  computeQuotaHostTier,
  getQuotaCompatibility,
  validateQuotaFormFields,
} = await import("../src/lib/quota-compatibility.ts");

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
  budgetLzt: 100,
  sponsorHostPerMinute: 1,
  sponsorPlayerPerMinute: 0,
};

function makeQuota(overrides = {}) {
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
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("specsFromPcSpecs parses GPU VRAM and handles missing pcSpecs", () => {
  assert.deepEqual(specsFromPcSpecs(null), {
    gpuVram: null,
    cpuCores: null,
    ramGb: null,
    downloadMbps: null,
    uploadMbps: null,
  });
  assert.deepEqual(
    specsFromPcSpecs({
      gpu: "NVIDIA RTX 3080 10GB",
      ramGb: 32,
      cpuCores: 8,
      downloadMbps: 100,
      uploadMbps: 20,
    }),
    {
      gpuVram: 10,
      cpuCores: 8,
      ramGb: 32,
      downloadMbps: 100,
      uploadMbps: 20,
    },
  );
  assert.equal(
    specsFromPcSpecs({ gpu: "Unknown GPU", ramGb: 16 }).gpuVram,
    null,
  );
});

test("computeQuotaHostTier applies STREAM_OVERHEAD to min and rec thresholds", () => {
  const quota = {
    minCpuCores: 4,
    minRamGb: 8,
    minGpuVram: null,
    minDownloadMbps: null,
    minUploadMbps: null,
    recCpuCores: 8,
    recRamGb: 16,
    recGpuVram: null,
    recDownloadMbps: null,
    recUploadMbps: null,
  };

  assert.equal(
    computeQuotaHostTier(
      { gpuVram: null, cpuCores: 5, ramGb: 10, downloadMbps: null, uploadMbps: null },
      quota,
    ),
    "below_min",
  );
  assert.equal(
    computeQuotaHostTier(
      { gpuVram: null, cpuCores: 6, ramGb: 10, downloadMbps: null, uploadMbps: null },
      quota,
    ),
    "meets_min",
  );
  assert.equal(
    computeQuotaHostTier(
      { gpuVram: null, cpuCores: 10, ramGb: 18, downloadMbps: null, uploadMbps: null },
      quota,
    ),
    "above_rec",
  );
});

test("getQuotaCompatibility marks open quotas compatible and explains failures", () => {
  assert.deepEqual(getQuotaCompatibility(null, makeQuota()), {
    tier: "above_rec",
    compatible: true,
    reason: null,
  });

  const belowMin = getQuotaCompatibility(
    { gpu: "RTX 3060 8GB", ramGb: 16, cpuCores: 4, uploadMbps: 10 },
    makeQuota({ minCpuCores: 4, requiredTier: "min" }),
  );
  assert.equal(belowMin.tier, "below_min");
  assert.equal(belowMin.compatible, false);
  assert.match(belowMin.reason, /Нужно 6\+ ядер CPU/);

  const needsRec = getQuotaCompatibility(
    { gpu: "RTX 3080 10GB", ramGb: 16, cpuCores: 8, uploadMbps: 20 },
    makeQuota({
      minCpuCores: 4,
      minRamGb: 8,
      recCpuCores: 8,
      recRamGb: 16,
      requiredTier: "recommended",
    }),
  );
  assert.equal(needsRec.tier, "meets_min");
  assert.equal(needsRec.compatible, false);
  assert.match(needsRec.reason, /Нужно 10\+ ядер CPU/);
});

test("validateQuotaFormFields catches session, tier, royalty and sponsor errors", () => {
  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      minSessionMinutes: "60",
      maxSessionMinutes: "30",
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

  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      royaltyValue: -1,
    }),
    "Значение роялти не может быть отрицательным",
  );

  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      royaltyValue: 101,
      royaltyBasis: "percent",
    }),
    "Процент роялти не может быть больше 100",
  );

  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      kind: "sponsor",
      budgetLzt: 0,
    }),
    "Бюджет спонсора должен быть больше 0 LZT",
  );

  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      kind: "sponsor",
      sponsorHostPerMinute: 0,
      sponsorPlayerPerMinute: 0,
    }),
    "Спонсорская квота должна платить хосту или игроку за минуту",
  );

  assert.equal(validateQuotaFormFields(baseFormFields), null);
});
