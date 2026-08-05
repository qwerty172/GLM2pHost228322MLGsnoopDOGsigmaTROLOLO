import { test } from "node:test";
import assert from "node:assert/strict";

const {
  specsFromPcSpecs,
  computeQuotaHostTier,
  getQuotaCompatibility,
  validateQuotaFormFields,
} = await import("../src/lib/quota-compatibility.ts");

const baseQuota = {
  minGpuVram: 4,
  minCpuCores: 4,
  minRamGb: 8,
  minDownloadMbps: 25,
  minUploadMbps: 10,
  recGpuVram: 8,
  recCpuCores: 8,
  recRamGb: 16,
  recDownloadMbps: 75,
  recUploadMbps: 20,
  requiredTier: "minimum",
};

const baseFormFields = {
  minGpuVram: "4",
  minCpuCores: "4",
  minRamGb: "8",
  minDownloadMbps: "25",
  minUploadMbps: "10",
  recGpuVram: "8",
  recCpuCores: "8",
  recRamGb: "16",
  recDownloadMbps: "75",
  recUploadMbps: "20",
  minSessionMinutes: "15",
  maxSessionMinutes: "120",
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

test("specsFromPcSpecs parses GPU VRAM and maps host fields", () => {
  assert.deepEqual(
    specsFromPcSpecs({
      gpu: "RTX 4070 12 GB",
      ramGb: 32,
      cpuCores: 8,
      downloadMbps: 100,
      uploadMbps: 30,
    }),
    {
      gpuVram: 12,
      cpuCores: 8,
      ramGb: 32,
      downloadMbps: 100,
      uploadMbps: 30,
    },
  );
  assert.equal(specsFromPcSpecs({ gpu: "Unknown GPU", ramGb: 16 }).gpuVram, null);
});

test("computeQuotaHostTier classifies below_min, meets_min and above_rec", () => {
  const weak = specsFromPcSpecs({
    gpu: "GTX 1050 2 GB",
    ramGb: 8,
    cpuCores: 4,
    uploadMbps: 10,
    downloadMbps: 25,
  });
  assert.equal(computeQuotaHostTier(weak, baseQuota), "below_min");

  const mid = specsFromPcSpecs({
    gpu: "GTX 1050 4 GB",
    ramGb: 10,
    cpuCores: 6,
    uploadMbps: 15,
    downloadMbps: 30,
  });
  assert.equal(computeQuotaHostTier(mid, baseQuota), "meets_min");

  const strong = specsFromPcSpecs({
    gpu: "RTX 4080 16 GB",
    ramGb: 32,
    cpuCores: 12,
    uploadMbps: 50,
    downloadMbps: 200,
  });
  assert.equal(computeQuotaHostTier(strong, baseQuota), "above_rec");
});

test("getQuotaCompatibility treats empty requirements as compatible", () => {
  assert.deepEqual(
    getQuotaCompatibility(null, {
      ...baseQuota,
      minGpuVram: null,
      minCpuCores: null,
      minRamGb: null,
      minDownloadMbps: null,
      minUploadMbps: null,
      requiredTier: "minimum",
    }),
    { tier: "above_rec", compatible: true, reason: null },
  );
});

test("getQuotaCompatibility returns Russian failure reason below minimum", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1050 2 GB", ramGb: 8, cpuCores: 4, uploadMbps: 10, downloadMbps: 25 },
    baseQuota,
  );
  assert.equal(result.compatible, false);
  assert.equal(result.tier, "below_min");
  assert.match(result.reason, /Нужно 4\+ VRAM/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1050 4 GB", ramGb: 10, cpuCores: 6, uploadMbps: 15, downloadMbps: 30 },
    { ...baseQuota, requiredTier: "recommended" },
  );
  assert.equal(result.compatible, false);
  assert.equal(result.tier, "meets_min");
  assert.match(result.reason, /Нужно/);
});

test("validateQuotaFormFields catches session and threshold ordering", () => {
  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      minSessionMinutes: "120",
      maxSessionMinutes: "30",
    }),
    "Минимальная длительность сессии не может быть больше максимальной",
  );
  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      recGpuVram: "2",
    }),
    "Рекомендуемые VRAM должны быть не ниже минимальных",
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
  assert.equal(validateQuotaFormFields(baseFormFields), null);
});
