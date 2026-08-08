import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.MODERATION_API_KEY = "test-key";
delete process.env.MODERATION_FAIL_OPEN;

const { collectImageRefUrls, moderateContent } = await import("../dist/lib/moderation.js");
const realFetch = globalThis.fetch;

try {
  let requestBody = null;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ results: [{ flagged: false, categories: {} }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const clean = await moderateContent({
    text: "A harmless product shot",
    imageUrls: ["https://storage.example/ref.png"],
    resolveImageUrl: async () => "data:image/jpeg;base64,ZmFrZS1qcGVn",
  });
  assert.equal(clean.blocked, false);
  assert.equal(requestBody.input[1].image_url.url, "data:image/jpeg;base64,ZmFrZS1qcGVn");

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ results: [{ flagged: true, categories: { "sexual/minors": true } }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  const prohibited = await moderateContent({ text: "test" });
  assert.equal(prohibited.blocked, true, "severe content must remain blocked");

  globalThis.fetch = async () => new Response("upstream error", { status: 500 });
  const unavailable = await moderateContent({ imageUrls: ["https://storage.example/ref.png"] });
  assert.equal(unavailable.blocked, true, "production image verification must stay fail-closed");
  assert.deepEqual(unavailable.categories, ["unverified-image"]);

  assert.deepEqual(
    collectImageRefUrls({
      referenceUrl: "https://x/start.png",
      referenceEndUrl: "https://x/end.png",
      imageUrls: ["https://x/ref.png"],
      videoUrls: ["https://x/ref.mp4"],
    }),
    ["https://x/start.png", "https://x/end.png", "https://x/ref.png"]
  );
  console.log("Reference moderation checks passed.");
} finally {
  globalThis.fetch = realFetch;
}
