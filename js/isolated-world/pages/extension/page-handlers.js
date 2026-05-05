// Event wiring for the settings panel: select dropdowns, multiselect panels,
// toggle groups, cycle-toggle, per-setting change listeners, enable/disable-all
// buttons, and the document-level click handler that closes open dropdowns.
// _extCloseOpenDropdowns is bound once at module scope to prevent listener
// accumulation when the settings panel is opened and closed repeatedly.
// Depends on: common/settings.js (SETTINGS, saveSettings, applySettings),
//             pages/extension/page.js (applyToggleBtnStyle, ICON_SHOW/HIDE/AUTO)

let _extClickListenerBound = false;

function _extCloseOpenDropdowns(e) {
  const extPanel = document.getElementById("ext-panel");
  if (!extPanel) return;
  extPanel.querySelectorAll("[data-ext-select]").forEach(triggerBtn => {
    const key = triggerBtn.dataset.extSelect;
    const dp = document.getElementById(`setting-${key}-panel`);
    if (dp && !dp.contains(e.target) && e.target !== triggerBtn) dp.hidden = true;
  });
  extPanel.querySelectorAll("[data-ext-ms]").forEach(triggerBtn => {
    const pKey = triggerBtn.dataset.extMs;
    const dp = document.getElementById(`ext-ms-${pKey}-panel`);
    if (dp && !dp.hidden && !dp.contains(e.target) && e.target !== triggerBtn) {
      dp.hidden = true;
      triggerBtn.setAttribute("aria-expanded", "false");
    }
  });
}

