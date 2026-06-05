/**
 * Transaksion email — Resend HTTP API orqali (SDK'siz).
 * RESEND_API_KEY bo'lmasa: email yuborilmaydi, havola log'ga yoziladi (dev).
 */

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "AssetFlow <onboarding@resend.dev>";
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Email yuboradi. Sozlanmagan bo'lsa `false` qaytaradi (xato emas) —
 * chaqiruvchi kod oqimni davom ettiraversin.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(
      `[email] RESEND_API_KEY yo'q — yuborilmadi. To: ${input.to} · ${input.subject}`
    );
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend xato ${res.status}: ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] yuborishda xato:", e);
    return false;
  }
}

/** Oddiy markirovkalangan email shabloni */
export function renderEmailLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#0f0f0f;font-family:-apple-system,Segoe UI,sans-serif;color:#e8e8e8;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#1a1a1a;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:28px">
    <div style="font-size:18px;font-weight:700;color:#82c341;margin-bottom:16px">AssetFlow</div>
    <h1 style="font-size:16px;margin:0 0 12px">${title}</h1>
    ${bodyHtml}
    <p style="font-size:11px;color:#888;margin-top:24px">Agar bu so'rovni siz yubormagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.</p>
  </div></body></html>`;
}
