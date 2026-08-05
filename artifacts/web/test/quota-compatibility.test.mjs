import { test } from "node:test";
import assert from "node:assert/strict";

const {
  specsFromPcSpecs,
  computeQuotaHostTier,
  getQuotaCompatibility,
  validateQuotaFormFields,
} = await import("../src/lib/quota-compatibility.ts");

const baseQuotaFields = {
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
  budgetLzt: 1000,
  sponsorHostPerMinute: 1,
  sponsorPlayerPerMinute: 0,
};

test("specsFromPcSpecs returns null specs for missing pcSpecs", () => {
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

test("specsFromPcSpecs parses GPU VRAM and maps pc specs", () => {
  assert.deepEqual(
    specsFromPcSpecs({
      gpu: "RTX 4070 12 GB",
      ramGb: 32,
      cpuCores: 8,
      downloadMbps: 100,
      uploadMbps: 20,
    }),
    {
      gpuVram: 12,
      cpuCores: 8,
      ramGb: 32,
      downloadMbps: 100,
      uploadMbps: 20,
    },
  );
});

test("computeQuotaHostTier applies stream overhead to thresholds", () => {
  const specs = specsFromPcSpecs({
    gpu: "GTX 1050 4 GB",
    ramGb: 10,
    cpuCores: 6,
    uploadMbps: 15,
    downloadMbps: 30,
  });

  assert.equal(
    computeQuotaHostTier(specs, {
      ...baseQuotaFields,
      minCpuCores: 4,
      minRamGb: 8,
      minUploadMbps: 10,
      recCpuCores: 8,
      recRamGb: 16,
      recUploadMbps: 20,
    }),
    "meets_min",
  );

  assert.equal(
    computeQuotaHostTier(specs, {
      ...baseQuotaFields,
      minCpuCores: 8,
      minRamGb: 16,
      minUploadMbps: 20,
      recCpuCores: 8,
      recRamGb: 16,
      recUploadMbps: 20,
    }),
    "below_min",
  );

  assert.equal(
    computeQuotaHostTier(specs, {
      ...baseQuotaFields,
      minCpuCores: 4,
      minRamGb: 8,
      minUploadMbps: 10,
      recCpuCores: 4,
      recRamGb: 8,
      recUploadMbps: 10,
    }),
    "above_rec",
  );
});

test("getQuotaCompatibility treats quotas without requirements as compatible", () => {
  assert.deepEqual(
    getQuotaCompatibility(null, { ...baseQuotaFields }),
    { tier: "above_rec", compatible: true, reason: null },
  );
});

test("getQuotaCompatibility rejects below-min hosts with a reason", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1050 4 GB", ramGb: 8, cpuCores: 4, uploadMbps: 10 },
    {
      ...baseQuotaFields,
      minCpuCores: 8,
      minRamGb: 16,
    },
  );

  assert.equal(result.tier, "below_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /Нужно 10\+ ядер CPU/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const result = getQuotaCompatibility(
    { gpu: "RTX 3060 12 GB", ramGb: 16, cpuCores: 8, uploadMbps: 25 },
    {
      ...baseQuotaFields,
      requiredTier: "recommended",
      minCpuCores: 4,
      minRamGb: 8,
      minUploadMbps: 10,
      recCpuCores: 12,
      recRamGb: 32,
      recUploadMbps: 50,
    },
  );

  assert.equal(result.tier, "meets_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /Нужен рекомендуемый уровень железа|Нужно 14\+ ядер CPU/);
});

test("getQuotaCompatibility accepts meets_min when only min tier is required", () => {
  assert.deepEqual(
    getQuotaCompatibility(
      { gpu: "RTX 3060 12 GB", ramGb: 16, cpuCores: 8, uploadMbps: 25 },
      {
        ...baseQuotaFields,
        requiredTier: "min",
        minCpuCores: 4,
        minRamGb: 8,
        minUploadMbps: 10,
        recCpuCores: 12,
        recRamGb: 32,
        recUploadMbps: 50,
      },
    ),
    { tier: "meets_min", compatible: true, reason: null },
  );
});

test("validateQuotaFormFields catches session and min/rec ordering", () => {
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

test("validateQuotaFormFields validates royalty and sponsor fields", () => {
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
