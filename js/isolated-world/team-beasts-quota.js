// Shows a daily quota counter for "Lagspel mot odjur" on the team battles page.
// The game does not expose a client-side counter for this, so we reconstruct it
// by filtering /api/avatars/me/activity?query=lagspel (odjur) for entries since
// Swedish midnight, then increment locally on each BattleFinished TEAM_NPC event.
//
// The API call is avoided once we know the daily limit is hit — the count is
// cached in chrome.storage.local and only reset when the Swedish date rolls over.
//
// The daily_team_beasts limit is read from configModule via store-bridge (ext:config-data).
//
// Depends on: utils.js (swedishDateToday, swedishMidnightUTC, gameRequest),
//             settings.js (loadSettings), api-handler.js (apiRegisterHandler).

const _TB_QUOTA_CACHE_KEY = "team-beasts-quota";
const _TB_QUOTA_ACTIVITY_URL = "/api/avatars/me/activity?query=lagspel%20(odjur)";
const _TB_QUOTA_BATTLE_TYPE_TEAM_NPC = 9; // config.battle_types.TEAM_NPC
const _TB_QUOTA_LIMIT_FALLBACK = 10;      // fallback if ext:config-data hasn't fired yet

let _tbQuotaSettings = {};
let _tbQuotaCount = null;     // battles played today (Swedish)
let _tbQuotaDate = null;      // Swedish date for which _tbQuotaCount is valid
let _tbQuotaAvatarId = null;  // avatar the cached count belongs to
let _tbQuotaSynced = false;   // true once we've fetched the activity API today
let _tbQuotaObs = null;
let _tbQuotaFetching = false;
let _activeAvatarIdCached = null; // pushed in via ext:active-avatar from store-bridge

window.addEventListener("ext:active-avatar", e => {
  _activeAvatarIdCached = e.detail?.id ?? null;
});

function _onTeambattlesOpenPage() {
  const p = location.pathname;
  const onCorrectPath = p.startsWith("/game/arena/teambattles") && 
                        p !== "/game/arena/teambattles/create" && 
                        !/^\/game\/arena\/teambattles\/\d+$/.test(p);

  if (onCorrectPath) return true;

  // Fallback: Check DOM if we are on /game/account (common when navigating from virtual pages)
  if (p === "/game/account") {
    // Teambattles-header or the create button are good indicators
    return !!document.querySelector('.teambattles-header') || 
           Array.from(document.querySelectorAll('button')).some(b => {
             const t = b.textContent.trim();
             return t === "Skapa lagspel" || t === "Create team battle";
           });
  }

  return false;
}



apiRegisterHandler(/\/api\/(users|avatars)\/me(\?|$)/, () => {
  if (_onTeambattlesOpenPage() && _tbQuotaSettings["show-team-beasts-quota"]) {
    _initTbQuota();
  }
});

// Returns the active avatar id. Primary source is the store-bridge event;
// falls back to the API cache for the brief window before the bridge fires
// on first load.
function _getActiveAvatarId() {
  if (_activeAvatarIdCached) return _activeAvatarIdCached;

  const meAvatar = apiGetCacheByPattern(/\/api\/avatars\/me(\?|$)/);
  if (meAvatar?.id) return meAvatar.id;

  const userMe = apiGetCacheByPattern(/\/api\/users\/me(\?|$)/);
  if (userMe?.avatar?.id) return userMe.avatar.id;

  return null;
}

async function _loadTbQuotaFromStorage() {
  const today = swedishDateToday();
  const avatarId = _getActiveAvatarId();
  if (avatarId === null) return;

  try {
    const stored = await chrome.storage.local.get(_TB_QUOTA_CACHE_KEY);
    const map = stored[_TB_QUOTA_CACHE_KEY] || {};
    const cached = map[avatarId];

    if (cached && cached.date === today && typeof cached.count === "number") {
      _tbQuotaCount = cached.count;
      _tbQuotaDate = today;
      _tbQuotaAvatarId = avatarId;
      return;
    }
  } catch (e) {}

  // Only reset to null if we don't have any valid data at all yet.
  // This ensures the counter stays visible when navigating between tabs.
  if (_tbQuotaCount === null) {
    _tbQuotaDate = today;
    _tbQuotaAvatarId = avatarId;
    _tbQuotaSynced = false;
  }
}

