import { test } from "node:test";
import assert from "node:assert/strict";

const {
  specsFromPcSpecs,
  computeQuotaHostTier,
  getQuotaCompatibility,
  validateQuotaFormFields,
} = await import("../src/lib/quota-compatibility.ts");

const baseQuota = {
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
  requiredTier: "minimum",
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
  budgetLzt: 100,
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

test("specsFromPcSpecs parses GPU VRAM and maps host fields", () => {
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

test("computeQuotaHostTier classifies below_min, meets_min, above_rec", () => {
  const specs = specsFromPcSpecs({
    gpu: "GTX 1050 4 GB",
    ramGb: 18,
    cpuCores: 6,
    uploadMbps: 15,
    downloadMbps: 30,
  });
  const quota = {
    ...baseQuota,
    minRamGb: 16,
    recRamGb: 32,
  };

  assert.equal(computeQuotaHostTier(specs, quota), "meets_min");

  const weakSpecs = specsFromPcSpecs({
    gpu: "GTX 1050 4 GB",
    ramGb: 10,
    cpuCores: 6,
    uploadMbps: 15,
    downloadMbps: 30,
  });
  assert.equal(computeQuotaHostTier(weakSpecs, quota), "below_min");

  const strongSpecs = specsFromPcSpecs({
    gpu: "RTX 4090 24 GB",
    ramGb: 34,
    cpuCores: 12,
    uploadMbps: 50,
    downloadMbps: 200,
  });
  assert.equal(computeQuotaHostTier(strongSpecs, quota), "above_rec");
});

test("getQuotaCompatibility treats quotas without requirements as compatible", () => {
  assert.deepEqual(
    getQuotaCompatibility(null, { ...baseQuota, requiredTier: "minimum" }),
    { tier: "above_rec", compatible: true, reason: null },
  );
});

test("getQuotaCompatibility rejects hosts below minimum requirements", () => {
  const quota = {
    ...baseQuota,
    minRamGb: 16,
    requiredTier: "minimum",
  };
  const pcSpecs = {
    gpu: "GTX 1050 4 GB",
    ramGb: 10,
    cpuCores: 6,
    uploadMbps: 15,
    downloadMbps: 30,
  };

  const result = getQuotaCompatibility(pcSpecs, quota);
  assert.equal(result.tier, "below_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /Нужно 18\+ ГБ RAM/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const quota = {
    ...baseQuota,
    minRamGb: 8,
    recRamGb: 32,
    requiredTier: "recommended",
  };
  const pcSpecs = {
    gpu: "RTX 3060 12 GB",
    ramGb: 18,
    cpuCores: 8,
    uploadMbps: 20,
    downloadMbps: 100,
  };

  const result = getQuotaCompatibility(pcSpecs, quota);
  assert.equal(result.tier, "meets_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /Нужно 34\+ ГБ RAM/);
});

test("getQuotaCompatibility accepts meets_min when only minimum is required", () => {
  const quota = {
    ...baseQuota,
    minRamGb: 8,
    recRamGb: 32,
    requiredTier: "minimum",
  };
  const pcSpecs = {
    gpu: "RTX 3060 12 GB",
    ramGb: 18,
    cpuCores: 8,
    uploadMbps: 20,
    downloadMbps: 100,
  };

  const result = getQuotaCompatibility(pcSpecs, quota);
  assert.equal(result.tier, "meets_min");
  assert.equal(result.compatible, true);
  assert.equal(result.reason, null);
});

test("validateQuotaFormFields rejects invalid session and spec pairs", () => {
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
      minRamGb: "16",
      recRamGb: "8",
    }),
    "Рекомендуемые ГБ RAM должны быть не ниже минимальных",
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
});

test("validateQuotaFormFields returns null for valid fields", () => {
  assert.equal(
    validateQuotaFormFields({
      ...baseFormFields,
      minRamGb: "8",
      recRamGb: "16",
      minSessionMinutes: "15",
      maxSessionMinutes: "120",
    }),
    null,
  );
});
