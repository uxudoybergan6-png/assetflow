import { Request, Response, NextFunction } from "express";

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
      error: "Contributor yoki admin huquqi kerak",
      code: "CONTRIBUTOR_REQUIRED",
    });
    return;
  }
  next();
}
