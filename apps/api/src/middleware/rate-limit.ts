import type { Request, Response, NextFunction } from "express";

/**
 * Fixed-window rate limiter.
 *
 * DEFAULT (REDIS_URL yo'q): dependency-siz, in-memory. Bitta API instansi uchun
 * (Cloud Run/PM2 single process) — bugungi xatti-harakat AYNAN shu.
 *
 * OPSIONAL (REDIS_URL bor): counter'lar Redis'da saqlanadi → bir nechta instans
 * bitta limitni baham ko'radi (gorizontal scaling). `ioredis` DINAMIK import
 * qilinadi — HARD dependency YO'Q. Paket o'rnatilmagan yoki Redis yiqilsa,
 * so'rov in-memory'ga QAYTADI (fail-open — limiter hech qachon API'ni bloklamaydi).
 *
 * Redis'ni yoqish: `REDIS_URL=redis://…` o'rnating + `npm i ioredis -w apps/api`.
 * REDIS_URL bo'lmasa — hech narsa o'zgarmaydi (aynan joriy in-memory yo'l).
 */

type Bucket = { count: number; resetAt: number };

interface RateLimitOptions {
  /** Oyna uzunligi (ms) */
  windowMs: number;
  /** Oyna ichidagi maksimal so'rovlar soni */
  max: number;
  /** Kalit prefiksi — turli limiter'lar bir-biriga aralashmasligi uchun */
  keyPrefix?: string;
  /** 429 javobidagi xabar */
  message?: string;
}

// ── Redis klient (ixtiyoriy, YAGONA umumiy) ────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisLike = any;
let redisPromise: Promise<RedisLike | null> | null = null;
let redisWarned = false;

function getRedis(): Promise<RedisLike | null> {
  if (!process.env.REDIS_URL) return Promise.resolve(null);
  if (!redisPromise) {
    redisPromise = (async () => {
      try {
        // O'zgaruvchi specifier → tsc statik ravishda 'ioredis'ni talab qilmaydi
        // (paket bo'lmasa build yiqilmaydi). Runtime'da yo'q bo'lsa — catch.
        const spec = "ioredis";
        const mod: RedisLike = await import(spec).catch(() => null);
        if (!mod) {
          console.warn(
            "[rate-limit] REDIS_URL berilgan, lekin 'ioredis' o'rnatilmagan — in-memory'da qolinadi."
          );
          return null;
        }
        const Redis = mod.default || mod;
        const client = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
          lazyConnect: false,
        });
        client.on("error", (err: Error) => {
          if (!redisWarned) {
            redisWarned = true;
            console.warn("[rate-limit] Redis xatosi — in-memory'ga fallback:", err?.message);
          }
        });
        return client;
      } catch (err) {
        console.warn("[rate-limit] Redis init muvaffaqiyatsiz — in-memory:", (err as Error)?.message);
        return null;
      }
    })();
  }
  return redisPromise;
}

export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max, keyPrefix = "rl", message } = opts;
  const hits = new Map<string, Bucket>();

  // Eskirgan bucketlarni tozalab turish (memory leak oldini olish)
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref?.();

  const tooMany = (res: Response, resetAt: number, now: number) => {
    const retryAfter = Math.ceil((resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: message || "Juda ko'p so'rov — birozdan keyin urinib ko'ring",
      retryAfter,
    });
  };

  // ── In-memory yadro — JORIY xatti-harakat 1:1 (Redis yo'q yoki yiqilganda) ──
  const inMemory = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let bucket = hits.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(key, bucket);
    }
    bucket.count++;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      tooMany(res, bucket.resetAt, now);
      return;
    }
    next();
  };

  // REDIS_URL YO'Q → to'g'ridan in-memory (async overhead yo'q, aynan hozirgidek).
  if (!process.env.REDIS_URL) return inMemory;

  // REDIS_URL BOR → Redis counter; har qanday xatoda in-memory'ga fallback.
  return async (req: Request, res: Response, next: NextFunction) => {
    const client = await getRedis().catch(() => null);
    if (!client) return inMemory(req, res, next);
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const key = `ratelimit:${keyPrefix}:${ip}`;
      const now = Date.now();

      const count: number = await client.incr(key);
      if (count === 1) await client.pexpire(key, windowMs);
      let ttl: number = await client.pttl(key);
      if (ttl < 0) {
        await client.pexpire(key, windowMs);
        ttl = windowMs;
      }
      const resetAt = now + ttl;

      const remaining = Math.max(0, max - count);
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

      if (count > max) {
        tooMany(res, resetAt, now);
        return;
      }
      next();
    } catch {
      // Redis blip — fail-open: joriy in-memory xatti-harakati.
      return inMemory(req, res, next);
    }
  };
}
