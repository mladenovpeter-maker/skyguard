import { Router, type IRouter } from "express";
import { requireDeviceKey } from "../middlewares/requireDeviceKey";

const router: IRouter = Router();

interface BleStatus {
  totalScans: number;
  dronesDetected: number;
  adapter: string;
  ts: string;
  receivedAt: string;
}

let latestStatus: BleStatus | null = null;

/** POST /api/ble-status — droneID scanner heartbeat every 30 s */
router.post("/ble-status", requireDeviceKey, (req, res): void => {
  const b = req.body ?? {};
  latestStatus = {
    totalScans:     Number(b.totalScans     ?? 0),
    dronesDetected: Number(b.dronesDetected ?? 0),
    adapter:        String(b.adapter        ?? "hci1"),
    ts:             String(b.ts             ?? new Date().toISOString()),
    receivedAt:     new Date().toISOString(),
  };
  res.status(204).end();
});

/** GET /api/ble-status — frontend polls */
router.get("/ble-status", (req, res): void => {
  if (!latestStatus) { res.status(204).end(); return; }
  res.json(latestStatus);
});

export default router;
