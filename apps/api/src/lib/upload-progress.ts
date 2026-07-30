/**
 * Upload jarayoni bosqichlari — xotirada saqlanadi, SSE orqali Studio'ga
 * real vaqtda uzatiladi. Kalit: templateId (cuid — taxmin qilib bo'lmaydi).
 * Bosqichlar: receive (0-80, klient XHR o'zi hisoblaydi) → sync (80-88, R2)
 * → db (88-90) → extract (90-97, sahnalar) → db (97-99) → done (100).
 */
import { prisma } from "@creative-tools/database";

export interface UploadProgressState {
  stage: "receive" | "sync" | "download" | "scan" | "extract" | "db" | "done" | "error";
  pct: number;
  message: string;
  error?: string;
  done: boolean;
  updatedAt: number;
}

type Listener = (p: UploadProgressState) => void;

const store = new Map<string, UploadProgressState>();
const listeners = new Map<string, Set<Listener>>();

const TTL_MS = 10 * 60 * 1000;
const cleaner = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.updatedAt > TTL_MS) store.delete(k);
  }
  // #63: DB nusxasi ham TTL bilan tozalanadi (jadval o'smasin). Best-effort.
  void prisma.uploadProgress
    .deleteMany({ where: { updatedAt: { lt: new Date(now - TTL_MS) } } })
    .catch(() => {});
}, 60_000);
cleaner.unref?.();

export function setUploadProgress(
  templateId: string,
  patch: {
    stage: UploadProgressState["stage"];
    pct: number;
    message: string;
    error?: string;
    done?: boolean;
  }
) {
  const state: UploadProgressState = {
    stage: patch.stage,
    pct: Math.max(0, Math.min(100, Math.round(patch.pct))),
    message: patch.message,
    error: patch.error,
    done: patch.done ?? false,
    updatedAt: Date.now(),
  };
  store.set(templateId, state);
  const subs = listeners.get(templateId);
  if (subs) for (const fn of subs) fn(state);
  persistUploadProgress(templateId, state);
}

export function getUploadProgress(
  templateId: string
): UploadProgressState | null {
  return store.get(templateId) ?? null;
}

// ── #63 (T5.4) — instanslar aro progress ───────────────────────────────────
// Yuqoridagi store/listeners FAQAT shu protsess ichida. Cloud Run'da SSE ulanishi
// (GET .../upload-progress) yuklashni bajarayotgan instansdan BOSHQASIGA tushishi
// mumkin — o'shanda progress bar hech qachon qimirlamasdi. Yechim: holat DB'ga ham
// yoziladi (throttled), SSE esa lokal listener'ga qo'shimcha ravishda DB'ni pollaydi.
// Sticky routing tanlanmadi — Cloud Run session affinity best-effort va SSE'ni
// kafolatlamaydi; DB yozuvi esa restartga ham chidamli.

/** DB'ga yozish oralig'i — har piksel siljishi uchun UPDATE qilinmasin. */
const PERSIST_THROTTLE_MS = 1_500;
const lastPersistAt = new Map<string, number>();

function persistUploadProgress(templateId: string, state: UploadProgressState): void {
  const now = state.updatedAt;
  const prev = lastPersistAt.get(templateId) ?? 0;
  // Terminal holatlar (done/error) HAR DOIM yoziladi — klient oxirgi kadrni ko'rsin.
  const terminal = state.done || state.stage === "error" || state.stage === "done";
  if (!terminal && now - prev < PERSIST_THROTTLE_MS) return;
  lastPersistAt.set(templateId, now);
  if (terminal) lastPersistAt.delete(templateId);
  const data = {
    stage: state.stage,
    pct: state.pct,
    message: state.message,
    error: state.error ?? null,
    done: state.done,
  };
  // Fire-and-forget: progress KO'RSATKICH — DB blipi upload oqimini bloklamasin.
  void prisma.uploadProgress
    .upsert({ where: { templateId }, create: { templateId, ...data }, update: data })
    .catch(() => {});
}

/** Boshqa instans yozgan holat (SSE fallback). Xato = null (lokal holat ishlatiladi). */
export async function readPersistedUploadProgress(
  templateId: string
): Promise<UploadProgressState | null> {
  try {
    const row = await prisma.uploadProgress.findUnique({ where: { templateId } });
    if (!row) return null;
    return {
      stage: row.stage as UploadProgressState["stage"],
      pct: row.pct,
      message: row.message,
      error: row.error ?? undefined,
      done: row.done,
      updatedAt: row.updatedAt.getTime(),
    };
  } catch {
    return null;
  }
}

export function subscribeUploadProgress(
  templateId: string,
  fn: Listener
): () => void {
  let subs = listeners.get(templateId);
  if (!subs) {
    subs = new Set();
    listeners.set(templateId, subs);
  }
  subs.add(fn);
  return () => {
    subs!.delete(fn);
    if (!subs!.size) listeners.delete(templateId);
  };
}
