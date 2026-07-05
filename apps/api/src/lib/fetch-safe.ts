/**
 * fetchSafe — SSRF himoyasi (Bosqich 1 #7). Server tomonda FOYDALANUVCHI bergan URL'larni
 * (referens rasm/video) yuklashda ishlatiladi. Siyosat QAT'IY:
 *   • data: URI → ruxsat (lokal, tarmoqqa chiqmaydi).
 *   • http(s) + FAQAT bizning storage hostimiz (GCS bucket / CDN / S3 endpoint) → ruxsat.
 *   • boshqa hamma host → RAD (tashqi URL bilan ichki metadata/loopback'ga so'rov yuborib bo'lmaydi).
 *   • host private/loopback/link-local IP'ga rezolv bo'lsa → RAD (DNS-rebinding himoyasi).
 *   • redirect: "error" — ochiq host bizning bucket'dan ichki manzilga redirect qila olmaydi.
 *
 * Rad etilsa SsrfError throw qiladi — chaqiruvchilar buni catch qilib referensni tashlab yuboradi
 * (tashqi 404'dek muloyim degradatsiya).
 */
import dns from "dns/promises";
import net from "net";

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

let allowed: Set<string> | null = null;

/** Bizning storage hostlari (env'dan bir marta). Boshqa host = tashqi = rad. */
function allowedHosts(): Set<string> {
  if (allowed) return allowed;
  const set = new Set<string>();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  if (bucket) {
    // GCS S3-moslik: path-style (storage.googleapis.com/<bucket>/..) + virtual-host.
    set.add("storage.googleapis.com");
    set.add(`${bucket}.storage.googleapis.com`);
    set.add(`${bucket}.s3.amazonaws.com`);
  }
  for (const v of [process.env.CDN_BASE_URL, process.env.S3_ENDPOINT]) {
    const raw = v?.trim();
    if (!raw) continue;
    try {
      set.add(new URL(raw).hostname);
    } catch {
      /* noto'g'ri URL — o'tkazib yuboramiz */
    }
  }
  allowed = set;
  return set;
}

/** Xususiy/loopback/link-local IP (IPv4 va IPv6, IPv4-mapped ham). */
export function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) return isPrivateIpv6(ip);
  return true; // noma'lum format → xavfsiz tomon (rad)
}

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split(".").map((x) => parseInt(x, 10));
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) → embedded IPv4 tekshiriladi.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  return false;
}

/** Host (yoki IP-literal) faqat public IP'ga rezolv bo'lishini tasdiqlaydi. */
async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new SsrfError(`Private IP blocked: ${hostname}`);
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SsrfError(`Host did not resolve: ${hostname}`);
  }
  if (!addrs.length) throw new SsrfError(`Host did not resolve: ${hostname}`);
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new SsrfError(`Host resolved to a private IP: ${hostname} -> ${a.address}`);
  }
}

/**
 * Xavfsiz fetch. Faqat data: URI + bizning storage hostimiz. Boshqa host / xususiy IP → SsrfError.
 * redirect: "error" (ochiq redirect bilan chetlab o'tib bo'lmaydi).
 */
export async function fetchSafe(url: string, init?: RequestInit): Promise<Response> {
  if (/^data:/i.test(url)) {
    return fetch(url, { ...init, redirect: "error" });
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new SsrfError("URL is invalid");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new SsrfError(`Protocol not allowed: ${u.protocol}`);
  }
  if (!allowedHosts().has(u.hostname)) {
    throw new SsrfError(`Host not allowed (SSRF): ${u.hostname}`);
  }
  await assertPublicHost(u.hostname);
  return fetch(url, { ...init, redirect: "error" });
}
