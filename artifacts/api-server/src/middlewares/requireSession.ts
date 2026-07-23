import type { NextFunction, Request, Response } from "express";

/** Requires any logged-in user (admin or operator). */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!(req.session as any)?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/** Requires admin role. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req.session as any)?.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
