// Team battles page enhancements: injects a "hide team-vs-monster" checkbox
// (UI label: "Dölj Lag mot monster") into the open team battles filter bar when enabled in settings.
// The checkbox state is persisted separately in chrome.storage.local.
// Depends on: settings.js (loadSettings)

const _TEAMBATTLES_KEY = "teambattles-hide-monsters";
const _TB_QUOTA_KEY = "team-beasts-quota";

const _CHECK_SVG = icon("check", { size: 24, class: "lucide size-3.5 lucide-check size-3.5", ariaHidden: true });

let _teambattlesSettings = {};
let _hideMonsters = false;
let _teambattlesObs = null;

const _MY_BATTLE_BTN_CLASSES = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 has-[>svg]:px-3 w-full sm:w-auto";

// Re-implemented helper to identify active avatar for quota lookup
function _getActiveAvatarId() {
  const meAvatar = apiGetCacheByPattern(/\/api\/avatars\/me(\?|$)/);
  if (meAvatar?.id) return meAvatar.id;
  const userMe = apiGetCacheByPattern(/\/api\/users\/me(\?|$)/);
  if (userMe?.avatar?.id) return userMe.avatar.id;
  const avatars = apiGetCacheByPattern(/\/api\/users\/me\/avatars(\?|$)/);
  if (Array.isArray(avatars)) {
    const active = avatars.find(a => a.active === true);
    if (active?.id) return active.id;
  }
  return null;
}

function _onTeambattlesPage() {
  const p = location.pathname;
  if (!p.startsWith("/game/arena/teambattles")) return false;

  // Exclude creation page and specific battle detail pages
  if (p === "/game/arena/teambattles/create") return false;
  if (/^\/game\/arena\/teambattles\/\d+$/.test(p)) return false;

  return true;
}

// Returns the anchor element of the user's own open team battle from the sidebar, or null.
function _getOwnBattleLink() {
  for (const a of document.querySelectorAll('.sidebar a[href]')) {
    if (/^\/game\/arena\/teambattles\/\d+$/.test(a.getAttribute('href'))) {
      return a;
    }
  }
  return null;
}

function _applyFilter() {
  const ownLink = _teambattlesSettings["highlight-own-teambattle"] ? _getOwnBattleLink() : null;
  const ownHref = ownLink?.getAttribute("href");

  const tables = document.querySelectorAll('[data-slot="table"]');
  for (const table of tables) {
    const headers = table.querySelectorAll('thead th');
    let odjurIndex = -1;
    headers.forEach((th, i) => {
      if (th.textContent.trim().toLowerCase() === "odjur") odjurIndex = i;
    });
    if (odjurIndex < 0) continue;

    const rows = table.querySelectorAll('tbody tr');
    let visibleIndex = 0;
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const isMonster = cells[odjurIndex]?.textContent.trim().toLowerCase() === "ja";
      const hidden = _hideMonsters && isMonster;
      row.style.display = hidden ? "none" : "";

      // Re-apply zebra striping on visible rows since Vue bakes surface-row-alt statically.
      const shouldBeAlt = !hidden && (visibleIndex % 2 === 1);
      if (row.classList.contains("surface-row-alt") !== shouldBeAlt) {
        row.classList.toggle("surface-row-alt", shouldBeAlt);
      }
      if (!hidden) visibleIndex++;

      // Highlight own battle row
      const isOwn = !!(ownHref && row.querySelector(`a[href="${ownHref}"]`));
      if (row.classList.contains("ext-own-teambattle") !== isOwn) {
        row.classList.toggle("ext-own-teambattle", isOwn);
      }
    });
  }
}

function _syncCheckboxVisual(btn, checked) {
  const targetState = checked ? "checked" : "unchecked";
  if (btn.getAttribute("data-state") === targetState) return;

  btn.setAttribute("aria-checked", checked ? "true" : "false");
  btn.setAttribute("data-state", targetState);
  const indicator = btn.querySelector('[data-slot="checkbox-indicator"]');
  if (indicator) {
    indicator.setAttribute("data-state", targetState);
    indicator.style.display = checked ? "" : "none";
  }
}