async function _persistTbQuota() {
  if (_tbQuotaAvatarId === null) return;
  try {
    const stored = await chrome.storage.local.get(_TB_QUOTA_CACHE_KEY);
    const map = stored[_TB_QUOTA_CACHE_KEY] || {};
    map[_tbQuotaAvatarId] = {
      date: _tbQuotaDate,
      count: _tbQuotaCount
    };
    await chrome.storage.local.set({ [_TB_QUOTA_CACHE_KEY]: map });
  } catch (e) {
    if (e.message?.includes("Extension context invalidated")) location.reload();
  }
}

// Roll over the cache if the Swedish date has advanced or the active avatar changed.
function _rolloverIfNeeded() {
  const today = swedishDateToday();
  const avatarId = _getActiveAvatarId();
  const avatarChanged = avatarId !== null && _tbQuotaAvatarId !== null && avatarId !== _tbQuotaAvatarId;
  if (_tbQuotaDate !== today || avatarChanged) {
    _tbQuotaDate = today;
    _tbQuotaAvatarId = avatarId ?? _tbQuotaAvatarId;
    _tbQuotaCount = 0;
    _tbQuotaSynced = false;
    _persistTbQuota();
  } else if (_tbQuotaAvatarId === null && avatarId !== null) {
    _tbQuotaAvatarId = avatarId;
  }
}

// Fetch activity log and count entries since Swedish midnight.
// Paginates forward until we see an entry from before the cutoff.
async function _syncFromActivity() {
  if (_tbQuotaFetching) return;
  _tbQuotaFetching = true;
  try {
    const cutoff = swedishMidnightUTC().getTime();
    let count = 0;
    let url = _TB_QUOTA_ACTIVITY_URL;
    let reachedOlderEntries = false;

    // Safety cap: 10 pages is plenty since limit is typically 10.
    for (let page = 0; page < 10 && url; page++) {
      const data = await gameRequest(url);
      const rows = Array.isArray(data?.data) ? data.data : [];
      for (const row of rows) {
        const ts = new Date(row.created_at).getTime();
        if (ts < cutoff) { reachedOlderEntries = true; break; }
        count++;
      }
      if (reachedOlderEntries) break;
      url = data?.links?.next || null;
    }

    _tbQuotaCount = count;
    _tbQuotaSynced = true;
    await _persistTbQuota();
    _renderTbQuota();
  } catch (e) {
    console.error("Lanista Extension: failed to sync team-beasts quota", e);
  } finally {
    _tbQuotaFetching = false;
  }
}

function _effectiveLimit() {
  const limitVal = window.ExtConfig?.daily_team_beasts;
  return limitVal ? parseInt(limitVal, 10) : _TB_QUOTA_LIMIT_FALLBACK;
}

// Fetch activity only if we haven't yet confirmed the count today AND the
// cached count is below the limit. Once the quota is reached the cached value
// cannot go up until Swedish midnight, so no refresh is needed.
async function _maybeSync() {
  // If we don't know which avatar is active yet, don't attempt to sync.
  // This avoids accidental 0/10 resets during gladiator switch transitions.
  const avatarId = _getActiveAvatarId();
  if (avatarId === null) return;

  _rolloverIfNeeded();

  // If we've already synced once in this session, we don't need to call the API.
  // This ensures the cache is verified against the server at least once per session,
  // even if the local count is already at the limit.
  if (_tbQuotaSynced) return;

  await _syncFromActivity();
}

// --- UI injection ---

function _findQuotaAnchor() {
  // Lanista has a specific container for header actions (lg:ml-auto flex).
  // We use this as the primary anchor because it persists even when the 
  // "Skapa lagspel" button is hidden (e.g., when already in a battle).
  const actionSlot = document.querySelector('.lg\\:ml-auto.flex.items-center');
  if (actionSlot) return actionSlot;

  // Fallback: search for the button container by text if the structure above fails
  const labels = ["Skapa lagspel", "Create team battle"];
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (labels.includes(btn.textContent.trim())) {
      return btn.parentElement;
    }
  }
  return null;
}

