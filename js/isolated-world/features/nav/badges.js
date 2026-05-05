// Nav badge tracking — state, badge/visibility rendering.
// Avatar-derived badge state (daily_beasts, unseen_adventures, active id) is
// pushed in via ext:badge-data and ext:active-avatar from main-world/store-bridge.js.
// Daily quest data still comes from /api/avatars/me/daily — that endpoint is not
// reflected in the user store.
// Depends on: common/api-handler.js (apiRegisterHandler, apiGetCacheByPattern)
// Reads: _navSettings (var defined in nav/enhancements.js)

let _dailiesRemaining = null; // null = unknown; number = incomplete daily tasks
let _beastsRemaining  = null; // null = unknown; number = beast fights left today
let _unseenAdventures = null; // null = unknown; number = unseen adventures
let _dailiesReqs      = null; // requirements map from /api/config/dailies
let _latestDailyData  = null;
let _lastDailyBeasts  = null; // last raw daily_beasts count from store (used to recompute on limit change)
let _navBadgeUpdating = false;

const _NAV_BADGE_CLASS = "ext-nav-badge inline-flex items-center font-medium badge-notify h-5 min-w-5 justify-center rounded-full border border-primary/30 bg-primary/20 px-1.5 py-0 text-[10px] leading-5 text-primary ml-auto shrink-0";

// --- API handlers ---


// Daily quest requirements (thresholds per task, UPPERCASE keys)
apiRegisterHandler(/\/api\/config\/dailies/, (_url, data) => {
  if (data?.requirements) {
    _dailiesReqs = data.requirements;
    _recomputeDailies();
  }
});

// Daily activity counters + active task list
apiRegisterHandler(/\/api\/avatars\/me\/daily/, (_url, data) => {
  if (!Array.isArray(data?.current_dailies)) return;
  _latestDailyData = data;
  _recomputeDailies();
});

// AvatarDailyFinished relayed from MAIN-world socket-listener —
// fetch fresh daily quest data to ensure the UI is in sync with the server.
window.addEventListener("ext:avatar-daily-finished", () => {
  if (typeof _fetchAndDispatch === "function") {
    _fetchAndDispatch("/api/avatars/me/daily");
  }
});

// Adventures list fetch (triggered by the game when the user opens the adventures page) —
// server marks adventures as seen, so clear our local unseen counter and re-render.
apiRegisterHandler(/\/api\/avatars\/me\/adventures(\?|$)/, () => {
  if (_unseenAdventures === 0) return;
  _unseenAdventures = 0;
  _updateNavBadges();
});

// --- Store bridge listeners ---

// Reactive avatar fields (daily_beasts, unseen_adventures) from the Pinia user store.
window.addEventListener("ext:badge-data", (e) => {
  const { dailyBeasts, unseenAdventures } = e.detail || {};

  if (dailyBeasts !== undefined) {
    _lastDailyBeasts = dailyBeasts;
    const limitStr = window.ExtConfig?.daily_beasts;
    if (limitStr == null) {
      console.error("[Lanista-Ext] daily_beasts limit missing from ExtConfig");
      _beastsRemaining = null;
    } else {
      const limit = parseInt(limitStr, 10);
      _beastsRemaining = Math.max(0, limit - dailyBeasts);
    }
  }
  if (unseenAdventures !== undefined) {
    _unseenAdventures = unseenAdventures;
  }
  _updateNavBadges();
});

// Active gladiator changed — invalidate daily quest state. The daily endpoint is
// per-gladiator and gets re-fetched by state-synchronizer.js on switch.
window.addEventListener("ext:active-avatar", () => {
  _latestDailyData = null;
  _dailiesRemaining = null;
});

function _recomputeDailies() {
  if (!_latestDailyData) return;
  let reqs = _dailiesReqs;
  if (!reqs) {
    const cached = apiGetCacheByPattern(/\/api\/config\/dailies(\?|$)/);
    if (cached?.requirements) reqs = _dailiesReqs = cached.requirements;
  }
  if (!reqs) return;
  const keys = _latestDailyData.current_dailies;
  // Some tasks (e.g. damage_done) have a dynamic per-gladiator threshold in the daily
  // response itself (key + "_threshold"). Prefer that over the static config value.
  const baseRemaining = keys.filter(key => {
    const current   = _latestDailyData[key] ?? 0;
    const threshold = _latestDailyData[key + "_threshold"] ?? reqs[key.toUpperCase()] ?? Infinity;
    return current < threshold;
  }).length;
  _dailiesRemaining = baseRemaining;
  _updateNavBadges();
}

