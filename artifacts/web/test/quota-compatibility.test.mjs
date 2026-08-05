import { test } from "node:test";
import assert from "node:assert/strict";

const {
  specsFromPcSpecs,
  computeQuotaHostTier,
  getQuotaCompatibility,
  validateQuotaFormFields,
} = await import("../src/lib/quota-compatibility.ts");

const emptyFields = {
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

function makeQuota(overrides = {}) {
  return {
    id: "q1",
    requiredTier: "min",
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
    ...overrides,
  };
}

const capablePc = {
  gpu: "RTX 4070 12 GB",
  ramGb: 32,
  cpuCores: 8,
  uploadMbps: 50,
  downloadMbps: 100,
};

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

test("specsFromPcSpecs parses GPU VRAM and optional fields", () => {
  assert.deepEqual(specsFromPcSpecs(capablePc), {
    gpuVram: 12,
    cpuCores: 8,
    ramGb: 32,
    downloadMbps: 100,
    uploadMbps: 50,
  });
  assert.equal(specsFromPcSpecs({ gpu: "GTX 1050", ramGb: 8 }).gpuVram, null);
});

test("computeQuotaHostTier applies stream overhead to thresholds", () => {
  const specs = specsFromPcSpecs({
    gpu: "GTX 1050 4 GB",
    ramGb: 10,
    cpuCores: 6,
    uploadMbps: 15,
    downloadMbps: 30,
  });
  const quota = makeQuota({
    minGpuVram: 4,
    minCpuCores: 4,
    minRamGb: 8,
    minUploadMbps: 10,
    recGpuVram: 8,
    recCpuCores: 6,
    recRamGb: 16,
    recUploadMbps: 20,
  });

  assert.equal(computeQuotaHostTier(specs, quota), "meets_min");

  const weakSpecs = specsFromPcSpecs({ gpu: "GTX 1050 2 GB", ramGb: 4, cpuCores: 2, uploadMbps: 5 });
  assert.equal(computeQuotaHostTier(weakSpecs, quota), "below_min");

  const strongSpecs = specsFromPcSpecs(capablePc);
  assert.equal(computeQuotaHostTier(strongSpecs, quota), "above_rec");
});

test("getQuotaCompatibility is compatible when quota has no requirements", () => {
  const result = getQuotaCompatibility(null, makeQuota());
  assert.deepEqual(result, { tier: "above_rec", compatible: true, reason: null });
});

test("getQuotaCompatibility rejects host below minimum with Russian reason", () => {
  const quota = makeQuota({ minRamGb: 16 });
  const result = getQuotaCompatibility(
    { gpu: "RTX 3060 8 GB", ramGb: 8, cpuCores: 4, uploadMbps: 20 },
    quota,
  );

  assert.equal(result.compatible, false);
  assert.equal(result.tier, "below_min");
  assert.match(result.reason, /Нужно 18\+ ГБ RAM/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const quota = makeQuota({
    requiredTier: "recommended",
    minRamGb: 8,
    recRamGb: 32,
  });
  const result = getQuotaCompatibility(
    { gpu: "RTX 3060 8 GB", ramGb: 16, cpuCores: 6, uploadMbps: 20 },
    quota,
  );

  assert.equal(result.compatible, false);
  assert.equal(result.tier, "meets_min");
  assert.match(result.reason, /Нужно 34\+ ГБ RAM/);
});

test("validateQuotaFormFields catches session and min/rec ordering", () => {
  assert.equal(
    validateQuotaFormFields({
      ...emptyFields,
      minSessionMinutes: "60",
      maxSessionMinutes: "30",
    }),
    "Минимальная длительность сессии не может быть больше максимальной",
  );

  assert.equal(
    validateQuotaFormFields({
      ...emptyFields,
      minRamGb: "16",
      recRamGb: "8",
    }),
    "Рекомендуемые ГБ RAM должны быть не ниже минимальных",
  );
});

test("validateQuotaFormFields validates royalty and sponsor fields", () => {
  assert.equal(
    validateQuotaFormFields({ ...emptyFields, royaltyValue: -1 }),
    "Значение роялти не может быть отрицательным",
  );
  assert.equal(
    validateQuotaFormFields({ ...emptyFields, royaltyValue: 150, royaltyBasis: "percent" }),
    "Процент роялти не может быть больше 100",
  );
  assert.equal(
    validateQuotaFormFields({
      ...emptyFields,
      kind: "sponsor",
      budgetLzt: 0,
      sponsorHostPerMinute: 0,
      sponsorPlayerPerMinute: 0,
    }),
    "Бюджет спонсора должен быть больше 0 LZT",
  );
  assert.equal(
    validateQuotaFormFields({
      ...emptyFields,
      kind: "sponsor",
      budgetLzt: 1000,
      sponsorHostPerMinute: 0,
      sponsorPlayerPerMinute: 0,
    }),
    "Спонсорская квота должна платить хосту или игроку за минуту",
  );
  assert.equal(validateQuotaFormFields(emptyFields), null);
});
