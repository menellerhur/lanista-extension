// Reusable custom dropdown with search field for Planera Gladiator.
// Renders inline HTML and handles its own events.

// Builds the dropdown HTML string.
// opts: { id, value, items, placeholder, noneLabel, showSearch, disabled }
// items: [{ value, label, meta }]  (meta = small secondary text shown right-aligned)
function pgDropdownHtml(opts) {
  let { id, value, items = [], placeholder = "Välj...", noneLabel = "— Inget —", showSearch = true, disabled = false, invalid = false } = opts;

  if (items.length === 0) {
    disabled = true;
    placeholder = "";
    noneLabel = false;
  }

  const current = value != null ? items.find(i => String(i.value) === String(value)) : null;
  const btnLabel = current ? current.label : (noneLabel || placeholder);

  const searchHtml = showSearch ? `
    <div class="pg-dd-search-wrap">
      <input type="text" class="pg-dd-search" placeholder="Sök..." autocomplete="off" data-pg-dd-search="${id}">
    </div>` : "";

  const disabledAttr = disabled ? " disabled" : "";
  const disabledClass = disabled ? " pg-dd-disabled" : "";
  const invalidClass = invalid ? " pg-dd-invalid" : "";

  return `
    <div class="pg-dropdown${disabledClass}${invalidClass}" data-pg-dd="${id}">
      <button type="button" class="pg-dd-btn" data-pg-dd-toggle="${id}"${disabledAttr}>
        <span class="pg-dd-label">${pgEscape(btnLabel)}</span>
        <span class="pg-dd-arrow">▾</span>
      </button>
      <div class="pg-dd-panel" id="pg-dd-panel-${id}" hidden>
        ${searchHtml}
        <div class="pg-dd-list" data-pg-dd-list="${id}">
          ${pgDropdownListHtml(id, items, value, noneLabel)}
        </div>
      </div>
    </div>`;
}

function pgDropdownListHtml(id, items, currentValue, noneLabel) {
  let html = "";
  if (noneLabel !== false) {
    const sel = currentValue == null ? " pg-dd-selected" : "";
    html += `<button type="button" class="pg-dd-item${sel}" data-pg-dd-opt="${id}" data-pg-dd-val="">
      <span>${pgEscape(noneLabel || "— Inget —")}</span>
    </button>`;
  }
  for (const item of items) {
    const isSelected = String(item.value ?? "") === String(currentValue ?? "");
    const selectedClass = isSelected ? " pg-dd-selected" : "";
    const disabledClass = item.disabled ? " pg-dd-item--disabled" : "";
    const disabledAttr = item.disabled ? " disabled" : "";
    const metaClass = item.metaClass ? ` ${item.metaClass}` : "";
    // metaHtml allows pre-rendered HTML (e.g. multiple icons); meta is plain text and gets escaped.
    const metaInner = item.metaHtml != null ? item.metaHtml : (item.meta ? pgEscape(item.meta) : "");
    const meta = metaInner ? `<span class="pg-dd-meta${metaClass}">${metaInner}</span>` : "";

    html += `
      <button type="button" class="pg-dd-item ${selectedClass}${disabledClass}"
        data-pg-dd-opt="${id}" data-pg-dd-val="${pgEscape(String(item.value ?? ""))}"${disabledAttr}>
        <span class="pg-dd-label">${pgEscape(item.label)}</span>
        ${meta}
      </button>`;
  }
  return html;
}

