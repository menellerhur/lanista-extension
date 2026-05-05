// Table refresh + virtualized row rendering for the items database.
// itemsRefreshTable() is the master "data changed" entry point: it re-applies
// filters, rebuilds the table skeleton, and schedules virtual row rendering.
// itemsUpdateVirtualTable() is called on every scroll (via rAF) to render only
// the visible window of rows plus a small buffer.
// Depends on: state.js (items*), config.js (ITEM_VIEWS, WEAPON_TYPE_ORDER, WEAPON_TYPE_LABELS),
//             data.js (itemsLoadEnriched), filters.js, tables.js, columns.js,
//             ui-selection.js (itemsUpdateSelectionUI),
//             ui-filters-summary.js (itemsGetActiveFiltersSummary),
//             ui-subcats.js (itemsBuildSubcatButtons, itemsBindSubcatButtons)

const ITEM_ROW_HEIGHT = 25;

async function itemsRefreshTable() {
  const tableDiv = document.getElementById("ext-items-table");
  if (!tableDiv) return;

  // 1. Capture scroll position and context
  const scrollEl = document.getElementById("ext-items-table-scroll");
  const currentContext = `${itemsCurrentViewKey}-${itemsCurrentSubcat}-${itemsWeaponSubview}`;
  const contextChanged = itemsLastNavContext !== currentContext;

  const scrollPos = (!contextChanged && scrollEl)
    ? { left: scrollEl.scrollLeft, top: scrollEl.scrollTop }
    : null;

  itemsLastNavContext = currentContext;

  // 2. Hide tooltips on refresh to avoid "stuck" popups when DOM is replaced
  ["ext-items-stats-tooltip", "ext-weapon-tooltip"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // 3. Conditional loading indicator (only if not cached)
  const view = ITEM_VIEWS.find(v => v.key === itemsCurrentViewKey);
  const cacheKey = "enriched_" + view.file;
  const isCached = itemsCache[cacheKey] !== undefined;

  if (!isCached) {
    tableDiv.innerHTML = '<p class="text-sm text-muted-foreground pt-2">Laddar...</p>';
  }

  const allItems = await itemsLoadEnriched(view.file);
  const viewItems = allItems.filter(view.baseFilter);
  itemsCurrentViewItems = viewItems;

  if (!viewItems.length) {
    tableDiv.innerHTML = '<p class="text-sm text-muted-foreground pt-2">Ingen data hittades.</p>';
    return;
  }

  // Weapon type subtabs — built dynamically from data
  if (view.subcatMode === "weapon_types") {
    const subtabsEl = document.getElementById("ext-items-subtabs");
    if (subtabsEl && !subtabsEl.dataset.built) {
      subtabsEl.dataset.built = "1";
      const presentTypes = WEAPON_TYPE_ORDER.filter(t => viewItems.some(i => i.type_name === t));
      const buttons = [{ label: "Alla", key: "__all__" }, ...presentTypes.map(t => ({ label: WEAPON_TYPE_LABELS[t] || t, key: t }))];
      subtabsEl.innerHTML = itemsBuildSubcatButtons(buttons);
      itemsBindSubcatButtons(subtabsEl);
    }
  }

  const filtered = itemsSort(itemsApplyColFilters(itemsApplyFilters(viewItems, view)));
  itemsCurrentFiltered = filtered;
  itemsCurrentView     = view;

  const selectionHtml = `<span id="ext-items-selection-wrap" style="visibility:hidden">
    <span id="ext-items-selection-count" class="ext-selection-count" title="Klicka för att byta filterläge"></span>
    <span class="ext-selection-pipe"></span>
    <span id="ext-items-selection-clear" class="ext-selection-clear" title="Avmarkera alla">
      ${icon("x", { size: 10, strokeWidth: 2.5 })}
    </span>
  </span>`;

  const filterSummary = itemsGetActiveFiltersSummary().replace(/"/g, "&quot;");
  const filtersActive = Object.keys(itemsColFilters).length > 0 || itemsCurrentSubcat !== null;
  const filterClearHtml = `<span id="ext-items-filter-clear-wrap" style="${filtersActive ? "" : "display:none"}">
    <span class="ext-selection-pipe"></span>
    <span id="ext-items-filter-clear" class="ext-selection-clear" title="Rensa alla filter">
      ${icon("x", { size: 10, strokeWidth: 2.5 })}
    </span>
  </span>`;

  // 4. Update DOM
  tableDiv.innerHTML = `
    <div id="ext-items-table-scroll" class="overflow-x-auto" style="overflow-y:auto">${itemsRenderTable(filtered, view)}</div>
    <p class="text-xs text-muted-foreground mt-3 flex items-center">
      <span class="ext-row-count" data-tooltip="${filterSummary}">${filtered.length} av ${viewItems.length} rader</span>
      ${filterClearHtml}
      <span class="ml-auto">${selectionHtml}</span>
    </p>
  `;

  const scrollElAfter = document.getElementById("ext-items-table-scroll");
  if (scrollElAfter) {
    scrollElAfter.addEventListener("scroll", () => {
      requestAnimationFrame(itemsUpdateVirtualTable);
    });
  }
  itemsUpdateVirtualTable();

  // 5. Restore scroll position
  if (scrollPos) {
    const newScrollEl = document.getElementById("ext-items-table-scroll");
    if (newScrollEl) {
      newScrollEl.scrollLeft = scrollPos.left;
      newScrollEl.scrollTop  = scrollPos.top;
      itemsUpdateVirtualTable();
    }
  }

  itemsUpdateSelectionUI();
}

function itemsUpdateVirtualTable() {
  const scrollEl = document.getElementById("ext-items-table-scroll");
  if (!scrollEl) return;

  const tbody = scrollEl.querySelector("tbody");
  if (!tbody) return;

  const scrollTop = scrollEl.scrollTop;
  const viewportH = scrollEl.clientHeight;
  const buffer    = 8;
  const total     = itemsCurrentFiltered.length;

  let start = Math.floor(scrollTop / ITEM_ROW_HEIGHT) - buffer;
  if (start < 0) start = 0;

  let end = Math.ceil((scrollTop + viewportH) / ITEM_ROW_HEIGHT) + buffer;
  if (end > total) end = total;

  const topH    = start * ITEM_ROW_HEIGHT;
  const bottomH = (total - end) * ITEM_ROW_HEIGHT;

  const visibleItems = itemsCurrentFiltered.slice(start, end);
  const keys = itemsGetVisibleColKeys();

  itemsItemRowMap = {}; // Rebuild map for visible rows
  const rowsHtml = itemsRenderRows(visibleItems, keys);

  const topSpacer    = `<tr style="height:${topH}px"><td colspan="${keys.length}" style="padding:0;height:${topH}px;border:none"></td></tr>`;
  const bottomSpacer = `<tr style="height:${bottomH}px"><td colspan="${keys.length}" style="padding:0;height:${bottomH}px;border:none"></td></tr>`;

  tbody.innerHTML = topSpacer + rowsHtml + bottomSpacer;
}
