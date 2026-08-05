import { test } from "node:test";
import assert from "node:assert/strict";

const {
  SHADER_PRESETS,
  SHADER_PRESET_KEYS,
  SHADER_STORAGE_KEYS,
  SHADER_WEBGL_UNAVAILABLE_MSG,
  VERTEX_SHADER_SRC,
  resolveShaderFragCode,
  fragmentShaderUsesUniform,
  compileShader,
  createShaderProgram,
} = await import("../src/components/webgl-video-shader.tsx");

const VERTEX_SHADER = 35633;
const FRAGMENT_SHADER = 35632;
const COMPILE_STATUS = 35713;
const LINK_STATUS = 35714;

function createMockGl({ compileOk = true, linkOk = true, compileLog = "syntax error", programLog = "link error" } = {}) {
  return {
    VERTEX_SHADER,
    FRAGMENT_SHADER,
    COMPILE_STATUS,
    LINK_STATUS,
    createShader() {
      return {};
    },
    shaderSource() {},
    compileShader() {},
    getShaderParameter(_shader, param) {
      if (param === COMPILE_STATUS) return compileOk;
      return false;
    },
    getShaderInfoLog() {
      return compileLog;
    },
    deleteShader() {},
    createProgram() {
      return {};
    },
    attachShader() {},
    linkProgram() {},
    getProgramParameter(_program, param) {
      if (param === LINK_STATUS) return linkOk;
      return false;
    },
    getProgramInfoLog() {
      return programLog;
    },
  };
}

test("SHADER_PRESET_KEYS lists all built-in presets", () => {
  assert.deepEqual(SHADER_PRESET_KEYS, ["none", "sharpen", "contrast", "upscale", "night"]);
});

test("SHADER_STORAGE_KEYS match play.tsx localStorage keys", () => {
  assert.equal(SHADER_STORAGE_KEYS.preset, "shaderPreset");
  assert.equal(SHADER_STORAGE_KEYS.customCode, "shaderCustomCode");
});

test("SHADER_WEBGL_UNAVAILABLE_MSG is Russian", () => {
  assert.equal(SHADER_WEBGL_UNAVAILABLE_MSG, "WebGL недоступен в этом браузере");
});

test("SHADER_PRESETS have Russian labels and valid fragment shaders", () => {
  for (const key of SHADER_PRESET_KEYS) {
    const preset = SHADER_PRESETS[key];
    assert.ok(preset.label.length > 0, `${key} label`);
    assert.ok(preset.description.length > 0, `${key} description`);
    assert.match(preset.code, /uniform sampler2D uVideo/);
    assert.match(preset.code, /void main\(\)/);
    assert.match(preset.code, /gl_FragColor/);
  }
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
});

test("resolveShaderFragCode returns custom code for custom preset", () => {
  const custom = "precision mediump float; void main() { gl_FragColor = vec4(1.0); }";
  assert.equal(resolveShaderFragCode("custom", custom), custom);
});

test("resolveShaderFragCode returns preset code for built-in presets", () => {
  assert.equal(resolveShaderFragCode("sharpen", "ignored"), SHADER_PRESETS.sharpen.code);
  assert.equal(resolveShaderFragCode("night", "ignored"), SHADER_PRESETS.night.code);
});

test("resolveShaderFragCode falls back to none for unknown preset", () => {
  assert.equal(resolveShaderFragCode("unknown" /* as any */, "x"), SHADER_PRESETS.none.code);
});

test("fragmentShaderUsesUniform detects uResolution in sharpen/upscale", () => {
  assert.equal(fragmentShaderUsesUniform(SHADER_PRESETS.sharpen.code, "uResolution"), true);
  assert.equal(fragmentShaderUsesUniform(SHADER_PRESETS.upscale.code, "uResolution"), true);
  assert.equal(fragmentShaderUsesUniform(SHADER_PRESETS.contrast.code, "uResolution"), false);
  assert.equal(fragmentShaderUsesUniform(SHADER_PRESETS.none.code, "uVideo"), true);
});

test("VERTEX_SHADER_SRC defines aPosition attribute and vTexCoord varying", () => {
  assert.match(VERTEX_SHADER_SRC, /attribute vec2 aPosition/);
  assert.match(VERTEX_SHADER_SRC, /varying vec2 vTexCoord/);
});

test("compileShader returns shader when compilation succeeds", () => {
  const gl = createMockGl({ compileOk: true });
  const shader = compileShader(gl, VERTEX_SHADER, VERTEX_SHADER_SRC);
  assert.ok(shader);
});

test("compileShader throws with info log on compile failure", () => {
  const gl = createMockGl({ compileOk: false, compileLog: "undeclared identifier" });
  assert.throws(
    () => compileShader(gl, FRAGMENT_SHADER, "void main() { x; }"),
    /undeclared identifier/,
  );
});

test("createShaderProgram links vertex and fragment shaders", () => {
  const gl = createMockGl({ compileOk: true, linkOk: true });
  const program = createShaderProgram(gl, VERTEX_SHADER_SRC, SHADER_PRESETS.none.code);
  assert.ok(program);
});

test("createShaderProgram throws when link fails", () => {
  const gl = createMockGl({ compileOk: true, linkOk: false, programLog: "link failed" });
  assert.throws(
    () => createShaderProgram(gl, VERTEX_SHADER_SRC, SHADER_PRESETS.none.code),
    /link failed/,
  );
});
