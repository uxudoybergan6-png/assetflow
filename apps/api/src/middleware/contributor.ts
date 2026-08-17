import { Request, Response, NextFunction } from "express";
import { adminRequire2fa } from "../lib/twofa.js";

export function requireContributorOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "ADMIN" && req.user.role !== "CONTRIBUTOR") {
    res.status(403).json({
      error: "Contributor or admin role required",
      code: "CONTRIBUTOR_REQUIRED",
    });
    return;
  }
  if (req.user.role === "ADMIN" && adminRequire2fa() && req.user.totpEnabled !== true) {
    res.status(403).json({
      error: "Two-factor authentication is required for admin accounts",
      code: "TWO_FA_SETUP_REQUIRED",
    });
    return;
  }
  next();
}
