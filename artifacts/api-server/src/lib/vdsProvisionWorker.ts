import { db, hostsTable, quotaVdsTable, quotasTable, hostGamesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decryptSshKey } from "./sshKey";
import { logger } from "./logger";
import { randomBytes } from "node:crypto";

const PROVISION_INTERVAL_MS = 15_000;
const HEALTH_CHECK_INTERVAL_MS = 60_000;

let provisionTimer: ReturnType<typeof setInterval> | null = null;
let healthTimer: ReturnType<typeof setInterval> | null = null;

async function appendLog(id: string, line: string) {
  const ts = new Date().toISOString();
  await db
    .update(quotaVdsTable)
    .set({
      provisionLog: `${ts} ${line}\n`,
      updatedAt: new Date(),
    })
    .where(eq(quotaVdsTable.id, id));
}

async function setStatus(
  id: string,
  status: string,
  extra?: { hostId?: string },
) {
  await db
    .update(quotaVdsTable)
    .set({ status, updatedAt: new Date(), ...(extra ?? {}) })
    .where(eq(quotaVdsTable.id, id));
}

async function tryConnectSsh(
  host: string,
  port: number,
  user: string,
  privateKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const ssh2Mod = await import("ssh2").catch(() => null);
  if (!ssh2Mod) {
    return { ok: false, error: "ssh2 module not available" };
  }
  const { Client } = ssh2Mod;
  return new Promise((resolve) => {
    const conn = new Client();
    const timeout = setTimeout(() => {
      conn.destroy();
      resolve({ ok: false, error: "Connection timed out after 10s" });
    }, 10_000);

    conn.on("ready", () => {
      clearTimeout(timeout);
      conn.end();
      resolve({ ok: true });
    });

    conn.on("error", (err: Error) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });

    try {
      conn.connect({
        host,
        port,
        username: user,
        privateKey,
        readyTimeout: 10_000,
      });
    } catch (err) {
      clearTimeout(timeout);
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}

async function runRemoteCommand(
  host: string,
  port: number,
  user: string,
  privateKey: string,
  command: string,
): Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }> {
  const ssh2Mod = await import("ssh2").catch(() => null);
  if (!ssh2Mod) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      error: "ssh2 module not available",
    };
  }
  const { Client } = ssh2Mod;
  return new Promise((resolve) => {
    const conn = new Client();
    const timeout = setTimeout(() => {
      conn.destroy();
      resolve({
        ok: false,
        stdout: "",
        stderr: "",
        error: "Command timed out after 30s",
      });
    }, 30_000);

    let stdout = "";
    let stderr = "";

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          resolve({ ok: false, stdout, stderr, error: err.message });
          return;
        }
        stream.on("data", (d: Buffer) => {
          stdout += d.toString();
        });
        stream.stderr.on("data", (d: Buffer) => {
          stderr += d.toString();
        });
        stream.on("close", (code: number) => {
          clearTimeout(timeout);
          conn.end();
          resolve({ ok: code === 0, stdout, stderr });
        });
      });
    });

    conn.on("error", (err: Error) => {
      clearTimeout(timeout);
      resolve({ ok: false, stdout, stderr, error: err.message });
    });

    conn.connect({ host, port, username: user, privateKey, readyTimeout: 10_000 });
  });
}

