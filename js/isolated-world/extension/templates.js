// Pure HTML builders for the settings panel — one function per setting type.
// Each returns only the HTML for its own element; open/close of accumulator
// containers (card, nested-container) is owned by page-builder.js.
// Depends on: settings.js (SETTINGS), icons.js (icon),
//             extension/page.js (ICON_SHOW/HIDE/AUTO, TOGGLE_ACTIVE_COLORS)

function buildHeaderCardOpenHtml(s) {
  return `
    <div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-0 border border-border shadow-xl surface-card relative rounded-xl p-4 lg:p-5 mb-4">
      <h2 class="block font-serif uppercase text-foreground leading-tight">${s.label}</h2>
      <div class="mt-3">
        <div class="ext-settings-group">
  `;
}

function buildToggleGroupHtml(s, settings) {
  const currentVal = settings[s.key];
  const isDarkSet = document.documentElement.classList.contains("dark");
  const mode = isDarkSet ? "dark" : "light";
  const bgActive = isDarkSet ? "#27272a" : "#ffffff";
  const trayBg = isDarkSet ? "#1a1410" : "#f5ede093";
  const trayShadow = isDarkSet
    ? "inset 0 1px 3px rgba(0,0,0,0.25),inset 0 -1px 1px rgba(255,255,255,0.04)"
    : "inset 0 1px 3px rgba(0,0,0,0.09),inset 0 -1px 2px rgba(255,255,255,0.35)";

  const buttons = s.options.map(o => {
    const isActive = currentVal === o.v;
    let iconHtml = ICON_SHOW;
    if (o.v === "hide") iconHtml = ICON_HIDE;
    if (o.v === "auto") iconHtml = ICON_AUTO;
    const inlineStyle = isActive
      ? `background-color:${bgActive};box-shadow:0 1px 3px rgba(0,0,0,0.12);color:${TOGGLE_ACTIVE_COLORS[mode][o.v] || ""};`
      : "background-color:transparent;box-shadow:none;";
    return `<button type="button" data-ext-toggle="${s.key}" data-v="${o.v}" style="${inlineStyle}" class="ext-toggle-btn${isActive ? " active" : ""}" title="${o.l}">${iconHtml}</button>`;
  }).join("");

  return `
    <div class="ext-toggle-group-row py-1 w-fit">
      <label class="text-sm font-medium text-foreground/80 leading-none py-0.5">${s.label}</label>
      <div class="inline-flex rounded-lg w-fit" style="background-color:${trayBg} !important;box-shadow:${trayShadow};padding:2px;gap:1px;">
        <input type="hidden" id="setting-${s.key}" value="${currentVal}">
        ${buttons}
      </div>
    </div>
  `;
}

