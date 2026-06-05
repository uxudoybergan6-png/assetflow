import { prisma } from "@creative-tools/database";

/** Shablon bo'yicha thread — reject/approve xabari */
export async function postTemplateModerationMessage(opts: {
  contributorId: string;
  templateId: string;
  templateName: string;
  senderId: string;
  body: string;
  subjectPrefix: string;
}) {
  const { contributorId, templateId, templateName, senderId, body, subjectPrefix } =
    opts;
  if (!body.trim()) return null;

  const subject = `${subjectPrefix}: ${templateName}`;

  let thread = await prisma.studioMessageThread.findFirst({
    where: { contributorId, templateId },
    orderBy: { updatedAt: "desc" },
  });

  if (!thread) {
    thread = await prisma.studioMessageThread.create({
      data: {
        contributorId,
        templateId,
        subject,
        isBroadcast: false,
      },
    });
  } else if (thread.subject !== subject) {
    thread = await prisma.studioMessageThread.update({
      where: { id: thread.id },
      data: { subject },
    });
  }

  const msg = await prisma.studioMessage.create({
    data: {
      threadId: thread.id,
      senderId,
      body: body.trim(),
    },
  });

  await prisma.studioMessageThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date() },
  });

  return { thread, message: msg };
}
