import { test } from "node:test";
import assert from "node:assert/strict";

const { SHADER_PRESETS } = await import("../src/components/webgl-video-shader.tsx");

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

test("SHADER_PRESETS defines all built-in presets with Russian labels", () => {
  assert.deepEqual(Object.keys(SHADER_PRESETS).sort(), PRESET_KEYS.sort());
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");
});

test("each preset has description and valid GLSL fragment shader", () => {
  for (const key of PRESET_KEYS) {
    const preset = SHADER_PRESETS[key];
    assert.ok(preset.description.length > 0, `${key} description`);
    assert.match(preset.code, /precision mediump float;/);
    assert.match(preset.code, /uniform sampler2D uVideo;/);
    assert.match(preset.code, /varying vec2 vTexCoord;/);
    assert.match(preset.code, /void main\(\)/);
    assert.match(preset.code, /gl_FragColor/);
  }
});

test("none preset passes through video texture unchanged", () => {
  const { code } = SHADER_PRESETS.none;
  assert.match(code, /gl_FragColor = texture2D\(uVideo, vTexCoord\);/);
});

test("sharpen and upscale presets use uResolution uniform", () => {
  assert.match(SHADER_PRESETS.sharpen.code, /uniform vec2 uResolution;/);
  assert.match(SHADER_PRESETS.upscale.code, /uniform vec2 uResolution;/);
  assert.match(SHADER_PRESETS.sharpen.code, /1\.0 \/ uResolution/);
  assert.match(SHADER_PRESETS.upscale.code, /bicubic/);
});

test("contrast preset boosts saturation via luminance mix", () => {
  assert.match(SHADER_PRESETS.contrast.code, /dot\(col, vec3\(0\.299, 0\.587, 0\.114\)\)/);
  assert.match(SHADER_PRESETS.contrast.code, /mix\(vec3\(lum\), col/);
});

test("night preset reduces brightness with warm tint", () => {
  assert.match(SHADER_PRESETS.night.code, /c\.rgb \* 0\.62/);
  assert.match(SHADER_PRESETS.night.code, /col\.r\s*\*=\s*1\.12/);
  assert.match(SHADER_PRESETS.night.code, /col\.b\s*\*=\s*0\.75/);
});
