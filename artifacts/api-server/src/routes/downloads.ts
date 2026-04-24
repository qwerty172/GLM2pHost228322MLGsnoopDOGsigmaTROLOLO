import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { Router, type IRouter } from "express";
import archiver from "archiver";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Resolve the host-agent source directory. We try several candidate paths
// because the api-server may run from different cwds:
//   - dev (pnpm filter)        → cwd = artifacts/api-server
//   - prod (deployment target) → cwd = workspace root, bundle in artifacts/api-server/dist
//   - tests / scripts          → arbitrary cwd
// The first existing candidate wins; we log which one was used at startup.
function resolveAgentDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "artifacts", "host-agent"),
    path.resolve(process.cwd(), "..", "host-agent"),
    path.resolve(__dirname, "..", "..", "..", "host-agent"),
    path.resolve(__dirname, "..", "..", "..", "..", "host-agent"),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }
  return null;
}

const RESOLVED_AGENT_DIR = resolveAgentDir();
if (RESOLVED_AGENT_DIR) {
  logger.info({ agentDir: RESOLVED_AGENT_DIR }, "Host agent bundle source");
} else {
  logger.warn(
    "Host agent directory not found in any candidate location; downloads will 503",
  );
}

const START_BAT = `@echo off
REM Cloud Gaming Host Agent — first-run launcher.
REM Requires Node.js 20+ installed (https://nodejs.org).

setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies, this only happens once and may take a few minutes...
  call npm install --include=dev --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo Dependency install failed. Make sure Node.js 20+ is installed.
    pause
    exit /b 1
  )
)

echo Starting Cloud Gaming Host Agent...
call npx --no-install electron .
if errorlevel 1 (
  echo.
  echo The agent exited with an error. See the messages above.
  pause
)
endlocal
`;

const INSTALL_TXT = `Cloud Gaming Host Agent — portable bundle
==========================================

What this is
------------
This ZIP contains the source and built JavaScript for the Cloud Gaming
host agent (an Electron desktop app). Use it to host games on Windows
when you don't have access to a signed installer (.exe) build.

Requirements
------------
- Windows 10/11 (x64)
- Node.js 20 or newer — install from https://nodejs.org

How to run
----------
1. Extract this ZIP anywhere (for example: C:\\CloudGamingHost).
2. Double-click "start.bat".
   On the first run it will download Electron and a few helper
   packages. This takes 2-3 minutes and only happens once.
3. The agent window opens. Sign in with the host token from your
   Host Dashboard, choose a game window to capture, and you are live.

Optional: build a real installer (.exe)
---------------------------------------
On a Windows machine with Node.js installed, you can produce a signed
NSIS installer:

    npm install
    npm run package:win

The installer ends up in the "release" folder.

Need help?
----------
Open the Host Dashboard on the web platform — there is a status panel
that shows whether the agent has connected.
`;

router.get("/downloads/host-agent.zip", (req, res): void => {
  const agentDir = RESOLVED_AGENT_DIR;

  if (!agentDir) {
    res.status(503).json({ error: "Host agent bundle is unavailable." });
    return;
  }

  const distDir = path.join(agentDir, "dist");
  if (!existsSync(distDir)) {
    logger.error({ distDir }, "Host agent dist not built");
    res.status(503).json({
      error:
        "Host agent has not been built yet. Run `pnpm --filter @workspace/host-agent run build` and retry.",
    });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="cloud-gaming-host-agent.zip"',
  );
  res.setHeader("Cache-Control", "no-store");

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("warning", (err) => {
    logger.warn({ err }, "archiver warning while building host-agent zip");
  });
  archive.on("error", (err) => {
    logger.error({ err }, "archiver error while building host-agent zip");
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.destroy(err);
    }
  });

  // Abort archiving only if the *response* socket closes before we finish
  // writing. `req.on("close")` fires as soon as the GET request body is
  // drained (effectively immediately), which would corrupt the ZIP.
  res.on("close", () => {
    if (!res.writableEnded) {
      archive.abort();
    }
  });

  archive.pipe(res);

  const includeIfPresent = (relPath: string) => {
    const abs = path.join(agentDir, relPath);
    if (!existsSync(abs)) return;
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      archive.directory(abs, relPath);
    } else {
      archive.file(abs, { name: relPath });
    }
  };

  includeIfPresent("dist");
  includeIfPresent("src");
  includeIfPresent("assets");
  includeIfPresent("scripts");
  includeIfPresent("build");
  includeIfPresent("package.json");
  includeIfPresent("tsconfig.main.json");
  includeIfPresent("tsconfig.renderer.json");
  includeIfPresent("electron-builder.yml");
  includeIfPresent("README.md");

  archive.append(START_BAT, { name: "start.bat" });
  archive.append(INSTALL_TXT, { name: "INSTALL.txt" });

  archive.finalize().catch((err) => {
    logger.error({ err }, "archiver finalize failed");
  });
});

export default router;
