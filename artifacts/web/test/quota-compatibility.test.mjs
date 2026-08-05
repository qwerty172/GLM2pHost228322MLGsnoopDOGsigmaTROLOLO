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
  requiredTier: "min",
};

const strongPc = {
  gpu: "RTX 4070 12 GB",
  ramGb: 32,
  cpuCores: 12,
  downloadMbps: 100,
  uploadMbps: 30,
};

const weakPc = {
  gpu: "GTX 1050 4 GB",
  ramGb: 10,
  cpuCores: 6,
  downloadMbps: 30,
  uploadMbps: 15,
};

test("specsFromPcSpecs returns null fields for missing pcSpecs", () => {
  assert.deepEqual(specsFromPcSpecs(null), {
    gpuVram: null,
    cpuCores: null,
    ramGb: null,
    downloadMbps: null,
    uploadMbps: null,
  });
  assert.deepEqual(specsFromPcSpecs(undefined), specsFromPcSpecs(null));
});

test("specsFromPcSpecs parses GPU VRAM and maps telemetry", () => {
  assert.deepEqual(specsFromPcSpecs(strongPc), {
    gpuVram: 12,
    cpuCores: 12,
    ramGb: 32,
    downloadMbps: 100,
    uploadMbps: 30,
  });
  assert.deepEqual(specsFromPcSpecs({ gpu: "Unknown GPU", ramGb: 16 }), {
    gpuVram: null,
    cpuCores: null,
    ramGb: 16,
    downloadMbps: null,
    uploadMbps: null,
  });
});

test("computeQuotaHostTier applies stream overhead to thresholds", () => {
  const specs = specsFromPcSpecs(weakPc);
  assert.equal(computeQuotaHostTier(specs, baseQuota), "meets_min");

  const belowMinSpecs = {
    gpuVram: 4,
    cpuCores: 5,
    ramGb: 9,
    downloadMbps: 25,
    uploadMbps: 14,
  };
  assert.equal(computeQuotaHostTier(belowMinSpecs, baseQuota), "below_min");

  const aboveRecSpecs = specsFromPcSpecs(strongPc);
  assert.equal(computeQuotaHostTier(aboveRecSpecs, baseQuota), "above_rec");
});

test("getQuotaCompatibility treats quotas without requirements as always compatible", () => {
  const quota = {
    ...baseQuota,
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
  assert.deepEqual(getQuotaCompatibility(weakPc, quota), {
    tier: "above_rec",
    compatible: true,
    reason: null,
  });
});

test("getQuotaCompatibility marks below-min hosts incompatible with Russian reason", () => {
  const result = getQuotaCompatibility(weakPc, {
    ...baseQuota,
    minUploadMbps: 20,
    recGpuVram: null,
    recCpuCores: null,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
  });
  assert.equal(result.tier, "below_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /Мбит\/с отдачи/);
});

test("getQuotaCompatibility enforces recommended tier when required", () => {
  const quota = { ...baseQuota, requiredTier: "recommended" };
  const result = getQuotaCompatibility(weakPc, quota);
  assert.equal(result.tier, "meets_min");
  assert.equal(result.compatible, false);
  assert.match(result.reason, /VRAM|ядер|RAM|Мбит\/с/);
});

test("validateQuotaFormFields catches session and spec ordering issues", () => {
  const fields = {
    minGpuVram: "8",
    minCpuCores: "4",
    minRamGb: "16",
    minDownloadMbps: "50",
    minUploadMbps: "10",
    recGpuVram: "4",
    recCpuCores: "8",
    recRamGb: "32",
    recDownloadMbps: "100",
    recUploadMbps: "20",
    minSessionMinutes: "120",
    maxSessionMinutes: "30",
    kind: "royalty",
    royaltyValue: 10,
    royaltyBasis: "percent",
    budgetLzt: 0,
    sponsorHostPerMinute: 0,
    sponsorPlayerPerMinute: 0,
  };

  assert.equal(
    validateQuotaFormFields(fields),
    "Минимальная длительность сессии не может быть больше максимальной",
  );

  assert.equal(
    validateQuotaFormFields({ ...fields, minSessionMinutes: "30", maxSessionMinutes: "120" }),
    "Рекомендуемые VRAM должны быть не ниже минимальных",
  );
});

test("validateQuotaFormFields validates royalty and sponsor economics", () => {
  const baseFields = {
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
    royaltyValue: -1,
    royaltyBasis: "percent",
    budgetLzt: 0,
    sponsorHostPerMinute: 0,
    sponsorPlayerPerMinute: 0,
  };
  assert.equal(
    validateQuotaFormFields(baseFields),
    "Значение роялти не может быть отрицательным",
  );
  assert.equal(
    validateQuotaFormFields({ ...baseFields, royaltyValue: 150 }),
    "Процент роялти не может быть больше 100",
  );

  const sponsorFields = {
    ...baseFields,
    kind: "sponsor",
    royaltyValue: 0,
    budgetLzt: 0,
    sponsorHostPerMinute: 0,
    sponsorPlayerPerMinute: 0,
  };
  assert.equal(
    validateQuotaFormFields(sponsorFields),
    "Бюджет спонсора должен быть больше 0 LZT",
  );
  assert.equal(
    validateQuotaFormFields({
      ...sponsorFields,
      budgetLzt: 1000,
      sponsorHostPerMinute: -1,
    }),
    "Выплаты за минуту не могут быть отрицательными",
  );
  assert.equal(
    validateQuotaFormFields({
      ...sponsorFields,
      budgetLzt: 1000,
      sponsorHostPerMinute: 0,
      sponsorPlayerPerMinute: 0,
    }),
    "Спонсорская квота должна платить хосту или игроку за минуту",
  );
  assert.equal(
    validateQuotaFormFields({
      ...sponsorFields,
      budgetLzt: 1000,
      sponsorHostPerMinute: 5,
      sponsorPlayerPerMinute: 0,
    }),
    null,
  );
});
