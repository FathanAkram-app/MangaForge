// Client-side export of a composed manga page (a DOM node) to a downloadable
// PNG, via modern-screenshot (foreignObject rasterization). Loaded dynamically
// so it never runs during SSR/build. See the editor for the calling pattern.

// Canvas has per-side (Chrome/FF) and total-area (iOS/Safari) caps; clamp the
// scale so a large page never silently rasterizes to a blank image.
function safeScale(cssW: number, cssH: number, desired = 3): number {
  const MAX_SIDE = 16_384;
  const MAX_AREA = 16_777_216;
  const byArea = Math.sqrt(MAX_AREA / (cssW * cssH));
  const bySide = Math.min(MAX_SIDE / cssW, MAX_SIDE / cssH);
  return Math.max(1, Math.min(desired, byArea, bySide));
}

function triggerDownload(href: string, fileName: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportPageToPng(node: HTMLElement, fileName = "manga-page.png"): Promise<void> {
  const { domToBlob } = await import("modern-screenshot");
  // Ensure web fonts (next/font, same-origin) are loaded before rasterizing,
  // otherwise text falls back to a system font in the export.
  await document.fonts.ready;

  const { width, height } = node.getBoundingClientRect();
  const blob = await domToBlob(node, {
    type: "image/png",
    scale: safeScale(width, height, 3),
    backgroundColor: "#ffffff",
    // Drop editor chrome (handles, "click to add" placeholders) from the capture.
    filter: (el) => !(el instanceof HTMLElement && el.dataset.exportIgnore !== undefined),
  });
  if (!blob) throw new Error("Export produced an empty image.");

  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
