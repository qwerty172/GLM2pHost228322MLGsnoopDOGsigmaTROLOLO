// Copies static renderer assets (HTML, CSS) into dist/renderer alongside the
// compiled JS so they can be loaded by Electron's BrowserWindow.
//
// Because tsconfig.renderer.json includes both `src/renderer/**` and
// `src/shared/**`, TypeScript computes a rootDir of `src` and emits the
// renderer entry to `dist/renderer/renderer/index.js`. We additionally copy
// it (and its sourcemap) to a flat path `dist/renderer/index.js` so the
// HTML can reference it as `./index.js` — that way both the compiled-output
// path AND the HTML are unambiguous to humans, linters, and CI checks.
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src", "renderer");
const DST = path.join(__dirname, "..", "dist", "renderer");

fs.mkdirSync(DST, { recursive: true });

for (const entry of fs.readdirSync(SRC)) {
  if (entry.endsWith(".html") || entry.endsWith(".css")) {
    fs.copyFileSync(path.join(SRC, entry), path.join(DST, entry));
  }
}

const nestedJs = path.join(DST, "renderer", "index.js");
const flatJs = path.join(DST, "index.js");
if (fs.existsSync(nestedJs)) {
  fs.copyFileSync(nestedJs, flatJs);
  const nestedMap = nestedJs + ".map";
  if (fs.existsSync(nestedMap)) {
    fs.copyFileSync(nestedMap, flatJs + ".map");
  }
}

// CI guard: HTML must reference a file that actually exists, otherwise
// Electron's BrowserWindow silently fails to bootstrap the renderer.
const html = fs.readFileSync(path.join(DST, "index.html"), "utf8");
const m = html.match(/<script[^>]+src="([^"]+)"/);
if (m) {
  const referenced = path.resolve(DST, m[1]);
  if (!fs.existsSync(referenced)) {
    throw new Error(
      `Renderer bootstrap is broken: index.html references ${m[1]} which resolves to ${referenced} — file does not exist.`,
    );
  }
}

console.log("Copied renderer static assets to", DST);
