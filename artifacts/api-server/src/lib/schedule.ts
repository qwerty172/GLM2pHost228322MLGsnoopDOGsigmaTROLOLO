import type { ScheduleSlot } from "@workspace/db";

// Returns true when the given Date falls inside any of the host's weekly
// availability slots. All slots are interpreted in UTC. Slots that wrap
// midnight (endMin <= startMin) are split into two ranges so the comparison
// is always a simple half-open interval [start, end).
export function isWithinSchedule(
  slots: ScheduleSlot[] | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!slots || slots.length === 0) return false;
  const day = now.getUTCDay(); // 0..6
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  const prevDay = (day + 6) % 7;
  for (const slot of slots) {
    if (slot.startMin === slot.endMin) continue;
    if (slot.endMin > slot.startMin) {
      if (slot.day === day && minute >= slot.startMin && minute < slot.endMin) {
        return true;
      }
    } else {
      // wraps midnight
      if (slot.day === day && minute >= slot.startMin) return true;
      if (slot.day === prevDay && minute < slot.endMin) return true;
    }
  }
  return false;
}

export function isHostAvailableNow(
  scheduleMode: string,
  slots: ScheduleSlot[] | null | undefined,
  now: Date = new Date(),
): boolean {
  if (scheduleMode === "always") return true;
  if (scheduleMode === "scheduled") return isWithinSchedule(slots, now);
  return false;
}
