import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <section className="text-center py-24">
        <p className="text-[var(--accent)] font-medium mb-4">
          Adobe Premiere Pro & After Effects
        </p>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Professional motion assets.
          <br />
          <span className="text-zinc-400">$4.99/month.</span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
          5,000+ templates, transitions, VFX overlays, textures & LUTs.
          One plugin. Instant download inside your Adobe apps.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/register"
            className="bg-[var(--accent)] px-8 py-4 rounded-xl text-lg font-semibold hover:bg-[var(--accent-hover)]"
          >
            Start Free Trial
          </Link>
          <Link
            href="/pricing"
            className="border border-[var(--border)] px-8 py-4 rounded-xl text-lg hover:border-zinc-500"
          >
            View Pricing
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6 py-16">
        {[
          {
            title: "Premiere Pro Plugin",
            desc: "UXP panel — search, preview, download assets directly in your timeline workflow.",
          },
          {
            title: "After Effects Plugin",
            desc: "CEP panel for AE — same library, same subscription, seamless workflow.",
          },
          {
            title: "Cloud Library",
            desc: "Assets delivered via CDN. Fast previews, secure signed downloads.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
            <p className="text-zinc-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="text-center py-16 border-t border-[var(--border)]">
        <p className="text-zinc-500 text-sm mb-2">vs Pixflow at $19.99/mo</p>
        <p className="text-3xl font-bold">4x cheaper. Same quality assets.</p>
      </section>
    </div>
  );
}
