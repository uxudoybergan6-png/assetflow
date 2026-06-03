import type { Request, Response, NextFunction } from "express";

/**
 * Dependency-siz, in-memory fixed-window rate limiter.
 * Bitta API instansi uchun mo'ljallangan (PM2 single process). Ko'p instansi
 * yoki gorizontal scaling kerak bo'lsa — Redis asosli limiter kerak bo'ladi.
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

  return (req: Request, res: Response, next: NextFunction) => {
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
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: message || "Juda ko'p so'rov — birozdan keyin urinib ko'ring",
        retryAfter,
      });
      return;
    }

    next();
  };
}
