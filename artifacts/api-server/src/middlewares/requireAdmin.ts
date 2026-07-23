import type { NextFunction, Request, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";

/** Requires the signed-in Clerk user to have publicMetadata.role === "admin". */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const client = clerkClient();
  const clerkUser = await client.users.getUser(userId);
  if ((clerkUser.publicMetadata as Record<string, unknown>)?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
