/**
 * FrameFlow CDN proksi — Cloudflare Worker (cdn.getframeflow.app)
 * =================================================================
 * P1 #3 (CDN, Plan B). GCP org-policy per-obyekt public'ni taqiqlaydi, shu bois
 * `assetflow-assets-2026` bucket'i YOPIQ qoladi. Ko'rsatish assetlari (thumb/
 * preview/scene/gen-derivativ) SHU Worker orqali beriladi:
 *
 *   GET /<key>
 *     ├─ isPublicReadKey(key) === false → 403, HECH QANDAY bayt (GCS'ga bormaydi)
 *     └─ true → GCS'dan S3-interop SigV4 imzosi bilan olib, uzoq keshlab beradi
 *
 * 🔴 Ruxsat ro'yxati — API'dagi AYNAN o'sha funksiya (yagona manba, takrorlanmaydi):
 *   apps/api/src/lib/public-keys.ts. pack/mogrt/gen-asl/gen-refs/gen-ref-src/
 *   avatars/incoming — HECH QACHON mos kelmaydi → doim 403.
 *
 * Maxfiylar (Worker secret): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (mavjud GCS
 * HMAC kalitlari). Vars (wrangler.toml): AWS_S3_BUCKET, S3_ENDPOINT, AWS_REGION.
 */
import { AwsClient } from "aws4fetch";
import { isPublicReadKey } from "../../../apps/api/src/lib/public-keys";

export interface Env {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_S3_BUCKET: string;
  S3_ENDPOINT?: string;
  AWS_REGION?: string;
}

// Kalitlar versiyalangan (?v=<epoch>) yoki o'zgarmas → uzoq immutable kesh.
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
// GCS javobidan mijozga o'tkaziladigan xavfsiz sarlavhalar (auth/gcs izlari EMAS).
const PASS_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "etag",
  "last-modified",
];

function plain(status: number, msg: string): Response {
  return new Response(msg, { status, headers: { "cache-control": "no-store" } });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    const url = new URL(request.url);
    // getPublicUrl() `${CDN_BASE_URL}/${key}` quradi — kalit = pathname (dekod qilingan).
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    // 🔴 YAGONA DARVOZA. Ruxsatsiz kalit → 403; GCS'ga umuman murojaat qilinmaydi,
    // shu bois pack/mogrt/gen-asl/refs mavjudligi ham oshkor bo'lmaydi.
    if (!isPublicReadKey(key)) return plain(403, "Forbidden");

    const range = request.headers.get("range");
    const cache = caches.default;
    // Kesh kaliti — to'liq URL (?v= cache-bust bilan). Faqat to'liq (Range'siz) GET keshlanadi.
    const cacheKey = new Request(url.toString(), { method: "GET" });
    if (request.method === "GET" && !range) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    const endpoint = (env.S3_ENDPOINT || "https://storage.googleapis.com").replace(/\/+$/, "");
    // Kalitni RAW berib, URL konstruktoriga kodlashni topshiramiz (aws4fetch shu
    // kodlangan pathname bilan imzolaydi — GCS canonical yo'li bilan mos keladi).
    const originUrl = `${endpoint}/${env.AWS_S3_BUCKET}/${key}`;

    const client = new AwsClient({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      service: "s3",
      region: env.AWS_REGION || "auto",
    });

    let originResp: Response;
    try {
      originResp = await client.fetch(originUrl, {
        method: request.method,
        headers: range ? { range } : undefined,
      });
    } catch {
      return plain(502, "Bad Gateway");
    }

    // GCS 403 (imzo/mavjud emas) yoki 404 → mijozga 404 (mavjudlikni oshkor qilmaymiz).
    if (originResp.status === 403 || originResp.status === 404) return plain(404, "Not Found");
    if (originResp.status !== 200 && originResp.status !== 206) return plain(502, "Bad Gateway");

    const headers = new Headers();
    for (const h of PASS_HEADERS) {
      const v = originResp.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set("cache-control", IMMUTABLE_CACHE);
    headers.set("accept-ranges", "bytes");
    // Cross-origin <img>/<video> (getframeflow.app) uchun.
    headers.set("access-control-allow-origin", "*");
    headers.set("cross-origin-resource-policy", "cross-origin");
    headers.set("x-content-type-options", "nosniff");

    const resp = new Response(request.method === "HEAD" ? null : originResp.body, {
      status: originResp.status,
      headers,
    });

    if (request.method === "GET" && !range && originResp.status === 200) {
      ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    }
    return resp;
  },
};
