import { test } from "node:test";
import assert from "node:assert/strict";

const {
  SHADER_PRESETS,
  SHADER_PRESET_KEYS,
  SHADER_STORAGE_KEYS,
  resolveShaderFragCode,
  fragmentShaderUsesUniform,
  compileShader,
  createShaderProgram,
} = await import("../src/components/webgl-video-shader.tsx");

test("SHADER_PRESET_KEYS lists all built-in presets", () => {
  assert.deepEqual(SHADER_PRESET_KEYS, ["none", "sharpen", "contrast", "upscale", "night"]);
});

test("SHADER_STORAGE_KEYS matches play.tsx localStorage keys", () => {
  assert.equal(SHADER_STORAGE_KEYS.preset, "shaderPreset");
  assert.equal(SHADER_STORAGE_KEYS.customCode, "shaderCustomCode");
});

test("SHADER_PRESETS defines Russian labels for each preset", () => {
  assert.equal(SHADER_PRESETS.none.label, "Выкл");
  assert.equal(SHADER_PRESETS.sharpen.label, "Резкость");
  assert.equal(SHADER_PRESETS.contrast.label, "Контраст");
  assert.equal(SHADER_PRESETS.upscale.label, "Апскейл");
  assert.equal(SHADER_PRESETS.night.label, "Ночной");
  for (const key of SHADER_PRESET_KEYS) {
    assert.ok(SHADER_PRESETS[key].code.includes("void main()"));
    assert.ok(SHADER_PRESETS[key].description.length > 0);
  }
});

test("resolveShaderFragCode returns custom code for custom preset", () => {
  const custom = "void main() { gl_FragColor = vec4(1.0); }";
  assert.equal(resolveShaderFragCode("custom", custom), custom);
});

test("resolveShaderFragCode returns preset code for built-in presets", () => {
  assert.equal(resolveShaderFragCode("sharpen", "ignored"), SHADER_PRESETS.sharpen.code);
  assert.equal(resolveShaderFragCode("upscale", ""), SHADER_PRESETS.upscale.code);
  assert.equal(resolveShaderFragCode("none", ""), SHADER_PRESETS.none.code);
});

test("fragmentShaderUsesUniform detects uResolution and uTime", () => {
  assert.equal(fragmentShaderUsesUniform(SHADER_PRESETS.sharpen.code, "uResolution"), true);
  assert.equal(fragmentShaderUsesUniform(SHADER_PRESETS.none.code, "uResolution"), false);
  assert.equal(fragmentShaderUsesUniform("uniform float uTime;", "uTime"), true);
  assert.equal(fragmentShaderUsesUniform("uniform sampler2D uVideo;", "uVideo"), true);
  assert.equal(fragmentShaderUsesUniform(SHADER_PRESETS.contrast.code, "uTime"), false);
});

function createMockGl({ compileOk = true, linkOk = true, createShaderFails = false } = {}) {
  const shaders = new Set();
  const programs = new Set();
  let shaderId = 0;
  let programId = 0;

  return {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    createShader() {
      if (createShaderFails) return null;
      const s = { id: ++shaderId };
      shaders.add(s);
      return s;
    },
    shaderSource() {},
    compileShader() {},
    getShaderParameter(_s, pname) {
      return pname === 35713 ? compileOk : false;
    },
    getShaderInfoLog() {
      return compileOk ? "" : "shader compile error";
    },
    deleteShader(s) {
      shaders.delete(s);
    },
    createProgram() {
      const p = { id: ++programId };
      programs.add(p);
      return p;
    },
    attachShader() {},
    linkProgram() {},
    getProgramParameter(_p, pname) {
      return pname === 35714 ? linkOk : false;
    },
    getProgramInfoLog() {
      return linkOk ? "" : "link error";
    },
    deleteProgram(p) {
      programs.delete(p);
    },
  };
}

test("compileShader returns shader on success", () => {
  const gl = createMockGl();
  const shader = compileShader(gl, gl.VERTEX_SHADER, "void main() {}");
  assert.ok(shader);
});

test("compileShader throws on compile failure", () => {
  const gl = createMockGl({ compileOk: false });
  assert.throws(() => compileShader(gl, gl.FRAGMENT_SHADER, "bad"), /shader compile error/);
});

test("compileShader returns null when createShader fails", () => {
  const gl = createMockGl({ createShaderFails: true });
  assert.equal(compileShader(gl, gl.VERTEX_SHADER, "void main() {}"), null);
});

test("createShaderProgram links vertex and fragment shaders", () => {
  const gl = createMockGl();
  const prog = createShaderProgram(gl, "void main() {}", "void main() {}");
  assert.ok(prog);
});

test("createShaderProgram throws on link failure", () => {
  const gl = createMockGl({ linkOk: false });
  assert.throws(() => createShaderProgram(gl, "void main() {}", "void main() {}"), /link error/);
});

test("createShaderProgram throws when shader compile fails", () => {
  const gl = createMockGl({ compileOk: false });
  assert.throws(() => createShaderProgram(gl, "void main() {}", "void main() {}"), /shader compile error/);
});