function _injectCheckbox() {
  const existing = document.getElementById("ext-teambattles-monsters");
  if (!_onTeambattlesPage() || !_teambattlesSettings["show-teambattles-monster-filter"]) {
    if (existing) _removeCheckbox();
    return;
  }
  if (existing) return;

  const anchorCheckbox = document.getElementById("teambattles-mylevel");
  if (!anchorCheckbox) return;
  const grid = anchorCheckbox.closest('.grid');
  if (!grid) return;

  // Stack the two existing checkboxes vertically to make room for the new one
  grid.classList.remove("sm:grid-cols-2");

  const refBtn = grid.querySelector('[data-slot="checkbox"]');
  const btn = document.createElement("button");
  btn.id = "ext-teambattles-monsters";
  btn.type = "button";
  btn.className = refBtn ? refBtn.className : "peer border-input bg-white/95 data-[state=unchecked]:border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:text-white data-[state=checked]:border-primary size-4 shrink-0 rounded-[4px] border shadow-xs outline-none dark:bg-input/30";
  btn.setAttribute("data-slot", "checkbox");
  btn.setAttribute("role", "checkbox");
  btn.setAttribute("aria-required", "false");
  btn.setAttribute("aria-label", "Enbart lag mot lag");

  const indicator = document.createElement("span");
  indicator.setAttribute("data-slot", "checkbox-indicator");
  indicator.className = "grid place-content-center text-current transition-none";
  indicator.style.pointerEvents = "none";
  indicator.innerHTML = _CHECK_SVG;
  btn.appendChild(indicator);

  _syncCheckboxVisual(btn, _hideMonsters);

  btn.addEventListener("click", async () => {
    _hideMonsters = !_hideMonsters;
    _syncCheckboxVisual(btn, _hideMonsters);
    try {
      await chrome.storage.local.set({ [_TEAMBATTLES_KEY]: _hideMonsters });
    } catch (e) {
      if (e.message?.includes("Extension context invalidated")) location.reload();
      else console.error("Lanista Extension: failed to save teambattles setting", e);
    }
    _applyFilter();
  });

  const label = document.createElement("label");
  label.htmlFor = btn.id;
  label.className = "text-sm font-semibold";
  label.textContent = " Enbart lag mot lag ";

  const wrap = document.createElement("div");
  wrap.className = "flex items-center gap-2";
  wrap.appendChild(btn);
  wrap.appendChild(label);
  grid.appendChild(wrap);
}

function _removeCheckbox() {
  const btn = document.getElementById("ext-teambattles-monsters");
  if (btn) btn.closest('.flex.items-center.gap-2')?.remove();

  // Restore the original 2-column grid layout
  const anchorCheckbox = document.getElementById("teambattles-mylevel");
  const grid = anchorCheckbox?.closest('.grid');
  if (grid) grid.classList.add("sm:grid-cols-2");

  // Restore any hidden rows
  _hideMonsters = false;
  _applyFilter();
}

function _setupTeambattlesObs() {
  if (_teambattlesObs) return;
  _teambattlesObs = new MutationObserver(() => {
    _injectCheckbox();
    _applyFilter();
    _tagCreateButton();
    _updateMyBattleButton();
  });
  _teambattlesObs.observe(getGameContentRoot(), { childList: true, subtree: true });
}

function _updateMyBattleButton() {
  const existing = document.getElementById("ext-my-teambattle-btn");
  const onPage = _onTeambattlesPage();
  const settingOn = !!_teambattlesSettings["show-my-teambattle-button"];

  if (!onPage || !settingOn) {
    if (existing) existing.remove();
    return;
  }

  const ownLink = _getOwnBattleLink();
  const ownHref = ownLink?.getAttribute("href");
  
  // Search for the native create button. We shouldn't show our button if create is present.
  // CRITICAL: Must be specific to 'button' elements to avoid detecting our own 'a' tag button.
  const createBtn = document.querySelector("button.ext-teambattle-create-btn") || 
                     Array.from(document.querySelectorAll('button')).find(b => {
                       const t = b.textContent.trim();
                       return t === "Skapa lagspel" || t === "Create team battle";
                     });

  if (createBtn || !ownHref) {
    if (existing) existing.remove();
    return;
  }

  // If already exists, just update href if needed (though it shouldn't change without reload/sync)
  if (existing) {
    if (existing.getAttribute("href") !== ownHref) {
      existing.setAttribute("href", ownHref);
    }
    return;
  }

  // Target container: the header action area
  const anchor = document.querySelector('.lg\\:ml-auto.flex.items-center');
  if (!anchor) return;

  const btn = document.createElement("a");
  btn.id = "ext-my-teambattle-btn";
  btn.href = ownHref;
  btn.className = _MY_BATTLE_BTN_CLASSES;
  btn.textContent = "Mitt lagspel";

  // Prevent full page reload by triggering the sidebar link instead
  btn.addEventListener("click", (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return; // Allow normal browser behavior for modified clicks
    e.preventDefault();
    const link = _getOwnBattleLink();
    if (link) {
      link.click();
    } else {
      // Fallback if sidebar link disappeared: navigate normally via router
      extRouterPush(ownHref);
    }
  });
  
  if (_teambattlesSettings["compact-teambattles-create-btn"]) {
    btn.classList.add("ext-teambattle-create-btn");
  }

  anchor.appendChild(btn);
}

