import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ESM static importlar env loaderdan oldin evaluate bo'lmasligi uchun app dinamik yuklanadi.
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(monorepoRoot, ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env") });
await import("./index.js");