function _renderTbQuota() {

  const existing = document.getElementById("ext-tb-quota");
  const onPage = _onTeambattlesOpenPage();
  const settingOn = !!_tbQuotaSettings["show-team-beasts-quota"];

  // If we've left the page entirely, clean up the DOM.
  if (!onPage) {
    if (existing) existing.remove();
    return;
  }

  // If loading or the setting is off, hide the element but keep it in the DOM 
  // to avoid re-insertion flickering during fast transitions/syncs.
  if (!settingOn || _tbQuotaCount === null) {
    if (existing) existing.style.display = "none";
    return;
  }

  const anchor = _findQuotaAnchor();
  if (!anchor) return;

  const limit = _effectiveLimit();
  const count = _tbQuotaCount ?? 0;
  const atMax = count >= limit;

  const text = `Lagspel mot odjur: ${count}/${limit}`;

  let pill = existing;
  if (!pill) {
    pill = document.createElement("span");
    pill.id = "ext-tb-quota";
    pill.className = "ext-tb-quota" + (atMax ? " ext-tb-quota-max" : "");
    pill.textContent = text;
    anchor.insertBefore(pill, anchor.firstChild);
    return;
  }

  // Restore visibility and update state
  if (pill.style.display === "none") pill.style.display = "";

  // Only mutate when values actually change — otherwise the MutationObserver
  // re-triggers _renderTbQuota() from its own writes and the page locks up.
  if (pill.parentElement !== anchor) anchor.insertBefore(pill, anchor.firstChild);
  if (pill.classList.contains("ext-tb-quota-max") !== atMax) {
    pill.classList.toggle("ext-tb-quota-max", atMax);
  }
  if (pill.textContent !== text) pill.textContent = text;
}

function _setupTbQuotaObs() {
  if (_tbQuotaObs) return;
  _tbQuotaObs = new MutationObserver(() => {
    _renderTbQuota();
  });
  _tbQuotaObs.observe(getGameContentRoot(), { childList: true, subtree: true });
}

async function _initTbQuota() {
  // Always ensure the observer is running if the setting is on
  if (_tbQuotaSettings["show-team-beasts-quota"]) _setupTbQuotaObs();

  if (!_onTeambattlesOpenPage()) return;
  if (!_tbQuotaSettings["show-team-beasts-quota"]) return;

  await _loadTbQuotaFromStorage();

  _renderTbQuota();
  await _maybeSync();
}

// --- Event wiring ---

// Increment when a TEAM_NPC battle finishes. The socket-listener in MAIN world
// dispatches this with { type }. We also re-sync the cache immediately.
window.addEventListener("ext:battle-finished", (e) => {
  if (e.detail?.type !== _TB_QUOTA_BATTLE_TYPE_TEAM_NPC) return;
  _rolloverIfNeeded();
  _tbQuotaCount = (_tbQuotaCount ?? 0) + 1;
  _persistTbQuota();
  _renderTbQuota();
});

window.addEventListener("ext:navigate", () => {
  _initTbQuota();
});

window.addEventListener("popstate", () => {
  _initTbQuota();
});

// Gladiator switch without page reload — the counter is per-avatar.
// We reset to null and hide the UI immediately, then wait for the user/avatar
// API handler to trigger a fresh _initTbQuota once the new ID is ready.
window.addEventListener("ext:gladiator-switched", () => {
  _tbQuotaSynced = false;
  _tbQuotaCount = null;
  _tbQuotaAvatarId = null;
  _renderTbQuota();
});

function initTeamBeastsQuota(settings) {
  _tbQuotaSettings = settings;
  _initTbQuota();
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  loadSettings().then(settings => {
    const effective = getEffectiveSettings(settings);
    const wasOn = _tbQuotaSettings["show-team-beasts-quota"];
    _tbQuotaSettings = effective;
    if (effective["show-team-beasts-quota"] && !wasOn) {
      _initTbQuota();
    } else if (!effective["show-team-beasts-quota"] && wasOn) {
      if (_tbQuotaObs) { _tbQuotaObs.disconnect(); _tbQuotaObs = null; }
      document.getElementById("ext-tb-quota")?.remove();
    } else if (_onTeambattlesOpenPage()) {
      _renderTbQuota();
    }
  });
});
