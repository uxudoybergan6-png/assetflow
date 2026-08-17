import { renderShellMeta } from "./_shell-meta.js";

export function onRequest(context) {
  return renderShellMeta(context, {
    title: "Pricing — FrameFlow",
    description: "Compare FrameFlow plans, generation credits and creative workflow features.",
  });
}
