import { Router, type IRouter } from "express";
import { resolveUser } from "../lib/users";

const router: IRouter = Router();

router.post("/auth/login", (req, res): void => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "username and password required" });
    return;
  }
  const user = resolveUser(username, password);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  (req.session as any).user = user;
  res.json({ username: user.username, role: user.role });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

router.get("/auth/me", (req, res): void => {
  const user = (req.session as any)?.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ username: user.username, role: user.role });
});

export default router;
