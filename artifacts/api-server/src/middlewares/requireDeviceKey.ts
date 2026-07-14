import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, devicesTable } from "@workspace/db";
import { hashDeviceKey } from "../lib/deviceKeys";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceId?: number;
    }
  }
}

/** Requires a valid, non-revoked device API key (sent by the field hardware bridge). */
export async function requireDeviceKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("Authorization");
    const key = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;

    if (!key) {
      res.status(401).json({ error: "Missing device API key" });
      return;
    }

    const [device] = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.apiKeyHash, hashDeviceKey(key)));

    if (!device || device.revoked) {
      res.status(401).json({ error: "Invalid or revoked device API key" });
      return;
    }

    await db
      .update(devicesTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(devicesTable.id, device.id));

    req.deviceId = device.id;
    next();
  } catch (err) {
    next(err);
  }
}
