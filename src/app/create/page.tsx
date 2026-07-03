"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CreateError,
  createGeneration,
  fetchGallery,
  pollGeneration,
  saveAsCharacter,
  type CreateInput,
} from "@/lib/client";
import { isUserError, SYSTEM_ERROR_MESSAGE, type GenerationDTO } from "@/lib/generations/types";
import {
  MANGA_COLORS,
  MANGA_FORMATS,
  MANGA_GENRES,
  type MangaColor,
  type MangaFormat,
  type MangaGenre,
} from "@/lib/manga";

/** How each failure state is presented — a distinct card + one clear action. */
const FAILURE = {
  timeout: {
    title: "Timed out",
    hint: "The image service took too long. This is usually temporary.",
    box: "bg-amber-100",
    chip: "bg-amber-200 text-amber-900",
    action: "retry" as const,
  },
  bad_response: {
    title: "Came back broken",
    hint: "The service replied, but not with a valid image.",
    box: "bg-orange-100",
    chip: "bg-orange-200 text-orange-900",
    action: "retry" as const,
  },
  invalid_prompt: {
    title: "Prompt blocked",
    hint: "It didn't pass the content filter. Try a different scene.",
    box: "bg-rose-100",
    chip: "bg-rose-200 text-rose-900",
    action: "edit" as const,
  },
  unknown: {
    title: "Something went wrong",
    hint: "An unexpected error occurred.",
    box: "bg-neutral-100",
    chip: "bg-neutral-200 text-neutral-800",
    action: "retry" as const,
  },
};

type FormState = {
  subject: string;
  genre: MangaGenre;
  format: MangaFormat;
  color: MangaColor;
  screentone: boolean;
  characterId: string;
};

const DEFAULT_FORM: FormState = {
  subject: "",
  genre: "shonen",
  format: "panel",
  color: "bw",
  screentone: true,
  characterId: "",
};

