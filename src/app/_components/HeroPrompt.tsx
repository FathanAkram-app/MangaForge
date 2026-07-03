"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The landing hero's entry point: type a scene here and it routes into the
 * studio with the prompt pre-filled (low-friction "show, don't tell" start).
 */
export function HeroPrompt() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/create?prompt=${encodeURIComponent(q)}` : "/create");
  }

  return (
    <form
      onSubmit={go}
      className="mx-auto flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-stretch"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="a lone swordsman on a rain-soaked rooftop at night…"
        aria-label="Describe a manga scene"
        className="min-w-0 flex-1 rounded-lg border-2 border-ink bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      />
      <button
        type="submit"
        className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-ink bg-accent px-6 py-3 text-sm font-semibold text-white shadow-[3px_3px_0_0_#111] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#111] active:translate-y-0 active:shadow-[1px_1px_0_0_#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        Forge it →
      </button>
    </form>
  );
}
