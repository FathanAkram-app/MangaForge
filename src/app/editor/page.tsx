"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPE,
  type RefObject,
} from "react";
import { fetchGallery } from "@/lib/client";
import type { GenerationDTO } from "@/lib/generations/types";
import { exportPageToPng } from "@/lib/export-page";
import { MANGA_LAYOUTS, type MangaLayout } from "@/lib/manga-layouts";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type PanelState = { imageUrl: string; scale: number; offXPct: number; offYPct: number };
type OverlayType = "bubble" | "caption" | "sfx";
type Overlay = {
  id: string;
  type: OverlayType;
  text: string;
  xPct: number;
  yPct: number;
  wPct: number;
  fontPx: number;
  rotate: number;
  onDark: boolean;
};
type Selection = { kind: "panel"; area: string } | { kind: "overlay"; id: string } | null;

let counter = 0;
const uid = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`;

export default function EditorPage() {
  const [layout, setLayout] = useState<MangaLayout>(MANGA_LAYOUTS[0]);
  const [panels, setPanels] = useState<Record<string, PanelState>>({});
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [art, setArt] = useState<GenerationDTO[]>([]);
  const [loadingArt, setLoadingArt] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGallery()
      .then((items) => setArt(items.filter((i) => i.status === "succeeded" && i.imageUrl)))
      .catch(() => setMessage("Couldn't load your art. Generate some in the studio first."))
      .finally(() => setLoadingArt(false));
  }, []);

  function changeLayout(next: MangaLayout) {
    setLayout(next);
    // Keep any placed art whose panel area still exists in the new layout.
    setPanels((prev) => {
      const kept: Record<string, PanelState> = {};
      for (const area of next.areas) if (prev[area]) kept[area] = prev[area];
      return kept;
    });
    setSelection(null);
  }

  function assignArt(url: string) {
    if (selection?.kind !== "panel") {
      setMessage("Select a panel first, then click a piece of art.");
      return;
    }
    setPanels((prev) => ({ ...prev, [selection.area]: { imageUrl: url, scale: 1, offXPct: 0, offYPct: 0 } }));
    setMessage(null);
  }

  const updatePanel = useCallback((area: string, patch: Partial<PanelState>) => {
    setPanels((prev) => (prev[area] ? { ...prev, [area]: { ...prev[area], ...patch } } : prev));
  }, []);

  function setPanelScale(area: string, scale: number) {
    setPanels((prev) => {
      const p = prev[area];
      if (!p) return prev;
      const max = (scale - 1) * 50;
      return { ...prev, [area]: { ...p, scale, offXPct: clamp(p.offXPct, -max, max), offYPct: clamp(p.offYPct, -max, max) } };
    });
  }

  function clearPanel(area: string) {
    setPanels((prev) => {
      const next = { ...prev };
      delete next[area];
      return next;
    });
  }

  function addOverlay(type: OverlayType) {
    const id = uid();
    const common = { id, type, xPct: 32, yPct: 24, rotate: type === "sfx" ? -8 : 0, onDark: false };
    const overlay: Overlay =
      type === "sfx"
        ? { ...common, text: "DOKUN", wPct: 30, fontPx: 46 }
        : type === "caption"
          ? { ...common, text: "Later that night…", wPct: 36, fontPx: 13 }
          : { ...common, text: "Nani?!", wPct: 26, fontPx: 18 };
    setOverlays((o) => [...o, overlay]);
    setSelection({ kind: "overlay", id });
  }

  const updateOverlay = useCallback((id: string, patch: Partial<Overlay>) => {
    setOverlays((o) => o.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const removeOverlay = useCallback((id: string) => {
    setOverlays((o) => o.filter((x) => x.id !== id));
    setSelection(null);
  }, []);

  // Delete / Backspace removes the selected overlay — but never while typing.
  useEffect(() => {
    if (selection?.kind !== "overlay") return;
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeOverlay(selection.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, removeOverlay]);

  async function handleExport() {
    if (!pageRef.current) return;
    setSelection(null);
    setExporting(true);
    try {
      // Let the data-exporting styles (hiding chrome) paint before capture.
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      await exportPageToPng(pageRef.current, "manga-page.png");
    } catch {
      setMessage("Export failed — please try again.");
    } finally {
      setExporting(false);
    }
  }

  function reset() {
    setPanels({});
    setOverlays([]);
    setSelection(null);
    setMessage(null);
  }

  const selectedOverlay = selection?.kind === "overlay" ? overlays.find((o) => o.id === selection.id) ?? null : null;
  const selectedPanelArea = selection?.kind === "panel" ? selection.area : null;
  const selectedPanel = selectedPanelArea ? panels[selectedPanelArea] : undefined;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4 border-b-2 border-ink pb-4">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Manga<span className="text-accent">Forge</span>
            </Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">panel editor</span>
          </div>
          <Link
            href="/create"
            className="rounded-lg border-2 border-ink bg-paper px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] shadow-[2px_2px_0_0_#111] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            ← Studio
          </Link>
        </header>

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Layout</span>
          {MANGA_LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => changeLayout(l)}
              className={`rounded-md border-2 border-ink px-2.5 py-1 text-xs font-semibold transition ${
                l.id === layout.id ? "bg-ink text-paper" : "bg-paper hover:bg-muted"
              }`}
            >
              {l.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-ink/20" />
          <button onClick={() => addOverlay("bubble")} className={toolBtn}>+ Speech</button>
          <button onClick={() => addOverlay("caption")} className={toolBtn}>+ Caption</button>
          <button onClick={() => addOverlay("sfx")} className={toolBtn}>+ SFX</button>
          <span className="mx-1 h-5 w-px bg-ink/20" />
          <button onClick={reset} className={toolBtn}>Reset</button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-ink bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-[2px_2px_0_0_#111] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {exporting ? "Exporting…" : "Export PNG"}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Stage */}
          <div className="flex items-start justify-center">
            <div
              ref={pageRef}
              data-exporting={exporting || undefined}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setSelection(null);
              }}
              className="relative grid w-full max-w-[520px] border-2 border-ink bg-white shadow-[6px_6px_0_0_#111]"
              style={{
                aspectRatio: "3 / 4",
                gridTemplateColumns: layout.gridTemplateColumns,
                gridTemplateRows: layout.gridTemplateRows,
                gridTemplateAreas: layout.gridTemplateAreas,
                gap: 12,
                padding: 16,
                touchAction: "none",
              }}
            >
              {layout.areas.map((area) => (
                <Panel
                  key={area}
                  area={area}
                  state={panels[area]}
                  selected={selectedPanelArea === area}
                  onSelect={() => setSelection({ kind: "panel", area })}
                  onPan={(patch) => updatePanel(area, patch)}
                />
              ))}

              {overlays.map((el) => (
                <OverlayItem
                  key={el.id}
                  el={el}
                  pageRef={pageRef}
                  selected={selection?.kind === "overlay" && selection.id === el.id}
                  onSelect={() => setSelection({ kind: "overlay", id: el.id })}
                  onChange={(patch) => updateOverlay(el.id, patch)}
                />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5">
            {/* Context controls */}
            {selectedOverlay ? (
              <div className="rounded-xl border-2 border-ink bg-white p-4 shadow-[4px_4px_0_0_#111]">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                    {selectedOverlay.type}
                  </h2>
                  <button
                    onClick={() => removeOverlay(selectedOverlay.id)}
                    className="rounded-md border-2 border-ink px-2 py-0.5 text-xs font-semibold text-accent-dark hover:bg-muted"
                  >
                    Delete
                  </button>
                </div>
                <textarea
                  value={selectedOverlay.text}
                  onChange={(e) => updateOverlay(selectedOverlay.id, { text: e.target.value })}
                  rows={2}
                  className="w-full resize-y rounded-lg border-2 border-ink bg-paper px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <LabeledRange
                  label={`Size ${selectedOverlay.fontPx}px`}
                  min={8}
                  max={selectedOverlay.type === "sfx" ? 160 : 48}
                  value={selectedOverlay.fontPx}
                  onChange={(v) => updateOverlay(selectedOverlay.id, { fontPx: v })}
                />
                {selectedOverlay.type === "sfx" && (
                  <>
                    <LabeledRange
                      label={`Rotate ${selectedOverlay.rotate}°`}
                      min={-45}
                      max={45}
                      value={selectedOverlay.rotate}
                      onChange={(v) => updateOverlay(selectedOverlay.id, { rotate: v })}
                    />
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedOverlay.onDark}
                        onChange={(e) => updateOverlay(selectedOverlay.id, { onDark: e.target.checked })}
                        className="h-4 w-4 accent-accent"
                      />
                      White (for dark panels)
                    </label>
                  </>
                )}
              </div>
            ) : selectedPanel ? (
              <div className="rounded-xl border-2 border-ink bg-white p-4 shadow-[4px_4px_0_0_#111]">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                    Panel
                  </h2>
                  <button
                    onClick={() => selectedPanelArea && clearPanel(selectedPanelArea)}
                    className="rounded-md border-2 border-ink px-2 py-0.5 text-xs font-semibold hover:bg-muted"
                  >
                    Clear
                  </button>
                </div>
                <LabeledRange
                  label={`Zoom ${selectedPanel.scale.toFixed(2)}×`}
                  min={1}
                  max={4}
                  step={0.01}
                  value={selectedPanel.scale}
                  onChange={(v) => selectedPanelArea && setPanelScale(selectedPanelArea, v)}
                />
                <p className="mt-1 text-xs text-ink-soft">Drag inside the panel to reposition the art.</p>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-ink/40 p-4 text-sm text-ink-soft">
                Select a panel, then click a piece of art to place it. Add speech bubbles, captions, and SFX from the
                toolbar — drag to move, drag the corner to resize.
              </div>
            )}

            {/* Art tray */}
            <div className="rounded-xl border-2 border-ink bg-white p-4 shadow-[4px_4px_0_0_#111]">
              <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Your art
              </h2>
              {loadingArt ? (
                <p className="text-sm text-ink-soft">Loading…</p>
              ) : art.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  No art yet.{" "}
                  <Link href="/create" className="font-semibold text-accent-dark underline">
                    Generate some
                  </Link>{" "}
                  in the studio.
                </p>
              ) : (
                <div className="grid max-h-[420px] grid-cols-3 gap-2 overflow-y-auto">
                  {art.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => assignArt(a.imageUrl!)}
                      title={a.params.subject}
                      className="overflow-hidden rounded-md border-2 border-ink transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- same-origin gallery thumb */}
                      <img src={a.imageUrl!} alt={a.params.subject} loading="lazy" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border-2 border-ink bg-amber-100 px-3 py-2 text-sm font-medium text-ink">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

const toolBtn =
  "rounded-md border-2 border-ink bg-paper px-2.5 py-1 text-xs font-semibold transition hover:bg-muted";

/* -------------------------------- Panel ---------------------------------- */

function Panel({
  area,
  state,
  selected,
  onSelect,
  onPan,
}: {
  area: string;
  state: PanelState | undefined;
  selected: boolean;
  onSelect: () => void;
  onPan: (patch: Partial<PanelState>) => void;
}) {
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number; rect: DOMRect } | null>(null);

  function onPointerDown(e: RPE<HTMLDivElement>) {
    e.stopPropagation();
    onSelect();
    if (!state) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      ox: state.offXPct,
      oy: state.offYPct,
      rect: el.getBoundingClientRect(),
    };
  }
  function onPointerMove(e: RPE<HTMLDivElement>) {
    const d = drag.current;
    if (!d || !state || e.pointerId !== d.id) return;
    const dx = ((e.clientX - d.x) / d.rect.width) * 100;
    const dy = ((e.clientY - d.y) / d.rect.height) * 100;
    const max = (state.scale - 1) * 50;
    onPan({ offXPct: clamp(d.ox + dx, -max, max), offYPct: clamp(d.oy + dy, -max, max) });
  }
  function end(e: RPE<HTMLDivElement>) {
    const d = drag.current;
    if (d && e.pointerId === d.id) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      drag.current = null;
    }
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      className="relative overflow-hidden bg-white"
      style={{
        gridArea: area,
        border: "3px solid #111",
        outline: selected ? "3px solid #e5342b" : undefined,
        outlineOffset: 2,
        touchAction: "none",
        cursor: state ? "grab" : "pointer",
      }}
    >
      {state ? (
        <img
          src={state.imageUrl}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `translate(${state.offXPct}%, ${state.offYPct}%) scale(${state.scale})`,
            transformOrigin: "center",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div data-export-ignore className="absolute inset-0 grid place-items-center px-2 text-center">
          <span className="halftone absolute inset-0 text-ink/[0.05]" />
          <span className="relative font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            {selected ? "pick art →" : "click panel"}
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ OverlayItem ------------------------------ */

function OverlayItem({
  el,
  pageRef,
  selected,
  onSelect,
  onChange,
}: {
  el: Overlay;
  pageRef: RefObject<HTMLDivElement | null>;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Overlay>) => void;
}) {
  const move = useRef<{ id: number; x: number; y: number; sx: number; sy: number; rect: DOMRect } | null>(null);
  const rez = useRef<{ id: number; x: number; sw: number; sf: number; rect: DOMRect } | null>(null);

  function downMove(e: RPE<HTMLDivElement>) {
    e.stopPropagation();
    onSelect();
    const c = pageRef.current;
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    move.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: el.xPct, sy: el.yPct, rect: c.getBoundingClientRect() };
  }
  function onMove(e: RPE<HTMLDivElement>) {
    const d = move.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = ((e.clientX - d.x) / d.rect.width) * 100;
    const dy = ((e.clientY - d.y) / d.rect.height) * 100;
    onChange({ xPct: clamp(d.sx + dx, 0, 100), yPct: clamp(d.sy + dy, 0, 100) });
  }
  function endMove(e: RPE<HTMLDivElement>) {
    const d = move.current;
    if (d && e.pointerId === d.id) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      move.current = null;
    }
  }

  function downRez(e: RPE<HTMLDivElement>) {
    e.stopPropagation();
    const c = pageRef.current;
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    rez.current = { id: e.pointerId, x: e.clientX, sw: el.wPct, sf: el.fontPx, rect: c.getBoundingClientRect() };
  }
  function onRez(e: RPE<HTMLDivElement>) {
    const r = rez.current;
    if (!r || e.pointerId !== r.id) return;
    const dx = ((e.clientX - r.x) / r.rect.width) * 100;
    const wPct = clamp(r.sw + dx, 6, 100);
    const ratio = wPct / r.sw;
    onChange({ wPct, fontPx: clamp(r.sf * ratio, 8, 220) });
  }
  function endRez(e: RPE<HTMLDivElement>) {
    const r = rez.current;
    if (r && e.pointerId === r.id) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      rez.current = null;
    }
  }

  const isSfx = el.type === "sfx";

  return (
    <div
      onPointerDown={downMove}
      onPointerMove={onMove}
      onPointerUp={endMove}
      onPointerCancel={endMove}
      style={{
        position: "absolute",
        left: `${el.xPct}%`,
        top: `${el.yPct}%`,
        width: isSfx ? "auto" : `${el.wPct}%`,
        transform: isSfx ? `rotate(${el.rotate}deg)` : undefined,
        transformOrigin: "top left",
        touchAction: "none",
        cursor: "move",
        userSelect: "none",
        outline: selected ? "2px solid #e5342b" : undefined,
        outlineOffset: 2,
      }}
    >
      {el.type === "bubble" && (
        <div
          style={{
            position: "relative",
            background: "#fff",
            color: "#111",
            border: "3px solid #111",
            borderRadius: 20,
            padding: "12px 16px",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: `${el.fontPx}px`,
            lineHeight: 1.25,
            textAlign: "center",
          }}
        >
          {el.text}
          <span
            style={{
              position: "absolute",
              left: 22,
              bottom: -9,
              width: 16,
              height: 16,
              background: "#fff",
              borderRight: "3px solid #111",
              borderBottom: "3px solid #111",
              transform: "rotate(45deg)",
            }}
          />
        </div>
      )}

      {el.type === "caption" && (
        <div
          style={{
            background: "#fff",
            color: "#111",
            border: "3px solid #111",
            padding: "6px 10px",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: `${el.fontPx}px`,
            letterSpacing: "0.02em",
            lineHeight: 1.35,
            textTransform: "uppercase",
          }}
        >
          {el.text}
        </div>
      )}

      {isSfx && (
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: `${el.fontPx}px`,
            lineHeight: 0.9,
            whiteSpace: "nowrap",
            color: el.onDark ? "#fff" : "#111",
            textShadow: el.onDark ? SFX_OUTLINE_DARK : SFX_OUTLINE_LIGHT,
          }}
        >
          {el.text}
        </span>
      )}

      {selected && (
        <div
          data-export-ignore
          onPointerDown={downRez}
          onPointerMove={onRez}
          onPointerUp={endRez}
          onPointerCancel={endRez}
          style={{
            position: "absolute",
            right: -8,
            bottom: -8,
            width: 15,
            height: 15,
            borderRadius: 3,
            background: "#e5342b",
            border: "2px solid #111",
            cursor: "nwse-resize",
            touchAction: "none",
          }}
        />
      )}
    </div>
  );
}

const SFX_OUTLINE_LIGHT =
  "2px 0 #fff,-2px 0 #fff,0 2px #fff,0 -2px #fff,2px 2px #fff,-2px -2px #fff,2px -2px #fff,-2px 2px #fff";
const SFX_OUTLINE_DARK =
  "2px 0 #111,-2px 0 #111,0 2px #111,0 -2px #111,2px 2px #111,-2px -2px #111,2px -2px #111,-2px 2px #111";

/* ------------------------------ LabeledRange ----------------------------- */

function LabeledRange({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-soft">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}
