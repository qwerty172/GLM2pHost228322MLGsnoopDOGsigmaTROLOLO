import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// DEAD SCHEMA — intentionally not exported from schema/index.ts and unused by
// any API route. Kept (with messages.ts) so an existing `conversations` /
// `messages` table (if provisioned earlier) is not silently dropped by
// drizzle-kit push. Do not wire into the product until a real messaging API
// ships; until then prefer deleting both table files in a dedicated cleanup PR
// after confirming no production data depends on them.
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
