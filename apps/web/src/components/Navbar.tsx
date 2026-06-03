"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "ADMIN";
  const isContributor = role === "CONTRIBUTOR" || isAdmin;

  return (
    <nav className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
      <Link href="/" className="text-xl font-bold text-[var(--accent)]">
        CreativeTools
      </Link>
      <div className="flex items-center gap-6 text-sm">
        <Link href="/pricing" className="hover:text-[var(--accent)]">
          Pricing
        </Link>
        <Link href="/studio" className="hover:text-[var(--accent)]">
          AssetFlow Studio
        </Link>
        {session ? (
          <>
            <Link href="/dashboard" className="hover:text-[var(--accent)]">
              Dashboard
            </Link>
            {isContributor && (
              <Link href="/contributor" className="hover:text-[var(--accent)]">
                Contributor
              </Link>
            )}
            {isAdmin && (
              <>
                <Link href="/admin" className="hover:text-[var(--accent)]">
                  Admin
                </Link>
                <Link
                  href="/admin/contributors"
                  className="hover:text-[var(--accent)]"
                >
                  Contributors
                </Link>
              </>
            )}
            <button
              onClick={() => signOut()}
              className="text-zinc-400 hover:text-white"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:text-[var(--accent)]">
              Login
            </Link>
            <Link
              href="/register"
              className="bg-[var(--accent)] px-4 py-2 rounded-lg hover:bg-[var(--accent-hover)]"
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
