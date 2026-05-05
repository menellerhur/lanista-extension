// Dynamic table rendering logic for all item categories.
// Depends on: state.js (itemsGladiatorVf, itemsWeaponSubview, itemsSortCol, itemsSortDir),
//             filters.js (itemsGetStrengthReq, itemsGetWeaponSkillReq, itemsFormatPrice)


function itemsTh(label, col, align, tooltip, opts = {}) {
  const a = align || "right";
  const active = itemsSortCol === col;
  const colorClass = active ? "text-foreground" : "text-muted-foreground";
  const tipAttr = tooltip ? ` title="${tooltip}"` : "";
  const filterActive = opts.filterActive ?? (typeof itemsIsColFilterActive === "function" && itemsIsColFilterActive(col));
  const arrowUp   = icon("sort-up",   { width: 8, height: 12, strokeWidth: 1 });
  const arrowDown = icon("sort-down", { width: 8, height: 12, strokeWidth: 1 });
  const arrowSvg  = itemsSortDir === "asc" ? arrowUp : arrowDown;
  const arrowSpan = `<span class="ext-sort-arrow${active ? " ext-sort-arrow--active" : ""}">${arrowSvg}</span>`;
  const menuCls   = "ext-col-menu-icon" + (filterActive ? " ext-col-menu-icon--active" : "");
  const menuDots  = icon("menu-dots", { width: 4, height: 10, style: "pointer-events:none" });
  const searchIcon = icon("search", { size: 11, strokeWidth: 2.5, style: "pointer-events:none" });
  const menuBtn = opts.noMenu ? "" : (col === "name"
    ? `<span class="ext-col-menu-icon ext-col-search-icon${itemsNameSearchOpen ? " ext-col-menu-icon--active" : ""}" data-col-menu="${col}">${searchIcon}</span>`
    : `<span class="${menuCls}" data-col-menu="${col}">${menuDots}</span>`);
  const thCls = `py-1 pl-2 pr-1 text-xs ${colorClass} cursor-pointer select-none${a === "left" ? " text-left" : a === "center" ? " text-center" : " text-right"}${filterActive ? " ext-th--filter-active" : ""}`;
  if (col === "name" && itemsNameSearchOpen) {
    const searchVal = (itemsColFilters?.name?.text || "").replace(/"/g, "&quot;");
    const thClsSearch = thCls.replace("cursor-pointer", "cursor-text");
    return `<th class="${thClsSearch}" data-sort-col="${col}"${tipAttr} style="min-width:240px"><div class="ext-th-inner"><input class="ext-th-inline-search" type="text" value="${searchVal}" placeholder="Sök..." style="cursor:text!important"><div class="ext-th-actions">${menuBtn}</div></div></th>`;
  }
  const styleAttr = col === "name" ? ' style="min-width:240px"' : "";
  return `<th class="${thCls}" data-sort-col="${col}"${tipAttr}${styleAttr}><div class="ext-th-inner"><span style="white-space:nowrap">${label}</span>${arrowSpan}<div class="ext-th-actions">${menuBtn}</div></div></th>`;
}

// ITEM_TYPE_NAMES + itemsBuildItemTooltip + itemsBuildMaterialTooltip moved to
// js/isolated-world/common/item-tooltip.js so plan-gladiator can reuse them.

function itemsRenderRows(items, keys) {
  return items.map(item => {
    itemsItemRowMap[item.id] = item;
    return `<tr class="ext-items-row border-b border-border/40${itemsSelectedIds.has(item.id) ? " ext-row-selected" : ""}" data-item-id="${item.id}">
      ${itemsRenderColCells(item, keys)}
    </tr>`;
  }).join("");
}

// Returns the HTML that goes INSIDE the <td> for a given item and column.
function itemsGetCellInnerHtml(item, key) {
  const col = ITEMS_ALL_COLUMNS[key];
  if (!col) return "";
  if (col.renderCell) {
    const tdHtml = col.renderCell(item, key);
    // Extract content between the first > and the last <
    const start = tdHtml.indexOf(">") + 1;
    const end = tdHtml.lastIndexOf("<");
    return (start > 0 && end > start) ? tdHtml.substring(start, end) : "";
  }
  const display = (() => {
    const rawV = col.getValue(item);
    const v = col.format ? col.format(item, rawV) : rawV;
    return v === null || v === undefined ? "–" : String(v);
  })();
  return display;
}

let _measurementCanvas = null;
function getTextWidth(text, font) {
  if (!_measurementCanvas) _measurementCanvas = document.createElement("canvas");
  const context = _measurementCanvas.getContext("2d");
  context.font = font;
  return context.measureText(text).width;
}

function itemsRenderVirtualTableShell(keys, sizingItems) {
  const sizingRow = sizingItems ? itemsRenderSizingRow(sizingItems, keys) : "";
  return `<table class="w-full text-sm border-collapse">
    <thead>
      <tr>${itemsRenderColHeaders(keys)}</tr>
      ${sizingRow}
    </thead>
    <tbody></tbody>
  </table>`;
}

function itemsFindSizingValues(items, keys) {
  const sizingItems = {};
  const maxWidths = {};
  keys.forEach(k => {
    sizingItems[k] = null;
    maxWidths[k] = 0;
  });

  // Table uses text-xs (12px) and Open Sans/sans-serif
  const fontNormal = "12px 'Open Sans', sans-serif";
  const fontMedium = "500 12px 'Open Sans', sans-serif";

  items.forEach(item => {
    keys.forEach(k => {
      const col = ITEMS_ALL_COLUMNS[k];
      if (!col) return;

      const html = itemsGetCellInnerHtml(item, k);
      const text = (typeof html === "string") ? html.replace(/<[^>]*>?/gm, "") : String(html);

      const font = (k === "name") ? fontMedium : fontNormal;
      const width = getTextWidth(text, font);

      if (width > maxWidths[k]) {
        maxWidths[k] = width;
        sizingItems[k] = item;
      }
    });
  });
  return sizingItems;
}

// Hides every <td> the sizing row emits. Per-cell styling is required because
// renderCell can produce multi-cell HTML (e.g. durability/absorption in bonus mode);
// wrapping multi-cell HTML in a single <td> lets the parser break out of the wrapper.
const ITEMS_SIZING_HIDE_STYLE = "height:0;padding-top:0;padding-bottom:0;border:none;line-height:0;color:transparent;overflow:hidden;pointer-events:none;user-select:none;";

function itemsApplySizingHiding(tdHtml) {
  return tdHtml.replace(/<td\b([^>]*)>/g, (_match, attrs) => {
    if (/\sstyle\s*=\s*"/.test(attrs)) {
      const merged = attrs.replace(/(\sstyle\s*=\s*")([^"]*)(")/, (_m, p, body, q) => {
        const sep = body && !body.endsWith(";") ? ";" : "";
        return `${p}${body}${sep}${ITEMS_SIZING_HIDE_STYLE}${q}`;
      });
      return `<td${merged}>`;
    }
    return `<td${attrs} style="${ITEMS_SIZING_HIDE_STYLE}">`;
  });
}

function itemsRenderSizingRow(sizingItems, keys) {
  const cells = keys.map(k => {
    const item = sizingItems[k];
    if (!item) return "";
    return itemsApplySizingHiding(itemsRenderColCells(item, [k]));
  }).join("");

  return `<tr style="height:0;border:none" aria-hidden="true">${cells}</tr>`;
}

function itemsRenderTable(items, view) {
  const keys = itemsGetVisibleColKeys();
  const sizingItems = items.length ? itemsFindSizingValues(items, keys) : null;
  let html = itemsRenderVirtualTableShell(keys, sizingItems);
  if (!items.length) html += '<p class="text-sm text-muted-foreground pt-2 pl-1">Inga rader matchade filtren.</p>';
  return html;
}
