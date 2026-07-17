import { Router, type IRouter } from "express";
import { and, eq, gte, sql, count } from "drizzle-orm";
import { db, detectionsTable, devicesTable } from "@workspace/db";
import { GetIngestStatusResponse } from "@workspace/api-zod";
import { ACTIVE_WINDOW_MS } from "../lib/flight-sessions";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Hardware is "connected" if a detection OR heartbeat was received within this window.
const CONNECTED_WINDOW_MS = 60 * 1000; // 60 s (bridge heartbeats every 30 s)

router.get("/status", requireAuth, async (_req, res): Promise<void> => {
  const now = Date.now();

  const [{ lastIngestAt } = { lastIngestAt: null }] = await db
    .select({ lastIngestAt: sql<Date | null>`max(${detectionsTable.timestamp})` })
    .from(detectionsTable);

  // Latest heartbeat from any non-revoked device
  const [{ latestHeartbeat } = { latestHeartbeat: null }] = await db
    .select({ latestHeartbeat: sql<Date | null>`max(${devicesTable.lastSeenAt})` })
    .from(devicesTable)
    .where(eq(devicesTable.revoked, false));

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

  const connected =
    (lastIngestAt != null && now - new Date(lastIngestAt).getTime() <= CONNECTED_WINDOW_MS) ||
    (latestHeartbeat != null && now - new Date(latestHeartbeat).getTime() <= CONNECTED_WINDOW_MS);

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
