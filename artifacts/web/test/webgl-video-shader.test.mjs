import { test } from "node:test";
import assert from "node:assert/strict";

const { SHADER_PRESETS } = await import("../src/components/webgl-video-shader.tsx");

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

function isValidFragmentShader(code) {
  return (
    code.includes("precision mediump float") &&
    code.includes("uniform sampler2D uVideo") &&
    code.includes("varying vec2 vTexCoord") &&
    code.includes("void main()") &&
    code.includes("gl_FragColor")
  );
}

test("SHADER_PRESETS defines five built-in presets", () => {
  assert.deepEqual(Object.keys(SHADER_PRESETS), PRESET_KEYS);
});

test("SHADER_PRESETS labels are Russian", () => {
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");
});

test("SHADER_PRESETS descriptions are non-empty Russian strings", () => {
  for (const key of PRESET_KEYS) {
    const { description } = SHADER_PRESETS[key];
    assert.ok(description.length > 10, `${key} description too short`);
    assert.match(description, /[А-Яа-яЁё]/, `${key} description should be Russian`);
  }
});

test("every preset fragment shader has required GLSL structure", () => {
  for (const key of PRESET_KEYS) {
    assert.ok(isValidFragmentShader(SHADER_PRESETS[key].code), `${key} shader invalid`);
  }
});

test("none preset is passthrough texture2D", () => {
  const { code } = SHADER_PRESETS.none;
  assert.match(code, /texture2D\(uVideo,\s*vTexCoord\)/);
  assert.doesNotMatch(code, /uResolution/);
});

test("sharpen and upscale presets use uResolution uniform", () => {
  assert.match(SHADER_PRESETS.sharpen.code, /uniform vec2 uResolution/);
  assert.match(SHADER_PRESETS.upscale.code, /uniform vec2 uResolution/);
  assert.doesNotMatch(SHADER_PRESETS.contrast.code, /uResolution/);
  assert.doesNotMatch(SHADER_PRESETS.night.code, /uResolution/);
});

test("upscale preset implements bicubic interpolation", () => {
  assert.match(SHADER_PRESETS.upscale.code, /vec4 bicubic/);
  assert.match(SHADER_PRESETS.upscale.code, /vec4 cubic/);
});

test("night preset reduces brightness with warm tone", () => {
  const { code } = SHADER_PRESETS.night;
  assert.match(code, /c\.rgb \* 0\.62/);
  assert.match(code, /col\.r\s*\*=\s*1\.12/);
  assert.match(code, /col\.b\s*\*=\s*0\.75/);
});
