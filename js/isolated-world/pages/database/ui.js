// Orchestrator for the items-tab UI. Builds the outer layout (view tabs,
// subtabs, weapon-subview button, column-picker button, table container),
// binds per-render document-level listeners via an AbortController, and
// delegates the actual widgets to sibling ui-*.js modules.
// Depends on: common/constants.js (EXT_TAB_TRIGGER_CLASS), config.js (ITEM_VIEWS),
//             state.js (items*), columns.js (itemsGetVisibleColKeys),
//             common/icons.js (icon),
//             ui-selection.js (itemsUpdateSelectionUI),
//             ui-subcats.js (itemsBuildSubcatButtons, itemsBindSubcatButtons, itemsBuildSubviewList),
//             ui-table-refresh.js (itemsRefreshTable),
//             ui-col-picker.js (itemsRefreshColPickerBtn, itemsOpenColPicker,
//                               itemsCloseColPicker, itemsSetupColPickerDrag),
//             ui-col-filter.js (itemsOpenColFilterPanel),
//             ui-tooltip.js (itemsBindTooltip)

let _renderAbortController = null;

function renderItemsTabContent(container) {
  if (_renderAbortController) _renderAbortController.abort();
  _renderAbortController = new AbortController();
  const _renderSignal = _renderAbortController.signal;

  const viewTabs = ITEM_VIEWS.map(v =>
    `<button class="${EXT_TAB_TRIGGER_CLASS}" data-state="${v.key === itemsCurrentViewKey ? "active" : "inactive"}" data-items-view="${v.key}">${v.label}</button>`
  ).join("");

  const currentView = ITEM_VIEWS.find(v => v.key === itemsCurrentViewKey);
  const hasSubcats  = currentView.subcatMode !== null;

  if (currentView.noAllTab && currentView.subcats && itemsCurrentSubcat === null)
    itemsCurrentSubcat = currentView.subcats[0].label;

  const staticSubcatButtons = (currentView.subcatMode === "static")
    ? itemsBuildSubcatButtons(
        currentView.noAllTab
          ? currentView.subcats.map(s => ({ label: s.label, key: s.label }))
          : [{ label: "Alla", key: "__all__" }, ...currentView.subcats.map(s => ({ label: s.label, key: s.label }))]
      )
    : "";

  const pickerCols = itemsCustomCols.length + itemsHiddenCols.length;

  container.innerHTML = `
    <div class="flex flex-col h-full gap-3 p-0">
      <div data-slot="tabs-list" class="text-muted-foreground inline-flex max-w-full items-end border-b border-border/70 w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        ${viewTabs}
      </div>
      <div id="ext-items-subtabs" class="text-muted-foreground inline-flex max-w-full items-end border-b border-border/70 w-full flex-wrap justify-start gap-1 bg-transparent p-0" ${hasSubcats ? "" : 'style="display:none"'}>
        ${staticSubcatButtons}
      </div>
      <div class="flex flex-wrap gap-2 items-center">
        <div id="ext-items-weapon-subview-wrap" style="position:relative">
          <button id="ext-items-weapon-subview-btn" class="h-7 rounded-md border border-input bg-background px-3 text-xs outline-none cursor-pointer flex items-center justify-between gap-2 min-w-[120px] hover:bg-accent text-foreground">
            <span id="ext-items-weapon-subview-label">${itemsWeaponSubview === "standard" ? "Standard" : itemsWeaponSubview === "parera" ? "Parera" : "Skada"}</span>
            <span class="text-[9px] opacity-70">▼</span>
          </button>
          <div id="ext-items-weapon-subview-panel" class="ext-col-picker-panel" style="display:none; min-width: 100%; max-width: none; top: calc(100% + 4px); padding: 4px; left: 0; right: auto;">
            ${itemsBuildSubviewList()}
          </div>
        </div>
        <div id="ext-col-picker-wrap" style="position:relative;margin-left:auto">
          <button id="ext-col-picker-btn" class="h-7 rounded-md border border-input bg-background px-3 text-xs outline-none cursor-pointer flex items-center justify-between gap-2 min-w-[120px] hover:bg-accent text-foreground whitespace-nowrap">
            <span id="ext-col-picker-btn-text">${pickerCols ? `● Kolumner (${pickerCols})` : "Kolumner"}</span>
            <span class="text-[9px] opacity-70">▼</span>
          </button>
          <div id="ext-col-picker-panel" class="ext-col-picker-panel" style="display:none">
            <div class="ext-cpp-search-wrap">
              <div class="relative w-full">
                <input id="ext-col-picker-search" type="text" class="ext-cpp-search text-xs outline-none w-full pr-6" placeholder="Sök kolumn..." autocomplete="off">
                <button id="ext-col-picker-search-clear" class="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hidden bg-transparent border-none p-0.5 cursor-pointer leading-none">
                  ${icon("x", { size: 11, strokeWidth: 2.5 })}
                </button>
              </div>
            </div>
            <div id="ext-col-picker-list" class="ext-cpp-list"></div>
            <div class="ext-cpp-footer">
              <button id="ext-col-picker-clear" class="ext-cpp-clear-btn ext-cfp-clear-btn" ${pickerCols === 0 ? "disabled" : ""}>${icon("x", { size: 9, strokeWidth: 2.5, style: "pointer-events:none;flex-shrink:0;position:relative;top:0.5px" })}<span>Återställ kolumner</span></button>
            </div>
          </div>
        </div>
      </div>
      <div id="ext-items-table"></div>
    </div>
  `;

  const subtabsEl = document.getElementById("ext-items-subtabs");
  if (currentView.subcatMode === "static") itemsBindSubcatButtons(subtabsEl);

  container.querySelectorAll("[data-items-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      itemsCurrentViewKey   = btn.dataset.itemsView;
      itemsCurrentSubcat    = null;
      itemsNameSearchOpen   = false;
      itemsWeaponSubview    = "standard";
      itemsSelectedIds      = new Set();
      itemsFilterSelection  = "all";
      itemsSortCol          = null;
      itemsSortDir          = "asc";
      itemsColFilters       = {};
      itemsHiddenCols       = [];
      itemsCustomCols       = [];
      itemsColOrder         = [];

      container.querySelectorAll("[data-items-view]").forEach(b => {
        b.dataset.state = b === btn ? "active" : "inactive";
      });

      const newView = ITEM_VIEWS.find(v => v.key === itemsCurrentViewKey);

      const subviewLabel = document.getElementById("ext-items-weapon-subview-label");
      itemsWeaponSubview = "standard";
      if (subviewLabel) subviewLabel.textContent = "Standard";
      itemsRefreshColPickerBtn();
      const subviewPanel = document.getElementById("ext-items-weapon-subview-panel");
      if (subviewPanel) subviewPanel.innerHTML = itemsBuildSubviewList();

      if (subtabsEl) {
        delete subtabsEl.dataset.built;
        if (newView.subcatMode === "static" && newView.subcats) {
          if (newView.noAllTab) itemsCurrentSubcat = newView.subcats[0].label;
          subtabsEl.innerHTML = itemsBuildSubcatButtons(
            newView.noAllTab
              ? newView.subcats.map(s => ({ label: s.label, key: s.label }))
              : [{ label: "Alla", key: "__all__" }, ...newView.subcats.map(s => ({ label: s.label, key: s.label }))]
          );
          itemsBindSubcatButtons(subtabsEl);
          subtabsEl.style.display = "";
        } else if (newView.subcatMode === "weapon_types") {
          subtabsEl.innerHTML = "";
          subtabsEl.style.display = "";
        } else {
          subtabsEl.innerHTML = "";
          subtabsEl.style.display = "none";
        }
      }

      itemsRefreshTable();
    });
  });

  // Track mousedown to prevent auto-closing dropdowns when dragging out (e.g. from search box)
  let mousedownInPicker = false;
  let mousedownInSubview = false;
  document.addEventListener("mousedown", e => {
    mousedownInPicker = !!e.target.closest("#ext-col-picker-wrap");
    mousedownInSubview = !!e.target.closest("#ext-items-weapon-subview-wrap");
  }, { signal: _renderSignal });

  // Weapon-subview dropdown (Standard / Parera / Skada + custom views)
  document.addEventListener("click", e => {
    if (!e.target.isConnected) return;
    const subviewBtn   = e.target.closest("#ext-items-weapon-subview-btn");
    const subviewPanel = document.getElementById("ext-items-weapon-subview-panel");
    const subviewWrap  = e.target.closest("#ext-items-weapon-subview-wrap");

    if (subviewBtn && subviewPanel) {
      const isClosing = subviewPanel.style.display === "block";
      subviewPanel.style.display = isClosing ? "none" : "block";
      if (isClosing) {
        itemsViewNamingMode = false;
        subviewPanel.innerHTML = itemsBuildSubviewList();
      }
      return;
    }

    if (subviewWrap) {
      const delBtn = e.target.closest(".ext-cpp-delete");
      if (delBtn) {
        e.stopPropagation();
        const id = delBtn.dataset.subviewDelete;
        itemsCustomViews = itemsCustomViews.filter(v => v.id !== id);
        itemsSaveCustomViews();
        if (itemsWeaponSubview === id) {
          itemsWeaponSubview = "standard";
          itemsHiddenCols = [];
          itemsCustomCols = [];
          itemsColFilters = {};
          const label = document.getElementById("ext-items-weapon-subview-label");
          if (label) label.textContent = "Standard";
          itemsRefreshTable();
          itemsRefreshColPickerBtn();
        }
        if (subviewPanel) subviewPanel.innerHTML = itemsBuildSubviewList();
        return;
      }

      const saveBtn = e.target.closest("#ext-items-save-view-btn");
      if (saveBtn) {
        itemsViewNamingMode = true;
        if (subviewPanel) subviewPanel.innerHTML = itemsBuildSubviewList();
        const input = document.getElementById("ext-items-new-view-name");
        if (input) {
          input.focus();
          input.addEventListener("keydown", ev => {
            if (ev.key === "Enter") document.getElementById("ext-items-save-view-confirm")?.click();
            if (ev.key === "Escape") document.getElementById("ext-items-save-view-cancel")?.click();
          });
        }
        return;
      }

      const cancelBtn = e.target.closest("#ext-items-save-view-cancel");
      if (cancelBtn) {
        itemsViewNamingMode = false;
        if (subviewPanel) subviewPanel.innerHTML = itemsBuildSubviewList();
        return;
      }

      const confirmBtn = e.target.closest("#ext-items-save-view-confirm");
      if (confirmBtn) {
        const input = document.getElementById("ext-items-new-view-name");
        const name = input?.value?.trim();
        if (name) {
          const visibleCols = itemsGetVisibleColKeys().filter(k => k !== "name");

          const newId = "custom-" + Date.now();
          itemsCustomViews.push({
            id: newId,
            name: name,
            parentViewKey: itemsCurrentViewKey,
            baseCols: visibleCols,
            colFilters: JSON.parse(JSON.stringify(itemsColFilters))
          });
          itemsSaveCustomViews();

          itemsWeaponSubview = newId;
          itemsHiddenCols = [];
          itemsCustomCols = [];
          itemsColOrder = [];
          itemsViewNamingMode = false;

          const label = document.getElementById("ext-items-weapon-subview-label");
          if (label) label.textContent = name;
          if (subviewPanel) {
            subviewPanel.innerHTML = itemsBuildSubviewList();
            subviewPanel.style.display = "none";
          }
          itemsRefreshTable();
          itemsRefreshColPickerBtn();
        }
        return;
      }

      const item = e.target.closest(".ext-cpp-item-subview");
      if (item) {
        itemsWeaponSubview = item.dataset.subview;

        const cv = itemsCustomViews.find(v => v.id === itemsWeaponSubview);
        if (cv) {
          // Column customizations (hidden, custom, order) follow along when switching subviews.
          // Filters only override if the custom view has its own saved filters.
          if (cv.colFilters && Object.keys(cv.colFilters).length > 0) {
            itemsColFilters = JSON.parse(JSON.stringify(cv.colFilters));
          }
          itemsRefreshColPickerBtn();
        } else if (itemsWeaponSubview === "standard" || itemsWeaponSubview === "parera" || itemsWeaponSubview === "skada") {
          itemsRefreshColPickerBtn();
        }

        const label = document.getElementById("ext-items-weapon-subview-label");
        if (label) {
          const itemLabel = item.querySelector(".ext-cpp-label")?.textContent;
          if (itemLabel) label.textContent = itemLabel;
        }
        if (subviewPanel) {
          itemsViewNamingMode = false;
          subviewPanel.innerHTML = itemsBuildSubviewList();
          subviewPanel.style.display = "none";
        }

        itemsRefreshTable();
      }
      return;
    }

    // Clicked outside — close panel if it's open
    if (subviewPanel && subviewPanel.style.display === "block") {
      if (subviewWrap || mousedownInSubview) return;
      subviewPanel.style.display = "none";
      itemsViewNamingMode = false;
      subviewPanel.innerHTML = itemsBuildSubviewList();
    }
  }, { signal: _renderSignal });

  // Column picker open/close via document-level delegation
  document.addEventListener("click", e => {
    if (!e.target.isConnected) return;
    const btn  = e.target.closest("#ext-col-picker-btn");
    const wrap = e.target.closest("#ext-col-picker-wrap");

    if (btn) {
      const panel = document.getElementById("ext-col-picker-panel");
      if (panel?.style.display === "block") itemsCloseColPicker();
      else                                  itemsOpenColPicker();
      return;
    }

    // Don't auto-close if clicking inside (or started inside) the picker panel wrap
    if (wrap || mousedownInPicker) return;

    const panel = document.getElementById("ext-col-picker-panel");
    if (panel && panel.style.display === "block") itemsCloseColPicker();
  }, { signal: _renderSignal });

  // Escape closes both dropdowns
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const subview   = document.getElementById("ext-items-weapon-subview-panel");
    const colPicker = document.getElementById("ext-col-picker-panel");
    if (subview) subview.style.display = "none";
    if (colPicker && colPicker.style.display === "block") itemsCloseColPicker();
  }, { signal: _renderSignal });

  // Column picker search box
  document.getElementById("ext-col-picker-search")?.addEventListener("input", e => {
    const q        = e.target.value.trim();
    const listEl   = document.getElementById("ext-col-picker-list");
    const clearBtn = document.getElementById("ext-col-picker-search-clear");
    if (listEl) listEl.innerHTML = itemsBuildColPickerList(q);
    if (clearBtn) clearBtn.classList.toggle("hidden", q.length === 0);
  });

  document.getElementById("ext-col-picker-search-clear")?.addEventListener("click", () => {
    const input = document.getElementById("ext-col-picker-search");
    if (input) {
      input.value = "";
      input.dispatchEvent(new Event("input"));
      input.focus();
    }
  });

  // Column picker drag-and-drop reordering
  const pickerListEl = document.getElementById("ext-col-picker-list");
  if (pickerListEl) itemsSetupColPickerDrag(pickerListEl);

  document.getElementById("ext-col-picker-clear")?.addEventListener("click", () => {
    itemsCustomCols = [];
    itemsHiddenCols = [];
    itemsColOrder   = [];
    itemsColFilters = {};
    itemsCloseColPicker();
    itemsRefreshColPickerBtn();
    itemsRefreshTable();
  });

  const tableDiv = document.getElementById("ext-items-table");

  // Column sort on header click
  tableDiv.addEventListener("click", e => {
    if (e.target.closest("[data-col-menu]") || e.target.closest(".ext-th-inline-search")) return;
    const th = e.target.closest("[data-sort-col]");
    if (!th) return;
    const col = th.dataset.sortCol;
    const isNumeric = ITEMS_ALL_COLUMNS[col]?.type === "number";

    if (itemsSortCol === col) {
      if (isNumeric) {
        if (itemsSortDir === "desc") {
          itemsSortDir = "asc";
        } else {
          itemsSortCol = null;
          itemsSortDir = "asc";
        }
      } else {
        if (itemsSortDir === "asc") {
          itemsSortDir = "desc";
        } else {
          itemsSortCol = null;
          itemsSortDir = "asc";
        }
      }
    } else {
      itemsSortCol = col;
      itemsSortDir = isNumeric ? "desc" : "asc";
    }
    itemsRefreshTable();
  });

  // Inline name-search field inside the Name column header
  tableDiv.addEventListener("input", async e => {
    const inp = e.target.closest(".ext-th-inline-search");
    if (!inp) return;
    if (!itemsColFilters["name"]) itemsColFilters["name"] = {};
    itemsColFilters["name"].text = inp.value;
    const cursor = inp.selectionStart;
    await itemsRefreshTable();
    const newInp = document.querySelector(".ext-th-inline-search");
    if (newInp) { newInp.focus(); newInp.setSelectionRange(cursor, cursor); }
  });
  tableDiv.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !e.target.classList.contains("ext-th-inline-search")) return;
    itemsNameSearchOpen = false;
    itemsColFilters["name"] = {};
    itemsRefreshTable();
  });

  // Column ⋮ menu opens the col-filter panel
  tableDiv.addEventListener("click", e => {
    const menuBtn = e.target.closest("[data-col-menu]");
    if (menuBtn) itemsOpenColFilterPanel(menuBtn.dataset.colMenu, menuBtn);
  });

  // Row selection + selection-pill + clear-all-filters
  tableDiv.addEventListener("click", e => {
    if (e.target.closest("#ext-items-filter-clear")) {
      itemsColFilters = {};
      itemsCurrentSubcat = null;

      const subtabsEl = document.getElementById("ext-items-subtabs");
      if (subtabsEl) {
        const buttons = subtabsEl.querySelectorAll("[data-items-subcat]");
        const allBtn  = Array.from(buttons).find(b => b.dataset.itemsSubcat === "__all__");
        if (allBtn) {
          buttons.forEach(b => b.dataset.state = (b === allBtn ? "active" : "inactive"));
        } else if (buttons.length > 0) {
          buttons.forEach((b, i) => b.dataset.state = (i === 0 ? "active" : "inactive"));
          itemsCurrentSubcat = buttons[0].dataset.itemsSubcat;
        }
      }

      itemsRefreshTable();
      return;
    }
    if (e.target.closest("#ext-items-selection-count")) {
      const cycle = { all: "selected", selected: "unselected", unselected: "all" };
      itemsFilterSelection = cycle[itemsFilterSelection];
      itemsRefreshTable();
      return;
    }
    if (e.target.closest("#ext-items-selection-clear")) {
      itemsSelectedIds     = new Set();
      itemsFilterSelection = "all";
      itemsRefreshTable();
      return;
    }
    const row = e.target.closest("[data-item-id]");
    if (!row) return;
    const id = parseInt(row.dataset.itemId);
    if (itemsSelectedIds.has(id)) {
      itemsSelectedIds.delete(id);
      row.classList.remove("ext-row-selected");
    } else {
      itemsSelectedIds.add(id);
      row.classList.add("ext-row-selected");
    }
    const wasFiltered = itemsFilterSelection !== "all";
    if (itemsSelectedIds.size === 0) itemsFilterSelection = "all";
    itemsUpdateSelectionUI();
    if (itemsFilterSelection !== "all" || wasFiltered) itemsRefreshTable();
  });

  // Tooltips (data-tooltip cells + per-item weapon tooltip)
  itemsBindTooltip(tableDiv, "ext-items-stats-tooltip", "[data-tooltip]", cell => {
    const t = cell.dataset.tooltip;
    return t != null ? { text: t } : null;
  }, _renderSignal);
  itemsBindTooltip(tableDiv, "ext-weapon-tooltip", "[data-item-tooltip-id]", row => {
    const item = itemsItemRowMap[row.dataset.itemTooltipId];
    if (!item) return null;
    const html = item.is_material ? itemsBuildMaterialTooltip(item) : itemsBuildItemTooltip(item);
    return { html };
  }, _renderSignal);

  itemsRefreshTable();
}
