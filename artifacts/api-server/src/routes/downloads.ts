import path from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
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

REM ── Self-relaunch guard ──────────────────────────────────────────────────────
REM If launched by double-click or from inside a ZIP the window closes as soon
REM as the script ends. We relaunch ourselves inside "cmd /k" so the window
REM always stays open and the user can read any error messages.
if /i "%~1"=="--interactive" goto :main
start "Cloud Gaming Host Agent" cmd /k ""%~f0" --interactive"
exit /b 0

:main
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo  Cloud Gaming Host Agent - starting up
echo  Folder: %CD%
echo ============================================================
echo.

REM ── 1. Check Node.js version ────────────────────────────────────────────────
echo [1/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js was not found. Install Node.js 20+ from https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f %%V in ('node --version 2^>nul') do set CURRENT_NODE_VER=%%V
echo       Node.js: %CURRENT_NODE_VER%

REM Extract major version number (strip leading 'v' then take before first dot)
set TEMP_VER=%CURRENT_NODE_VER:~1%
for /f "tokens=1 delims=." %%M in ("%TEMP_VER%") do set NODE_MAJOR=%%M

if %NODE_MAJOR% LSS 20 (
  echo ERROR: Node.js 20 or newer is required. You have %CURRENT_NODE_VER%.
  echo        Download the latest LTS from https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo       Version OK ^(%NODE_MAJOR% ^>= 20^).

REM ── 2. Install / re-install dependencies ────────────────────────────────────
echo.
echo [2/3] Checking dependencies...

set STAMP_FILE=.node_version
set SAVED_NODE_VER=
if exist "%STAMP_FILE%" (
  set /p SAVED_NODE_VER=<"%STAMP_FILE%"
)

if not "%CURRENT_NODE_VER%"=="%SAVED_NODE_VER%" (
  echo       Node.js version changed ^(was: %SAVED_NODE_VER%, now: %CURRENT_NODE_VER%^).
  echo       Re-installing dependencies to rebuild native addons ^(~2-5 min^)...
  if exist node_modules rmdir /s /q node_modules
  call npm install --include=dev --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. See messages above.
    echo        Make sure Node.js 20+ is installed correctly.
    pause
    exit /b 1
  )
  echo %CURRENT_NODE_VER%>"%STAMP_FILE%"
  echo       Dependencies installed.
) else if not exist node_modules (
  echo       First run - installing dependencies ^(~2-5 min^)...
  call npm install --include=dev --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. See messages above.
    echo        Make sure Node.js 20+ is installed correctly.
    pause
    exit /b 1
  )
  echo %CURRENT_NODE_VER%>"%STAMP_FILE%"
  echo       Dependencies installed.
) else (
  echo       node_modules already present, skipping install.
)

REM ── 3. Launch Electron ───────────────────────────────────────────────────────
echo.
echo [3/3] Launching Electron...

if exist ".\\node_modules\\.bin\\electron.cmd" (
  echo       Binary found: node_modules\\.bin\\electron.cmd
  call ".\\node_modules\\.bin\\electron.cmd" .
) else (
  echo       Local electron not found - falling back to npx...
  call npx --yes electron .
)

set EXIT_CODE=%ERRORLEVEL%
echo.
if %EXIT_CODE% NEQ 0 (
  echo ============================================================
  echo  AGENT EXITED WITH AN ERROR ^(code: %EXIT_CODE%^)
  echo  Read the messages above for details.
  echo  Log file: logs\agent.log  ^(in this folder^)
  echo ============================================================
) else (
  echo ============================================================
  echo  Agent stopped ^(code: 0^).
  echo  If no window ever appeared - the agent may already be
  echo  running. Check the system tray ^(bottom-right corner,
  echo  click ^ to see hidden icons^).
  echo  Log file: logs\agent.log  ^(in this folder^)
  echo ============================================================
)
echo.
pause
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

   What start.bat does automatically:
   a. Checks that Node.js 20+ is installed — exits with a clear message
      if not.
   b. On first run, runs "npm install" to fetch Electron and all helper
      packages (2-3 minutes, happens once per machine).
   c. If you later upgrade Node.js, it detects the version change and
      re-installs automatically so native addons (e.g. koffi) stay
      compatible.
   d. Launches Electron directly from the local node_modules — no npx
      confirmation prompts, no internet required after the first install.

3. The agent window opens. Sign in with the host token from your
   Host Dashboard, choose a game window to capture, and you are live.

Optional: build a real installer (.exe)
---------------------------------------
On a Windows machine with Node.js installed, you can produce a signed
NSIS installer:

    npm install
    npm run package:win

The installer ends up in the "release" folder.

Если не работает — чеклист
--------------------------
1. Node.js 20+ установлен? Проверь в командной строке:
       node --version
   Если версия ниже 20 (или команда не найдена) — установи с
   https://nodejs.org и перезапусти start.bat.

2. Агент запущен и не закрыт? После start.bat должно открыться окно
   агента (и иконка в трее). Если окно сразу закрывается — запусти
   start.bat повторно и прочитай сообщение об ошибке.

