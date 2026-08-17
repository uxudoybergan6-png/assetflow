const DEFAULT_MEDIA_CAP = 512 * 1024 * 1024;

/** Provider javobini chunked transferda ham qat'iy cap bilan o'qiydi. */
export async function readCappedResponse(
  response: Response,
  maxBytes = Number(process.env.PROVIDER_RESULT_MAX_BYTES || DEFAULT_MEDIA_CAP)
): Promise<Buffer> {
  const cap = Number.isFinite(maxBytes) && maxBytes > 0 ? Math.floor(maxBytes) : DEFAULT_MEDIA_CAP;
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > cap) throw new Error(`Provider result exceeds ${cap} byte limit`);
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel("result too large");
        throw new Error(`Provider result exceeds ${cap} byte limit`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
