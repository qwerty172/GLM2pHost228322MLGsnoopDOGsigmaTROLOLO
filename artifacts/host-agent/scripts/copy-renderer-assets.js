// Copies static renderer assets (HTML, CSS) into dist/renderer alongside the
// compiled JS so they can be loaded by Electron's BrowserWindow.
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

console.log("Copied renderer static assets to", DST);