function pgEscape(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Registers a dropdown change listener on a container.
// callback(value) is called when user selects an option.
// Pass null value for "none".
function pgDropdownBind(container, id, callback) {
  // Clean up previous listeners for this specific ID on this container to prevent stacking
  if (!container._pgDdHandlers) container._pgDdHandlers = {};
  if (container._pgDdHandlers[id]) {
    container.removeEventListener("click", container._pgDdHandlers[id].click);
    container.removeEventListener("input", container._pgDdHandlers[id].input);
  }

  const clickHandler = e => {
    const toggleBtn = e.target.closest(`[data-pg-dd-toggle="${id}"]`);
    if (toggleBtn) {
      e.stopPropagation();
      pgDropdownToggle(container, id);
      return;
    }
    // Option selected
    const opt = e.target.closest(`[data-pg-dd-opt="${id}"]`);
    if (opt) {
      if (opt.disabled || opt.classList.contains("pg-dd-item--disabled")) return;
      const val = opt.dataset.pgDdVal;
      pgDropdownClose(container, id);
      callback(val === "" ? null : isNaN(val) ? val : Number(val));
      return;
    }
  };

  const inputHandler = e => {
    const search = e.target.closest(`[data-pg-dd-search="${id}"]`);
    if (!search) return;
    const q = search.value.toLowerCase();
    const list = container.querySelector(`[data-pg-dd-list="${id}"]`);
    if (!list) return;
    list.querySelectorAll(`[data-pg-dd-opt="${id}"]`).forEach(btn => {
      const text = btn.textContent.toLowerCase();
      btn.style.display = text.includes(q) ? "" : "none";
    });
  };

  container.addEventListener("click", clickHandler);
  container.addEventListener("input", inputHandler);

  container._pgDdHandlers[id] = { click: clickHandler, input: inputHandler };
}

function pgDropdownToggle(container, id) {
  const panel = container.querySelector(`#pg-dd-panel-${id}`);
  if (!panel) return;
  if (panel.hidden) {
    pgCloseAllDropdowns();
    panel.hidden = false;
    const search = panel.querySelector(`[data-pg-dd-search="${id}"]`);
    if (search) {
      search.value = "";
      // Reset filter
      panel.querySelectorAll(`[data-pg-dd-opt="${id}"]`).forEach(btn => btn.style.display = "");
    } else {
      // Even if no search, reset filter just in case
      panel.querySelectorAll(`[data-pg-dd-opt="${id}"]`).forEach(btn => btn.style.display = "");
    }

    setTimeout(() => {
      if (search) search.focus();

      // Scroll to selected item
      const list = panel.querySelector(`[data-pg-dd-list="${id}"]`);
      if (list) {
        const selected = list.querySelector(".pg-dd-selected");
        if (selected) {
          // Subtracting the list's padding (4px) ensures the item is flush with the top.
          list.scrollTop = selected.offsetTop - 4;
        }
      }
    }, 10);
  } else {
    panel.hidden = true;
  }
}

function pgDropdownClose(container, id) {
  const panel = container.querySelector(`#pg-dd-panel-${id}`);
  if (panel) panel.hidden = true;
  if (typeof itemTooltipHide === "function") itemTooltipHide();
}

function pgCloseAllDropdowns() {
  document.querySelectorAll(".pg-dd-panel").forEach(p => { p.hidden = true; });
  if (typeof itemTooltipHide === "function") itemTooltipHide();
}

// Update the visual state (label and selection markers) of an already-rendered dropdown
function pgDropdownSetValue(container, id, value, label) {
  const labelEl = container.querySelector(`[data-pg-dd-toggle="${id}"] .pg-dd-label`);
  if (labelEl) labelEl.textContent = label;

  const list = container.querySelector(`[data-pg-dd-list="${id}"]`);
  if (list) {
    list.querySelectorAll(`[data-pg-dd-opt="${id}"]`).forEach(btn => {
      const isSelected = String(btn.dataset.pgDdVal) === String(value ?? "");
      btn.classList.toggle("pg-dd-selected", isSelected);
    });
  }
}

// Update the meta text (e.g. warning icon) of a specific dropdown item.
// Pass `metaHtml` for raw HTML (e.g. multiple stacked icons); pass `meta` for plain text.
function pgDropdownSetItemMeta(container, id, value, meta, className, metaHtml) {
  const list = container.querySelector(`[data-pg-dd-list="${id}"]`);
  if (!list) return;

  const opt = list.querySelector(`[data-pg-dd-opt="${id}"][data-pg-dd-val="${pgEscape(String(value ?? ""))}"]`);
  if (!opt) return;

  let metaEl = opt.querySelector(".pg-dd-meta");
  const hasContent = metaHtml != null ? metaHtml !== "" : !!meta;

  if (hasContent) {
    if (!metaEl) {
      metaEl = document.createElement("span");
      opt.appendChild(metaEl);
    }
    metaEl.className = "pg-dd-meta" + (className ? " " + className : "");
    if (metaHtml != null) {
      metaEl.innerHTML = metaHtml;
    } else {
      metaEl.textContent = meta;
    }
  } else if (metaEl) {
    metaEl.remove();
  }
}

// Close all dropdowns when clicking outside
document.addEventListener("click", e => {
  if (!e.target.closest(".pg-dropdown")) pgCloseAllDropdowns();
}, true);
