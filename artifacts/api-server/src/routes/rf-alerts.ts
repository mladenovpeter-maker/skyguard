import { requireSession } from "../middlewares/requireSession";
import { Router, type IRouter } from "express";
import { desc, gte } from "drizzle-orm";
import { db, rfAlertsTable } from "@workspace/db";

import { requireDeviceKey } from "../middlewares/requireDeviceKey";

const router: IRouter = Router();

const RECENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface RfAlertPayload {
  bandId: string;
  bandLabel: string;
  peakDbm: number;
  peakHz: number;
  threat: string;
  possibleDrones?: string;
  aboveBaselineDb?: number;
}

function parseRfAlert(body: unknown): RfAlertPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const d = body as Record<string, unknown>;
  if (typeof d["bandId"] !== "string") return null;
  if (typeof d["bandLabel"] !== "string") return null;
  if (typeof d["peakDbm"] !== "number") return null;
  if (typeof d["peakHz"] !== "number") return null;
  const threat = typeof d["threat"] === "string" ? d["threat"] : "info";
  return {
    bandId:          d["bandId"] as string,
    bandLabel:       d["bandLabel"] as string,
    peakDbm:         d["peakDbm"] as number,
    peakHz:          d["peakHz"] as number,
    threat,
    possibleDrones:  typeof d["possibleDrones"] === "string" ? d["possibleDrones"] : undefined,
    aboveBaselineDb: typeof d["aboveBaselineDb"] === "number" ? d["aboveBaselineDb"] : undefined,
  };
}

/** POST /rf-alerts — ingest a signal alert from the HackRF bridge */
router.post("/rf-alerts", requireDeviceKey, async (req, res): Promise<void> => {
  const payload = parseRfAlert(req.body);
  if (!payload) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const [row] = await db
    .insert(rfAlertsTable)
    .values({ ...payload, deviceId: req.deviceId ?? null })
    .returning();
  req.log.info({ bandId: payload.bandId, peakDbm: payload.peakDbm }, "RF alert ingested");
  res.status(201).json(row);
});

/** POST /rf-alerts/:id/label — operator labels an alert as drone/wifi/other for ML training */
router.post("/rf-alerts/:id/label", requireSession, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "");
  const label = req.body?.label;
  if (isNaN(id) || !["drone", "wifi", "other"].includes(label)) {
    res.status(400).json({ error: "label must be drone | wifi | other" });
    return;
  }
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .update(rfAlertsTable)
    .set({ label })
    .where(eq(rfAlertsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "not found" }); return; }
  res.json(row);
});

/** GET /rf-alerts/training-data — labeled examples for ML training */
router.get("/rf-alerts/training-data", requireSession, async (_req, res): Promise<void> => {
  const { isNotNull } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(rfAlertsTable)
    .where(isNotNull(rfAlertsTable.label))
    .orderBy(desc(rfAlertsTable.timestamp))
    .limit(5000);
  res.json(rows);
});

/** GET /rf-alerts/recent — last 10 minutes of alerts for the UI */
router.get("/rf-alerts/recent", requireSession, async (_req, res): Promise<void> => {
  const cutoff = new Date(Date.now() - RECENT_WINDOW_MS);
  const rows = await db
    .select()
    .from(rfAlertsTable)
    .where(gte(rfAlertsTable.timestamp, cutoff))
    .orderBy(desc(rfAlertsTable.timestamp))
    .limit(100);
  res.json(rows);
});

export default router;
