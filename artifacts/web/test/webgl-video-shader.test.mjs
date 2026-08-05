import { test } from "node:test";
import assert from "node:assert/strict";

const {
  SHADER_PRESETS,
  SHADER_PRESET_STORAGE_KEY,
  SHADER_CUSTOM_CODE_STORAGE_KEY,
  SHADER_BUILTIN_PRESET_KEYS,
  isShaderPresetActive,
  resolveShaderFragCode,
} = await import("../src/components/webgl-video-shader.tsx");

test("SHADER_PRESET_STORAGE_KEY and SHADER_CUSTOM_CODE_STORAGE_KEY match play.tsx localStorage keys", () => {
  assert.equal(SHADER_PRESET_STORAGE_KEY, "shaderPreset");
  assert.equal(SHADER_CUSTOM_CODE_STORAGE_KEY, "shaderCustomCode");
});

test("SHADER_BUILTIN_PRESET_KEYS lists all built-in presets", () => {
  assert.deepEqual(SHADER_BUILTIN_PRESET_KEYS.sort(), ["contrast", "night", "none", "sharpen", "upscale"]);
});

test("SHADER_PRESETS defines Russian labels and descriptions for each preset", () => {
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");
  for (const key of SHADER_BUILTIN_PRESET_KEYS) {
    assert.ok(SHADER_PRESETS[key].description.length > 0, `${key} has description`);
  }
});

test("each preset fragment shader declares uVideo sampler and vTexCoord varying", () => {
  for (const key of SHADER_BUILTIN_PRESET_KEYS) {
    const code = SHADER_PRESETS[key].code;
    assert.match(code, /uniform sampler2D uVideo/, `${key} uses uVideo`);
    assert.match(code, /varying vec2 vTexCoord/, `${key} uses vTexCoord`);
    assert.match(code, /void main\(\)/, `${key} has main()`);
  }
});

test("sharpen and upscale presets use uResolution uniform", () => {
  assert.match(SHADER_PRESETS.sharpen.code, /uniform vec2 uResolution/);
  assert.match(SHADER_PRESETS.upscale.code, /uniform vec2 uResolution/);
});

test("isShaderPresetActive treats none as inactive", () => {
  assert.equal(isShaderPresetActive("none"), false);
  assert.equal(isShaderPresetActive("sharpen"), true);
  assert.equal(isShaderPresetActive("custom"), true);
});

test("resolveShaderFragCode returns preset code or custom fragment", () => {
  assert.equal(resolveShaderFragCode("sharpen", "custom glsl"), SHADER_PRESETS.sharpen.code);
  assert.equal(resolveShaderFragCode("none", "ignored"), SHADER_PRESETS.none.code);
  assert.equal(resolveShaderFragCode("custom", "precision mediump float;\nvoid main() {}"), "precision mediump float;\nvoid main() {}");
});
