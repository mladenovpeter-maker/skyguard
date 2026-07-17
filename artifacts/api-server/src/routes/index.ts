import { Router, type IRouter } from "express";
import healthRouter from "./health";
import homeRouter from "./home";
import detectionsRouter from "./detections";
import statusRouter from "./status";
import devicesRouter from "./devices";
import heartbeatRouter from "./heartbeat";
import ambientRouter from "./ambient";
import rfAlertsRouter from "./rf-alerts";
import knownRfSourcesRouter from "./known-rf-sources";
import piStatusRouter from "./pi-status";
import bleStatusRouter from "./ble-status";

const router: IRouter = Router();

router.use(healthRouter);
router.use(homeRouter);
router.use(detectionsRouter);
router.use(statusRouter);
router.use(devicesRouter);
router.use(heartbeatRouter);
router.use(ambientRouter);
router.use(rfAlertsRouter);
router.use(knownRfSourcesRouter);
router.use(piStatusRouter);
router.use(bleStatusRouter);

export default router;
