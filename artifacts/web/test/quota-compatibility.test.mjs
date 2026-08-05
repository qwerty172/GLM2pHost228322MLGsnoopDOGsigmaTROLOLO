import { test } from "node:test";
import assert from "node:assert/strict";

const {
  specsFromPcSpecs,
  computeQuotaHostTier,
  getQuotaCompatibility,
  validateQuotaFormFields,
} = await import("../src/lib/quota-compatibility.ts");

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
    budgetLzt: 1000,
    sponsorHostPerMinute: 1,
    sponsorPlayerPerMinute: 0,
    ...overrides,
  };
}

function baseQuota(overrides = {}) {
  return {
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
});

test("specsFromPcSpecs parses GPU VRAM and optional network fields", () => {
  assert.deepEqual(
    specsFromPcSpecs({
      gpu: "RTX 4070 12 GB",
      ramGb: 32,
      cpuCores: 8,
      downloadMbps: 100,
      uploadMbps: 25,
    }),
    {
      gpuVram: 12,
      cpuCores: 8,
      ramGb: 32,
      downloadMbps: 100,
      uploadMbps: 25,
    },
  );
});

test("computeQuotaHostTier applies stream overhead to thresholds", () => {
  const quota = baseQuota({
    minCpuCores: 4,
    minRamGb: 8,
    minUploadMbps: 10,
    recCpuCores: 8,
    recRamGb: 16,
    recUploadMbps: 20,
  });

  const meetsMin = {
    gpuVram: null,
    cpuCores: 6,
    ramGb: 10,
    downloadMbps: null,
    uploadMbps: 15,
  };
  assert.equal(computeQuotaHostTier(meetsMin, quota), "meets_min");

  const belowMin = { ...meetsMin, cpuCores: 5 };
  assert.equal(computeQuotaHostTier(belowMin, quota), "below_min");

  const aboveRec = {
    gpuVram: null,
    cpuCores: 10,
    ramGb: 18,
    downloadMbps: null,
    uploadMbps: 25,
  };
  assert.equal(computeQuotaHostTier(aboveRec, quota), "above_rec");
});

test("getQuotaCompatibility treats quotas without requirements as compatible", () => {
  assert.deepEqual(
    getQuotaCompatibility(null, baseQuota()),
    { tier: "above_rec", compatible: true, reason: null },
  );
});

test("getQuotaCompatibility reports below_min with Russian reason", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1050 4 GB", ramGb: 8, cpuCores: 4, uploadMbps: 10 },
    baseQuota({ minCpuCores: 4, minUploadMbps: 10 }),
  );
  assert.equal(result.tier, "below_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /ядер CPU/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const result = getQuotaCompatibility(
    { gpu: "RTX 3060 12 GB", ramGb: 10, cpuCores: 6, uploadMbps: 15 },
    baseQuota({
      minCpuCores: 4,
      minRamGb: 8,
      minUploadMbps: 10,
      recCpuCores: 8,
      recRamGb: 16,
      recUploadMbps: 20,
      requiredTier: "recommended",
    }),
  );
  assert.equal(result.tier, "meets_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /ГБ RAM|ядер CPU|Мбит\/с/);
});

test("validateQuotaFormFields catches session and spec ordering issues", () => {
  assert.equal(
    validateQuotaFormFields(
      baseFormFields({
        minSessionMinutes: "120",
        maxSessionMinutes: "60",
      }),
    ),
    "Минимальная длительность сессии не может быть больше максимальной",
  );

  assert.equal(
    validateQuotaFormFields(
      baseFormFields({
        minCpuCores: "8",
        recCpuCores: "4",
      }),
    ),
    "Рекомендуемые ядер CPU должны быть не ниже минимальных",
  );
});

test("validateQuotaFormFields validates royalty and sponsor fields", () => {
  assert.equal(
    validateQuotaFormFields(baseFormFields({ royaltyValue: -1 })),
    "Значение роялти не может быть отрицательным",
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
        sponsorHostPerMinute: 0,
        sponsorPlayerPerMinute: 0,
      }),
    ),
    "Спонсорская квота должна платить хосту или игроку за минуту",
  );

  assert.equal(validateQuotaFormFields(baseFormFields()), null);
});
