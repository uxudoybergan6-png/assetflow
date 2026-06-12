/**
 * Upload jarayoni bosqichlari — xotirada saqlanadi, SSE orqali Studio'ga
 * real vaqtda uzatiladi. Kalit: templateId (cuid — taxmin qilib bo'lmaydi).
 * Bosqichlar: receive (0-80, klient XHR o'zi hisoblaydi) → sync (80-88, R2)
 * → db (88-90) → extract (90-97, sahnalar) → db (97-99) → done (100).
 */
export interface UploadProgressState {
  stage: "receive" | "sync" | "extract" | "db" | "done" | "error";
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
}

export function getUploadProgress(
  templateId: string
): UploadProgressState | null {
  return store.get(templateId) ?? null;
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