function bindSettingsHandlers(panel) {
  // Lock each select dropdown's button width to its widest option so the
  // button never resizes when the selected option changes.
  for (const s of SETTINGS) {
    if (s.type !== "select") continue;
    const dp = document.getElementById(`setting-${s.key}-panel`);
    const btn = document.getElementById(`setting-${s.key}-btn`);
    if (!dp || !btn) continue;
    const probe = document.createElement("span");
    probe.style.cssText = "position:fixed;visibility:hidden;white-space:nowrap;font-size:0.75rem;font-family:inherit;";
    document.body.appendChild(probe);
    let maxTextW = 0;
    dp.querySelectorAll("[data-ext-option]").forEach(o => {
      probe.textContent = o.textContent;
      maxTextW = Math.max(maxTextW, probe.offsetWidth);
    });
    probe.remove();
    btn.style.width = `${maxTextW + 34}px`; // 34px = button px-2 + gap-1.5 + chevron
  }

  async function persistSettings() {
    const updated = {};
    for (const s of SETTINGS) {
      if (s.type === "header" || s.type === "multiselect") continue;
      if (s.type === "multiselect-child") {
        const btn = panel.querySelector(`[data-ext-ms-child="${s.key}"]`);
        updated[s.key] = btn ? btn.dataset.checked === "true" : s.default;
        continue;
      }
      const el = document.getElementById(`setting-${s.key}`);
      if (!el) continue;
      updated[s.key] = (s.type === "select" || s.type === "toggle-group" || s.type === "radio") ? el.value : el.checked;
    }
    await saveSettings(updated);
    applySettings(updated);
    syncSettingsState();
  }

  function updateMultiselectSummary(pKey) {
    const msSetting = SETTINGS.find(s => s.type === "multiselect" && s.parentKey === pKey);
    if (!msSetting) return;
    const msPanel = document.getElementById(`ext-ms-${pKey}-panel`);
    if (!msPanel) return;

    const children = SETTINGS.filter(c => (c.type === "multiselect-child" || c.type === "toggle-group") && c.parentKey === pKey);
    const total = children.length;
    let checked = 0;
    children.forEach(c => {
      if (c.type === "multiselect-child") {
        const b = msPanel.querySelector(`[data-ext-ms-child="${c.key}"]`);
        if (b && b.dataset.checked === "true") checked++;
      } else if (c.type === "toggle-group") {
        const hiddenInput = document.getElementById(`setting-${c.key}`);
        if (hiddenInput && hiddenInput.value !== "show") checked++;
      }
    });
    const isLinks = pKey.includes("collapse");
    const unit = isLinks ? "länkar" : "valda";
    const summary = checked === 0
      ? `Inga ${unit}`
      : checked === total ? `Alla ${unit}` : `${checked} av ${total} ${unit}`;
    const summaryEl = document.getElementById(`ext-ms-${pKey}-summary`);
    if (summaryEl) summaryEl.textContent = summary;
  }

  function syncSettingsState() {
    const values = {};
    for (const s of SETTINGS) {
      if (!s.key) continue;
      if (s.type === "multiselect-child") {
        const btn = panel.querySelector(`[data-ext-ms-child="${s.key}"]`);
        if (btn) values[s.key] = btn.dataset.checked === "true";
        continue;
      }
      const el = document.getElementById(`setting-${s.key}`);
      if (el) values[s.key] = el.type === "checkbox" ? el.checked : el.value;
    }
    const isExtEnabled = values["extension-enabled"] !== false;

    for (const s of SETTINGS) {
      if (!s.key || s.key === "extension-enabled" || s.type === "header" || s.type === "multiselect-child") continue;

      let shouldEnable = isExtEnabled;
      if (shouldEnable && s.parentKey) {
        const parentEl = document.getElementById(`setting-${s.parentKey}`);
        shouldEnable = parentEl ? parentEl.checked : true;
      }

      if (s.parentKey) {
        const parentEl = document.getElementById(`setting-${s.parentKey}`);
        const parentChecked = isExtEnabled && !!(parentEl && parentEl.checked);
        const subContainer = panel.querySelector(`#sub-container-${s.parentKey}`);
        if (subContainer) subContainer.classList.toggle("expanded", parentChecked);
        const chevron = panel.querySelector(`#ext-chevron-${s.parentKey}`);
        if (chevron) chevron.classList.toggle("expanded", parentChecked);
      }

      if (s.type === "select") {
        const btnEl = document.getElementById(`setting-${s.key}-btn`);
        if (btnEl) btnEl.disabled = !shouldEnable;
      } else if (s.type === "toggle-group") {
        panel.querySelectorAll(`[data-ext-toggle="${s.key}"]`).forEach(b => b.disabled = !shouldEnable);
      } else if (s.type === "radio") {
        panel.querySelectorAll(`[data-ext-radio="${s.key}"]`).forEach(b => b.disabled = !shouldEnable);
      } else if (s.type === "multiselect-child") {
        // Handled via the multiselect block
      } else {
        const el = document.getElementById(`setting-${s.key}`);
        if (el) el.disabled = !shouldEnable;
      }
    }

    // Multiselect triggers have no s.key — handle them separately
    for (const s of SETTINGS) {
      if (s.type !== "multiselect") continue;
      const parentEl = document.getElementById(`setting-${s.parentKey}`);
      const parentChecked = isExtEnabled && !!(parentEl && parentEl.checked);
      const msBtn = document.getElementById(`ext-ms-${s.parentKey}-btn`);
      if (msBtn) msBtn.disabled = !parentChecked;
      const subContainer = panel.querySelector(`#sub-container-${s.parentKey}`);
      if (subContainer) subContainer.classList.toggle("expanded", parentChecked);
    }

    const extSubContainer = panel.querySelector("#sub-container-extension-enabled");
    if (extSubContainer) extSubContainer.classList.toggle("expanded", isExtEnabled);
    const extChevron = panel.querySelector("#ext-chevron-extension-enabled");
    if (extChevron) extChevron.classList.toggle("expanded", isExtEnabled);

    const btnEnableAll = document.getElementById("ext-btn-enable-all");
    const btnDisableAll = document.getElementById("ext-btn-disable-all");
    if (btnEnableAll) btnEnableAll.disabled = !isExtEnabled;
    if (btnDisableAll) btnDisableAll.disabled = !isExtEnabled;
  }

  // Select dropdowns
  panel.querySelectorAll("[data-ext-select]").forEach(triggerBtn => {
    const key = triggerBtn.dataset.extSelect;
    const dropdownPanel = document.getElementById(`setting-${key}-panel`);

    triggerBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (triggerBtn.disabled) return;
      const opening = dropdownPanel.hidden;
      panel.querySelectorAll("[data-ext-select]").forEach(otherBtn => {
        if (otherBtn === triggerBtn) return;
        const otherPanel = document.getElementById(`setting-${otherBtn.dataset.extSelect}-panel`);
        if (otherPanel && !otherPanel.hidden) otherPanel.hidden = true;
      });
      panel.querySelectorAll("[data-ext-ms]").forEach(msBtn => {
        const msPanel = document.getElementById(`ext-ms-${msBtn.dataset.extMs}-panel`);
        if (msPanel && !msPanel.hidden) {
          msPanel.hidden = true;
          msBtn.setAttribute("aria-expanded", "false");
        }
      });
      dropdownPanel.hidden = !opening;
      if (opening) {
        const panelRect = dropdownPanel.getBoundingClientRect();
        const btnRect = triggerBtn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;
        if (spaceBelow < panelRect.height && spaceAbove > spaceBelow) {
          dropdownPanel.style.top = "auto";
          dropdownPanel.style.bottom = "calc(100% + 4px)";
        } else {
          dropdownPanel.style.top = "calc(100% + 4px)";
          dropdownPanel.style.bottom = "auto";
        }
      }
    });

    dropdownPanel.querySelectorAll("[data-ext-option]").forEach(opt => {
      opt.addEventListener("click", () => {
        const val = opt.dataset.extOption;
        document.getElementById(`setting-${key}`).value = val;
        document.getElementById(`setting-${key}-lbl`).textContent = opt.textContent;
        dropdownPanel.querySelectorAll("[data-ext-option]").forEach(o => {
          const iconEl = o.querySelector(".check-icon");
          if (iconEl) {
            iconEl.classList.toggle("opacity-100", o === opt);
            iconEl.classList.toggle("opacity-0", o !== opt);
          }
        });
        dropdownPanel.hidden = true;
        document.getElementById(`setting-${key}`).dispatchEvent(new Event("change"));
      });
    });
  });

  // Bind outside-click handler only once per session; the handler short-circuits
  // when ext-panel is not mounted.
  if (!_extClickListenerBound) {
    document.addEventListener("click", _extCloseOpenDropdowns);
    _extClickListenerBound = true;
  }

  // Toggle group
  panel.querySelectorAll("[data-ext-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.extToggle;
      const val = btn.dataset.v;
      document.getElementById(`setting-${key}`).value = val;
      const isDark = document.documentElement.classList.contains("dark");
      panel.querySelectorAll(`[data-ext-toggle="${key}"]`).forEach(b => {
        applyToggleBtnStyle(b, b.dataset.v === val, isDark);
      });
      const keyObj = SETTINGS.find(s => s.key === key);
      if (keyObj && keyObj.parentKey) {
        updateMultiselectSummary(keyObj.parentKey);
      }
      persistSettings();
    });
  });

  // Radio buttons
  panel.querySelectorAll("[data-ext-radio]").forEach(radio => {
    radio.addEventListener("change", () => {
      const key = radio.dataset.extRadio;
      document.getElementById(`setting-${key}`).value = radio.value;
      persistSettings();
    });
  });

  // Cycle-toggle inside multiselect panels
  panel.querySelectorAll("[data-ext-toggle-cycle]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const key = btn.dataset.extToggleCycle;
      const toggleSetting = SETTINGS.find(s => s.key === key);
      if (!toggleSetting) return;
      const opts = toggleSetting.options.map(o => o.v);
      const currentIdx = opts.indexOf(btn.dataset.v);
      const nextIdx = (currentIdx + 1) % opts.length;
      const nextVal = opts[nextIdx];
      btn.dataset.v = nextVal;
      document.getElementById(`setting-${key}`).value = nextVal;
      let nextIcon = ICON_SHOW;
      if (nextVal === "hide") nextIcon = ICON_HIDE;
      if (nextVal === "auto") nextIcon = ICON_AUTO;
      const iconContainer = btn.querySelector('.ext-cycle-icon');
      if (iconContainer) {
        iconContainer.innerHTML = nextIcon;
        iconContainer.className = `ext-cycle-icon ml-auto shrink-0 flex items-center justify-center transition-all ${nextVal === "show" ? "text-foreground/30 opacity-60" : "text-primary opacity-90"}`;
      }
      if (toggleSetting.parentKey) {
        updateMultiselectSummary(toggleSetting.parentKey);
        document.getElementById(`ext-ms-${toggleSetting.parentKey}-btn`).dispatchEvent(new Event("change"));
      }
      persistSettings();
    });
  });

  // Multiselect dropdown
  panel.querySelectorAll("[data-ext-ms]").forEach(triggerBtn => {
    const pKey = triggerBtn.dataset.extMs;
    const msPanel = document.getElementById(`ext-ms-${pKey}-panel`);
    if (!msPanel) return;

    triggerBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (triggerBtn.disabled) return;
      const opening = msPanel.hidden;
      panel.querySelectorAll("[data-ext-ms]").forEach(otherBtn => {
        if (otherBtn === triggerBtn) return;
        const otherPanel = document.getElementById(`ext-ms-${otherBtn.dataset.extMs}-panel`);
        if (otherPanel && !otherPanel.hidden) {
          otherPanel.hidden = true;
          otherBtn.setAttribute("aria-expanded", "false");
        }
      });
      panel.querySelectorAll("[data-ext-select]").forEach(selBtn => {
        const dp = document.getElementById(`setting-${selBtn.dataset.extSelect}-panel`);
        if (dp) dp.hidden = true;
      });
      msPanel.hidden = !opening;
      triggerBtn.setAttribute("aria-expanded", opening ? "true" : "false");
      if (opening) {
        const panelRect = msPanel.getBoundingClientRect();
        const btnRect = triggerBtn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;
        if (spaceBelow < panelRect.height && spaceAbove > spaceBelow) {
          msPanel.style.top = "auto";
          msPanel.style.bottom = "calc(100% + 4px)";
        } else {
          msPanel.style.top = "calc(100% + 4px)";
          msPanel.style.bottom = "auto";
        }
      }
    });

    msPanel.querySelectorAll("[data-ext-ms-child]").forEach(btn => {
      btn.addEventListener("click", () => {
        const currentlyChecked = btn.dataset.checked === "true";
        const nextChecked = !currentlyChecked;
        btn.dataset.checked = nextChecked.toString();
        const iconEl = btn.querySelector('.check-icon');
        if (iconEl) {
          iconEl.classList.toggle("opacity-100", nextChecked);
          iconEl.classList.toggle("opacity-0", !nextChecked);
        }
        updateMultiselectSummary(pKey);
        document.getElementById(`ext-ms-${pKey}-btn`).dispatchEvent(new Event("change"));
        persistSettings();
      });
    });
  });

  // Per-setting change listeners — parent checkbox cascades to child checkboxes
  for (const s of SETTINGS) {
    if (s.type === "header" || s.type === "multiselect" || s.type === "multiselect-child") continue;
    const el = document.getElementById(`setting-${s.key}`);
    if (el) {
      el.addEventListener("change", async (e) => {
        const isChecked = e.target.checked;
        const isCheckbox = e.target.type === "checkbox";
        if (isCheckbox) {
          for (const s2 of SETTINGS) {
            if (s2.parentKey === s.key && s2.type === "checkbox") {
              const childEl = document.getElementById(`setting-${s2.key}`);
              if (childEl) childEl.checked = isChecked;
            }
          }
        }
        persistSettings();
        syncSettingsState();
      });
    }
  }

  syncSettingsState();

  const btnEnableAll = document.getElementById("ext-btn-enable-all");
  const btnDisableAll = document.getElementById("ext-btn-disable-all");
  if (btnEnableAll) {
    btnEnableAll.addEventListener("click", async () => {
      for (const s of SETTINGS) {
        if (!s.key || s.key === "extension-enabled" || s.type) continue;
        const el = document.getElementById(`setting-${s.key}`);
        if (el) el.checked = true;
      }
      await persistSettings();
      syncSettingsState();
    });
  }
  if (btnDisableAll) {
    btnDisableAll.addEventListener("click", async () => {
      for (const s of SETTINGS) {
        if (!s.key || s.key === "extension-enabled" || s.type) continue;
        const el = document.getElementById(`setting-${s.key}`);
        if (el) el.checked = false;
      }
      await persistSettings();
      syncSettingsState();
    });
  }
}