function buildMultiselectHtml(s, settings) {
  const isExpanded = settings[s.parentKey];
  const isExtEnabled = settings["extension-enabled"];
  const parentEnabled = isExtEnabled && isExpanded;
  const children = SETTINGS.filter(c => (c.type === "multiselect-child" || c.type === "toggle-group") && c.parentKey === s.parentKey);
  const isLinks = s.parentKey.includes("collapse");
  const unit = isLinks ? "länkar" : "valda";
  const checkedCount = children.filter(c => {
    if (c.type === "toggle-group") return settings[c.key] !== "show";
    return settings[c.key];
  }).length;
  const summaryText = checkedCount === 0
    ? `Inga ${unit}`
    : checkedCount === children.length
      ? `Alla ${unit}`
      : `${checkedCount} av ${children.length} ${unit}`;

  const checkItems = children.map(c => {
    if (c.type === "toggle-group") {
      const currentVal = settings[c.key] || c.default;
      let iconHtml = ICON_SHOW;
      if (currentVal === "hide") iconHtml = ICON_HIDE;
      if (currentVal === "auto") iconHtml = ICON_AUTO;
      const colorClass = currentVal === "show" ? "text-foreground/30 opacity-60" : "text-primary opacity-90";
      return `<button type="button" data-ext-toggle-cycle="${c.key}" data-v="${currentVal}" class="flex w-full items-center px-2 py-1 text-xs rounded-sm cursor-pointer text-left ext-dropdown-hover transition-colors">
        <input type="hidden" id="setting-${c.key}" value="${currentVal}">
        <span style="padding-right: 5px;">${c.label}</span>
        <div class="ext-cycle-icon ml-auto shrink-0 flex items-center justify-center ${colorClass}">${iconHtml}</div>
      </button>`;
    } else {
      const isChecked = settings[c.key] ? true : false;
      const checkIcon = icon("check", { size: 14, strokeWidth: 1.5, class: `check-icon ml-auto shrink-0 transition-opacity ${isChecked ? 'opacity-100' : 'opacity-0'}` });
      return `<button type="button" data-ext-ms-child="${c.key}" data-checked="${isChecked}" class="flex w-full items-center px-2 py-1 text-xs rounded-sm cursor-pointer text-left ext-dropdown-hover transition-colors"><span style="padding-right: 5px;">${c.label}</span>${checkIcon}</button>`;
    }
  }).join("");
  const msId = `ext-ms-${s.parentKey}`;
  return `
    <div id="sub-container-${s.parentKey}" class="ext-nested-container${isExpanded ? " expanded" : ""}">
      <div class="ext-sub-content">
        <div class="ext-sub-item">
          <div class="relative">
            <button type="button" id="${msId}-btn" class="inline-flex items-center justify-between gap-1.5 rounded-md border border-input bg-white dark:bg-card px-2 text-xs shadow-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-foreground/80 font-medium min-w-[160px]" style="height: 26px !important;" ${parentEnabled ? "" : "disabled"}
              data-ext-ms="${s.parentKey}" aria-expanded="false">
              <span id="${msId}-summary">${summaryText}</span>
              ${icon("chevron-down", { size: 12, ariaHidden: true })}
            </button>
            <div id="${msId}-panel" class="ext-select-panel min-w-[180px]" hidden>
              <div class="ext-multiselect-header">${s.placeholder}</div>
              ${checkItems}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildSelectInnerHtml(s, settings) {
  const parentDisabled = s.parentKey && !settings[s.parentKey];
  const currentVal = settings[s.key];
  const currentLabel = s.options.find(o => o.value === currentVal)?.label ?? currentVal;
  const optionBtns = s.options.map(o => {
    const isSelected = currentVal === o.value;
    const checkIcon = icon("check", { size: 14, strokeWidth: 1.5, class: `check-icon ml-auto shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}` });
    return `<button type="button" data-ext-option="${o.value}" class="flex w-full items-center px-2 py-1 text-xs rounded-sm cursor-pointer text-left ext-dropdown-hover transition-colors"><span style="padding-right: 5px;">${o.label}</span>${checkIcon}</button>`;
  }).join("");

  return `
    <input type="hidden" id="setting-${s.key}" value="${currentVal}">
    <div class="relative flex items-center gap-3">
      <button type="button" id="setting-${s.key}-btn" data-ext-select="${s.key}"
        class="inline-flex items-center justify-between gap-1.5 rounded-md border border-input bg-white dark:bg-card px-2 text-xs shadow-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-foreground/80 font-medium"
        style="height: 26px !important;"
        ${parentDisabled ? "disabled" : ""}>
        <span id="setting-${s.key}-lbl">${currentLabel}</span>
        ${icon("chevron-down", { size: 12, ariaHidden: true })}
      </button>
      <div id="setting-${s.key}-panel" class="ext-select-panel min-w-full" hidden>
        ${optionBtns}
      </div>
    </div>
  `;
}

function buildSubsectionLabelHtml(s) {
  return `<div class="ext-sub-section-label">${s.label}</div>`;
}

function buildCheckboxHtml(s, settings, parentKeys) {
  const chevronHtml = parentKeys.has(s.key)
    ? icon("chevron-right", { size: 10, strokeWidth: 2.5, id: `ext-chevron-${s.key}`, class: `ext-chevron${settings[s.key] ? " expanded" : ""}`, ariaHidden: true })
    : "";
  return `
    <label class="flex items-center gap-2 cursor-pointer mt-0.5 w-fit">
      <input type="checkbox" id="setting-${s.key}" class="ext-checkbox appearance-none border border-border bg-white dark:bg-card size-4 shrink-0 rounded-[4px] shadow-xs transition-shadow outline-none cursor-pointer relative disabled:opacity-50" ${settings[s.key] ? "checked" : ""}>
      <span class="text-sm font-medium text-foreground/80 py-0.5">${s.label}</span>
      ${chevronHtml}
    </label>
  `;
}

function buildRadioHtmlArray(s, settings) {
  const currentVal = settings[s.key] || s.default;
  const parentDisabled = s.parentKey && !settings[s.parentKey];

  return s.options.map((o, idx) => {
    const isChecked = currentVal === o.value;
    const hiddenInput = idx === 0 ? `<input type="hidden" id="setting-${s.key}" value="${currentVal}">` : "";
    return `
      ${hiddenInput}
      <label class="flex items-center gap-2 cursor-pointer mt-0.5 w-fit">
        <input type="radio" name="setting-${s.key}-radio" data-ext-radio="${s.key}" value="${o.value}" class="ext-radio appearance-none border border-border bg-white dark:bg-card size-4 shrink-0 rounded-full shadow-xs transition-shadow outline-none cursor-pointer relative disabled:opacity-50" ${isChecked ? "checked" : ""} ${parentDisabled ? "disabled" : ""}>
        <span class="text-sm font-medium text-foreground/80 py-0.5">${o.label}</span>
      </label>
    `;
  });
}

function buildExtEnabledNestedHtml(settings) {
  const dis = settings["extension-enabled"] ? "" : " disabled";
  const isExpanded = settings["extension-enabled"] ? " expanded" : "";
  const btnClass = `ext-btn-action inline-flex items-center px-3 rounded-md border border-input bg-background text-xs font-medium text-foreground/80 shadow-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style="height:21px;padding-top:1px`;
  return `
    <div id="sub-container-extension-enabled" class="ext-nested-container${isExpanded}">
      <div class="ext-sub-content">
        <div class="ext-sub-item flex gap-2">
          <button type="button" id="ext-btn-enable-all" class="${btnClass}"${dis}>Aktivera alla inställningar</button>
          <button type="button" id="ext-btn-disable-all" class="${btnClass}"${dis}>Inaktivera alla inställningar</button>
        </div>
      </div>
    </div>
  `;
}
