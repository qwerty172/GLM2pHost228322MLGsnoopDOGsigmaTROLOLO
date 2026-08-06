import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as React from "react";
import { createElement, act, createRef } from "react";
import { createRoot } from "react-dom/client";

globalThis.React = React;

const { SHADER_PRESETS, WebGLVideoShader } = await import("../src/components/webgl-video-shader.tsx");

const PRESET_KEYS = ["none", "sharpen", "contrast", "upscale", "night"];

function createMockGl({ compileOk = true, linkOk = true } = {}) {
  const constants = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    TEXTURE_2D: 3553,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    LINEAR: 9729,
    FLOAT: 5126,
    TRIANGLE_STRIP: 5,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
  };

  const calls = {
    drawArrays: 0,
    deleteProgram: 0,
    deleteBuffer: 0,
    deleteTexture: 0,
  };

  const gl = {
    ...constants,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: (_shader, param) =>
      param === constants.COMPILE_STATUS ? compileOk : true,
    getShaderInfoLog: () => (compileOk ? "" : "shader compile failed"),
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: (_prog, param) =>
      param === constants.LINK_STATUS ? linkOk : true,
    getProgramInfoLog: () => (linkOk ? "" : "link failed"),
    deleteProgram: () => {
      calls.deleteProgram += 1;
    },
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    createTexture: () => ({}),
    bindTexture: () => {},
    texParameteri: () => {},
    getAttribLocation: () => 0,
    getUniformLocation: (_prog, name) => {
      if (name === "uVideo") return 1;
      if (name === "uResolution") return 2;
      if (name === "uTime") return 3;
      return null;
    },
    viewport: () => {},
    texImage2D: () => {},
    useProgram: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    uniform1i: () => {},
    uniform2f: () => {},
    uniform1f: () => {},
    drawArrays: () => {
      calls.drawArrays += 1;
    },
    deleteBuffer: () => {
      calls.deleteBuffer += 1;
    },
    deleteTexture: () => {
      calls.deleteTexture += 1;
    },
  };

  return { gl, calls };
}

let domRegistered = false;
let domContainer = null;
let domRoot = null;
let origGetContext = null;
let origRequestAnimationFrame = null;
let origCancelAnimationFrame = null;
let rafQueue = [];
let rafId = 0;

function ensureDom() {
  if (!domRegistered) {
    GlobalRegistrator.register({ url: "https://localhost/", width: 640, height: 360 });
    domRegistered = true;
  }
}

function installRafMock() {
  rafQueue = [];
  rafId = 0;
  origRequestAnimationFrame = globalThis.requestAnimationFrame;
  origCancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => {
    rafId += 1;
    rafQueue.push({ id: rafId, cb });
    return rafId;
  };
  globalThis.cancelAnimationFrame = (id) => {
    rafQueue = rafQueue.filter((entry) => entry.id !== id);
  };
}

async function flushRaf(maxFrames = 4) {
  for (let i = 0; i < maxFrames; i += 1) {
    const batch = rafQueue.splice(0);
    if (!batch.length) break;
    for (const { cb } of batch) {
      await cb(performance.now());
    }
  }
}

function installWebGlMock(options) {
  ensureDom();
  const { gl, calls } = createMockGl(options);
  globalThis.__webglMockGl = gl;
  origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(type) {
    if (type === "webgl") return gl;
    return origGetContext.call(this, type);
  };
  return { gl, calls };
}

function restoreWebGlMock() {
  globalThis.__webglMockGl = null;
  if (origGetContext) {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    origGetContext = null;
  }
  if (origRequestAnimationFrame) {
    globalThis.requestAnimationFrame = origRequestAnimationFrame;
    globalThis.cancelAnimationFrame = origCancelAnimationFrame;
    origRequestAnimationFrame = null;
    origCancelAnimationFrame = null;
  }
}

