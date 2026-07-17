import { Router, type IRouter } from "express";
import { desc, gte } from "drizzle-orm";
import { db, rfAlertsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireDeviceKey } from "../middlewares/requireDeviceKey";

const router: IRouter = Router();

const RECENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface RfAlertPayload {
  bandId: string;
  bandLabel: string;
  peakDbm: number;
  peakHz: number;
  threat: string;
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
    bandId:    d["bandId"] as string,
    bandLabel: d["bandLabel"] as string,
    peakDbm:   d["peakDbm"] as number,
    peakHz:    d["peakHz"] as number,
    threat,
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

/** GET /rf-alerts/recent — last 10 minutes of alerts for the UI */
router.get("/rf-alerts/recent", requireAuth, async (_req, res): Promise<void> => {
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
