// Central icon registry. Provides `icon(name, opts)` which returns an SVG
// markup string, and `iconEl(name, opts)` which returns a parsed DOM element.
// Usage:
//   icon("check", { size: 14, strokeWidth: 1.5, class: "check-icon" })
//   iconEl("preview", { size: 11, strokeWidth: 1.2, class: "ext-preview-icon" })

const ICON_DEFS = {
  "check":           { inner: `<path d="M20 6 9 17l-5-5"/>` },
  "chevron-down":    { inner: `<path d="m6 9 6 6 6-6"/>` },
  "chevron-left":    { inner: `<path d="m15 18-6-6 6-6"/>` },
  "chevron-right":   { inner: `<path d="m9 18 6-6-6-6"/>` },
  "eye":             { inner: `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/>` },
  "eye-off":         { inner: `<path d="m2 2 20 20"/><path d="M6.76 6.76A10.75 10.75 0 0 0 2.062 12.348a1 1 0 0 0 0 .696 10.75 10.75 0 0 0 19.876 0 10.21 10.21 0 0 0-1.87-2.93"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>` },
  // Older Feather-style eye-off — visually distinct from Lucide "eye-off" above.
  "eye-off-feather": { inner: `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>` },
  "lines":           { inner: `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>` },
  "menu-dots":       { viewBox: "0 0 4 10", inner: `<circle cx="2" cy="1" r="1"/><circle cx="2" cy="5" r="1"/><circle cx="2" cy="9" r="1"/>`, defaults: { fill: "currentColor", stroke: null } },
  "pencil":          { inner: `<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>` },
  "plus":            { inner: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>` },
  "preview":         { viewBox: "0 0 11 11", inner: `<path d="M1 5.5C2 3 3.5 2 5.5 2s3.5 1 4.5 3.5C9 8 7.5 9 5.5 9S2 8 1 5.5z"/><circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" stroke="none"/>` },
  "save":            { inner: `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>` },
  "refresh-cw":      { inner: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>` },
  "lock":            { inner: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>` },
  "search":          { inner: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>` },
  "sort-down":       { viewBox: "0 0 8 12", inner: `<path d="M1.5 7.5L4 10L6.5 7.5"/><path d="M4 10V2"/>` },
  "sort-up":         { viewBox: "0 0 8 12", inner: `<path d="M1.5 4.5L4 2L6.5 4.5"/><path d="M4 2V10"/>` },
  "sparkles":        { inner: `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>` },
  "trash-2":         { inner: `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>` },
  "x":               { inner: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>` },
  "copy":            { inner: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>` },
  "files":           { inner: `<path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"/><path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8"/><path d="M15 2v4.5h4.5"/>` },
  "layers":          { inner: `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.1 6.27a2 2 0 0 0 0 3.46l9.07 4.09a2 2 0 0 0 1.66 0l9.07-4.09a2 2 0 0 0 0-3.46Z"/><path d="m2.1 14.27 9.07 4.09a2 2 0 0 0 1.66 0l9.07-4.09"/><path d="m2.1 10.27 9.07 4.09a2 2 0 0 0 1.66 0l9.07-4.09"/>` },
  "square-stack":    { inner: `<path d="M4 10c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/><path d="M10 16c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/><rect width="8" height="8" x="14" y="14" rx="2"/>` },
  "plus-square":     { inner: `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>` },
  "clipboard":       { inner: `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>` },
  "file-plus":       { inner: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 12v6"/>` },
  "library":         { inner: `<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>` },
  "combine":         { inner: `<rect width="7" height="7" x="2" y="2" rx="2"/><rect width="7" height="7" x="15" y="15" rx="2"/><path d="M15 4h2a2 2 0 0 1 2 2v11"/><path d="M4 15v2a2 2 0 0 0 2 2h11"/>` },
  "component":       { inner: `<path d="m12 3 4.5 4.5L12 12 7.5 7.5Z"/><path d="m12 12 4.5 4.5L12 21l-4.5-4.5Z"/><path d="m16.5 7.5 4.5 4.5-4.5 4.5-4.5-4.5Z"/><path d="m7.5 7.5 4.5 4.5-4.5 4.5-4.5-4.5Z"/>` },
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
