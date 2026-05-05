// Right panel collapse/expand for the avatar nav and konto sections.
// Depends on: common/settings.js, common/icons.js (icon)

const _RPC_AVATAR_NAV_LINKS = [
  { href: "/game/avatar/me/info",             key: "rpc-av-info" },
  { href: "/game/avatar/me/bio",              key: "rpc-av-bio" },
  { href: "/game/avatar/me/stats",            key: "rpc-av-stats" },
  { href: "/game/avatar/me/history",          key: "rpc-av-history" },
  { href: "/game/avatar/me/statistics",       key: "rpc-av-statistics" },
  { href: "/game/avatar/me/gear",             key: "rpc-av-gear" },
  { href: "/game/avatar/me/professions",      key: "rpc-av-professions" },
  { href: "/game/avatar/me/achievements",     key: "rpc-av-achievements" },
  { href: "/game/avatar/me/activity",         key: "rpc-av-activity" },
  { href: "/game/avatar/me/passive-settings", key: "rpc-av-passive" },
];

const _RPC_KONTO_LINKS = [
  { liClass: "ext-extension-link", key: "rpc-ko-extension" },
  { liClass: "ext-database-link",  key: "rpc-ko-database" },
  { liClass: "ext-notifications-link",   key: "rpc-ko-notifications" },
  { liClass: "ext-plan-gladiator-link", key: "rpc-ko-plan-gladiator" },
  { href: "/game/stable",          key: "rpc-ko-stable" },
  { href: "/game/notes",           key: "rpc-ko-notes" },
  { href: "/game/friends",         key: "rpc-ko-friends" },
  { href: "/game/account",         key: "rpc-ko-account" },
  { href: "/game/messages",        key: "rpc-ko-messages" },
  { href: "/logout",               key: "rpc-ko-logout" },
];

let _rpcSettings = {};
let _rpcCollapseState = { avatarNav: false, konto: false };

function _rpcInjectChevron(kicker) {
  if (kicker.querySelector(".ext-rpc-chevron")) return;
  // Wrap bare text nodes in a span so the flex container can truncate the
  // name correctly (text nodes can't shrink below content width in flex).
  if (!kicker.querySelector(".ext-rpc-text")) {
    const span = document.createElement("span");
    span.className = "ext-rpc-text";
    [...kicker.childNodes]
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .forEach(n => span.appendChild(n));
    kicker.insertBefore(span, kicker.firstChild);
  }
  kicker.insertAdjacentHTML("beforeend", icon("chevron-down", { size: 14, class: "ext-rpc-chevron", ariaHidden: true }));
}

function _rpcUpdateChevron(kicker, collapsed) {
  kicker?.querySelector(".ext-rpc-chevron")?.classList.toggle("ext-rpc-collapsed", collapsed);
}

// Build a { href -> key, liClass -> key } lookup once per linkMap so that
// _rpcApplyLinkVisibility is O(1) per <li> instead of O(n) via .find().
const _rpcIndexCache = new WeakMap();
function _rpcIndexLinkMap(linkMap) {
  let index = _rpcIndexCache.get(linkMap);
  if (index) return index;
  index = { byHref: new Map(), byLiClass: new Map() };
  for (const m of linkMap) {
    if (m.href) index.byHref.set(m.href, m.key);
    if (m.liClass) index.byLiClass.set(m.liClass, m.key);
  }
  _rpcIndexCache.set(linkMap, index);
  return index;
}

function _rpcApplyLinkVisibility(panel, linkMap, collapsed) {
  const ul = panel.querySelector("ul");
  if (!ul) return;
  const index = _rpcIndexLinkMap(linkMap);
  for (const li of ul.querySelectorAll(":scope > li")) {
    if (!collapsed) {
      li.classList.remove("ext-rpc-hidden");
      continue;
    }
    let key;
    for (const [cls, k] of index.byLiClass) {
      if (li.classList.contains(cls)) { key = k; break; }
    }
    if (!key) {
      const href = li.querySelector("a[href]")?.getAttribute("href");
      if (href) key = index.byHref.get(href);
    }
    // Checked (true) = collapsable = hide; unchecked (false) or unknown = always visible
    li.classList.toggle("ext-rpc-hidden", !!(key && _rpcSettings[key]));
  }
}

