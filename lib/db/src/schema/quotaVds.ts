import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { quotasTable } from "./quotas";

export const quotaVdsTable = pgTable(
  "quota_vds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotaId: uuid("quota_id")
      .notNull()
      .unique()
      .references(() => quotasTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("ssh"),
    sshHost: text("ssh_host").notNull(),
    sshPort: integer("ssh_port").notNull().default(22),
    sshUser: text("ssh_user").notNull(),
    sshKeyEncrypted: text("ssh_key_encrypted").notNull(),
    // "pending" | "provisioning" | "online" | "offline" | "error"
    status: text("status").notNull().default("pending"),
    provisionLog: text("provision_log").notNull().default(""),
    lastHealthAt: timestamp("last_health_at", { withTimezone: true }),
    hostId: uuid("host_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("quota_vds_quota_idx").on(t.quotaId)],
);

export type QuotaVds = typeof quotaVdsTable.$inferSelect;
