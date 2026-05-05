// Column filter panel (the ⋮ menu that opens per column header).
// The panel itself is a single element appended to document.body and reused
// across all columns — opening it just rewrites its innerHTML and repositions it.
// Depends on: state.js (items*), config.js (ITEMS_ALL_COLUMNS, ARMOR_TYPE_NAMES,
//             TRINKET_TYPE_NAMES, WEAPON_TYPE_LABELS),
//             filters.js (itemsGetAllRaces, itemsGetAllMerchants, itemsGetAllProfessions,
//             itemsGetAllEnchantTags, itemsGetAllItemTypes, itemsGetAllWeaponClasses),
//             ui-table-refresh.js (itemsRefreshTable), common/icons.js (icon)

let _cfPanel = null;

function _itemsEnsureColFilterPanel() {
  if (_cfPanel) return _cfPanel;
  _cfPanel = document.getElementById("ext-col-filter-panel");
  if (_cfPanel) return _cfPanel;

  _cfPanel = document.createElement("div");
  _cfPanel.id = "ext-col-filter-panel";
  document.body.appendChild(_cfPanel);

  // Distinguish mousedown-inside-panel from click-outside so dragging an input
  // caret out of the panel doesn't close it when the user releases the mouse.
  let mousedownInside = false;
  _cfPanel.addEventListener("mousedown", () => { mousedownInside = true; });
  document.addEventListener("click", e => {
    if (mousedownInside) { mousedownInside = false; return; }
    if (!_cfPanel.contains(e.target) && !e.target.closest("[data-col-menu]")) {
      _cfPanel.style.display = "none";
      _cfPanel._activeKey    = null;
    }
  }, true);

  _cfPanel.addEventListener("click", e => {
    const sortBtn = e.target.closest("[data-sort-dir]");
    const sortClr = e.target.closest("[data-sort-clear]");
    const filtClr = e.target.closest("[data-filter-clear]");
    if (sortBtn) {
      itemsSortCol = sortBtn.dataset.sortCol;
      itemsSortDir = sortBtn.dataset.sortDir;
      _cfPanel.style.display = "none"; _cfPanel._activeKey = null;
      itemsRefreshTable();
    } else if (sortClr) {
      itemsSortCol = null; itemsSortDir = "asc";
      _cfPanel.style.display = "none"; _cfPanel._activeKey = null;
      itemsRefreshTable();
    } else if (filtClr) {
      delete itemsColFilters[_cfPanel._activeKey];
      if (_cfPanel._activeKey === "durability") itemsGladiatorVf = 0;
      if (_cfPanel._activeKey === "absorption") itemsGladiatorStr = 0;
      _cfPanel.style.display = "none"; _cfPanel._activeKey = null;
      itemsRefreshTable();
    }
  });

  _cfPanel.addEventListener("input", e => {
    const key = _cfPanel._activeKey;
    if (!key) return;
    const col = ITEMS_ALL_COLUMNS[key];
    if (!col || col.type === "race_select" || col.type === "merchant_select" || col.type === "profession_select" || col.type === "class_select" || col.type === "age_select") return;
    if (!itemsColFilters[key]) itemsColFilters[key] = {};
    if (key === "_damage_range") {
      itemsColFilters[key].avgMin = _cfPanel.querySelector(".ext-cfp-avg-min")?.value ?? "";
      itemsColFilters[key].avgMax = _cfPanel.querySelector(".ext-cfp-avg-max")?.value ?? "";
      itemsColFilters[key].botMin = _cfPanel.querySelector(".ext-cfp-bot-min")?.value ?? "";
      itemsColFilters[key].botMax = _cfPanel.querySelector(".ext-cfp-bot-max")?.value ?? "";
      itemsColFilters[key].topMin = _cfPanel.querySelector(".ext-cfp-top-min")?.value ?? "";
      itemsColFilters[key].topMax = _cfPanel.querySelector(".ext-cfp-top-max")?.value ?? "";
      if (!itemsColFilters[key].avgMin && !itemsColFilters[key].avgMax &&
          !itemsColFilters[key].botMin && !itemsColFilters[key].botMax &&
          !itemsColFilters[key].topMin && !itemsColFilters[key].topMax) {
        delete itemsColFilters[key];
      }
    } else if (col.type === "number") {
      itemsColFilters[key].min = _cfPanel.querySelector(".ext-cfp-min")?.value ?? "";
      itemsColFilters[key].max = _cfPanel.querySelector(".ext-cfp-max")?.value ?? "";
      if (!itemsColFilters[key].min && !itemsColFilters[key].max) delete itemsColFilters[key];
    } else if (col.type === "string") {
      itemsColFilters[key].text = e.target.value;
      if (!itemsColFilters[key].text) delete itemsColFilters[key];
    }
    itemsRefreshTable();
  });

  _cfPanel.addEventListener("change", e => {
    const key = _cfPanel._activeKey;
    if (!key) return;
    const col = ITEMS_ALL_COLUMNS[key];
    if (col?.type === "bool" && e.target.type === "radio") {
      if (e.target.value === "any") delete itemsColFilters[key];
      else itemsColFilters[key] = { boolVal: e.target.value === "yes" };
      itemsRefreshTable();
    } else if ((col?.type === "race_select" || col?.type === "merchant_select" || col?.type === "class_select" || col?.type === "age_select") && e.target.classList.contains("ext-cfp-race-opt")) {
      const fk = col.type === "race_select" ? "races" : col.type === "merchant_select" ? "merchants" : col.type === "age_select" ? "ages" : "classes";
      if (!itemsColFilters[key]) itemsColFilters[key] = {};
      if (!itemsColFilters[key][fk]) itemsColFilters[key][fk] = [];
      if (e.target.checked) {
        itemsColFilters[key][fk].push(e.target.value);
      } else {
        itemsColFilters[key][fk] = itemsColFilters[key][fk].filter(r => r !== e.target.value);
        if (!itemsColFilters[key][fk].length) delete itemsColFilters[key];
      }
      itemsRefreshTable();
    } else if ((col?.type === "tag_select" || col?.type === "item_type_select") && e.target.classList.contains("ext-cfp-race-opt")) {
      const fk = col.type === "tag_select" ? "enchant_tags" : "item_types";
      if (!itemsColFilters[key]) itemsColFilters[key] = {};
      if (!itemsColFilters[key][fk]) itemsColFilters[key][fk] = [];
      if (e.target.checked) {
        itemsColFilters[key][fk].push(e.target.value);
      } else {
        itemsColFilters[key][fk] = itemsColFilters[key][fk].filter(v => v !== e.target.value);
        if (!itemsColFilters[key][fk].length) delete itemsColFilters[key];
      }
      itemsRefreshTable();
    } else if (col?.type === "profession_select" && e.target.classList.contains("ext-cfp-prof-opt")) {
      if (e.target.value === "__none__") {
        if (!itemsColFilters[key]) itemsColFilters[key] = { professions: [] };
        if (!itemsColFilters[key].professions) itemsColFilters[key].professions = [];
        if (e.target.checked) {
          if (!itemsColFilters[key].professions.includes("__none__")) itemsColFilters[key].professions.push("__none__");
        } else {
          itemsColFilters[key].professions = itemsColFilters[key].professions.filter(p => p !== "__none__");
          if (!itemsColFilters[key].professions.length) delete itemsColFilters[key];
        }
      } else if (e.target.classList.contains("ext-cfp-prof-name")) {
        const profName = e.target.value;
        if (!itemsColFilters[key]) itemsColFilters[key] = { professions: [] };
        if (!itemsColFilters[key].professions) itemsColFilters[key].professions = [];
        if (e.target.checked) {
          itemsColFilters[key].professions = itemsColFilters[key].professions.filter(p => !p.startsWith(profName + "\t"));
          for (let lvl = 1; lvl <= 8; lvl++) itemsColFilters[key].professions.push(`${profName}\t${lvl}`);
          _cfPanel.querySelectorAll(`.ext-cfp-prof-lvl[value^="${profName}\t"]`).forEach(cb => cb.checked = true);
        } else {
          itemsColFilters[key].professions = itemsColFilters[key].professions.filter(p => !p.startsWith(profName + "\t"));
          _cfPanel.querySelectorAll(`.ext-cfp-prof-lvl[value^="${profName}\t"]`).forEach(cb => cb.checked = false);
          if (!itemsColFilters[key].professions.length) delete itemsColFilters[key];
        }
      } else if (e.target.classList.contains("ext-cfp-prof-lvl")) {
        const val      = e.target.value;
        const profName = val.split("\t")[0];
        if (!itemsColFilters[key]) itemsColFilters[key] = { professions: [] };
        if (!itemsColFilters[key].professions) itemsColFilters[key].professions = [];
        if (e.target.checked) {
          if (!itemsColFilters[key].professions.includes(val)) itemsColFilters[key].professions.push(val);
          _cfPanel.querySelectorAll(`.ext-cfp-prof-name[value="${profName}"]`).forEach(cb => cb.checked = true);
        } else {
          itemsColFilters[key].professions = itemsColFilters[key].professions.filter(p => p !== val);
          const profLevels = itemsColFilters[key].professions.filter(p => p.startsWith(profName + "\t"));
          if (!profLevels.length) _cfPanel.querySelectorAll(`.ext-cfp-prof-name[value="${profName}"]`).forEach(cb => cb.checked = false);
          if (!itemsColFilters[key].professions.length) delete itemsColFilters[key];
        }
      }
      itemsRefreshTable();
    }
  });

  return _cfPanel;
}

