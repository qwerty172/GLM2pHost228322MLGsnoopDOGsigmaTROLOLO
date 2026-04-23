import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hostsTable = pgTable("hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostToken: text("host_token").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertHostSchema = createInsertSchema(hostsTable).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});
export type InsertHost = z.infer<typeof insertHostSchema>;
export type Host = typeof hostsTable.$inferSelect;
