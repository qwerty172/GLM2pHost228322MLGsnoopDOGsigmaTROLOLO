import { test } from "node:test";
import assert from "node:assert/strict";

const { SHADER_PRESETS, WebGLVideoShader } = await import("../src/components/webgl-video-shader.tsx");

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

test("SHADER_PRESETS defines all built-in shader presets", () => {
  assert.deepEqual(Object.keys(SHADER_PRESETS), PRESET_KEYS);
});

test("SHADER_PRESETS labels and descriptions are in Russian", () => {
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");

  for (const key of PRESET_KEYS) {
    assert.match(SHADER_PRESETS[key].description, /[\u0400-\u04FF]/, `${key} description should be Russian`);
  }
});

test("each preset fragment shader includes required GLSL uniforms and main", () => {
  for (const key of PRESET_KEYS) {
    const code = SHADER_PRESETS[key].code;
    assert.match(code, /precision mediump float;/);
    assert.match(code, /uniform sampler2D uVideo;/);
    assert.match(code, /varying vec2 vTexCoord;/);
    assert.match(code, /void main\(\)/);
    assert.match(code, /gl_FragColor/);
  }
});

test("sharpen and upscale presets use uResolution uniform", () => {
  assert.match(SHADER_PRESETS.sharpen.code, /uniform vec2 uResolution;/);
  assert.match(SHADER_PRESETS.upscale.code, /uniform vec2 uResolution;/);
  assert.match(SHADER_PRESETS.upscale.code, /bicubic/);
});

test("none preset is passthrough texture sampling", () => {
  const code = SHADER_PRESETS.none.code;
  assert.match(code, /gl_FragColor = texture2D\(uVideo, vTexCoord\)/);
  assert.doesNotMatch(code, /uResolution/);
});

test("WebGLVideoShader component is exported", () => {
  assert.equal(typeof WebGLVideoShader, "object");
  assert.ok(WebGLVideoShader);
});