async function itemsOpenColFilterPanel(key, anchorEl) {
  const panel = _itemsEnsureColFilterPanel();

  if (key === "name") {
    itemsNameSearchOpen = !itemsNameSearchOpen;
    if (!itemsNameSearchOpen) itemsColFilters["name"] = {};
    panel.style.display = "none"; panel._activeKey = null;
    await itemsRefreshTable();
    if (itemsNameSearchOpen) {
      const inp = document.querySelector(".ext-th-inline-search");
      if (inp) inp.focus();
    }
    return;
  }
  if (panel._activeKey === key && panel.style.display !== "none") {
    panel.style.display = "none"; panel._activeKey = null; return;
  }
  panel._activeKey = key;
  const col = ITEMS_ALL_COLUMNS[key];
  const f   = itemsColFilters[key] || {};

  const colLabel = col?.label ?? key;
  let html = `<div class="ext-cfp-header">Filter – ${colLabel}</div>`;
  if (col) {
    html += `<div class="ext-cfp-sep"></div><div class="ext-cfp-filter-row">`;
    if (key === "_damage_range") {
      html += `<div style="display:flex;flex-direction:column;gap:2px;margin-top:2px;">
        <div><label style="font-size:10px;font-weight:600;display:block;opacity:0.8;margin-bottom:-4px;">Snittskada</label>
        <div class="ext-cfp-minmax-wrap"><input type="number" class="ext-cfp-input ext-cfp-min ext-cfp-avg-min" placeholder="Från" value="${f.avgMin ?? ""}">
        <input type="number" class="ext-cfp-input ext-cfp-max ext-cfp-avg-max" placeholder="Till" value="${f.avgMax ?? ""}"></div></div>

        <div><label style="font-size:10px;font-weight:600;display:block;opacity:0.8;margin-bottom:-4px;">Lägsta skada</label>
        <div class="ext-cfp-minmax-wrap"><input type="number" class="ext-cfp-input ext-cfp-min ext-cfp-bot-min" placeholder="Från" value="${f.botMin ?? ""}">
        <input type="number" class="ext-cfp-input ext-cfp-max ext-cfp-bot-max" placeholder="Till" value="${f.botMax ?? ""}"></div></div>

        <div><label style="font-size:10px;font-weight:600;display:block;opacity:0.8;margin-bottom:-4px;">Högsta skada</label>
        <div class="ext-cfp-minmax-wrap"><input type="number" class="ext-cfp-input ext-cfp-min ext-cfp-top-min" placeholder="Från" value="${f.topMin ?? ""}">
        <input type="number" class="ext-cfp-input ext-cfp-max ext-cfp-top-max" placeholder="Till" value="${f.topMax ?? ""}"></div></div>
      </div>`;
    } else if (col.type === "number") {
      html += `<div class="ext-cfp-minmax-wrap">
        <input type="number" class="ext-cfp-input ext-cfp-min" placeholder="Min" value="${f.min ?? ""}">
        <input type="number" class="ext-cfp-input ext-cfp-max" placeholder="Max" value="${f.max ?? ""}">
      </div>`;
    } else if (col.type === "string") {
      html += `<input type="text" class="ext-cfp-input ext-cfp-text" placeholder="Sök..." value="${f.text ?? ""}" style="margin-top:3px;display:block">`;
    } else if (col.type === "bool") {
      const v = f.boolVal == null ? "any" : (f.boolVal ? "yes" : "no");
      const falseLabel = col.filterLabels?.falseLabel ?? "Nej";
      const trueLabel  = col.filterLabels?.trueLabel  ?? "Ja";
      html += `<div class="ext-cfp-bool" style="margin-top:4px">
        <label><input type="radio" name="ext-cfp-bool-${key}" value="any" ${v==="any"?"checked":""}> Alla</label>
        ${col.filterLabels?.falseFirst
          ? `<label><input type="radio" name="ext-cfp-bool-${key}" value="no"  ${v==="no" ?"checked":""}> ${falseLabel}</label>
        <label><input type="radio" name="ext-cfp-bool-${key}" value="yes" ${v==="yes"?"checked":""}> ${trueLabel}</label>`
          : `<label><input type="radio" name="ext-cfp-bool-${key}" value="yes" ${v==="yes"?"checked":""}> ${trueLabel}</label>
        <label><input type="radio" name="ext-cfp-bool-${key}" value="no"  ${v==="no" ?"checked":""}> ${falseLabel}</label>`}
      </div>`;
    } else if (col.type === "race_select") {
      const races    = itemsGetAllRaces(itemsCurrentViewItems);
      const selected = f.races || [];
      html += `<div class="ext-cfp-race-list">
        <label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="__none__" ${selected.includes("__none__")?"checked":""}> –</label>
        ${races.map(r => `<label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="${r}" ${selected.includes(r)?"checked":""}> ${r.charAt(0).toUpperCase() + r.slice(1)}</label>`).join("")}
      </div>`;
    } else if (col.type === "merchant_select") {
      const merchants = itemsGetAllMerchants(itemsCurrentViewItems);
      const selected  = f.merchants || [];
      html += `<div class="ext-cfp-race-list">
        <label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="__none__" ${selected.includes("__none__")?"checked":""}> –</label>
        ${merchants.map(m => `<label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="${m}" ${selected.includes(m)?"checked":""}> ${m}</label>`).join("")}
      </div>`;
    } else if (col.type === "class_select") {
      const classes  = itemsGetAllWeaponClasses(itemsCurrentViewItems);
      const selected = f.classes || [];
      html += `<div class="ext-cfp-race-list">
        ${classes.map(c => `<label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="${c}" ${selected.includes(c)?"checked":""}> ${c}</label>`).join("")}
      </div>`;
    } else if (col.type === "profession_select") {
      const professions = itemsGetAllProfessions(itemsCurrentViewItems);
      const selected    = f.professions || [];
      const noneChecked = selected.includes("__none__");
      html += `<div class="ext-cfp-race-list">
        <label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-prof-opt" value="__none__" ${noneChecked?"checked":""}> –</label>
        ${professions.map(prof => {
          const profChecked = selected.some(p => p.startsWith(prof + "\t"));
          const activeLevels = selected.filter(p => p.startsWith(prof + "\t")).map(p => Number(p.split("\t")[1]));
          const levelsHtml = Array.from({length: 8}, (_, i) => {
            const lvl = i + 1;
            const val = `${prof}\t${lvl}`;
            const checked = activeLevels.includes(lvl) ? "checked" : "";
            return `<label class="ext-cfp-race-item ext-cfp-prof-level-item"><input type="checkbox" class="ext-cfp-prof-opt ext-cfp-prof-lvl" value="${val}" ${checked}> Nivå ${lvl}</label>`;
          }).join("");
          return `<label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-prof-opt ext-cfp-prof-name" value="${prof}" ${profChecked?"checked":""}> ${prof}</label>` +
            `<div class="ext-cfp-prof-levels" data-prof="${prof}">${levelsHtml}</div>`;
        }).join("")}
      </div>`;
    } else if (col.type === "tag_select") {
      const tags     = itemsGetAllEnchantTags(itemsCurrentViewItems);
      const selected = f.enchant_tags || [];
      html += `<div class="ext-cfp-race-list">
        <label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="__none__" ${selected.includes("__none__")?"checked":""}> –</label>
        ${tags.map(t => `<label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="${t}" ${selected.includes(t)?"checked":""}> ${t}</label>`).join("")}
      </div>`;
    } else if (col.type === "item_type_select") {
      const types    = itemsGetAllItemTypes(itemsCurrentViewItems);
      const selected = f.item_types || [];
      html += `<div class="ext-cfp-race-list">
        ${types.map(t => {
          const label = ARMOR_TYPE_NAMES[t] || TRINKET_TYPE_NAMES[t] || WEAPON_TYPE_LABELS[t] || t;
          return `<label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="${t}" ${selected.includes(t)?"checked":""}> ${label}</label>`;
        }).join("")}
      </div>`;
    } else if (col.type === "age_select") {
      const ages     = itemsGetAllAges(itemsCurrentViewItems);
      const selected = f.ages || [];
      html += `<div class="ext-cfp-race-list">
        <label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="__none__" ${selected.includes("__none__")?"checked":""}> –</label>
        ${ages.map(a => `<label class="ext-cfp-race-item"><input type="checkbox" class="ext-cfp-race-opt" value="${a}" ${selected.includes(a)?"checked":""}> ${ITEMS_AGE_LABELS[a] || a}</label>`).join("")}
      </div>`;
    }
    html += `</div>`;
  }

  if (key === "durability") {
    html += `<div class="ext-cfp-sep"></div>
      <div class="ext-cfp-filter-row">
        <div class="ext-cfp-minmax-wrap">
          <input id="ext-cfp-sim-vf" type="number" min="0" class="ext-cfp-input" placeholder="VF" value="${itemsGladiatorVf || ""}" style="width:72px">
        </div>
      </div>`;
  }
  if (key === "absorption") {
    html += `<div class="ext-cfp-sep"></div>
      <div class="ext-cfp-filter-row">
        <div class="ext-cfp-minmax-wrap">
          <input id="ext-cfp-sim-str" type="number" min="0" class="ext-cfp-input" placeholder="Styrka" value="${itemsGladiatorStr || ""}" style="width:72px">
        </div>
      </div>`;
  }

  html += `<div class="ext-cfp-sep"></div><button class="ext-cfp-clear-btn" data-filter-clear>${icon("x", { size: 9, strokeWidth: 2.5, style: "pointer-events:none;flex-shrink:0;position:relative;top:0.5px" })}<span>Rensa filter</span></button>`;

  panel.innerHTML = html;
  const rect = (anchorEl.closest("th") ?? anchorEl).getBoundingClientRect();
  panel.style.display = "block";
  panel.style.minWidth = rect.width + "px";
  panel.style.top  = (rect.bottom + 4) + "px";
  panel.style.left = Math.min(rect.left, window.innerWidth - 210) + "px";
  panel.querySelector("input[type=text]")?.focus();

  panel.querySelector("#ext-cfp-sim-vf")?.addEventListener("input", e => {
    itemsGladiatorVf = parseInt(e.target.value) || 0;
    itemsRefreshTable();
  });
  panel.querySelector("#ext-cfp-sim-str")?.addEventListener("input", e => {
    itemsGladiatorStr = parseInt(e.target.value) || 0;
    itemsRefreshTable();
  });
}
