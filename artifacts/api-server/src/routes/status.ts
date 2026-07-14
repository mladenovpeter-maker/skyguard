import { Router, type IRouter } from "express";
import { and, gte, sql, count } from "drizzle-orm";
import { db, detectionsTable } from "@workspace/db";
import { GetIngestStatusResponse } from "@workspace/api-zod";
import { ACTIVE_WINDOW_MS } from "../lib/flight-sessions";

const router: IRouter = Router();

const CONNECTED_WINDOW_MS = 15 * 1000;

router.get("/status", async (_req, res): Promise<void> => {
  const now = Date.now();

  const [{ lastIngestAt } = { lastIngestAt: null }] = await db
    .select({ lastIngestAt: sql<Date | null>`max(${detectionsTable.timestamp})` })
    .from(detectionsTable);

  const [{ activeDroneCount } = { activeDroneCount: 0 }] = await db
    .select({ activeDroneCount: sql<number>`count(distinct ${detectionsTable.droneId})` })
    .from(detectionsTable)
    .where(gte(detectionsTable.timestamp, new Date(now - ACTIVE_WINDOW_MS)));

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ detectionsToday } = { detectionsToday: 0 }] = await db
    .select({ detectionsToday: count() })
    .from(detectionsTable)
    .where(and(gte(detectionsTable.timestamp, startOfDay)));

  const connected = lastIngestAt != null && now - new Date(lastIngestAt).getTime() <= CONNECTED_WINDOW_MS;

  res.json(
    GetIngestStatusResponse.parse({
      connected,
      lastIngestAt: lastIngestAt ? new Date(lastIngestAt).toISOString() : null,
      activeDroneCount: Number(activeDroneCount),
      detectionsToday: Number(detectionsToday),
    }),
  );
});

export default router;