function _tagCreateButton() {
  const buttons = document.querySelectorAll('button:not(.ext-teambattle-create-btn)');
  for (const btn of buttons) {
    const text = btn.textContent.trim();
    if (text === "Skapa lagspel" || text === "Create team battle") {
      btn.classList.add("ext-teambattle-create-btn");
      break;
    }
  }
}

async function _initTeambattles() {
  // Always ensure the observer is running if any relevant setting is on
  if (_teambattlesSettings["show-teambattles-monster-filter"] || _teambattlesSettings["show-my-teambattle-button"]) _setupTeambattlesObs();

  if (!_onTeambattlesPage()) return;
  try {
    const stored = await chrome.storage.local.get(_TEAMBATTLES_KEY);
    _hideMonsters = !!stored[_TEAMBATTLES_KEY];
  } catch (e) {
    _hideMonsters = false;
  }

  // Handle auto-activation based on daily quota
  if (_teambattlesSettings["auto-activate-teambattles-monster-filter"]) {
    try {
      const avatarId = _getActiveAvatarId();
      if (avatarId) {
        const storedQuota = await chrome.storage.local.get(_TB_QUOTA_KEY);
        const map = storedQuota[_TB_QUOTA_KEY] || {};
        const cached = map[avatarId];

        // When auto-activation is ON, we ignore the previous manual setting
        // and force the state based on the current quota. Stale cache from a
        // previous Swedish day must be ignored — otherwise the checkbox stays
        // checked on the first visit after midnight until team-beasts-quota.js
        // has had a chance to roll the cache over.
        const fresh = cached && cached.date === swedishDateToday();
        const atLimit = !!(fresh && typeof cached.count === "number" && cached.count >= 10);
        _hideMonsters = atLimit;
      }
    } catch (e) {}
  }

  const btn = document.getElementById("ext-teambattles-monsters");
  if (btn) {
    _syncCheckboxVisual(btn, _hideMonsters);
  } else {
    _injectCheckbox();
  }
  _applyFilter();
  _updateMyBattleButton();
}

window.addEventListener("ext:navigate", () => {
  _initTeambattles();
});

window.addEventListener("popstate", () => {
  _initTeambattles();
});

// Re-init when we get user/avatar data to ensure we have the correct ID for auto-filtering
apiRegisterHandler(/\/api\/(users|avatars)\/me(\?|$)/, () => {
  _initTeambattles();
});

function initTeambattles(settings) {
  _teambattlesSettings = settings;
  _initTeambattles();
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  loadSettings().then(settings => {
    const wasFilterEnabled = _teambattlesSettings["show-teambattles-monster-filter"];
    const wasMyBtnEnabled = _teambattlesSettings["show-my-teambattle-button"];
    _teambattlesSettings = settings;
    
    if (!settings["show-teambattles-monster-filter"] && wasFilterEnabled) {
      _removeCheckbox();
    } else if (settings["show-teambattles-monster-filter"] && !wasFilterEnabled) {
      if (_onTeambattlesPage()) _initTeambattles();
    }

    if (!settings["show-my-teambattle-button"] && wasMyBtnEnabled) {
      document.getElementById("ext-my-teambattle-btn")?.remove();
    } else if (settings["show-my-teambattle-button"] && !wasMyBtnEnabled) {
      if (_onTeambattlesPage()) _initTeambattles();
    }

    if (_onTeambattlesPage()) {
      _applyFilter();
      _updateMyBattleButton();
    }
  });
});
