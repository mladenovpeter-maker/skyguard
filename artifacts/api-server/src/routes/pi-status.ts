import { Router, type IRouter } from "express";
import { requireDeviceKey } from "../middlewares/requireDeviceKey";

const router: IRouter = Router();

interface PiStatus {
  cpuPercent:  number;
  cpuTempC:    number | null;
  memPercent:  number;
  diskPercent: number;
  uptimeS:     number;
  ts:          string;
  receivedAt:  string;
}

// In-memory — no DB needed, ephemeral hardware telemetry
let latestStatus: PiStatus | null = null;

/** POST /api/pi-status — bridge reports Pi stats every 30 s */
router.post("/pi-status", requireDeviceKey, (req, res): void => {
  const b = req.body ?? {};
  latestStatus = {
    cpuPercent:  Number(b.cpuPercent  ?? 0),
    cpuTempC:    b.cpuTempC != null ? Number(b.cpuTempC) : null,
    memPercent:  Number(b.memPercent  ?? 0),
    diskPercent: Number(b.diskPercent ?? 0),
    uptimeS:     Number(b.uptimeS     ?? 0),
    ts:          String(b.ts ?? new Date().toISOString()),
    receivedAt:  new Date().toISOString(),
  };
  res.status(204).end();
});

/** GET /api/pi-status — frontend polls this */
router.get("/pi-status", (req, res): void => {
  if (!latestStatus) {
    res.status(204).end();
    return;
  }
  res.json(latestStatus);
});

export default router;
