// Assembles the full settings-panel HTML string by iterating SETTINGS and
// delegating per-type rendering to templates.js. Owns accumulator state
// (card open, nested-container open) so templates can stay pure.
// Depends on: settings.js (SETTINGS), extension/templates.js (build*Html)

function buildSettingsHtml(settings, parentKeys) {
  let html = "";
  let inCoolDownSection = false;
  let inSettingsGroup = false;
  let inSimpleNestedGroup = null;

  for (const s of SETTINGS) {
    if (s.type === "header") {
      if (inCoolDownSection) { html += `</div></div>`; inCoolDownSection = false; }
      if (inSimpleNestedGroup !== null) { html += `</div></div>`; inSimpleNestedGroup = null; }
      if (inSettingsGroup) { html += `</div></div></div>`; }
      html += buildHeaderCardOpenHtml(s);
      inSettingsGroup = true;
      continue;
    }

    if (s.type === "toggle-group") {
      const parentIsMultiselect = SETTINGS.some(p => p.type === "multiselect" && p.parentKey === s.parentKey);
      if (parentIsMultiselect) continue;
      if (inCoolDownSection) { html += `</div></div>`; inCoolDownSection = false; }
      if (inSimpleNestedGroup !== null) { html += `</div></div>`; inSimpleNestedGroup = null; }
      html += buildToggleGroupHtml(s, settings);
      continue;
    }

    if (s.type === "multiselect") {
      if (inCoolDownSection) { html += `</div></div>`; inCoolDownSection = false; }
      if (inSimpleNestedGroup !== null) { html += `</div></div>`; inSimpleNestedGroup = null; }
      html += buildMultiselectHtml(s, settings);
      continue;
    }

    // multiselect-child entries are rendered inside the multiselect block above
    if (s.type === "multiselect-child") continue;

    if (s.type === "subsection-label") {
      if (inCoolDownSection) { html += `</div></div>`; inCoolDownSection = false; }
      if (inSimpleNestedGroup !== s.parentKey) {
        if (inSimpleNestedGroup !== null) html += `</div></div>`;
        const isExpanded = settings[s.parentKey] ? " expanded" : "";
        html += `<div id="sub-container-${s.parentKey}" class="ext-nested-container${isExpanded}"><div class="ext-sub-content">`;
        inSimpleNestedGroup = s.parentKey;
      }
      html += buildSubsectionLabelHtml(s);
      continue;
    }

    if (s.type === "select") {
      if (inCoolDownSection) { html += `</div></div>`; inCoolDownSection = false; }
      const innerContent = buildSelectInnerHtml(s, settings);
      if (s.parentKey) {
        if (inSimpleNestedGroup !== s.parentKey) {
          if (inSimpleNestedGroup !== null) html += `</div></div>`;
          const isExpanded = settings[s.parentKey] ? " expanded" : "";
          html += `<div id="sub-container-${s.parentKey}" class="ext-nested-container${isExpanded}"><div class="ext-sub-content">`;
          inSimpleNestedGroup = s.parentKey;
        }
        html += `<div class="ext-sub-item">${innerContent}</div>`;
      } else {
        if (inSimpleNestedGroup !== null) { html += `</div></div>`; inSimpleNestedGroup = null; }
        html += `<div class="ext-select-standalone py-1">${innerContent}</div>`;
      }
      continue;
    }

    // Default: checkbox
    if (inCoolDownSection) { html += `</div></div>`; inCoolDownSection = false; }
    const isIndented = s.parentKey && s.parentKey !== "hide-cooldowns-master";
    const checkboxEl = buildCheckboxHtml(s, settings, parentKeys);
    if (isIndented) {
      if (inSimpleNestedGroup !== s.parentKey) {
        if (inSimpleNestedGroup !== null) html += `</div></div>`;
        const isExpanded = settings[s.parentKey] ? " expanded" : "";
        html += `<div id="sub-container-${s.parentKey}" class="ext-nested-container${isExpanded}"><div class="ext-sub-content">`;
        inSimpleNestedGroup = s.parentKey;
      }
      html += `<div class="ext-sub-item">${checkboxEl}</div>`;
    } else {
      if (inSimpleNestedGroup !== null) { html += `</div></div>`; inSimpleNestedGroup = null; }
      html += checkboxEl;
      if (s.key === "extension-enabled") {
        html += buildExtEnabledNestedHtml(settings);
      }
    }
  }

  if (inCoolDownSection) { html += `</div></div>`; }
  if (inSimpleNestedGroup !== null) { html += `</div></div>`; }
  if (inSettingsGroup) { html += `</div></div></div>`; }

  return html;
}
