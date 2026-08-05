import { test } from "node:test";
import assert from "node:assert/strict";

const { SHADER_PRESETS } = await import("../src/components/webgl-video-shader.tsx");

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

test("SHADER_PRESETS defines all built-in presets", () => {
  assert.deepEqual(Object.keys(SHADER_PRESETS).sort(), PRESET_KEYS.sort());
});

test("each preset has Russian label, description and GLSL code", () => {
  for (const key of PRESET_KEYS) {
    const preset = SHADER_PRESETS[key];
    assert.ok(preset.label.length > 0, `${key} label`);
    assert.ok(preset.description.length > 0, `${key} description`);
    assert.ok(preset.code.includes("void main()"), `${key} fragment shader`);
    assert.ok(preset.code.includes("uniform sampler2D uVideo"), `${key} uVideo uniform`);
    assert.ok(preset.code.includes("varying vec2 vTexCoord"), `${key} vTexCoord varying`);
  }
});

test("none preset is passthrough without extra uniforms", () => {
  const { code } = SHADER_PRESETS.none;
  assert.ok(code.includes("texture2D(uVideo, vTexCoord)"));
  assert.ok(!code.includes("uResolution"));
  assert.ok(!code.includes("uTime"));
});

test("sharpen and upscale presets use uResolution", () => {
  assert.ok(SHADER_PRESETS.sharpen.code.includes("uniform vec2 uResolution"));
  assert.ok(SHADER_PRESETS.upscale.code.includes("uniform vec2 uResolution"));
});

test("preset labels are localized for the player UI", () => {
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");
});
