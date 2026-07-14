import { Router, type IRouter } from "express";
import healthRouter from "./health";
import homeRouter from "./home";
import detectionsRouter from "./detections";
import statusRouter from "./status";

const router: IRouter = Router();

router.use(healthRouter);
router.use(homeRouter);
router.use(detectionsRouter);
router.use(statusRouter);

export default router;