function mountShader({
  active = true,
  fragCode = SHADER_PRESETS.none.code,
  readyState = 4,
  onCompileError,
  shaderRef,
} = {}) {
  ensureDom();
  const videoRef = { current: null };
  const video = { readyState };
  videoRef.current = video;

  domContainer = document.createElement("div");
  document.body.appendChild(domContainer);
  domRoot = createRoot(domContainer);

  act(() => {
    domRoot.render(
      createElement(WebGLVideoShader, {
        ref: shaderRef,
        videoRef,
        fragCode,
        active,
        onCompileError,
        className: "shader-canvas",
        style: { width: 640, height: 360 },
      }),
    );
  });

  const canvas = domContainer.querySelector("canvas");
  if (canvas) {
    Object.defineProperty(canvas, "clientWidth", { value: 640, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 360, configurable: true });
    if (globalThis.__webglMockGl) {
      const orig = canvas.getContext.bind(canvas);
      canvas.getContext = (type, opts) =>
        type === "webgl" ? globalThis.__webglMockGl : orig(type, opts);
    }
  }
  return { canvas, videoRef, video };
}

async function unmountShader() {
  if (domRoot) {
    act(() => {
      domRoot.unmount();
    });
    domRoot = null;
  }
  if (domContainer) {
    domContainer.remove();
    domContainer = null;
  }
  restoreWebGlMock();
  if (domRegistered) {
    await GlobalRegistrator.unregister();
    domRegistered = false;
  }
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  installRafMock();
  ensureDom();
});

afterEach(async () => {
  await unmountShader();
});

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

test("WebGLVideoShader renders hidden canvas when inactive", async () => {
  const { canvas } = mountShader({ active: false });
  assert.ok(canvas);
  assert.equal(canvas.style.display, "none");
  assert.equal(canvas.className, "shader-canvas");
});

test("WebGLVideoShader reports WebGL unavailable", async () => {
  const errors = [];
  ensureDom();
  origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = () => null;

  mountShader({ onCompileError: (err) => errors.push(err) });
  await flushRaf(1);

  assert.deepEqual(errors, ["WebGL недоступен в этом браузере"]);
});

test("WebGLVideoShader reports shader compile errors", async () => {
  const errors = [];
  installWebGlMock({ compileOk: false });

  mountShader({
    fragCode: "void main() { }",
    onCompileError: (err) => errors.push(err),
  });
  await flushRaf(1);

  assert.equal(errors.length, 1);
  assert.equal(errors[0], "shader compile failed");
});

test("WebGLVideoShader clears compile error on success", async () => {
  const errors = [];
  installWebGlMock();

  mountShader({
    fragCode: SHADER_PRESETS.sharpen.code,
    onCompileError: (err) => errors.push(err),
  });

  await flushRaf(3);

  assert.ok(errors.includes(null));
});

test("WebGLVideoShader exposes canvas element and ref handle", async () => {
  installWebGlMock();
  const shaderRef = createRef();

  const { canvas } = mountShader({ shaderRef });

  await flushRaf(2);

  assert.ok(canvas);
  assert.equal(canvas.tagName, "CANVAS");
  assert.equal(shaderRef.current?.canvas, canvas);
});

test("WebGLVideoShader waits for video readyState before drawing", async () => {
  const { calls } = installWebGlMock();

  mountShader({ readyState: 0 });
  await flushRaf(4);

  assert.equal(calls.drawArrays, 0);
});

test("WebGLVideoShader reports program link errors", async () => {
  const errors = [];
  installWebGlMock({ linkOk: false });

  mountShader({
    fragCode: SHADER_PRESETS.none.code,
    onCompileError: (err) => errors.push(err),
  });
  await flushRaf(1);

  assert.equal(errors.length, 1);
  assert.equal(errors[0], "link failed");
});

test("WebGLVideoShader cleans up WebGL resources on unmount", async () => {
  const { calls } = installWebGlMock();
  mountShader();

  await flushRaf(2);

  act(() => {
    domRoot.unmount();
  });
  domRoot = null;
  domContainer?.remove();
  domContainer = null;
  restoreWebGlMock();

  assert.equal(calls.deleteBuffer, 1);
  assert.equal(calls.deleteTexture, 1);
  assert.equal(calls.deleteProgram, 1);
});
