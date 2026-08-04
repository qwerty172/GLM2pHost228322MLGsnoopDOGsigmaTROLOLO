/**
 * WebGL video shader renderer.
 *
 * Captures frames from a <video> element and passes them through a
 * user-supplied GLSL fragment shader on every animation frame. The result
 * is drawn onto a <canvas> that sits in place of the video.
 *
 * Uniforms available to fragment shaders:
 *   uniform sampler2D uVideo;      // video texture
 *   uniform vec2      uResolution; // canvas pixel size (width, height)
 *   uniform float     uTime;       // seconds since shader activation
 *   varying vec2      vTexCoord;   // 0..1 UV (Y is flipped to match video)
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

// ─── Built-in preset shaders ────────────────────────────────────────────────

export const SHADER_PRESETS = {
  none: {
    label: "Выкл",
    description: "Без обработки",
    code: `precision mediump float;
uniform sampler2D uVideo;
varying vec2 vTexCoord;
void main() {
  gl_FragColor = texture2D(uVideo, vTexCoord);
}`,
  },

  sharpen: {
    label: "Резкость",
    description: "Unsharp mask — чёткость текста и UI",
    code: `precision mediump float;
uniform sampler2D uVideo;
uniform vec2 uResolution;
varying vec2 vTexCoord;
void main() {
  vec2 px = 1.0 / uResolution;
  vec4 c  = texture2D(uVideo, vTexCoord);
  vec4 t  = texture2D(uVideo, vTexCoord + vec2( 0.0,  -px.y));
  vec4 b  = texture2D(uVideo, vTexCoord + vec2( 0.0,   px.y));
  vec4 l  = texture2D(uVideo, vTexCoord + vec2(-px.x,  0.0 ));
  vec4 r  = texture2D(uVideo, vTexCoord + vec2( px.x,  0.0 ));
  gl_FragColor = clamp(5.0 * c - t - b - l - r, 0.0, 1.0);
}`,
  },

  contrast: {
    label: "Контраст",
    description: "Контраст + насыщенность — текст и тёмные сцены",
    code: `precision mediump float;
uniform sampler2D uVideo;
varying vec2 vTexCoord;
void main() {
  vec4 c   = texture2D(uVideo, vTexCoord);
  vec3 col = (c.rgb - 0.5) * 1.45 + 0.5;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.35);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}`,
  },

  upscale: {
    label: "Апскейл",
    description: "Бикубическая интерполяция — компенсирует артефакты сжатия",
    code: `precision mediump float;
uniform sampler2D uVideo;
uniform vec2 uResolution;
varying vec2 vTexCoord;

vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

vec4 bicubic(vec2 uv) {
  vec2 ts  = uResolution;
  vec2 inv = 1.0 / ts;
  vec2 p   = uv * ts - 0.5;
  vec2 fi  = fract(p);
  p       -= fi;
  vec4 xc  = cubic(fi.x);
  vec4 yc  = cubic(fi.y);
  vec4 c   = p.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s   = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = (c + vec4(xc.yw, yc.yw) / s) * inv.xxyy;
  vec4 s0  = texture2D(uVideo, off.xz);
  vec4 s1  = texture2D(uVideo, off.yz);
  vec4 s2  = texture2D(uVideo, off.xw);
  vec4 s3  = texture2D(uVideo, off.yw);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

void main() {
  gl_FragColor = bicubic(vTexCoord);
}`,
  },

  night: {
    label: "Ночной",
    description: "Снижает яркость, тёплый тон — игра ночью",
    code: `precision mediump float;
uniform sampler2D uVideo;
varying vec2 vTexCoord;
void main() {
  vec4 c   = texture2D(uVideo, vTexCoord);
  vec3 col = c.rgb * 0.62;
  col.r   *= 1.12;
  col.g   *= 0.96;
  col.b   *= 0.75;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}`,
  },
} as const;

export type PresetKey = keyof typeof SHADER_PRESETS | "custom";

// ─── Vertex shader (shared for all presets) ──────────────────────────────────

const VERT_SRC = `
attribute vec2 aPosition;
varying vec2 vTexCoord;
void main() {
  // Map clip-space [-1,1] to UV [0,1], flip Y so top of video = top of canvas
  vTexCoord   = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// ─── WebGL helpers ────────────────────────────────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(s) ?? "compile error";
    gl.deleteShader(s);
    throw new Error(err);
  }
  return s;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) throw new Error("Shader compile failed");
  const prog = gl.createProgram();
  if (!prog) throw new Error("createProgram failed");
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return prog;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface WebGLVideoShaderHandle {
  canvas: HTMLCanvasElement | null;
}

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  fragCode: string;
  active: boolean;
  className?: string;
  style?: CSSProperties;
  onCompileError?: (err: string | null) => void;
}

export const WebGLVideoShader = forwardRef<WebGLVideoShaderHandle, Props>(
  function WebGLVideoShader({ videoRef, fragCode, active, className, style, onCompileError }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({ canvas: canvasRef.current }), []);

    useEffect(() => {
      if (!active) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext("webgl", { antialias: false });
      if (!gl) {
        onCompileError?.("WebGL недоступен в этом браузере");
        return;
      }

      // Build program
      let prog: WebGLProgram;
      try {
        prog = createProgram(gl, VERT_SRC, fragCode);
        onCompileError?.(null);
      } catch (e) {
        onCompileError?.(e instanceof Error ? e.message : String(e));
        return;
      }

      // Full-screen quad
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );

      // Texture for video frames
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const aPos = gl.getAttribLocation(prog, "aPosition");
      const uVideoLoc = gl.getUniformLocation(prog, "uVideo");
      const uResLoc = gl.getUniformLocation(prog, "uResolution");
      const uTimeLoc = gl.getUniformLocation(prog, "uTime");

      let rafId = 0;
      const startTime = performance.now();

      const draw = () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          rafId = requestAnimationFrame(draw);
          return;
        }

        // Sync canvas size to display size
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }

        // Upload video frame
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        gl.useProgram(prog);

        // Attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        // Uniforms
        gl.uniform1i(uVideoLoc, 0);
        if (uResLoc) gl.uniform2f(uResLoc, canvas.width, canvas.height);
        if (uTimeLoc) gl.uniform1f(uTimeLoc, (performance.now() - startTime) / 1000);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        rafId = requestAnimationFrame(draw);
      };

      rafId = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(rafId);
        gl.deleteBuffer(buf);
        gl.deleteTexture(tex);
        gl.deleteProgram(prog);
      };
    }, [active, fragCode, videoRef, onCompileError]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ display: active ? undefined : "none", ...style }}
      />
    );
  },
);
