import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * User-defined "own" RF sources — bands that belong to the operator's own
 * equipment (home WiFi, own RC controller, etc.) and should be suppressed
 * from drone threat alerts.
 */
export const knownRfSourcesTable = pgTable("known_rf_sources", {
  id:        serial("id").primaryKey(),
  bandId:    text("band_id").notNull().unique(),  // e.g. "dji_2400"
  label:     text("label").notNull(),              // e.g. "Домашен WiFi рутер"
  suppress:  boolean("suppress").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KnownRfSourceRow = typeof knownRfSourcesTable.$inferSelect;