// --- Badge and visibility helpers ---

function _setNavBadge(href, count) {
  const link = document.querySelector(`.sidebar a[href="${href}"]`);
  if (!link) return;
  const inner = link.querySelector(".flex.w-full");
  if (!inner) return;
  const existing = inner.querySelector(".ext-nav-badge");
  if (!count || count <= 0) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    if (existing.textContent !== String(count)) existing.textContent = count;
    return;
  }
  const badge = document.createElement("div");
  badge.className = _NAV_BADGE_CLASS;
  badge.setAttribute("data-slot", "badge");
  badge.textContent = count;
  inner.appendChild(badge);
}

function _setNavLinkVisibility(href, visible) {
  // Badge is its own visibility owner — uses .ext-badge-hidden so it never competes
  // with other features' hide-classes (.ext-merged-source, etc.) on the same element.
  // Skip merged-source <li>s so we don't try to manage the hidden original behind
  // the merge-adventure-beasts clone.
  for (const link of document.querySelectorAll(`.sidebar a[href="${href}"]`)) {
    const li = link.closest("li");
    if (!li) continue;
    if (li.classList.contains("ext-merged-source")) continue;
    li.classList.toggle("ext-badge-hidden", !visible);
    return;
  }
}

let _adventureCleanupAttached = false;

function _evalAdventureVisibilityOnLeave() {
  if (location.pathname.startsWith("/game/arena/adventures")) return;
  _adventureCleanupAttached = false;
  window.removeEventListener("ext:navigate", _evalAdventureVisibilityOnLeave);
  window.removeEventListener("popstate", _evalAdventureVisibilityOnLeave);
  _updateNavBadges();
}

function _updateNavBadges() {
  if (_navBadgeUpdating) return;
  _navBadgeUpdating = true;

  // Adventures: hide when no unseen adventures (JS-based; CSS :has approach is unreliable
  // because Vue may use v-show which keeps the badge element in DOM with display:none)
  if (_unseenAdventures !== null) {
    let visible = !(_navSettings["hide-adventure-no-badge"] && _unseenAdventures === 0);
    
    // Only applied to Adventure page: Keep it visible if the user is currently on it.
    // Attach a one-time event listener to re-evaluate (and clean up) when they leave.
    if (!visible && location.pathname.startsWith("/game/arena/adventures")) {
      visible = true;
      if (!_adventureCleanupAttached) {
        _adventureCleanupAttached = true;
        window.addEventListener("ext:navigate", _evalAdventureVisibilityOnLeave);
        window.addEventListener("popstate", _evalAdventureVisibilityOnLeave);
      }
    }

    _setNavLinkVisibility("/game/arena/adventures", visible);
    // With merge-adventure-beasts the built link has no native Vue badge, so we render
    // our own. Without merge, the game already renders a native badge — don't duplicate.
    _setNavBadge("/game/arena/adventures",
      (_navSettings["merge-adventure-beasts"] && _unseenAdventures > 0) ? _unseenAdventures : null
    );
  }

  // Odjur: badge with remaining daily fights; hide when quota exhausted
  if (_beastsRemaining !== null) {
    _setNavLinkVisibility(
      "/game/arena/beasts",
      !(_navSettings["hide-beasts-completed"] && _beastsRemaining === 0)
    );
    _setNavBadge("/game/arena/beasts",
      (_navSettings["beasts-badge"] && _beastsRemaining > 0) ? _beastsRemaining : null
    );
  }

  // Dagliga uppdrag: badge with incomplete count; hide when all done
  if (_dailiesRemaining !== null) {
    _setNavLinkVisibility(
      "/game/arena/dailies",
      !(_navSettings["hide-dailies-completed"] && _dailiesRemaining === 0)
    );
    _setNavBadge("/game/arena/dailies",
      (_navSettings["dailies-badge"] && _dailiesRemaining > 0) ? _dailiesRemaining : null
    );
  }

  _navBadgeUpdating = false;
}
