/**
 * Logic for saving and restoring mass challenge settings per gladiator.
 */

let _massSettings = {};
let _massObserver = null;
let _isRestoring = false;
let _activeAvatarId = null; // pushed in via ext:active-avatar from store-bridge

window.addEventListener("ext:active-avatar", e => {
  _activeAvatarId = e.detail?.id ?? null;
});

const RACE_ID_TO_NAME = {
  1: "människa",
  2: "alv",
  3: "dvärg",
  4: "ork",
  5: "troll",
  6: "goblin",
  7: "odöd",
  11: "salamanth"
};

const TACTIC_ID_TO_NAME = {
  0: "Normal",
  1: "Normal - lätta attacker",
  2: "Normal - tunga attacker",
  3: "Defensiv",
  4: "Defensiv - lätta attacker",
  5: "Defensiv - tunga attacker",
  6: "Offensiv",
  7: "Offensiv - lätta attacker",
  8: "Offensiv - tunga attacker",
  9: "Bärsärk",
  10: "Bärsärk - lätta attacker",
  11: "Bärsärk - tunga attacker"
};

/**
 * Capture and save settings when a mass challenge is performed.
 */
function setupMassChallengeCapture() {
  apiRegisterHandler(/\/api\/challenges\/masscreate/, async (url, data, requestData) => {
    if (!_massSettings["save-mass-challenge-settings"] || !requestData) return;
    if (!_activeAvatarId) return;

    const storageKey = `mass_challenge_settings_${_activeAvatarId}`;

    try {
      if (requestData.race_settings) {
        const settingsToSave = {
          per_race_enabled: true,
          race_settings: requestData.race_settings,
          min_start_percentage: requestData.min_start_percentage
        };
        await chrome.storage.local.set({ [storageKey]: settingsToSave });
      } else {
        // If it wasn't checked, clear the saved settings for this gladiator.
        await chrome.storage.local.remove(storageKey);
      }
    } catch (e) {
      if (!handleChromeError(e)) console.error("Lanista Extension: failed to persist mass challenge settings", e);
    }
  });

  // Cleanup logic: remove settings for gladiators no longer in the stable.
  apiRegisterHandler(/\/api\/users\/me(\?|$)/, (url, data) => {
    if (!data?.avatars) return;
    const currentIds = data.avatars.map(a => a.id);
    _cleanupOldGladiators(currentIds);
  });

  apiRegisterHandler(/\/api\/users\/me\/avatars(\?|$)/, (url, data) => {
    if (!Array.isArray(data)) return;
    const currentIds = data.map(a => a.id);
    _cleanupOldGladiators(currentIds);
  });
}

async function _cleanupOldGladiators(currentIds) {
  try {
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter(key => {
      if (!key.startsWith("mass_challenge_settings_")) return false;
      const id = parseInt(key.replace("mass_challenge_settings_", ""), 10);
      return !currentIds.includes(id);
    });
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  } catch (e) {
    if (!handleChromeError(e)) console.error("Lanista Extension: failed to cleanup old gladiator settings", e);
  }
}

/**
 * Restore settings in the UI.
 */
async function restoreMassChallengeSettings(modal) {
  if (_isRestoring) return;
  if (!_activeAvatarId) return;

  const storageKey = `mass_challenge_settings_${_activeAvatarId}`;
  let saved;
  try {
    const stored = await chrome.storage.local.get(storageKey);
    saved = stored[storageKey];
  } catch (e) {
    if (!handleChromeError(e)) console.error("Lanista Extension: failed to load mass challenge settings", e);
    return;
  }
  if (!saved || !saved.per_race_enabled) return;

  _isRestoring = true;

  try {
    // 1. Auto-toggle the checkbox if it's not already checked.
    const perRaceToggle = modal.querySelector('#per-race-toggle');
    if (perRaceToggle && perRaceToggle.getAttribute('data-state') === 'unchecked') {
      perRaceToggle.click();
      await poll(() => modal.querySelector('.space-y-2.mb-4'), 2000);
    }

    // 2. Shield the entire screen from user interference
    const shield = document.createElement('div');
    shield.id = 'lanista-automation-shield';
    Object.assign(shield.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '999999',
      backgroundColor: 'rgba(0,0,0,0.3)',
      cursor: 'wait',
      pointerEvents: 'auto'
    });

    // Prevent any interaction from reaching the underlying elements or closing the modal
    const blocker = (e) => {
      if (!e.isTrusted) return; // Allow programmatic events from our script
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    const eventTypes = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'contextmenu'];
    eventTypes.forEach(type => shield.addEventListener(type, blocker, true));

    document.body.appendChild(shield);

    try {
      const raceRows = [...modal.querySelectorAll('.space-y-2.mb-4 > div.flex.items-center.gap-2')];

      for (const row of raceRows) {
        const nameSpan = row.querySelector('span.truncate');
        const raceName = nameSpan?.textContent?.trim().toLowerCase();
        if (!raceName) continue;

        const raceId = Object.keys(RACE_ID_TO_NAME).find(id => RACE_ID_TO_NAME[id] === raceName);
        const raceSaved = saved.race_settings[raceId];

        const checkbox = row.querySelector('button[role="checkbox"]');
        if (!raceSaved) {
          if (checkbox?.getAttribute('data-state') === 'checked') checkbox.click();
          continue;
        }

        // Ensure checkbox is checked
        if (checkbox && checkbox.getAttribute('data-state') === 'unchecked') {
          checkbox.click();
          await poll(() => checkbox.getAttribute('data-state') === 'checked');
        }

        // Restore Selects
        const selects = [...row.querySelectorAll('button[role="combobox"]')];
        if (selects.length >= 2) {
          await setSelectValue(selects[0], TACTIC_ID_TO_NAME[raceSaved.battle_tactic]);
          const pctLabel = Math.round(raceSaved.give_up_percentage * 100) + "%";
          await setSelectValue(selects[1], pctLabel, true);
        }
      }

      // Restore global "Starta vid minst"
      const globalStartSelect = modal.querySelector('label[for="start-percentage"]')?.parentElement?.nextElementSibling?.querySelector('button[role="combobox"]');
      if (globalStartSelect && saved.min_start_percentage !== undefined) {
        const pctLabel = Math.round(saved.min_start_percentage * 100) + "%";
        await setSelectValue(globalStartSelect, pctLabel, true);
      }
    } finally {
      // 3. Remove shield
      shield.remove();
    }
  } finally {
    _isRestoring = false;
  }
}

