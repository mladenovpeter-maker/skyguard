import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, homeConfigTable } from "@workspace/db";
import { GetHomeConfigResponse, UpdateHomeConfigBody, UpdateHomeConfigResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const DEFAULT_HOME = {
  propertyName: "Protected Property",
  lat: 42.6977,
  lng: 23.3219,
  geofenceRadiusMeters: 1000,
};

/** The home config is a singleton. Create the default row on first access. */
async function getOrCreateHomeConfig() {
  const [existing] = await db.select().from(homeConfigTable).limit(1);
  if (existing) {
    return existing;
  }
  const [created] = await db.insert(homeConfigTable).values(DEFAULT_HOME).returning();
  return created;
}

router.get("/home", requireAuth, async (_req, res): Promise<void> => {
  const home = await getOrCreateHomeConfig();
  res.json(GetHomeConfigResponse.parse(home));
});

router.put("/home", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateHomeConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const current = await getOrCreateHomeConfig();
  const [updated] = await db
    .update(homeConfigTable)
    .set(parsed.data)
    .where(eq(homeConfigTable.id, current.id))
    .returning();

  res.json(UpdateHomeConfigResponse.parse(updated ?? current));
});

export default router;