export default function Studio() {
  const [items, setItems] = useState<GenerationDTO[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remixParentId, setRemixParentId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number>(0);

  const composerRef = useRef<HTMLTextAreaElement>(null);

  const savedCharacters = useMemo(() => items.filter((i) => i.isCharacter), [items]);
  const hasActive = items.some((i) => i.status === "queued" || i.status === "running");

  // Load the persisted gallery on first render.
  useEffect(() => {
    fetchGallery()
      .then(setItems)
      .catch(() => setFormError("Couldn't load your gallery. Is the server running?"))
      .finally(() => setLoadingGallery(false));
  }, []);

  // Pre-fill the composer from a ?prompt= handed over by the landing hero.
  useEffect(() => {
    const prompt = new URLSearchParams(window.location.search).get("prompt");
    if (prompt) {
      setForm((f) => ({ ...f, subject: prompt }));
      composerRef.current?.focus();
    }
  }, []);

  // Poll any in-flight generations until they reach a terminal state.
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(async () => {
      const active = items.filter((i) => i.status === "queued" || i.status === "running");
      const updated = await Promise.all(active.map((i) => pollGeneration(i.id).catch(() => null)));
      setItems((prev) => prev.map((p) => updated.find((u) => u?.id === p.id) ?? p));
    }, 1500);
    return () => clearInterval(timer);
  }, [items, hasActive]);

  // A once-per-second tick so the "Inking… 12s" timer feels live.
  useEffect(() => {
    if (!hasActive) return;
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasActive]);

  const submit = useCallback(async (input: Omit<CreateInput, "idempotencyKey">) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createGeneration({ ...input, idempotencyKey: crypto.randomUUID() });
      setItems((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    } catch (err) {
      // A user (input) error shows the specific problem; anything else is on us.
      setFormError(
        err instanceof CreateError && isUserError(err.code) ? err.message : SYSTEM_ERROR_MESSAGE,
      );
    } finally {
      setSubmitting(false);
    }
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submit({
      subject: form.subject,
      genre: form.genre,
      format: form.format,
      color: form.color,
      screentone: form.screentone,
      characterId: form.characterId || undefined,
      parentId: remixParentId ?? undefined,
    });
    setRemixParentId(null);
  }

  // Load a card's settings back into the composer (for remix / edit).
  function loadIntoComposer(item: GenerationDTO, asRemix: boolean) {
    setForm({
      subject: item.params.subject,
      genre: item.params.genre,
      format: item.params.format,
      color: item.params.color,
      screentone: item.params.screentone,
      characterId: item.params.characterRef?.fromId ?? "",
    });
    setRemixParentId(asRemix ? item.id : null);
    setFormError(null);
    composerRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Re-run a failed generation with the same settings (keep the seed).
  function retry(item: GenerationDTO) {
    void submit({
      subject: item.params.subject,
      genre: item.params.genre,
      format: item.params.format,
      color: item.params.color,
      screentone: item.params.screentone,
      seed: item.params.seed,
    });
  }

  async function handleSaveCharacter(item: GenerationDTO) {
    const label = window.prompt("Name this character (you can reuse it in new prompts):", "");
    if (!label?.trim()) return;
    try {
      const updated = await saveAsCharacter(item.id, label.trim());
      setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      setFormError("Couldn't save that character.");
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-10 border-b-2 border-ink pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <Link href="/" className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
                <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
                  Manga<span className="text-accent">Forge</span>
                </h1>
              </Link>
              <p className="mt-3 max-w-xl text-sm text-ink-soft">
                Describe a scene, choose a style, and forge a manga panel. Every result is saved to your
                gallery below.
              </p>
            </div>
            <Link
              href="/editor"
              className="shrink-0 rounded-lg border-2 border-ink bg-paper px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] shadow-[2px_2px_0_0_#111] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              Panel editor →
            </Link>
          </div>
        </header>

        <Composer
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={formError}
          remixing={remixParentId !== null}
          onCancelRemix={() => setRemixParentId(null)}
          savedCharacters={savedCharacters}
          composerRef={composerRef}
        />

        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
              Your gallery
            </h2>
            {items.length > 0 && (
              <span className="font-mono text-xs text-ink-soft">
                {items.length} panel{items.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {loadingGallery ? (
            <p className="font-mono text-sm text-ink-soft">Loading…</p>
          ) : items.length === 0 ? (
            <div className="halftone rounded-xl border-2 border-dashed border-ink/40 p-12 text-center text-ink/70">
              <p className="mx-auto max-w-sm rounded-lg bg-paper/80 px-4 py-3 text-sm">
                No panels yet. Describe a scene above and hit{" "}
                <span className="font-semibold text-ink">Forge panel</span>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  nowTs={nowTs}
                  onRemix={() => loadIntoComposer(item, true)}
                  onEdit={() => loadIntoComposer(item, false)}
                  onRetry={() => retry(item)}
                  onSaveCharacter={() => handleSaveCharacter(item)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ------------------------------- Composer -------------------------------- */

function Composer({
  form,
  setForm,
  onSubmit,
  submitting,
  error,
  remixing,
  onCancelRemix,
  savedCharacters,
  composerRef,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  error: string | null;
  remixing: boolean;
  onCancelRemix: () => void;
  savedCharacters: GenerationDTO[];
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border-2 border-ink bg-white p-5 shadow-[5px_5px_0_0_#111] sm:p-6"
    >
      {remixing && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-accent/10 px-3 py-2 text-sm">
          <span className="font-medium">Remixing a panel — tweak the prompt, then forge.</span>
          <button
            type="button"
            onClick={onCancelRemix}
            className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs uppercase tracking-widest text-ink-soft hover:text-ink"
          >
            <IconX /> cancel
          </button>
        </div>
      )}

      <label htmlFor="subject" className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
        Scene
      </label>
      <textarea
        id="subject"
        ref={composerRef}
        value={form.subject}
        onChange={(e) => set("subject", e.target.value)}
        placeholder="a lone swordsman on a rain-soaked rooftop at night, city lights below"
        rows={3}
        className="w-full resize-y rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select
          label="Genre"
          value={form.genre}
          onChange={(v) => set("genre", v as MangaGenre)}
          options={MANGA_GENRES.map((g) => ({ value: g.id, label: g.label }))}
        />
        <Select
          label="Format"
          value={form.format}
          onChange={(v) => set("format", v as MangaFormat)}
          options={MANGA_FORMATS.map((f) => ({ value: f.id, label: f.label }))}
        />
        <Select
          label="Color"
          value={form.color}
          onChange={(v) => set("color", v as MangaColor)}
          options={MANGA_COLORS.map((c) => ({ value: c.id, label: c.label }))}
        />
        <div>
          <span className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
            Screentone
          </span>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.screentone}
              onChange={(e) => set("screentone", e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-accent"
            />
            Halftone
          </label>
        </div>
      </div>

      {savedCharacters.length > 0 && (
        <div className="mt-4">
          <Select
            label="Reuse a saved character (optional)"
            value={form.characterId}
            onChange={(v) => set("characterId", v)}
            options={[
              { value: "", label: "— none —" },
              ...savedCharacters.map((c) => ({ value: c.id, label: c.characterLabel ?? "Character" })),
            ]}
          />
          <p className="mt-1.5 text-xs text-ink-soft">
            Reuses the character&apos;s seed for a more consistent look (best-effort on free models).
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border-2 border-ink bg-rose-100 px-3 py-2 text-sm font-medium text-rose-900"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-paper shadow-[3px_3px_0_0_#111] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#111] active:translate-y-0 active:shadow-[1px_1px_0_0_#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0"
        >
          <IconSparkles />
          {submitting ? "Starting…" : remixing ? "Forge remix" : "Forge panel"}
        </button>
        <span className="font-mono text-xs text-ink-soft">Generation takes about 10–30 seconds.</span>
      </div>
    </form>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer rounded-lg border-2 border-ink bg-paper px-2 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------ Gallery card ----------------------------- */

function GalleryCard({
  item,
  nowTs,
  onRemix,
  onEdit,
  onRetry,
  onSaveCharacter,
}: {
  item: GenerationDTO;
  nowTs: number;
  onRemix: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onSaveCharacter: () => void;
}) {
  const badges = `${item.params.genre} · ${item.params.format} · ${item.params.color}`;

  // In-flight: skeleton "inking" panel with a live timer.
  if (item.status === "queued" || item.status === "running") {
    const elapsed = nowTs ? Math.max(0, Math.floor((nowTs - new Date(item.createdAt).getTime()) / 1000)) : 0;
    return (
      <article className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 border-ink bg-muted shadow-[4px_4px_0_0_#111]">
        <div className="halftone absolute inset-0 animate-pulse text-ink/10" aria-hidden="true" />
        <div className="relative px-3 text-center">
          <div
            className="mx-auto h-7 w-7 animate-spin rounded-sm border-2 border-ink border-t-accent"
            aria-hidden="true"
          />
          <p className="mt-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink">
            {item.status === "queued" ? "Queued" : "Inking"} · {elapsed}s
          </p>
          <p className="mx-auto mt-1 max-w-[90%] truncate text-xs text-ink-soft">{item.params.subject}</p>
        </div>
      </article>
    );
  }

  // Failed: distinct card per error code + one action.
  if (item.status === "failed") {
    const f = FAILURE[item.errorCode ?? "unknown"] ?? FAILURE.unknown;
    return (
      <article
        className={`flex aspect-square flex-col justify-between rounded-xl border-2 border-ink p-4 shadow-[4px_4px_0_0_#111] ${f.box}`}
      >
        <div>
          <span className={`inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ${f.chip}`}>
            {item.errorCode ?? "error"}
          </span>
          <p className="mt-2 font-display text-lg font-bold leading-tight text-ink">{f.title}</p>
          <p className="mt-1 text-xs text-ink/70">{item.errorMessage || f.hint}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-ink/60">{item.params.subject}</p>
          {f.action === "retry" ? (
            <CardButton onClick={onRetry}>
              <IconRetry /> Retry
            </CardButton>
          ) : (
            <CardButton onClick={onEdit}>
              <IconPencil /> Edit
            </CardButton>
          )}
        </div>
      </article>
    );
  }

  // Succeeded.
  return (
    <article className="group overflow-hidden rounded-xl border-2 border-ink bg-white shadow-[4px_4px_0_0_#111] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#111]">
      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin dynamic image; next/image adds no value here */}
      <img
        src={item.imageUrl ?? ""}
        alt={item.params.subject}
        loading="lazy"
        className="aspect-square w-full border-b-2 border-ink object-cover"
      />
      <div className="p-3">
        <p className="truncate text-sm font-medium text-ink" title={item.params.subject}>
          {item.params.subject}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-soft">{badges}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CardButton onClick={onRemix}>
            <IconSparkles /> Remix
          </CardButton>
          {!item.isCharacter ? (
            <CardButton onClick={onSaveCharacter}>
              <IconStar /> Save character
            </CardButton>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-dark">
              <IconStar filled /> {item.characterLabel}
            </span>
          )}
          <a
            href={item.imageUrl ?? "#"}
            download
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border-2 border-ink bg-paper px-2.5 py-1 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            <IconDownload /> Save
          </a>
        </div>
      </div>
    </article>
  );
}

function CardButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border-2 border-ink bg-paper px-2.5 py-1 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
    >
      {children}
    </button>
  );
}

/* --------------------------------- Icons --------------------------------- */
/* Inline SVG (Lucide-style), consistent 2px stroke — no emoji as icons. */

function Svg({ children, className = "h-3.5 w-3.5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconSparkles = () => (
  <Svg>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M12 7l1.7 3.3L17 12l-3.3 1.7L12 17l-1.7-3.3L7 12l3.3-1.7z" />
  </Svg>
);

const IconStar = ({ filled = false }: { filled?: boolean }) => (
  <Svg className={filled ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"}>
    <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 18l-6.2 3.2 1.6-7L2 9.5l7.1-.6z" />
  </Svg>
);

const IconDownload = () => (
  <Svg>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </Svg>
);

const IconRetry = () => (
  <Svg>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);

const IconPencil = () => (
  <Svg>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Svg>
);

const IconX = () => (
  <Svg className="h-3 w-3">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);
