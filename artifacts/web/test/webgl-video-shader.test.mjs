import { test } from "node:test";
import assert from "node:assert/strict";

const { SHADER_PRESETS, WebGLVideoShader } = await import("../src/components/webgl-video-shader.tsx");

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

test("SHADER_PRESETS defines all built-in presets", () => {
  assert.deepEqual(Object.keys(SHADER_PRESETS).sort(), PRESET_KEYS.sort());
});

test("SHADER_PRESETS labels and descriptions are in Russian", () => {
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");
  for (const key of PRESET_KEYS) {
    assert.ok(SHADER_PRESETS[key].description.length > 0, `${key} description`);
  }
});

test("each preset fragment shader declares uVideo and vTexCoord", () => {
  for (const key of PRESET_KEYS) {
    const code = SHADER_PRESETS[key].code;
    assert.match(code, /uniform sampler2D uVideo/, `${key}: uVideo`);
    assert.match(code, /varying vec2 vTexCoord/, `${key}: vTexCoord`);
    assert.match(code, /void main\(\)/, `${key}: main`);
  }
});

test("sharpen and upscale presets use uResolution uniform", () => {
  assert.match(SHADER_PRESETS.sharpen.code, /uniform vec2 uResolution/);
  assert.match(SHADER_PRESETS.upscale.code, /uniform vec2 uResolution/);
});

test("none preset passes through video texture unchanged", () => {
  assert.match(SHADER_PRESETS.none.code, /gl_FragColor = texture2D\(uVideo, vTexCoord\)/);
});

test("WebGLVideoShader is a forwardRef component", () => {
  assert.equal(typeof WebGLVideoShader, "object");
  assert.equal(typeof WebGLVideoShader.render, "function");
});
