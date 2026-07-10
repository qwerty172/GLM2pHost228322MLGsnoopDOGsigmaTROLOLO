// Best-effort wake-from-sleep scheduling for hosts with an active schedule.
//
// On Windows we register one Scheduled Task per weekly slot with the
// "wake the computer to run this task" flag set (WakeToRun), targeting the
// slot's start time. This reliably wakes a sleeping PC via the Windows Task
// Scheduler. Waking a fully powered-off (shutdown) machine is a BIOS/motherboard
// feature outside our control — out of scope, and this best-effort approach
// does not attempt it.
//
// On any other platform this is a no-op (logged once).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ScheduleSlot } from "../shared/messages";
import { log } from "./logger";

const execFileAsync = promisify(execFile);

const TASK_PREFIX = "CloudGamingWake_";

function dayToWinDay(day: number): string {
  // ScheduledTasks CLR DaysOfWeek names, matching ScheduleSlot's day
  // convention (0 = Sunday … 6 = Saturday).
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return names[day] ?? "Sunday";
}

// Schedules are stored/edited in UTC (see hosts.md / the "День (UTC)" label
// in the dashboard), but Windows' Task Scheduler weekly triggers fire in the
// machine's LOCAL time. Convert the UTC (day, startMin) pair to a local
// (day, HH:MM) pair before registering the trigger, otherwise the wake fires
// off by the host's UTC offset (and the day can roll over too).
//
// We anchor on a real calendar date near "now" (rather than doing pure
// modular arithmetic) so the local offset reflects the current DST state.
// Around a DST transition the local time-of-day can be off by an hour for
// roughly half the year either side of the switch — acceptable for this
// best-effort feature.
function utcSlotToLocal(day: number, startMin: number): { day: number; hhmm: string } {
  const now = new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayDelta = day - anchor.getUTCDay();
  anchor.setUTCDate(anchor.getUTCDate() + dayDelta);
  anchor.setUTCHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  return {
    day: anchor.getDay(),
    hhmm: `${String(anchor.getHours()).padStart(2, "0")}:${String(anchor.getMinutes()).padStart(2, "0")}`,
  };
}

async function removeExistingWakeTasks(): Promise<void> {
  // List then delete every task whose name starts with our prefix. Errors
  // are swallowed — a missing task or unavailable schtasks is not fatal.
  try {
    const { stdout } = await execFileAsync("schtasks", ["/Query", "/FO", "CSV", "/NH"]);
    const names = stdout
      .split("\n")
      .map((line) => line.split(",")[0]?.replace(/^"|"$/g, "").trim())
      .filter((n): n is string => !!n && n.includes(TASK_PREFIX));
    for (const name of names) {
      try {
        await execFileAsync("schtasks", ["/Delete", "/TN", name, "/F"]);
      } catch (err) {
        log("warn", `[wake-scheduler] Failed to delete stale task ${name}: ${String(err)}`);
      }
    }
  } catch (err) {
    log("warn", `[wake-scheduler] Failed to list existing wake tasks: ${String(err)}`);
  }
}

// Registers a Scheduled Task with WakeToRun via PowerShell (schtasks.exe
// alone has no CLI flag for the wake-computer setting). The task action is
// simply relaunching this agent binary — harmless if it's already running
// (single-instance lock makes the second launch a no-op that focuses/quits).
async function createWakeTask(slot: ScheduleSlot, index: number): Promise<void> {
  const local = utcSlotToLocal(slot.day, slot.startMin);
  const taskName = `${TASK_PREFIX}${index}_${dayToWinDay(slot.day)}_${slot.startMin}`;
  const time = local.hhmm;
  const dayName = dayToWinDay(local.day);
  const exePath = process.execPath;

  const script = [
    `$action = New-ScheduledTaskAction -Execute '${exePath.replace(/'/g, "''")}' -Argument '--hidden'`,
    `$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek ${dayName} -At ${time}`,
    `$settings = New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries`,
    `Register-ScheduledTask -TaskName '${taskName}' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null`,
  ].join("; ");

  try {
    await execFileAsync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);
  } catch (err) {
    log("warn", `[wake-scheduler] Failed to register wake task for slot ${index}: ${String(err)}`);
  }
}

// Reconciles the OS's set of wake-up tasks to match the given schedule.
// Call this whenever the schedule changes (on save) and once on startup.
export async function syncWakeTasks(
  scheduleMode: string,
  slots: ScheduleSlot[],
): Promise<void> {
  if (process.platform !== "win32") {
    log(
      "warn",
      "[wake-scheduler] Wake-on-schedule is only implemented for Windows on this platform — skipping (best-effort feature).",
    );
    return;
  }

  await removeExistingWakeTasks();

  if (scheduleMode !== "scheduled" || slots.length === 0) {
    log("info", "[wake-scheduler] No active schedule — wake tasks cleared.");
    return;
  }

  for (let i = 0; i < slots.length; i++) {
    await createWakeTask(slots[i]!, i);
  }
  log("info", `[wake-scheduler] Registered ${slots.length} wake task(s).`);
}
