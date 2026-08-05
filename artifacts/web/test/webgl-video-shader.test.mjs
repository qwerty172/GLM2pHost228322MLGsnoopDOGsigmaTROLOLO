import { test } from "node:test";
import assert from "node:assert/strict";

const { SHADER_PRESETS } = await import("../src/components/webgl-video-shader.tsx");

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

test("SHADER_PRESETS defines all built-in preset keys", () => {
  assert.deepEqual(Object.keys(SHADER_PRESETS), PRESET_KEYS);
});

test("SHADER_PRESETS none is passthrough with Russian label", () => {
  const none = SHADER_PRESETS.none;
  assert.equal(none.label, "Выкл");
  assert.equal(none.description, "Без обработки");
  assert.match(none.code, /uniform sampler2D uVideo/);
  assert.match(none.code, /texture2D\(uVideo, vTexCoord\)/);
});

test("SHADER_PRESETS sharpen uses unsharp mask with uResolution", () => {
  const sharpen = SHADER_PRESETS.sharpen;
  assert.equal(sharpen.label, "Резкость");
  assert.match(sharpen.description, /Unsharp mask/);
  assert.match(sharpen.code, /uniform vec2 uResolution/);
  assert.match(sharpen.code, /clamp\(5\.0 \* c - t - b - l - r/);
});

test("SHADER_PRESETS contrast boosts saturation and contrast", () => {
  const contrast = SHADER_PRESETS.contrast;
  assert.equal(contrast.label, "Контраст");
  assert.match(contrast.code, /mix\(vec3\(lum\), col, 1\.35\)/);
  assert.match(contrast.code, /\* 1\.45 \+ 0\.5/);
});

test("SHADER_PRESETS upscale defines bicubic interpolation", () => {
  const upscale = SHADER_PRESETS.upscale;
  assert.equal(upscale.label, "Апскейл");
  assert.match(upscale.description, /Бикубическая/);
  assert.match(upscale.code, /vec4 bicubic\(vec2 uv\)/);
  assert.match(upscale.code, /bicubic\(vTexCoord\)/);
});

test("SHADER_PRESETS night dims and warms the image", () => {
  const night = SHADER_PRESETS.night;
  assert.equal(night.label, "Ночной");
  assert.match(night.description, /ночью/);
  assert.match(night.code, /c\.rgb \* 0\.62/);
  assert.match(night.code, /col\.r\s*\*=\s*1\.12/);
});

test("every SHADER_PRESETS entry has label, description and compilable GLSL skeleton", () => {
  for (const key of PRESET_KEYS) {
    const preset = SHADER_PRESETS[key];
    assert.equal(typeof preset.label, "string");
    assert.ok(preset.label.length > 0);
    assert.equal(typeof preset.description, "string");
    assert.ok(preset.description.length > 0);
    assert.match(preset.code, /precision mediump float/);
    assert.match(preset.code, /uniform sampler2D uVideo/);
    assert.match(preset.code, /varying vec2 vTexCoord/);
    assert.match(preset.code, /void main\(\)/);
    assert.match(preset.code, /gl_FragColor/);
  }
});
