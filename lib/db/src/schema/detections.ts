import { pgTable, serial, text, doublePrecision, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const detectionsTable = pgTable(
  "detections",
  {
    id: serial("id").primaryKey(),
    droneId: text("drone_id").notNull(),
    model: text("model"),
    signalType: text("signal_type"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    altitudeM: doublePrecision("altitude_m"),
    speedKmh: doublePrecision("speed_kmh"),
    headingDeg: doublePrecision("heading_deg"),
    rssiDbm: doublePrecision("rssi_dbm"),
    pilotLat: doublePrecision("pilot_lat"),
    pilotLng: doublePrecision("pilot_lng"),
    distanceFromHomeM: doublePrecision("distance_from_home_m").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("detections_drone_id_idx").on(table.droneId),
    index("detections_timestamp_idx").on(table.timestamp),
  ],
);

export const insertDetectionSchema = createInsertSchema(detectionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDetection = z.infer<typeof insertDetectionSchema>;
export type DetectionRow = typeof detectionsTable.$inferSelect;
