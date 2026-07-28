import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { hostsTable } from "./hosts";

export const dripSchedulesTable = pgTable(
  "drip_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    amountLztPerTick: integer("amount_lzt_per_tick").notNull(),
    interval: text("interval").notNull(),
    ticksTotal: integer("ticks_total").notNull(),
    ticksDone: integer("ticks_done").notNull().default(0),
    nextTickAt: timestamp("next_tick_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("active"),
    bucket: text("bucket").notNull().default("balance"),
    note: text("note").notNull().default(""),
    purchaseUsdtCents: integer("purchase_usdt_cents"),
    createdByAdminHostId: uuid("created_by_admin_host_id").references(
      () => hostsTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("drip_schedules_status_next_idx").on(t.status, t.nextTickAt),
    index("drip_schedules_owner_idx").on(t.ownerType, t.ownerId),
  ],
);

export type DripSchedule = typeof dripSchedulesTable.$inferSelect;
