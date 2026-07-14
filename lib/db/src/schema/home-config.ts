import { pgTable, serial, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Singleton table -- always exactly one row, keyed by id = 1.
export const homeConfigTable = pgTable("home_config", {
  id: serial("id").primaryKey(),
  propertyName: text("property_name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  geofenceRadiusMeters: doublePrecision("geofence_radius_meters").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertHomeConfigSchema = createInsertSchema(homeConfigTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertHomeConfig = z.infer<typeof insertHomeConfigSchema>;
export type HomeConfigRow = typeof homeConfigTable.$inferSelect;
