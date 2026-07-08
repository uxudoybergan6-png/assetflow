import { OAuth2Client } from "google-auth-library";
import { prisma, UserRole } from "@creative-tools/database";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export type GoogleAuthResult =
  | {
      ok: true;
      user: Awaited<ReturnType<typeof prisma.user.findUnique>> & { subscription: any };
      /** FAZA 3 (E) — bu chaqiruvda YANGI user yaratildi (welcome email uchun). */
      isNew?: boolean;
    }
  | { ok: false; status: number; error: string; code?: string };

/** Google ID token'ni tekshiradi, email bo'yicha find-or-create qiladi
 *  (Account modeliga provider="google" bog'laydi). Google email'ni
 *  allaqachon tasdiqlagani uchun emailVerified darhol o'rnatiladi. */
export async function verifyGoogleIdTokenAndUpsertUser(credential: string): Promise<GoogleAuthResult> {
  if (!googleClient) {
    return { ok: false, status: 503, error: "Google sign-in is not configured", code: "GOOGLE_NOT_CONFIGURED" };
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return { ok: false, status: 401, error: "Google token is invalid" };
  }
  if (!payload?.email || payload.email_verified !== true) {
    return { ok: false, status: 401, error: "Your Google email is not verified" };
  }

  const email = payload.email;
  const googleSub = payload.sub;
  let user = await prisma.user.findUnique({
    where: { email },
    include: { subscription: true },
  });

  let isNew = false;
  if (!user) {
    isNew = true;
    const created = await prisma.user.create({
      data: {
        email,
        name: payload.name,
        role: UserRole.USER,
        emailVerified: new Date(),
        accounts: {
          create: { type: "oauth", provider: "google", providerAccountId: googleSub },
        },
      },
    });
    await prisma.subscription.create({
      data: { userId: created.id, status: "INCOMPLETE" },
    });
    user = { ...created, subscription: null };
  } else {
    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: googleSub } },
      update: {},
      create: { userId: user.id, type: "oauth", provider: "google", providerAccountId: googleSub },
    });
    if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
        include: { subscription: true },
      });
    }
  }

  if (user.role === UserRole.CONTRIBUTOR && user.contributorBlockedAt) {
    return { ok: false, status: 403, error: "Contributor account is blocked", code: "CONTRIBUTOR_BLOCKED" };
  }

  return { ok: true, user: user as any, isNew };
}
