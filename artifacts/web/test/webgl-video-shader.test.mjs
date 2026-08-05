import { test } from "node:test";
import assert from "node:assert/strict";

const { SHADER_PRESETS, WebGLVideoShader } = await import(
  "../src/components/webgl-video-shader.tsx"
);

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

test("SHADER_PRESETS defines all built-in preset keys", () => {
  assert.deepEqual(Object.keys(SHADER_PRESETS).sort(), PRESET_KEYS.sort());
});

test("SHADER_PRESETS labels and descriptions are Russian", () => {
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.none.description, "Без обработки");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");
  for (const key of PRESET_KEYS) {
    assert.match(SHADER_PRESETS[key].description, /[а-яА-ЯёЁ]/, `${key} description should be Russian`);
  }
});

test("each preset fragment shader includes required GLSL structure", () => {
  for (const key of PRESET_KEYS) {
    const code = SHADER_PRESETS[key].code;
    assert.match(code, /precision mediump float;/, `${key}: precision`);
    assert.match(code, /uniform sampler2D uVideo;/, `${key}: uVideo uniform`);
    assert.match(code, /varying vec2 vTexCoord;/, `${key}: vTexCoord varying`);
    assert.match(code, /void main\(\)/, `${key}: main()`);
    assert.match(code, /texture2D\(uVideo/, `${key}: samples uVideo`);
  }
});

test("sharpen and upscale presets use uResolution uniform", () => {
  assert.match(SHADER_PRESETS.sharpen.code, /uniform vec2 uResolution;/);
  assert.match(SHADER_PRESETS.upscale.code, /uniform vec2 uResolution;/);
  assert.doesNotMatch(SHADER_PRESETS.none.code, /uResolution/);
});

test("none preset is passthrough without extra processing", () => {
  const code = SHADER_PRESETS.none.code;
  assert.match(code, /gl_FragColor = texture2D\(uVideo, vTexCoord\);/);
});

test("upscale preset implements bicubic sampling", () => {
  const code = SHADER_PRESETS.upscale.code;
  assert.match(code, /vec4 cubic\(/);
  assert.match(code, /vec4 bicubic\(/);
  assert.match(code, /gl_FragColor = bicubic\(vTexCoord\);/);
});

test("WebGLVideoShader is a forwardRef component", () => {
  assert.equal(typeof WebGLVideoShader, "object");
  assert.equal(typeof WebGLVideoShader.render, "function");
});
