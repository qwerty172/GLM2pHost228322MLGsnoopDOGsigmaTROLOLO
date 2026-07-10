import { and, eq } from "drizzle-orm";
import { db, hostsTable } from "@workspace/db";
import { minutesSinceWindowStart } from "./schedule";
import { logger } from "./logger";

const WATCHDOG_INTERVAL_MS = 60_000;
const GRACE_PERIOD_MIN = 10;

let interval: NodeJS.Timeout | null = null;
let isChecking = false;

async function checkTick(): Promise<void> {
  if (isChecking) return;
  isChecking = true;
  try {
    await checkTickInner();
  } finally {
    isChecking = false;
  }
}

async function checkTickInner(): Promise<void> {
  const now = new Date();

  const scheduledHosts = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.scheduleMode, "scheduled"));

  for (const host of scheduledHosts) {
    const elapsed = minutesSinceWindowStart(host.scheduleJson ?? [], now);
    if (elapsed === null || elapsed < GRACE_PERIOD_MIN) continue;

    const cutoff = new Date(now.getTime() - GRACE_PERIOD_MIN * 60_000);
    if (host.lastSeenAt && host.lastSeenAt >= cutoff) continue;

    // Host's schedule window started >= 10 minutes ago and the agent hasn't
    // phoned home since then — deactivate the schedule so the catalog stops
    // advertising this host as "available by schedule".
    await db
      .update(hostsTable)
      .set({
        scheduleMode: "always",
        scheduleJson: [],
        scheduleAutoDisabledReason:
          "Расписание было автоматически отключено: агент не выходил на связь в течение 10 минут после начала окна. Настрой расписание заново, когда агент снова будет запущен.",
        scheduleAutoDisabledAt: now,
      })
      .where(and(eq(hostsTable.id, host.id)));

    logger.warn(
      { hostId: host.id, elapsedMin: elapsed },
      "Auto-deactivated host schedule — no heartbeat within grace period",
    );
  }
}

export function startScheduleWatchdog(): void {
  if (interval) return;
  logger.info(
    { intervalMs: WATCHDOG_INTERVAL_MS, gracePeriodMin: GRACE_PERIOD_MIN },
    "Starting schedule watchdog",
  );
  interval = setInterval(() => {
    void checkTick().catch((err) => {
      logger.error({ err }, "Schedule watchdog check failed");
    });
  }, WATCHDOG_INTERVAL_MS);
}

export function stopScheduleWatchdog(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
