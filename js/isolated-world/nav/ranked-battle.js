// Sidebar features for "Rankade lagspel":
//  - link-rankedbattles-to-mygroup: clicking the link triggers Min grupp modal
//  - hide-rankedbattles-on-cooldown: hide the link entirely while on cooldown
//
// Data: ext:ranked-data (next_ranked_battle_at) from main-world/store-bridge.js,
// sourced from userStore.avatar.

const _RANKED_HREF = "/game/arena/rankedbattles";

let _nextRankedBattleAt = null; // ms epoch, or null
let _rankedExpiryTimer  = null;

window.addEventListener("ext:ranked-data", e => {
  const { nextRankedBattleAt } = e.detail || {};
  _nextRankedBattleAt = nextRankedBattleAt ? new Date(nextRankedBattleAt).getTime() : null;
  _scheduleRankedExpiry();
  if (_navSettings && _navSettings["hide-rankedbattles-on-cooldown"]) _rankedHideApply();
});

// Re-apply when the cooldown expires so the link re-appears without any user action.
function _scheduleRankedExpiry() {
  if (_rankedExpiryTimer) { clearTimeout(_rankedExpiryTimer); _rankedExpiryTimer = null; }
  if (!_nextRankedBattleAt) return;
  const ms = _nextRankedBattleAt - Date.now();
  if (ms <= 0) return;
  _rankedExpiryTimer = setTimeout(() => {
    _rankedExpiryTimer = null;
    if (_navSettings["hide-rankedbattles-on-cooldown"]) _rankedHideApply();
  }, ms + 250);
}

// --- Feature: hide on cooldown ---

function _rankedHideApply() {
  const onCooldown = _nextRankedBattleAt && _nextRankedBattleAt > Date.now();
  // Two links share this href when on cooldown: the top cooldown-bar entry (no <li>)
  // and the Arenan section link (inside <li>). Only the latter is what we want to hide.
  for (const link of document.querySelectorAll(`.sidebar a[href="${_RANKED_HREF}"]`)) {
    const li = link.closest("li");
    if (!li) continue;
    li.classList.toggle("ext-ranked-hidden", !!onCooldown);
    return;
  }
}

function _rankedHideRemove() {
  for (const el of document.querySelectorAll(".ext-ranked-hidden")) {
    el.classList.remove("ext-ranked-hidden");
  }
}

registerNavFeature({
  name:    "hide-rankedbattles-on-cooldown",
  enabled: s => !!s["hide-rankedbattles-on-cooldown"],
  apply:   _rankedHideApply,
  remove:  _rankedHideRemove,
});

// --- Feature: link Rankade lagspel → Min grupp modal ---
// Capture-phase listener (matches the Verkstad redirect pattern in nav/enhancements.js).
// If the user is not in a group the Min grupp button doesn't exist — fall back to
// normal navigation.

document.addEventListener("click", e => {
  if (!document.body.classList.contains("ext-s-link-rankedbattles-to-mygroup")) return;
  const isSublinkMode = document.body.classList.contains("ext-s-rankedbattles-sublink");
  if (isSublinkMode) return; // In sublink mode, main link works normally

  const link = e.target.closest(`.sidebar a[href="${_RANKED_HREF}"]`);
  if (!link) return;
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;

  const button = document.querySelector(".ext-panel-grupper button");
  if (!button) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  button.click();
}, true);

// --- Feature: Sublink injection for "Underlänk" mode ---
function _rankedScopeAttrFrom(el) {
  if (!el) return null;
  for (const attr of el.attributes) {
    if (attr.name.startsWith("data-v-")) return attr.name;
  }
  return null;
}

function _getSublinkScopeAttr() {
  const example = document.querySelector(".sidebar ul.ml-4 a.nav-item");
  return _rankedScopeAttrFrom(example);
}

function _rankedMyGroupApply() {
  if (!_navSettings["link-rankedbattles-to-mygroup"]) return;
  const isSublinkMode = document.body.classList.contains("ext-s-rankedbattles-sublink");

  if (!isSublinkMode) {
    _rankedMyGroupRemove();
    return;
  }

  // Match replace-mode behavior: only show the sublink when the user is in a
  // group — .ext-panel-grupper button exists iff the user belongs to one.
  if (!document.querySelector(".ext-panel-grupper button")) {
    _rankedMyGroupRemove();
    return;
  }

  // Find the Ranked battles link (inside an li)
  const links = document.querySelectorAll(`.sidebar a[href="${_RANKED_HREF}"]`);
  let li = null;
  for (const link of links) {
    const parentLi = link.closest("li");
    if (parentLi) { li = parentLi; break; }
  }
  if (!li) return;

  let sublink = li.querySelector(".ext-ranked-sublink");
  if (!sublink) {
    let ul = li.querySelector("ul");
    let createdUl = false;
    if (!ul) {
      ul = document.createElement("ul");
      ul.className = "ml-4 mt-1 space-y-0.5 border-l border-border/70 pl-2 text-xs ext-ranked-ul";
      createdUl = true;
    }

    const scopeAttr = _getSublinkScopeAttr() || _rankedScopeAttrFrom(li.querySelector("a"));
    sublink = document.createElement("li");
    sublink.className = "mb-1 ext-ranked-sublink";
    if (scopeAttr) sublink.setAttribute(scopeAttr, "");
    
    const a = document.createElement("a");
    if (scopeAttr) a.setAttribute(scopeAttr, "");
    a.className = "router-link nav-item group cursor-pointer";
    a.href = "javascript:void(0)";
    
    const outer = document.createElement("span");
    if (scopeAttr) outer.setAttribute(scopeAttr, "");
    outer.className = "flex w-full items-center gap-2";

    const iconWrap = document.createElement("span");
    if (scopeAttr) iconWrap.setAttribute(scopeAttr, "");
    iconWrap.className = "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center";

    const icon = document.createElement("i");
    if (scopeAttr) icon.setAttribute(scopeAttr, "");
    icon.className = "fal fa-users sidebar-sub-item-icon text-[10px]";
    iconWrap.appendChild(icon);
    
    const label = document.createElement("span");
    if (scopeAttr) label.setAttribute(scopeAttr, "");
    label.className = "sidebar-label flex-1 truncate";
    label.textContent = "Min grupp";
    
    outer.appendChild(iconWrap);
    outer.appendChild(label);
    a.appendChild(outer);
    sublink.appendChild(a);
    
    ul.appendChild(sublink);

    if (createdUl) {
      li.appendChild(ul);
    }

    a.addEventListener("click", e => {
      const button = document.querySelector(".ext-panel-grupper button");
      if (!button) return;
      e.preventDefault();
      e.stopPropagation();
      button.click();
    });
  }
}

function _rankedMyGroupRemove() {
  document.querySelectorAll(".ext-ranked-sublink").forEach(el => el.remove());
  document.querySelectorAll(".ext-ranked-ul").forEach(ul => {
    if (ul.children.length === 0) ul.remove();
  });
}

registerNavFeature({
  name:    "link-rankedbattles-to-mygroup",
  enabled: s => !!s["link-rankedbattles-to-mygroup"],
  apply:   _rankedMyGroupApply,
  remove:  _rankedMyGroupRemove,
});
