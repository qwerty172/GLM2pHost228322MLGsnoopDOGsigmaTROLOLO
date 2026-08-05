import { test } from "node:test";
import assert from "node:assert/strict";

const { SHADER_PRESETS, WebGLVideoShader } = await import("../src/components/webgl-video-shader.tsx");

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

test("SHADER_PRESETS defines all built-in presets with Russian labels", () => {
  assert.deepEqual(Object.keys(SHADER_PRESETS), PRESET_KEYS);
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");
});

test("SHADER_PRESETS descriptions are non-empty Russian strings", () => {
  for (const key of PRESET_KEYS) {
    const preset = SHADER_PRESETS[key];
    assert.ok(preset.description.length > 5);
    assert.match(preset.description, /[а-яА-ЯёЁ]/);
  }
});

test("each preset fragment shader includes uVideo sampler and main()", () => {
  for (const key of PRESET_KEYS) {
    const code = SHADER_PRESETS[key].code;
    assert.match(code, /uniform\s+sampler2D\s+uVideo/);
    assert.match(code, /void\s+main\s*\(\s*\)/);
    assert.match(code, /gl_FragColor/);
    assert.match(code, /texture2D\s*\(\s*uVideo/);
  }
});

test("sharpen and upscale presets use uResolution uniform", () => {
  assert.match(SHADER_PRESETS.sharpen.code, /uniform\s+vec2\s+uResolution/);
  assert.match(SHADER_PRESETS.upscale.code, /uniform\s+vec2\s+uResolution/);
  assert.doesNotMatch(SHADER_PRESETS.none.code, /uResolution/);
  assert.doesNotMatch(SHADER_PRESETS.contrast.code, /uResolution/);
  assert.doesNotMatch(SHADER_PRESETS.night.code, /uResolution/);
});

test("none preset is passthrough texture sampling", () => {
  const code = SHADER_PRESETS.none.code;
  assert.match(code, /gl_FragColor\s*=\s*texture2D\s*\(\s*uVideo\s*,\s*vTexCoord\s*\)/);
  assert.doesNotMatch(code, /clamp\s*\(/);
});

test("WebGLVideoShader is exported (forwardRef component)", () => {
  assert.ok(WebGLVideoShader);
  const t = typeof WebGLVideoShader;
  assert.ok(t === "function" || t === "object");
});
