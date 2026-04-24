// Central icon registry. Provides `icon(name, opts)` which returns an SVG
// markup string, and `iconEl(name, opts)` which returns a parsed DOM element.
// Usage:
//   icon("check", { size: 14, strokeWidth: 1.5, class: "check-icon" })
//   iconEl("preview", { size: 11, strokeWidth: 1.2, class: "ext-preview-icon" })

const ICON_DEFS = {
  "check":           { inner: `<path d="M20 6 9 17l-5-5"/>` },
  "chevron-down":    { inner: `<path d="m6 9 6 6 6-6"/>` },
  "chevron-right":   { inner: `<path d="m9 18 6-6-6-6"/>` },
  "eye":             { inner: `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/>` },
  "eye-off":         { inner: `<path d="m2 2 20 20"/><path d="M6.76 6.76A10.75 10.75 0 0 0 2.062 12.348a1 1 0 0 0 0 .696 10.75 10.75 0 0 0 19.876 0 10.21 10.21 0 0 0-1.87-2.93"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>` },
  // Older Feather-style eye-off — visually distinct from Lucide "eye-off" above.
  "eye-off-feather": { inner: `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>` },
  "lines":           { inner: `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>` },
  "menu-dots":       { viewBox: "0 0 4 10", inner: `<circle cx="2" cy="1" r="1"/><circle cx="2" cy="5" r="1"/><circle cx="2" cy="9" r="1"/>`, defaults: { fill: "currentColor", stroke: null } },
  "preview":         { viewBox: "0 0 11 11", inner: `<path d="M1 5.5C2 3 3.5 2 5.5 2s3.5 1 4.5 3.5C9 8 7.5 9 5.5 9S2 8 1 5.5z"/><circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" stroke="none"/>` },
  "search":          { inner: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>` },
  "sort-down":       { viewBox: "0 0 8 12", inner: `<path d="M1.5 7.5L4 10L6.5 7.5"/><path d="M4 10V2"/>` },
  "sort-up":         { viewBox: "0 0 8 12", inner: `<path d="M1.5 4.5L4 2L6.5 4.5"/><path d="M4 2V10"/>` },
  "sparkles":        { inner: `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>` },
  "x":               { inner: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>` },
};

function icon(name, opts = {}) {
  const def = ICON_DEFS[name];
  if (!def) return "";
  const d = def.defaults || {};
  const size        = opts.size       ?? 14;
  const width       = opts.width      ?? size;
  const height      = opts.height     ?? size;
  const strokeWidth = opts.strokeWidth ?? 2;
  const stroke      = "stroke" in opts ? opts.stroke : ("stroke" in d ? d.stroke : "currentColor");
  const fill        = opts.fill       ?? d.fill ?? "none";
  const cls         = opts.class      ?? "";
  const style       = opts.style      ?? "";
  const id          = opts.id         ?? "";
  const ariaHidden  = opts.ariaHidden === true;

  const parts = [
    `xmlns="http://www.w3.org/2000/svg"`,
    `width="${width}"`,
    `height="${height}"`,
    `viewBox="${def.viewBox || "0 0 24 24"}"`,
    `fill="${fill}"`,
  ];
  if (stroke !== null && stroke !== "none") {
    parts.push(`stroke="${stroke}"`);
    parts.push(`stroke-width="${strokeWidth}"`);
    parts.push(`stroke-linecap="round"`);
    parts.push(`stroke-linejoin="round"`);
  }
  if (cls)        parts.push(`class="${cls}"`);
  if (id)         parts.push(`id="${id}"`);
  if (style)      parts.push(`style="${style}"`);
  if (ariaHidden) parts.push(`aria-hidden="true"`);

  return `<svg ${parts.join(" ")}>${def.inner}</svg>`;
}

function iconEl(name, opts = {}) {
  const tpl = document.createElement("template");
  tpl.innerHTML = icon(name, opts);
  return tpl.content.firstElementChild;
}
