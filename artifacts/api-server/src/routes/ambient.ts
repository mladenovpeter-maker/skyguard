import { Router, type IRouter } from "express";
import { gte } from "drizzle-orm";
import { db, ambientScansTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireDeviceKey } from "../middlewares/requireDeviceKey";
import { z } from "zod";

const router: IRouter = Router();

const AMBIENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const IngestAmbientItem = z.object({
  mac: z.string(),
  name: z.string().nullish(),
  signalType: z.enum(["BLE", "WIFI"]),
  rssiDbm: z.number().nullish(),
  vendor: z.string().nullish(),
  timestamp: z.string().optional(),
});

const IngestAmbientBatch = z.array(IngestAmbientItem);

/**
 * POST /ambient
 * Ingest a batch of non-drone RF devices (phones, APs, IoT…).
 */
router.post("/ambient", requireDeviceKey, async (req, res): Promise<void> => {
  const parsed = IngestAmbientBatch.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid ambient payload");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.length === 0) {
    res.json({ inserted: 0 });
    return;
  }

  const rows = parsed.data.map((d) => ({
    mac: d.mac,
    name: d.name ?? null,
    signalType: d.signalType,
    rssiDbm: d.rssiDbm ?? null,
    vendor: d.vendor ?? null,
    timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
  }));

  await db.insert(ambientScansTable).values(rows);
  req.log.info({ count: rows.length }, "Ambient batch ingested");
  res.json({ inserted: rows.length });
});

/**
 * GET /ambient/active
 * Returns the latest scan entry per MAC seen in the last 5 minutes.
 */
router.get("/ambient/active", requireAuth, async (_req, res): Promise<void> => {
  const cutoff = new Date(Date.now() - AMBIENT_WINDOW_MS);

  const recent = await db
    .select()
    .from(ambientScansTable)
    .where(gte(ambientScansTable.timestamp, cutoff))
    .orderBy(ambientScansTable.timestamp);

  // Deduplicate by MAC — keep latest entry
  const latestByMac = new Map<string, (typeof recent)[0]>();
  for (const row of recent) {
    latestByMac.set(row.mac, row);
  }

  const devices = Array.from(latestByMac.values()).map((row) => ({
    id: row.id,
    mac: row.mac,
    name: row.name,
    signalType: row.signalType,
    rssiDbm: row.rssiDbm,
    vendor: row.vendor,
    timestamp: row.timestamp.toISOString(),
  }));

  res.json(devices);
});

export default router;
