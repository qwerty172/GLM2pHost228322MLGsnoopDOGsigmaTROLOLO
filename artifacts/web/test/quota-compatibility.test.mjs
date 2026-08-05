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

function quota(overrides = {}) {
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
      gpu: "RTX 4070 12 GB",
      ramGb: 32,
      cpuCores: 8,
      uploadMbps: 50,
      downloadMbps: 100,
    }),
    {
      gpuVram: 12,
      cpuCores: 8,
      ramGb: 32,
      downloadMbps: 100,
      uploadMbps: 50,
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
  const thresholds = quota({
    minCpuCores: 4,
    minRamGb: 8,
    recCpuCores: 8,
    recRamGb: 16,
  });

  assert.equal(computeQuotaHostTier(specs, thresholds), "meets_min");

  const weakCpu = { ...specs, cpuCores: 5 };
  assert.equal(computeQuotaHostTier(weakCpu, thresholds), "below_min");

  const strong = { ...specs, cpuCores: 10, ramGb: 18 };
  assert.equal(computeQuotaHostTier(strong, thresholds), "above_rec");
});

test("getQuotaCompatibility treats quotas without requirements as always compatible", () => {
  assert.deepEqual(
    getQuotaCompatibility(null, quota()),
    { tier: "above_rec", compatible: true, reason: null },
  );
});

test("getQuotaCompatibility reports below-min hosts with a Russian reason", () => {
  const result = getQuotaCompatibility(
    { gpu: "GTX 1050 4 GB", ramGb: 8, cpuCores: 4 },
    quota({ minCpuCores: 4, minRamGb: 8 }),
  );

  assert.equal(result.tier, "below_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /6\+ ядер CPU/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const pcSpecs = { gpu: "RTX 3060 12 GB", ramGb: 10, cpuCores: 6, uploadMbps: 20 };

  const meetsMinOnly = getQuotaCompatibility(
    pcSpecs,
    quota({
      minCpuCores: 4,
      minRamGb: 8,
      recCpuCores: 8,
      recRamGb: 16,
      requiredTier: "recommended",
    }),
  );
  assert.equal(meetsMinOnly.tier, "meets_min");
  assert.equal(meetsMinOnly.compatible, false);
  assert.match(meetsMinOnly.reason, /10\+ ядер CPU/);

  const minTierOk = getQuotaCompatibility(
    pcSpecs,
    quota({
      minCpuCores: 4,
      minRamGb: 8,
      recCpuCores: 8,
      recRamGb: 16,
      requiredTier: "min",
    }),
  );
  assert.equal(minTierOk.compatible, true);
});

test("validateQuotaFormFields catches session, spec, royalty and sponsor errors", () => {
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
      minCpuCores: "8",
      recCpuCores: "4",
    }),
    "Рекомендуемые ядер CPU должны быть не ниже минимальных",
  );

  assert.equal(
    validateQuotaFormFields({ ...emptyFields, royaltyValue: -1 }),
    "Значение роялти не может быть отрицательным",
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
      budgetLzt: 100,
      sponsorHostPerMinute: 0,
      sponsorPlayerPerMinute: 0,
    }),
    "Спонсорская квота должна платить хосту или игроку за минуту",
  );

  assert.equal(validateQuotaFormFields(emptyFields), null);
});