3. Игры с античитом (EAC, BattlEye и т.п.)? Запускай start.bat
   ОТ ИМЕНИ АДМИНИСТРАТОРА (правый клик → "Запуск от имени
   администратора"), иначе управление мышью/клавиатурой может
   не работать.

4. Файрвол или антивирус? Агент использует локальный порт 18080
   (для связи с браузером) и исходящие соединения к платформе.
   Разреши их в настройках файрвола/антивируса, если появляется
   запрос.

5. Токен хоста вставлен? В окне агента должно быть "Вход выполнен".
   Токен берётся из Host Dashboard на сайте.

6. Лог ошибок агента: logs\\agent.log  (в той же папке, куда распакован ZIP)

Need help?
----------
Open the Host Dashboard on the web platform — there is a status panel
that shows whether the agent has connected (карточка "Агент" со
статусом и временем последнего сигнала).
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

  const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0]?.trim() ?? "https";
  const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0]?.trim();
  const apiBaseUrl = host ? `${proto}://${host}` : "";
  const bindCode =
    typeof req.query.bind === "string" && req.query.bind.trim()
      ? req.query.bind.trim()
      : null;

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
  // The host-agent's package.json uses pnpm's `catalog:` protocol for shared
  // versions. Standalone `npm install` (run by the portable bundle's start.bat)
  // does not understand `catalog:`, so we resolve those entries to the concrete
  // version from pnpm-workspace.yaml before adding the file to the zip.
  appendNormalizedPackageJson(archive, agentDir);
  includeIfPresent("tsconfig.main.json");
  includeIfPresent("tsconfig.renderer.json");
  includeIfPresent("electron-builder.yml");
  includeIfPresent("README.md");

  archive.append(START_BAT, { name: "start.bat" });
  archive.append(INSTALL_TXT, { name: "INSTALL.txt" });

  if (apiBaseUrl) {
    const bundleDefaults: Record<string, string> = { apiBaseUrl };
    if (bindCode) bundleDefaults.suggestedBindCode = bindCode;
    archive.append(JSON.stringify(bundleDefaults, null, 2), {
      name: "bundle-defaults.json",
    });
  }

  archive.finalize().catch((err) => {
    logger.error({ err }, "archiver finalize failed");
  });
});

// Redirect to latest GitHub Release installer when configured, else 503.
router.get("/downloads/host-agent.exe", (_req, res): void => {
  const releaseUrl = process.env.HOST_AGENT_EXE_URL;
  if (releaseUrl) {
    res.redirect(302, releaseUrl);
    return;
  }
  res.status(503).json({
    error: "Installer not available. Use /api/downloads/host-agent.zip or build via CI.",
  });
});

function loadPnpmCatalog(agentDir: string): Record<string, string> {
  // Walk up to the workspace root looking for pnpm-workspace.yaml. We only
  // need the `catalog:` mapping, so a tiny regex parser is enough — adding a
  // YAML dep just for this would be overkill.
  let dir = agentDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "pnpm-workspace.yaml");
    if (existsSync(candidate)) {
      const text = readFileSync(candidate, "utf8");
      const out: Record<string, string> = {};
      const m = text.match(/^catalog:\s*\n((?:[ \t]+.*\n?)+)/m);
      if (m && m[1]) {
        for (const line of m[1].split("\n")) {
          const e = line.match(/^\s+['"]?([^'":\s]+)['"]?:\s*(.+?)\s*$/);
          if (e && e[1] && e[2]) out[e[1]] = e[2].replace(/^['"]|['"]$/g, "");
        }
      }
      return out;
    }
    dir = path.dirname(dir);
  }
  return {};
}

function appendNormalizedPackageJson(
  archive: archiver.Archiver,
  agentDir: string,
): void {
  const pkgPath = path.join(agentDir, "package.json");
  if (!existsSync(pkgPath)) return;
  const raw = readFileSync(pkgPath, "utf8");
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw);
  } catch (err) {
    logger.warn({ err }, "host-agent package.json is not valid JSON");
    archive.file(pkgPath, { name: "package.json" });
    return;
  }
  const catalog = loadPnpmCatalog(agentDir);
  const normalize = (group: "dependencies" | "devDependencies"): void => {
    const deps = pkg[group] as Record<string, string> | undefined;
    if (!deps) return;
    for (const [name, version] of Object.entries(deps)) {
      if (version.startsWith("catalog:")) {
        const resolved = catalog[name];
        if (resolved) {
          deps[name] = resolved;
        } else {
          logger.warn(
            { name },
            "No catalog entry for dependency; falling back to '*'",
          );
          deps[name] = "*";
        }
      } else if (version.startsWith("workspace:")) {
        // Standalone npm install can't resolve workspace refs either; drop
        // them — the bundle is self-contained and shouldn't depend on
        // sibling workspace packages.
        delete deps[name];
      }
    }
  };
  normalize("dependencies");
  normalize("devDependencies");
  archive.append(JSON.stringify(pkg, null, 2) + "\n", { name: "package.json" });
}

export default router;
