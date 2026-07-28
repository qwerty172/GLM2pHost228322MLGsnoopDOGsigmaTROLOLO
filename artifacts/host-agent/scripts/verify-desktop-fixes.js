const path = require("path");
const fs = require("fs");

const assets = path.join("artifacts/host-agent/assets");
for (const f of ["icon.ico", "icon.png"]) {
  const p = path.join(assets, f);
  const st = fs.statSync(p);
  console.log(f, st.size, "bytes ok");
}

const html = fs.readFileSync(
  "artifacts/host-agent/dist/renderer/index.html",
  "utf8",
);
console.log("session-actions", html.includes("session-actions-card"));
console.log("connect-id", (html.match(/id="connect"/g) || []).length === 1);
console.log("steam-retry", html.includes("steam-scan-retry"));
console.log("open-log", html.includes("open-log-file"));

const css = fs.readFileSync(
  "artifacts/host-agent/dist/renderer/styles.css",
  "utf8",
);
console.log("hidden-fix", css.includes("modal-overlay[hidden]"));

const tray = fs.readFileSync(
  "artifacts/host-agent/dist/main/main/tray.js",
  "utf8",
);
console.log("destroyTray", tray.includes("exports.destroyTray"));
console.log("openSettingsCb", tray.includes("openSettingsCb"));

const main = fs.readFileSync(
  "artifacts/host-agent/dist/main/main/index.js",
  "utf8",
);
console.log("process.exit", main.includes("process.exit(0)"));
console.log("showOrCreate", main.includes("showOrCreateMainWindow"));
console.log("readLogTail", main.includes("readLogTail"));
