import { Router } from "express";
import { z } from "zod";
import { prisma, UserRole } from "@creative-tools/database";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { writeAuditLog } from "../lib/audit-log.js";

export const messagesRouter = Router();

function mapThread(
  thread: {
    id: string;
    contributorId: string;
    templateId: string | null;
    subject: string;
    isBroadcast: boolean;
    lastMessageAt: Date;
    contributor: { id: string; email: string; name: string | null };
    messages: {
      id: string;
      body: string;
      senderId: string;
      readAt: Date | null;
      createdAt: Date;
      sender: { id: string; name: string | null; email: string; role: string };
    }[];
  },
  viewerId: string
) {
  const last = thread.messages[0];
  const unreadCount = thread.messages.filter(
    (m) => m.senderId !== viewerId && !m.readAt
  ).length;
  return {
    id: thread.id,
    contributorId: thread.contributorId,
    templateId: thread.templateId,
    subject: thread.subject,
    isBroadcast: thread.isBroadcast,
    lastMessageAt: thread.lastMessageAt,
    lastMessage: last?.body ?? "",
    unreadCount,
    contributor: {
      id: thread.contributor.id,
      email: thread.contributor.email,
      name: thread.contributor.name || thread.contributor.email,
    },
  };
}

messagesRouter.get("/threads", requireAuth, async (req, res) => {
  const user = req.user!;
  const where =
    user.role === "ADMIN"
      ? {}
      : { contributorId: user.userId };

  const threads = await prisma.studioMessageThread.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 80,
    include: {
      contributor: { select: { id: true, email: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  res.json({
    items: threads.map((t) => mapThread(t, user.userId)),
  });
});

messagesRouter.get("/threads/:threadId", requireAuth, async (req, res) => {
  const user = req.user!;
  const threadId = String(req.params.threadId);

  const thread = await prisma.studioMessageThread.findUnique({
    where: { id: threadId },
    include: {
      contributor: { select: { id: true, email: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  if (!thread) {
    res.status(404).json({ error: "Thread topilmadi" });
    return;
  }
  if (user.role !== "ADMIN" && thread.contributorId !== user.userId) {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }

  res.json({
    thread: mapThread(
      {
        ...thread,
        messages: [thread.messages[thread.messages.length - 1]].filter(Boolean),
      },
      user.userId
    ),
    messages: thread.messages.map((m) => ({
      id: m.id,
      body: m.body,
      senderId: m.senderId,
      readAt: m.readAt,
      createdAt: m.createdAt,
      sender: {
        id: m.sender.id,
        name: m.sender.name || m.sender.email,
        email: m.sender.email,
        role: m.sender.role,
        isMe: m.senderId === user.userId,
      },
    })),
  });
});

const createThreadSchema = z.object({
  contributorId: z.string().min(1),
  templateId: z.string().optional().nullable(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});

messagesRouter.post(
  "/threads",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = createThreadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { contributorId, templateId, subject, body } = parsed.data;

    const thread = await prisma.studioMessageThread.create({
      data: {
        contributorId,
        templateId: templateId ?? null,
        subject,
        isBroadcast: false,
        messages: {
          create: {
            senderId: req.user!.userId,
            body,
          },
        },
      },
      include: {
        contributor: { select: { id: true, email: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    res.status(201).json({ thread: mapThread(thread, req.user!.userId) });
  }
);

const replySchema = z.object({
  body: z.string().min(1).max(8000),
});

messagesRouter.post("/threads/:threadId/reply", requireAuth, async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const threadId = String(req.params.threadId);
  const thread = await prisma.studioMessageThread.findUnique({
    where: { id: threadId },
  });
  if (!thread) {
    res.status(404).json({ error: "Thread topilmadi" });
    return;
  }

  const user = req.user!;
  if (user.role !== "ADMIN" && thread.contributorId !== user.userId) {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }
  if (thread.isBroadcast && user.role !== "ADMIN") {
    res.status(403).json({ error: "Broadcast threadga javob berib bo'lmaydi" });
    return;
  }

  const message = await prisma.studioMessage.create({
    data: {
      threadId,
      senderId: user.userId,
      body: parsed.data.body,
    },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await prisma.studioMessageThread.update({
    where: { id: threadId },
    data: { lastMessageAt: new Date() },
  });

  res.status(201).json({
    message: {
      id: message.id,
      body: message.body,
      senderId: message.senderId,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        name: message.sender.name || message.sender.email,
        role: message.sender.role,
        isMe: true,
      },
    },
  });
});

const broadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});

messagesRouter.post(
  "/broadcast",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = broadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { subject, body } = parsed.data;

    const contributors = await prisma.user.findMany({
      where: {
        role: UserRole.CONTRIBUTOR,
        contributorBlockedAt: null,
      },
      select: { id: true },
    });

    let sent = 0;
    for (const c of contributors) {
      await prisma.studioMessageThread.create({
        data: {
          contributorId: c.id,
          subject: `📢 ${subject}`,
          isBroadcast: true,
          messages: {
            create: {
              senderId: req.user!.userId,
              body,
            },
          },
        },
      });
      sent++;
    }

    await writeAuditLog({
      actorId: req.user!.userId,
      action: "broadcast",
      targetType: "contributors",
      detail: `${subject} → ${sent} ta`,
    });

    res.json({ ok: true, sent });
  }
);

messagesRouter.post("/threads/:threadId/read", requireAuth, async (req, res) => {
  const threadId = String(req.params.threadId);
  const user = req.user!;

  const thread = await prisma.studioMessageThread.findUnique({
    where: { id: threadId },
  });
  if (!thread) {
    res.status(404).json({ error: "Thread topilmadi" });
    return;
  }
  if (user.role !== "ADMIN" && thread.contributorId !== user.userId) {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }

  await prisma.studioMessage.updateMany({
    where: {
      threadId,
      senderId: { not: user.userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  res.json({ ok: true });
});
