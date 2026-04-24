// Subcategory tab bar and weapon-subview dropdown list builders.
// Depends on: constants.js (EXT_TAB_TRIGGER_CLASS),
//             state.js (itemsCurrentSubcat, itemsCurrentViewKey, itemsWeaponSubview,
//                       itemsCustomViews, itemsViewNamingMode),
//             table-refresh.js (itemsRefreshTable)

function itemsBuildSubcatButtons(buttons) {
  const activeKey = itemsCurrentSubcat ?? "__all__";
  return buttons.map(b =>
    `<button class="${EXT_TAB_TRIGGER_CLASS}" data-state="${b.key === activeKey ? "active" : "inactive"}" data-items-subcat="${b.key}">${b.label}</button>`
  ).join("");
}

function itemsBuildSubviewList() {
  const baseViews = (itemsCurrentViewKey === "weapon")
    ? [
        { key: "standard", label: "Standard" },
        { key: "parera",   label: "Parera" },
        { key: "skada",    label: "Skada" }
      ]
    : [
        { key: "standard", label: "Standard" }
      ];

  const customViews = itemsCustomViews.filter(cv => cv.parentViewKey === itemsCurrentViewKey);

  const baseHtml = baseViews.map(v => {
    const isSelected = itemsWeaponSubview === v.key;
    return `<div class="ext-cpp-item ext-cpp-item-subview rounded-sm" data-subview="${v.key}">
      <span class="ext-cpp-check">${isSelected ? "✓" : ""}</span>
      <span class="ext-cpp-label">${v.label}</span>
    </div>`;
  }).join("");

  const customHtml = customViews.map(v => {
    const isSelected = itemsWeaponSubview === v.id;
    return `<div class="ext-cpp-item ext-cpp-item-subview rounded-sm" data-subview="${v.id}">
      <span class="ext-cpp-check">${isSelected ? "✓" : ""}</span>
      <span class="ext-cpp-label">${v.name}</span>
      <span class="ext-cpp-delete" data-subview-delete="${v.id}" title="Ta bort vy">✕</span>
    </div>`;
  }).join("");

  const separator = customViews.length ? `<div class="h-px bg-border my-1 mx-1 opacity-50"></div>` : "";

  let footerHtml = `<div class="h-px bg-border my-1 mx-1 opacity-50"></div>`;
  if (itemsViewNamingMode) {
    footerHtml += `
      <div class="ext-cpp-naming-panel">
        <input id="ext-items-new-view-name" class="ext-cpp-naming-input" autofocus autocomplete="off" maxlength="20">
        <div class="ext-cpp-naming-btns">
          <button id="ext-items-save-view-confirm" class="ext-cpp-naming-btn ext-cpp-naming-btn--save">Spara</button>
          <button id="ext-items-save-view-cancel" class="ext-cpp-naming-btn">Avbryt</button>
        </div>
      </div>
    `;
  } else {
    footerHtml += `
      <div class="ext-cpp-item ext-cpp-item-save-view rounded-sm flex items-center justify-center p-0" style="height:22px" id="ext-items-save-view-btn" title="Spara som ny vy">
        <span class="text-lg leading-none opacity-60">+</span>
      </div>
    `;
  }

  return baseHtml + separator + customHtml + footerHtml;
}

function itemsBindSubcatButtons(el) {
  el.querySelectorAll("[data-items-subcat]").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.itemsSubcat;
      itemsCurrentSubcat = val === "__all__" ? null : val;
      el.querySelectorAll("[data-items-subcat]").forEach(b => {
        b.dataset.state = b.dataset.itemsSubcat === (itemsCurrentSubcat ?? "__all__") ? "active" : "inactive";
      });
      itemsRefreshTable();
    });
  });
}
