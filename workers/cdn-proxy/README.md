# FrameFlow CDN proxy (`cdn.getframeflow.app`)

**P1 #3 (CDN, Plan B).** GCP org-policy blocks per-object public on `assetflow-assets-2026`,
so the bucket stays **fully closed**. This Cloudflare Worker serves the *display* assets
(thumb / preview / scene / gen derivatives) and refuses everything else.

- **Single source of truth for the allow-list:** it imports `isPublicReadKey()` from
  `../../../apps/api/src/lib/public-keys.ts` — the exact same function the API uses. Not copied.
- `GET /<key>` → if `isPublicReadKey(key)` is **false** (packs, mogrt, gen originals, `gen-refs`,
  `gen-ref-src`, avatars, incoming) → **403, no bytes, never touches GCS**.
- If **true** → fetches from GCS over the S3-interop XML API with **SigV4** (existing HMAC keys),
  streams it back with `Cache-Control: public, max-age=31536000, immutable`, edge-cached.
- Range requests (video seeking) are forwarded; partial responses are not edge-cached.

## Owner deploy steps (Cloudflare)

```bash
cd workers/cdn-proxy
npm install

# 1) Auth (browser login, or set CLOUDFLARE_API_TOKEN)
npx wrangler login

# 2) Secrets — the existing GCS HMAC keys (values are in cloudrun-env.yaml)
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY

# 3) Deploy (wrangler.toml already sets AWS_S3_BUCKET / S3_ENDPOINT / AWS_REGION as vars,
#    and the [[routes]] custom_domain block creates cdn.getframeflow.app if the
#    getframeflow.app zone is in this Cloudflare account)
npx wrangler deploy
```

If the custom domain isn't auto-created (zone elsewhere): Cloudflare dashboard →
Workers & Pages → `frameflow-cdn-proxy` → **Settings → Domains & Routes → Add → Custom domain**
→ `cdn.getframeflow.app`. Cloudflare provisions the DNS + cert automatically.

## 🔴 Proof test (mandatory — run after deploy)

```bash
CDN=https://cdn.getframeflow.app
GCS=https://storage.googleapis.com/assetflow-assets-2026
p(){ printf "%-6s %s\n" "$(curl -s -o /dev/null -w '%{http_code}' -I "$1")" "$2"; }

p $CDN/templates/<id>/thumb.jpg    "CDN thumb        → 200"
p $CDN/templates/<id>/preview.mp4  "CDN preview      → 200"
p $CDN/templates/<id>/pack.zip     "CDN pack.zip     → 403"
p $CDN/gen-refs/<key>              "CDN gen-refs     → 403"
p $GCS/templates/<id>/thumb.jpg    "GCS direct thumb → 403 (bucket closed)"
```
Expected: thumb/preview **200**, pack.zip/gen-refs **403**, direct-GCS **403**.
Also confirm a Pro user downloading a pack via the API still gets **302 → 5-minute signed URL**.
