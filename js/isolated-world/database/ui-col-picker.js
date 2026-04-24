// Column picker — add/remove/reorder the visible columns of the items table.
// Opens from the "Kolumner" button in the items tab header.
// Depends on: state.js (items*), config.js (ITEMS_ALL_COLUMNS),
//             columns.js (itemsGetCurrentBaseCols, itemsGetVisibleColKeys, itemsIsColFilterActive),
//             ui-table-refresh.js (itemsRefreshTable)

// Session-stable ordering for the picker rows. Computed once on open so rows
// don't jump around while the user scrolls or toggles columns.
let _itemsColPickerSortedKeys = null;

function itemsRefreshColPickerBtn() {
  const btn = document.getElementById("ext-col-picker-btn");
  if (!btn) return;
  const n = itemsCustomCols.length + itemsHiddenCols.length;
  const labelSpan = document.getElementById("ext-col-picker-btn-text");
  if (labelSpan) {
    labelSpan.textContent = n ? `● Kolumner (${n})` : "Kolumner";
  }

  const clearBtn = document.getElementById("ext-col-picker-clear");
  if (clearBtn) clearBtn.disabled = n === 0;
}

function itemsBuildColPickerList(search) {
  if (!_itemsColPickerSortedKeys) return "";
  const baseCols = new Set(itemsGetCurrentBaseCols());
  const q = search?.toLowerCase().trim();
  const visibleKeys = q
    ? _itemsColPickerSortedKeys.filter(k => {
        const col = ITEMS_ALL_COLUMNS[k];
        const matchLabel = col.label.toLowerCase().includes(q);
        const matchShort = col.shortLabel ? col.shortLabel.toLowerCase().includes(q) : false;
        return matchLabel || matchShort;
      })
    : _itemsColPickerSortedKeys;

  if (!visibleKeys.length) return `<div class="ext-cpp-empty">Inga kolumner matchade.</div>`;
  return visibleKeys.map(key => {
    const col = ITEMS_ALL_COLUMNS[key];
    if (key === "name") {
      return `<div class="ext-cpp-item ext-cpp-item--disabled"><span class="ext-cpp-check">✓</span><span class="ext-cpp-label">${col.label}</span><span class="ext-cpp-base">●</span></div>`;
    }
    const isBase   = baseCols.has(key);
    const isCustom = itemsCustomCols.includes(key);
    const isHidden = itemsHiddenCols.includes(key);
    const present  = (isBase && !isHidden) || isCustom;
    const hidden   = isBase && isHidden;
    const cls      = "ext-cpp-item" + (present ? " ext-cpp-item--present" : "") + (hidden ? " ext-cpp-item--hidden" : "");
    const attr     = present ? ` data-col-toggle="${key}"` : ` data-col-add="${key}"`;
    const checkIcon = present ? "✓" : (hidden ? "✕" : "");
    const baseIcon = isBase ? `<span class="ext-cpp-base" title="Standardkolumn">●</span>` : "";
    return `<div class="${cls}"${attr}><span class="ext-cpp-check">${checkIcon}</span><span class="ext-cpp-label">${col.label}</span>${baseIcon}</div>`;
  }).join("");
}

function itemsOpenColPicker() {
  const panel = document.getElementById("ext-col-picker-panel");
  if (!panel) return;
  panel.style.display = "block";

  // Calculate picker order once on open.
  // We want all base columns to stay in their original order at the top,
  // followed by any custom columns, then the alphabetical list of others.
  const baseKeys = itemsGetCurrentBaseCols();
  const activeKeys = itemsGetVisibleColKeys();
  const handled = new Set(["name"]);
  const sorted = ["name"];

  const activePool = new Set([
    ...baseKeys,
    ...itemsCustomCols,
    ...Object.keys(itemsColFilters).filter(k => itemsIsColFilterActive(k))
  ]);

  // 1. First, follow the saved custom order for any keys in the active pool
  if (itemsColOrder && itemsColOrder.length > 0) {
    for (const k of itemsColOrder) {
      if (activePool.has(k) && !handled.has(k)) {
        sorted.push(k);
        handled.add(k);
      }
    }
  }

  // 2. Add any remaining base columns (default order)
  for (const k of baseKeys) {
    if (!handled.has(k)) {
      sorted.push(k);
      handled.add(k);
    }
  }

  // 3. Add any other currently visible columns (e.g., filtered ones)
  for (const k of activeKeys) {
    if (!handled.has(k)) {
      sorted.push(k);
      handled.add(k);
    }
  }

  // 4. Everything else alphabetical
  const other = Object.keys(ITEMS_ALL_COLUMNS)
    .filter(k => !handled.has(k) && !ITEMS_ALL_COLUMNS[k].pickerHidden)
    .sort((a, b) => ITEMS_ALL_COLUMNS[a].label.localeCompare(ITEMS_ALL_COLUMNS[b].label, "sv"));

  _itemsColPickerSortedKeys = [...sorted, ...other];

  const listEl   = document.getElementById("ext-col-picker-list");
  const searchEl = document.getElementById("ext-col-picker-search");
  if (listEl) {
    listEl.innerHTML = itemsBuildColPickerList(searchEl?.value || "");
    setTimeout(() => { if (listEl) listEl.scrollTop = 0; }, 10);
  }
  searchEl?.focus();
}