/**
 * Smart polling helper - checks a condition every 20ms
 */
function poll(fn, timeout = 300) {
  const start = Date.now();
  return new Promise((resolve) => {
    (function check() {
      if (fn()) return resolve(true);
      if (Date.now() - start > timeout) return resolve(false);
      setTimeout(check, 20);
    })();
  });
}

/**
 * Helper to check if a select is currently open.
 */
function isSelectOpen(trigger, menuId) {
  const state = trigger.getAttribute('data-state');
  const expanded = trigger.getAttribute('aria-expanded');
  const menuExists = menuId ? !!document.getElementById(menuId) : false;

  const isOpen = state === 'open' && expanded === 'true' && menuExists;

  return isOpen;
}

async function setSelectValue(trigger, valueText, isPrefix = false) {
  if (!trigger || !valueText) return;

  const getValue = () => trigger.querySelector('[data-slot="select-value"]')?.textContent?.trim();
  const currentValue = getValue();
  if (isPrefix ? currentValue?.startsWith(valueText) : currentValue === valueText) return;

  const menuId = trigger.getAttribute('aria-controls');

  const clickElement = (el) => {
    const events = [
      { type: 'pointerdown', class: PointerEvent, buttons: 1 },
      { type: 'pointerup', class: PointerEvent, buttons: 0 },
      { type: 'click', class: MouseEvent, buttons: 0 }
    ];
    events.forEach(ev => {
      el.dispatchEvent(new ev.class(ev.type, {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: ev.buttons,
        pointerType: 'mouse'
      }));
    });
  };

  // 1. Open the menu (with retry)
  let opened = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    clickElement(trigger);
    opened = await poll(() => isSelectOpen(trigger, menuId));
    if (opened) break;
    await new Promise(r => setTimeout(r, 50));
  }

  if (!opened) {
    console.error(`[Lanista] Failed to open menu for ${valueText}`);
    return;
  }

  // 2. Find the specific menu linked by aria-controls
  let activeMenu = null;
  await poll(() => {
    activeMenu = menuId ? document.getElementById(menuId) : document.querySelector('[role="listbox"][data-state="open"]');
    return activeMenu && activeMenu.querySelectorAll('[role="option"]').length > 0;
  });

  if (!activeMenu) {
    console.error(`[Lanista] Could not find menu content for ${menuId}`);
    return;
  }

  // 3. Find and click target
  const items = [...activeMenu.querySelectorAll('[role="option"]')];
  const target = items.find(item => {
    const text = item.textContent?.trim().toLowerCase();
    const search = valueText.toLowerCase();
    return isPrefix ? text?.startsWith(search) : text === search;
  });

  if (target) {
    await poll(() => isSelectOpen(trigger, menuId));

    // Click twice (needed for focus/selection it seems)
    clickElement(target);
    clickElement(target);

    // 4. Wait for menu to CLOSE
    await poll(() => !isSelectOpen(trigger, menuId));
  } else {
    console.warn(`[Lanista] Target value "${valueText}" not found in menu`);
    clickElement(trigger); // Close menu if not found
  }
}

let _captureInitialized = false;

function initMassChallenge(settings) {
  _massSettings = settings;
  if (!_captureInitialized) {
    setupMassChallengeCapture();
    _captureInitialized = true;
  }

  if (_massObserver) _massObserver.disconnect();
  _massObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;

        // Check if mass challenge modal
        const modal = node.matches('[role="dialog"]') ? node : node.querySelector('[role="dialog"]');
        if (modal && modal.textContent.includes("Massutmana gladiatorer")) {
          // If modal is already open and settings are saved, restore them.
          restoreMassChallengeSettings(modal);
          setupModalListeners(modal);
        }
      }
    }
  });

  _massObserver.observe(document.body, { childList: true, subtree: true });
}

function setupModalListeners(modal) {
  const perRaceToggle = modal.querySelector('#per-race-toggle');
  if (!perRaceToggle) return;

  // Listen for state change on the button
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'data-state') {
        const state = perRaceToggle.getAttribute('data-state');
        if (state === 'checked') {
          restoreMassChallengeSettings(modal);
        }
      }
    }
  });

  observer.observe(perRaceToggle, { attributes: true });
}
