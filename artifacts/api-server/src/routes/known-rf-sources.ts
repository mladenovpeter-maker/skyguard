import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, knownRfSourcesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireSession";
import { requireDeviceKey } from "../middlewares/requireDeviceKey";

const router: IRouter = Router();

/** GET /known-rf-sources — list all (auth or device key) */
router.get("/known-rf-sources", async (req, res): Promise<void> => {
  const rows = await db.select().from(knownRfSourcesTable).orderBy(knownRfSourcesTable.bandId);
  res.json(rows);
});

/** POST /known-rf-sources — add or update a known source */
router.post("/known-rf-sources", requireAdmin, async (req, res): Promise<void> => {
  const { bandId, label, suppress = true } = req.body ?? {};
  if (typeof bandId !== "string" || typeof label !== "string") {
    res.status(400).json({ error: "bandId and label required" });
    return;
  }
  const [row] = await db
    .insert(knownRfSourcesTable)
    .values({ bandId, label, suppress: Boolean(suppress) })
    .onConflictDoUpdate({
      target: knownRfSourcesTable.bandId,
      set: { label, suppress: Boolean(suppress) },
    })
    .returning();
  res.status(201).json(row);
});

/** DELETE /known-rf-sources/:bandId — remove */
router.delete("/known-rf-sources/:bandId", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(knownRfSourcesTable).where(eq(knownRfSourcesTable.bandId, req.params.bandId));
  res.status(204).end();
});

export default router;