function itemsCloseColPicker() {
  const panel = document.getElementById("ext-col-picker-panel");
  if (!panel) return;
  panel.style.display = "none";
  _itemsColPickerSortedKeys = null;
  const searchEl = document.getElementById("ext-col-picker-search");
  if (searchEl) searchEl.value = "";
}

// Attaches pointer-based drag-and-drop reordering to the column picker list.
// Listeners live on the list element itself; when the picker panel re-renders
// the element is replaced, so no explicit teardown is required.
function itemsSetupColPickerDrag(pickerListEl) {
  let dragEl = null;
  let placeholder = null;
  let startY = 0;
  let startTop = 0;
  let itemsDragJustFinished = false;
  let autoScrollInterval = null;
  let lastClientY = 0;

  const stopAutoScroll = () => {
    if (autoScrollInterval) {
      cancelAnimationFrame(autoScrollInterval);
      autoScrollInterval = null;
    }
  };

  pickerListEl.addEventListener("click", e => {
    if (itemsDragJustFinished) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const addRow = e.target.closest("[data-col-add]");
    const toggleRow = e.target.closest("[data-col-toggle]");
    const baseCols = new Set(itemsGetCurrentBaseCols());
    if (addRow) {
      const key = addRow.dataset.colAdd;
      if (baseCols.has(key)) {
        itemsHiddenCols = itemsHiddenCols.filter(k => k !== key);
      } else if (!itemsCustomCols.includes(key)) {
        itemsCustomCols.push(key);
      }
    } else if (toggleRow) {
      const key = toggleRow.dataset.colToggle;
      if (itemsCustomCols.includes(key)) {
        itemsCustomCols = itemsCustomCols.filter(k => k !== key);
        itemsHiddenCols = itemsHiddenCols.filter(k => k !== key);
        delete itemsColFilters[key];
      } else if (baseCols.has(key)) {
        if (!itemsHiddenCols.includes(key)) itemsHiddenCols.push(key);
        delete itemsColFilters[key];
      }
    } else {
      return;
    }
    const searchEl = document.getElementById("ext-col-picker-search");
    pickerListEl.innerHTML = itemsBuildColPickerList(searchEl?.value || "");
    itemsRefreshColPickerBtn();
    itemsRefreshTable();
  });

  pickerListEl.addEventListener("pointerdown", e => {
    if (e.offsetX > pickerListEl.clientWidth) return;
    const item = e.target.closest(".ext-cpp-item--present, .ext-cpp-item--hidden");
    const key = item?.dataset.colToggle || item?.dataset.colAdd;
    if (!item || key === "name") return;
    if (e.button !== 0) return;

    dragEl = item;
    startY = e.clientY;
    lastClientY = e.clientY;
    item.setPointerCapture(e.pointerId);

    stopAutoScroll();
    const loop = () => {
      if (dragEl) {
        processDragMove(lastClientY);
        autoScrollInterval = requestAnimationFrame(loop);
      }
    };
    autoScrollInterval = requestAnimationFrame(loop);
  });

  const processDragMove = (clientY) => {
    if (!dragEl) return;
    const dy = clientY - startY;

    if (!placeholder) {
      if (Math.abs(dy) < 5) return;
      document.body.classList.add("ext-dragging");

      const rect = dragEl.getBoundingClientRect();
      placeholder = document.createElement("div");
      placeholder.className = dragEl.className + " ext-cpp-item--placeholder";
      placeholder.style.height = rect.height + "px";

      dragEl.parentNode.insertBefore(placeholder, dragEl);

      dragEl.style.position = "absolute";
      dragEl.style.zIndex = "1000";
      dragEl.style.width = rect.width + "px";
      const pRectInit = pickerListEl.getBoundingClientRect();
      dragEl.style.left = (rect.left - pRectInit.left) + "px";
      dragEl.style.background = "var(--background)";
      dragEl.style.borderTop = "1px solid var(--border)";
      dragEl.style.borderBottom = "1px solid var(--border)";
      dragEl.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
      dragEl.style.opacity = "1";
      dragEl.style.transition = "none";

      startTop = rect.top;
    }

    const pRect = pickerListEl.getBoundingClientRect();
    const dragH = dragEl.getBoundingClientRect().height;
    const allSortable = Array.from(pickerListEl.querySelectorAll(".ext-cpp-item--present, .ext-cpp-item--hidden"))
                         .filter(el => el !== dragEl);
    const lastSortableRect = allSortable[allSortable.length - 1].getBoundingClientRect();

    if (clientY < pRect.top + 25) {
      pickerListEl.scrollTop -= 10;
    } else if (clientY > pRect.bottom - 25 && lastSortableRect.bottom > pRect.bottom) {
      pickerListEl.scrollTop += 10;
    }

    const pointerOffsetY = startY - startTop;
    let relativeTop = clientY - pRect.top + pickerListEl.scrollTop - pointerOffsetY;

    // Calculate local internal coordinate bounds
    const nameItem = pickerListEl.querySelector(".ext-cpp-item--disabled");
    const localTopLimit = nameItem ? nameItem.offsetTop + nameItem.offsetHeight : 0;
    const lastItem = allSortable[allSortable.length - 1];
    const localBottomLimit = lastItem ? lastItem.offsetTop + lastItem.offsetHeight : pickerListEl.scrollHeight;

    const clampedTop = Math.max(localTopLimit, Math.min(localBottomLimit - dragH, relativeTop));
    dragEl.style.top = clampedTop + "px";

    const dragRect = dragEl.getBoundingClientRect();
    const dragCenter = dragRect.top + dragRect.height / 2;

    let insertBeforeNode = null;
    let found = false;

    const validItems = Array.from(pickerListEl.querySelectorAll(".ext-cpp-item--present, .ext-cpp-item--hidden"))
      .filter(el => el !== dragEl && el !== placeholder && el.dataset.colToggle !== "name" && el.dataset.colAdd !== "name");

    for (const el of validItems) {
      const isAbove = !!(placeholder.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
      const r = el.getBoundingClientRect();
      const overlapOffset = 8;

      if (isAbove) {
        if (dragCenter < r.bottom - overlapOffset) {
          insertBeforeNode = el;
          found = true;
          break;
        }
      } else {
        if (dragCenter < r.top + overlapOffset) {
          insertBeforeNode = el;
          found = true;
          break;
        }
      }
    }

    if (found) {
      insertBeforeNode.parentNode.insertBefore(placeholder, insertBeforeNode);
    } else if (validItems.length > 0) {
      const last = validItems[validItems.length - 1];
      last.parentNode.insertBefore(placeholder, last.nextSibling);
    }
  };

  pickerListEl.addEventListener("pointermove", e => {
    lastClientY = e.clientY;
  });

  pickerListEl.addEventListener("pointerup", e => {
    stopAutoScroll();
    document.body.classList.remove("ext-dragging");
    if (!dragEl) return;
    dragEl.releasePointerCapture(e.pointerId);
    if (placeholder) {
      placeholder.parentNode.insertBefore(dragEl, placeholder);
      placeholder.remove();
      placeholder = null;

      dragEl.style.position = "";
      dragEl.style.zIndex = "";
      dragEl.style.width = "";
      dragEl.style.top = "";
      dragEl.style.left = "";
      dragEl.style.background = "";
      dragEl.style.boxShadow = "";
      dragEl.style.borderTop = "";
      dragEl.style.borderBottom = "";
      dragEl.style.opacity = "";
      dragEl.style.transition = "";

      const newOrder = [];
      pickerListEl.querySelectorAll(".ext-cpp-item--present, .ext-cpp-item--hidden").forEach(row => {
        const key = row.dataset.colToggle || row.dataset.colAdd;
        if (key) newOrder.push(key);
      });
      itemsColOrder = newOrder;

      const handledSet = new Set(newOrder);
      handledSet.add("name");
      const other = _itemsColPickerSortedKeys.filter(k => !handledSet.has(k));
      _itemsColPickerSortedKeys = ["name", ...newOrder, ...other];

      itemsRefreshTable();

      itemsDragJustFinished = true;
      setTimeout(() => itemsDragJustFinished = false, 0);
    }
    dragEl = null;
  });
}
