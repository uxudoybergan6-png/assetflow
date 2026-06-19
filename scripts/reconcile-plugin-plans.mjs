#!/usr/bin/env node
/**
 * Bir martalik reconciliation: barcha PluginProfile.plan'ni joriy Stripe obuna
 * holatiga moslashtiradi (ACTIVE/TRIALING → PRO, aks holda → FREE). Webhook
 * o'tkazib yuborilgan yoki #3 dan oldin "abadiy PRO" bo'lib qolgan hisoblar uchun.
 *
 * AVVAL build kerak (dist'dan import qilinadi):
 *   npm run build -w apps/api
 *   npm run reconcile:plans
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

// dotenv'dan KEYIN dinamik import — @creative-tools/database prisma DATABASE_URL'ni
// konstruksiyada o'qiydi, shu sabab env oldin yuklanishi shart.
const { reconcilePluginPlans } = await import(
  "../apps/api/dist/lib/plugin-profile.js"
);

const r = await reconcilePluginPlans();
console.log(
  `Reconcile tugadi: ${r.total} profil tekshirildi, ${r.changed} ta plan Stripe holatiga moslashtirildi.`
);
process.exit(0);
