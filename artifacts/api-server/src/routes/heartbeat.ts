import { Router, type IRouter } from "express";
import { requireDeviceKey } from "../middlewares/requireDeviceKey";

const router: IRouter = Router();

/**
 * POST /heartbeat
 * Called by the hardware bridge every ~30 s to signal the sensor is alive.
 * requireDeviceKey already updates devices.lastSeenAt, so we just return 200.
 */
router.post("/heartbeat", requireDeviceKey, (_req, res): void => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

export default router;