async function provisionVds(vds: typeof quotaVdsTable.$inferSelect) {
  logger.info({ vdsId: vds.id, sshHost: vds.sshHost }, "Starting VDS provisioning");
  await setStatus(vds.id, "provisioning");

  let privateKey: string;
  try {
    privateKey = decryptSshKey(vds.sshKeyEncrypted);
  } catch (err) {
    await appendLog(vds.id, `[ERROR] Cannot decrypt SSH key: ${err instanceof Error ? err.message : err}`);
    await setStatus(vds.id, "error");
    return;
  }

  const conn = await tryConnectSsh(vds.sshHost, vds.sshPort, vds.sshUser, privateKey);
  if (!conn.ok) {
    await appendLog(vds.id, `[ERROR] SSH connection failed: ${conn.error}`);
    await setStatus(vds.id, "error");
    return;
  }
  await appendLog(vds.id, "[OK] SSH connection established");

  // Generate a unique host token for this VDS host
  const hostToken = `vds-${randomBytes(24).toString("hex")}`;

  // Fetch API URL from env or use a sensible default
  const apiBase = process.env["API_BASE_URL"] ?? "https://localhost/api";

  // Build the agent installation script
  const installScript = [
    "#!/bin/bash",
    "set -e",
    "# Install Node.js if missing",
    "which node || (curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs)",
    "# Create service directory",
    "sudo mkdir -p /opt/lzt-agent",
    `sudo tee /opt/lzt-agent/.env <<'ENVEOF'`,
    `HOST_TOKEN=${hostToken}`,
    `API_BASE=${apiBase}`,
    `HEADLESS=true`,
    `ENVEOF`,
    "# Create systemd service",
    `sudo tee /etc/systemd/system/lzt-agent.service <<'SVCEOF'`,
    "[Unit]",
    "Description=LZT Host Agent (VDS headless)",
    "After=network.target",
    "[Service]",
    "Type=simple",
    "WorkingDirectory=/opt/lzt-agent",
    "EnvironmentFile=/opt/lzt-agent/.env",
    "ExecStart=/usr/bin/node /opt/lzt-agent/agent.js",
    "Restart=always",
    "RestartSec=10",
    "[Install]",
    "WantedBy=multi-user.target",
    "SVCEOF",
    "sudo systemctl daemon-reload",
    "sudo systemctl enable lzt-agent",
    "echo PROVISION_DONE",
  ].join("\n");

  const setupRes = await runRemoteCommand(
    vds.sshHost,
    vds.sshPort,
    vds.sshUser,
    privateKey,
    `bash -s <<'SCRIPT'\n${installScript}\nSCRIPT`,
  );

  if (!setupRes.ok || !setupRes.stdout.includes("PROVISION_DONE")) {
    await appendLog(vds.id, `[ERROR] Provisioning script failed: ${setupRes.error ?? ""}\n${setupRes.stderr}`);
    await setStatus(vds.id, "error");
    return;
  }
  await appendLog(vds.id, "[OK] Agent installed and service enabled");

  // Start the agent service
  const startRes = await runRemoteCommand(
    vds.sshHost,
    vds.sshPort,
    vds.sshUser,
    privateKey,
    "sudo systemctl start lzt-agent && echo STARTED",
  );
  if (!startRes.ok || !startRes.stdout.includes("STARTED")) {
    await appendLog(vds.id, `[WARN] Service start may have failed: ${startRes.stderr}`);
  } else {
    await appendLog(vds.id, "[OK] Agent service started");
  }

  // Register the VDS host in the DB
  const displayName = `VDS ${vds.sshHost}`;
  const [newHost] = await db
    .insert(hostsTable)
    .values({
      hostToken,
      displayName,
      isVds: 1,
    })
    .returning({ id: hostsTable.id });

  if (!newHost) {
    await appendLog(vds.id, "[ERROR] Failed to register VDS host in DB");
    await setStatus(vds.id, "error");
    return;
  }

  await appendLog(vds.id, `[OK] Host registered: ${newHost.id}`);

  // Link quota game to VDS host library when quota specifies a game.
  const [quota] = await db
    .select({ gameId: quotasTable.gameId })
    .from(quotasTable)
    .where(eq(quotasTable.id, vds.quotaId));
  if (quota?.gameId) {
    await db
      .insert(hostGamesTable)
      .values({
        hostId: newHost.id,
        gameId: quota.gameId,
        pricePerMinuteLzt: 10,
        enabled: true,
      })
      .onConflictDoNothing({ target: [hostGamesTable.hostId, hostGamesTable.gameId] });
    await appendLog(vds.id, `[OK] Game ${quota.gameId} added to VDS host library`);
  }

  await db
    .update(quotaVdsTable)
    .set({
      status: "online",
      hostId: newHost.id,
      lastHealthAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quotaVdsTable.id, vds.id));

  logger.info({ vdsId: vds.id, hostId: newHost.id }, "VDS provisioned successfully");
}

// In-flight guards: skip a tick if the previous cycle is still running, so a
// slow SSH/DB endpoint can't stack overlapping cycles under degraded conditions.
let isProvisioning = false;
let isHealthCycling = false;

async function runProvisionCycle() {
  if (isProvisioning) return;
  isProvisioning = true;
  try {
    const pending = await db
      .select()
      .from(quotaVdsTable)
      .where(eq(quotaVdsTable.status, "pending"))
      .limit(5);

    for (const vds of pending) {
      provisionVds(vds).catch((err) => {
        logger.error({ err, vdsId: vds.id }, "VDS provision error");
      });
    }
  } catch (err) {
    logger.error({ err }, "VDS provision cycle error");
  } finally {
    isProvisioning = false;
  }
}

// Max concurrent SSH health checks — keeps the worker from opening 20 sockets
// at once while still finishing the cycle quickly.
const HEALTH_CHECK_CONCURRENCY = 5;

async function checkVdsHealth(
  vds: typeof quotaVdsTable.$inferSelect,
): Promise<void> {
  let privateKey: string;
  try {
    privateKey = decryptSshKey(vds.sshKeyEncrypted);
  } catch {
    return;
  }
  try {
    const res = await tryConnectSsh(
      vds.sshHost,
      vds.sshPort,
      vds.sshUser,
      privateKey,
    );
    const status = res.ok ? "online" : "offline";
    await db
      .update(quotaVdsTable)
      .set({
        status,
        lastHealthAt: res.ok ? new Date() : vds.lastHealthAt,
        updatedAt: new Date(),
      })
      .where(eq(quotaVdsTable.id, vds.id));
    if (res.ok && vds.hostId) {
      await db
        .update(hostsTable)
        .set({ lastSeenAt: new Date() })
        .where(eq(hostsTable.id, vds.hostId));
    }
  } catch (err) {
    logger.error({ err, vdsId: vds.id }, "VDS health check error");
  }
}

async function runHealthCycle() {
  if (isHealthCycling) return;
  isHealthCycling = true;
  try {
    const online = await db
      .select()
      .from(quotaVdsTable)
      .where(eq(quotaVdsTable.status, "online"))
      .limit(20);

    // Process in bounded-concurrency batches so a slow/hung SSH endpoint can't
    // block the whole cycle and we don't fan out unbounded sockets.
    for (let i = 0; i < online.length; i += HEALTH_CHECK_CONCURRENCY) {
      const batch = online.slice(i, i + HEALTH_CHECK_CONCURRENCY);
      await Promise.all(batch.map((vds) => checkVdsHealth(vds)));
    }
  } catch (err) {
    logger.error({ err }, "VDS health cycle error");
  } finally {
    isHealthCycling = false;
  }
}

export function startVdsProvisionWorker() {
  if (provisionTimer || healthTimer) return;
  provisionTimer = setInterval(runProvisionCycle, PROVISION_INTERVAL_MS);
  healthTimer = setInterval(runHealthCycle, HEALTH_CHECK_INTERVAL_MS);
  runProvisionCycle().catch(() => {});
  logger.info("VDS provision worker started");
}
