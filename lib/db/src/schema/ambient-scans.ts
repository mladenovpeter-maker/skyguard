import { pgTable, serial, text, doublePrecision, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Non-drone RF devices seen in the area — phones, watches, IoT, APs.
 * Captured by the bridge from the raw BLE/WiFi scanner output.
 */
export const ambientScansTable = pgTable(
  "ambient_scans",
  {
    id: serial("id").primaryKey(),
    mac: text("mac").notNull(),
    name: text("name"),
    signalType: text("signal_type").notNull(), // "BLE" | "WIFI"
    rssiDbm: doublePrecision("rssi_dbm"),
    vendor: text("vendor"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ambient_scans_timestamp_idx").on(table.timestamp),
    index("ambient_scans_mac_idx").on(table.mac),
  ],
);

export const insertAmbientScanSchema = createInsertSchema(ambientScansTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAmbientScan = z.infer<typeof insertAmbientScanSchema>;
export type AmbientScanRow = typeof ambientScansTable.$inferSelect;
