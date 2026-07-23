import { requireSession } from "../middlewares/requireSession";
import { Router, type IRouter } from "express";
import { gte } from "drizzle-orm";
import { db, ambientScansTable } from "@workspace/db";

import { requireDeviceKey } from "../middlewares/requireDeviceKey";
const router: IRouter = Router();

const AMBIENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

interface AmbientItem {
  mac: string;
  name?: string | null;
  signalType: "BLE" | "WIFI";
  rssiDbm?: number | null;
  vendor?: string | null;
  timestamp?: string;
}

function parseAmbientBatch(body: unknown): AmbientItem[] | null {
  if (!Array.isArray(body)) return null;
  const result: AmbientItem[] = [];
  for (const item of body) {
    if (typeof item !== "object" || item === null) return null;
    const d = item as Record<string, unknown>;
    if (typeof d["mac"] !== "string") return null;
    if (d["signalType"] !== "BLE" && d["signalType"] !== "WIFI") return null;
    result.push({
      mac: d["mac"] as string,
      name: typeof d["name"] === "string" ? d["name"] : null,
      signalType: d["signalType"] as "BLE" | "WIFI",
      rssiDbm: typeof d["rssiDbm"] === "number" ? d["rssiDbm"] : null,
      vendor: typeof d["vendor"] === "string" ? d["vendor"] : null,
      timestamp: typeof d["timestamp"] === "string" ? d["timestamp"] : undefined,
    });
  }
  return result;
}

/**
 * POST /ambient
 * Ingest a batch of non-drone RF devices (phones, APs, IoT…).
 */
router.post("/ambient", requireDeviceKey, async (req, res): Promise<void> => {
  const parsed = parseAmbientBatch(req.body);
  if (parsed === null) {
    req.log.warn("Invalid ambient payload");
    res.status(400).json({ error: "Invalid payload: expected array of {mac, signalType, ...}" });
    return;
  }

  if (parsed.length === 0) {
    res.json({ inserted: 0 });
    return;
  }

  const rows = parsed.map((d) => ({
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
router.get("/ambient/active", requireSession, async (_req, res): Promise<void> => {
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