function _rpcSetupPanel(panelClass, masterKey, linkMap, stateKey, storageKey) {
  if (!_rpcSettings[masterKey]) return;
  const panel = document.querySelector(panelClass);
  if (!panel) return;
  const kicker = panel.querySelector(".section-kicker");
  if (!kicker) return;

  kicker.classList.add("ext-rpc-kicker");
  _rpcInjectChevron(kicker);

  const collapsed = _rpcCollapseState[stateKey];
  kicker.dataset.extRpcCollapsed = collapsed ? "1" : "0";
  _rpcUpdateChevron(kicker, collapsed);
  _rpcApplyLinkVisibility(panel, linkMap, collapsed);

  if (kicker._rpcClickHandler) {
    kicker.removeEventListener("click", kicker._rpcClickHandler);
  }
  const handler = async () => {
    const next = kicker.dataset.extRpcCollapsed !== "1";
    kicker.dataset.extRpcCollapsed = next ? "1" : "0";
    _rpcCollapseState[stateKey] = next;
    _rpcUpdateChevron(kicker, next);
    _rpcApplyLinkVisibility(panel, linkMap, next);
    try {
      await chrome.storage.local.set({ [storageKey]: next });
    } catch (e) {
      if (!handleChromeError(e)) console.error("Lanista Extension: failed to persist collapse state", e);
    }
  };
  kicker._rpcClickHandler = handler;
  kicker.addEventListener("click", handler);
}

function _removeRightPanelPanel(panelClass) {
  const panel = document.querySelector(panelClass);
  if (!panel) return;
  const kicker = panel.querySelector(".section-kicker");
  if (kicker) {
    kicker.classList.remove("ext-rpc-kicker");
    kicker.querySelector(".ext-rpc-chevron")?.remove();
    const textSpan = kicker.querySelector(".ext-rpc-text");
    if (textSpan) {
      while (textSpan.firstChild) kicker.insertBefore(textSpan.firstChild, textSpan);
      textSpan.remove();
    }
    if (kicker._rpcClickHandler) {
      kicker.removeEventListener("click", kicker._rpcClickHandler);
      delete kicker._rpcClickHandler;
    }
    delete kicker.dataset.extRpcCollapsed;
  }
  panel.querySelectorAll("ul > li").forEach(li => { li.classList.remove("ext-rpc-hidden"); });
}

function applyRightPanelCollapse() {
  if (_rpcSettings["right-panel-collapse-av"]) {
    _rpcSetupPanel(".ext-panel-avatar-nav", "right-panel-collapse-av", _RPC_AVATAR_NAV_LINKS, "avatarNav", "rpc-avatar-nav-collapsed");
  } else {
    _removeRightPanelPanel(".ext-panel-avatar-nav");
  }
  if (_rpcSettings["right-panel-collapse-ko"]) {
    _rpcSetupPanel(".ext-panel-konto", "right-panel-collapse-ko", _RPC_KONTO_LINKS, "konto", "rpc-konto-collapsed");
  } else {
    _removeRightPanelPanel(".ext-panel-konto");
  }
}

function updateRightPanelCollapseSettings(settings) {
  _rpcSettings = settings;
  applyRightPanelCollapse();
}

async function initRightPanelCollapse(settings) {
  _rpcSettings = settings;
  if (!settings["right-panel-collapse-av"] && !settings["right-panel-collapse-ko"]) return;
  try {
    const result = await chrome.storage.local.get(["rpc-avatar-nav-collapsed", "rpc-konto-collapsed"]);
    _rpcCollapseState.avatarNav = !!result["rpc-avatar-nav-collapsed"];
    _rpcCollapseState.konto = !!result["rpc-konto-collapsed"];
  } catch (e) {}
  applyRightPanelCollapse();
}
