import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import { findAssetPath, type TemplateAssetKind } from "./template-files.js";
import { isS3Configured, getPublicUrl } from "./s3.js";

const MIME: Record<TemplateAssetKind, string> = {
  thumb: "image/jpeg",
  preview: "video/mp4",
  pack: "application/octet-stream",
};

/** Brauzer video uchun Range (206) va CORS expose */
export function serveTemplateAsset(
  req: Request,
  res: Response,
  templateId: string,
  kind: TemplateAssetKind
) {
  // S3/R2 sozlangan bo'lsa — to'g'ridan redirect (CDN tezligi, API bandwidth tejaladi)
  if (isS3Configured()) {
    const s3Key = `templates/${templateId}/${kind}`;
    const url = getPublicUrl(s3Key);
    res.redirect(302, url);
    return;
  }

  const filePath = findAssetPath(templateId, kind);
  if (!filePath) {
    res.status(404).json({ error: "Fayl topilmadi" });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  let contentType = MIME[kind];
  if (kind === "thumb" && ext === ".png") contentType = "image/png";
  if (kind === "thumb" && ext === ".webp") contentType = "image/webp";
  if (kind === "preview" && ext === ".mov") contentType = "video/quicktime";
  if (kind === "preview" && ext === ".webm") contentType = "video/webm";

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Range, Accept-Ranges, Content-Length, Content-Type"
  );
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=3600");

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
        res.end();
        return;
      }
      const chunk = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", String(chunk));
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.setHeader("Content-Length", String(fileSize));
  fs.createReadStream(filePath).pipe(res);
}
