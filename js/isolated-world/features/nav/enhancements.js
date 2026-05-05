// Sidebar navigation: core observer, feature registry, polling, settings sync.
// Feature logic lives in dedicated files:
//   features/nav/merge.js, features/nav/hide-empty.js, features/nav/simplify-community.js, features/nav/cooldowns.js
// Badge state in features/nav/badges.js.

// var so other content scripts in the same feature group can read across files
var _navSettings = {};

// Feature registry. Each feature registers { name, enabled, apply, remove, onSettingsChange? }.
//   enabled(s)          → bool, whether feature should be active given settings
//   apply()             → idempotent; safe to call on every observer tick
//   remove()            → undo DOM changes; called when feature transitions enabled→disabled
//   onSettingsChange?   → optional; called on settings change with (newSettings, oldSettings)
//                         when enabled state didn't flip, for features with sub-settings
var _navFeatures = [];
function registerNavFeature(feature) { _navFeatures.push(feature); }

let _navObserver   = null;
let _navRafPending = false;
let _pollTimer     = null;

// --- Helpers ---

async function _fetchAndDispatch(url) {
  try {
    const data = await gameRequest(url);
    window.dispatchEvent(new CustomEvent("ext:api", { detail: { url, data } }));
  } catch (e) {}
}

const _NAV_OBSERVER_TARGET   = () => document.body;
const _NAV_OBSERVER_INIT_ARG = { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] };

// Runs fn() with the nav observer disconnected to prevent re-entrant loops.
function _withoutObserver(fn) {
  const target = _navObserver && _NAV_OBSERVER_TARGET();
  if (target) _navObserver.disconnect();
  try { fn(); } finally {
    if (target) _navObserver.observe(target, _NAV_OBSERVER_INIT_ARG);
  }
}

// Helper for features to locate a nav section by its kicker text.
function findNavSection(kickerText) {
  for (const el of document.querySelectorAll('.sidebar [data-slot="collapsible-trigger"] .section-kicker')) {
    if (el.textContent.trim() === kickerText) return el.closest('[data-slot="collapsible"]');
  }
  return null;
}

// --- Observer with rAF debounce ---
// Vue emits bursts of mutations on collapse/expand/gladiator-switch. Instead of running
// every feature on each mutation, we schedule one pass per frame.

function _scheduleRerun() {
  if (_navRafPending) return;
  _navRafPending = true;
  requestAnimationFrame(() => {
    _navRafPending = false;
    _runAllFeatures();
  });
}

function _runAllFeatures() {
  _withoutObserver(() => {
    // Baseline right-panel injections — idempotent. Re-run here so Vue remounts
    // (e.g. after avatar-create) restore our classes and injected links.
    markSidebarPanels();
    injectSettingsLink();
    injectDatabaseLink();
    injectPassiveLink();

    for (const f of _navFeatures) {
      if (f.enabled(_navSettings)) f.apply();
    }
    _updateNavBadges();
    applyRightPanelCollapse();
  });
}

function _setupNavObserver() {
  if (_navObserver) return;
  const target = _NAV_OBSERVER_TARGET();
  if (!target) return;
  // Observe body (stable across Vue remounts) and filter for mutations inside .sidebar —
  // otherwise we'd miss sidebar re-renders that replace the entire .sidebar node.
  _navObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      const node = m.target;
      if (node instanceof Element && (node.closest(".sidebar") || node.querySelector?.(".sidebar"))) {
        _scheduleRerun();
        return;
      }
    }
  });
  _navObserver.observe(target, _NAV_OBSERVER_INIT_ARG);
}

// --- Periodic polling for daily quests ---

function _scheduleDailiesPoll() {
  const minMs = 5  * 60 * 1000;
  const maxMs = 30 * 60 * 1000;
  const delay = minMs + Math.random() * (maxMs - minMs);
  _pollTimer = setTimeout(async () => {
    await _fetchAndDispatch("/api/avatars/me/daily");
    _scheduleDailiesPoll();
  }, delay);
}

// --- Verkstad redirect ---
// Intercept click on Verkstad nav link (capture phase, before Vue Router).

document.addEventListener("click", e => {
  if (!document.body.classList.contains("ext-s-redirect-workshop")) return;
  const link = e.target.closest('a[href="/game/market/craft"]');
  if (!link || !link.closest(".sidebar")) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  extRouterPush("/game/market/craft/ongoing");
}, true);

// --- Init ---

async function initNavEnhancements() {
  _navSettings = getEffectiveSettings(await loadSettings());
  _setupNavObserver();

  const needsDailies = _navSettings["dailies-badge"] || _navSettings["hide-dailies-completed"];
  const needsAvatars = _navSettings["beasts-badge"]  || _navSettings["hide-beasts-completed"]
                    || _navSettings["hide-adventure-no-badge"];

  if (needsAvatars && (_beastsRemaining === null || _unseenAdventures === null)) {
    await _fetchAndDispatch("/api/users/me/avatars");
  }


  if (needsDailies) {
    if (!_dailiesReqs) {
      const cached = apiGetCacheByPattern(/\/api\/config\/dailies(\?|$)/);
      if (cached?.requirements) {
        _dailiesReqs = cached.requirements;
      } else {
        await _fetchAndDispatch("/api/config/dailies");
      }
    }
    await _fetchAndDispatch("/api/avatars/me/daily");
    _scheduleDailiesPoll();
  }

  _runAllFeatures();
  await initRightPanelCollapse(_navSettings);

  // Fallback: refresh cooldowns when building/activity APIs return (Vue may update
  // cooldown state without node mutations we can observe).
  apiRegisterHandler(/\/api\/(buildings|chance-game|rankedbattles)/, () => {
    for (const f of _navFeatures) {
      if (f.name === "cooldowns" && f.enabled(_navSettings)) f.apply();
    }
  });
}

// --- Settings sync ---
// Detects enabled/disabled transitions per feature and calls remove()/apply() accordingly.
// Lets features hook in custom diff logic via onSettingsChange (e.g. tab change).

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  loadSettings().then(settings => {
    const prev = _navSettings;
    _navSettings = getEffectiveSettings(settings);

    _withoutObserver(() => {
      for (const f of _navFeatures) {
        const wasOn = f.enabled(prev);
        const isOn  = f.enabled(_navSettings);
        if (isOn && !wasOn) {
          f.apply();
        } else if (!isOn && wasOn) {
          f.remove?.();
        } else if (isOn && f.onSettingsChange) {
          f.onSettingsChange(_navSettings, prev);
        }
      }
      _updateNavBadges();
      updateRightPanelCollapseSettings(_navSettings);
    });
  });
});
