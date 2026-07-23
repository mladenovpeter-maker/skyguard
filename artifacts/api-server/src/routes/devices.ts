import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, devicesTable } from "@workspace/db";
import { CreateDeviceBody, CreateDeviceResponse, ListDevicesResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireSession";
import { generateDeviceKey, hashDeviceKey, keyDisplayPrefix } from "../lib/deviceKeys";

const router: IRouter = Router();

function toDeviceJson(device: typeof devicesTable.$inferSelect) {
  return {
    id: device.id,
    name: device.name,
    apiKeyPrefix: device.apiKeyPrefix,
    revoked: device.revoked,
    createdAt: device.createdAt ? device.createdAt.toISOString() : new Date(0).toISOString(),
    lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
  };
}

router.get("/devices", requireAdmin, async (_req, res): Promise<void> => {
  const devices = await db.select().from(devicesTable).orderBy(devicesTable.createdAt);
  res.json(ListDevicesResponse.parse(devices.map(toDeviceJson)));
});

router.post("/devices", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = generateDeviceKey();
  const sessionUser = (req.session as any)?.user;

  const [device] = await db
    .insert(devicesTable)
    .values({
      name: parsed.data.name,
      apiKeyHash: hashDeviceKey(apiKey),
      apiKeyPrefix: keyDisplayPrefix(apiKey),
      createdByUserId: sessionUser?.username ?? null,
    })
    .returning();

  req.log.info({ deviceId: device!.id }, "Device registered");

  res.status(201).json(
    CreateDeviceResponse.parse({
      ...toDeviceJson(device!),
      apiKey,
    }),
  );
});

router.delete("/devices/:deviceId", requireAdmin, async (req, res): Promise<void> => {
  const deviceId = Number(req.params.deviceId);
  if (!Number.isInteger(deviceId)) {
    res.status(400).json({ error: "Invalid device id" });
    return;
  }

  await db.delete(devicesTable).where(eq(devicesTable.id, deviceId));
  res.status(204).send();
});

export default router;
