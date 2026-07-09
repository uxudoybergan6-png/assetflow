import { Router } from "express";
import { getLandingConfig } from "../lib/landing-config.js";

// Ommaviy landing konfiguratsiyasi — auth YO'Q (landing login'siz ochiladi).
// Yozish yo'llari admin routerda (/api/admin/landing-config).
export const landingRouter = Router();

/** GET /api/landing/config — merged (default ⊕ saqlangan) landing CMS konfiguratsiyasi.
 *  Kichik javob + qisqa CDN/brauzer keshi: landing tez ochiladi, tahrir ~1 daqiqada tarqaladi. */
landingRouter.get("/config", async (_req, res) => {
  const { config, updatedAt } = await getLandingConfig();
  res.set("Cache-Control", "public, max-age=60");
  res.json({ config, updatedAt });
});
