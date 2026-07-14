import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A registered ingest device (e.g. a Raspberry Pi + HackRF bridge). Each
// device authenticates detection ingestion with its own API key so multiple
// physical units can be added/revoked independently.
export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  apiKeyHash: text("api_key_hash").notNull().unique(),
  apiKeyPrefix: text("api_key_prefix").notNull(),
  createdByUserId: text("created_by_user_id"),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
  revoked: true,
});
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type DeviceRow = typeof devicesTable.$inferSelect;
