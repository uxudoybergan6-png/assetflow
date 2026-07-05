/**
 * Transaksion email — Resend HTTP API orqali (SDK'siz).
 * RESEND_API_KEY bo'lmasa: email yuborilmaydi, havola log'ga yoziladi (dev).
 */

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "FrameFlow <onboarding@resend.dev>";
}

/**
 * Productionда EMAIL_FROM tasdiqlangan domendan bo'lishi SHART (Bosqich 1 #9). Yo'q yoki
 * `resend.dev` sandbox bo'lsa — xatlar FAQAT Resend hisob egasiga yetadi, HAQIQIY foydalanuvchilarga
 * EMAS. Bu holatda loud log (yuborishni bloklamaymiz — dev/test buzilmasin).
 */
function isProdSandboxFrom(): boolean {
  const from = process.env.EMAIL_FROM?.trim();
  return process.env.NODE_ENV === "production" && (!from || /resend\.dev/i.test(from));
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
  if (isProdSandboxFrom()) {
    console.error(
      "[email] ⚠️ Productionда EMAIL_FROM tasdiqlanmagan (yo'q yoki resend.dev sandbox) — bu xat HAQIQIY " +
        `foydalanuvchiga (${input.to}) YETMAYDI. Resend'da domenni tasdiqlang (DKIM/SPF) va EMAIL_FROM='FrameFlow <no-reply@sizning-domen>' qo'ying.`
    );
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
    <div style="font-size:18px;font-weight:700;color:#C2F04A;margin-bottom:16px">FrameFlow</div>
    <h1 style="font-size:16px;margin:0 0 12px">${title}</h1>
    ${bodyHtml}
    <p style="font-size:11px;color:#888;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
  </div></body></html>`;
}
