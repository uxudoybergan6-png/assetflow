import { renderShellMeta } from "./_shell-meta.js";

export function onRequest(context) {
  return renderShellMeta(context, {
    title: "Adobe Plugin — FrameFlow",
    description: "Browse FrameFlow assets and AI tools inside supported Adobe applications.",
  });
}
