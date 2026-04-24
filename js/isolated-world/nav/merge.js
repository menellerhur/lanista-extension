// Feature: add the "Odjur" (beasts) and "Äventyr" (adventures) nav links under
// the "Arenan" section, hiding the originals in their own "Äventyr & Odjur"
// section via .ext-merged-source.
//
// We build our own <li> (instead of cloning the original) so the links work
// even when "Äventyr & Odjur" is collapsed — Vue removes its content from DOM
// in that state, which would leave the clone stale across gladiator switches
// (disabled/enabled state for Odjur depends on level).
//
// Vue scoped-CSS attribute (data-v-*) is scraped from a sibling nav <a> so
// scoped styles apply. The attribute name is unstable between game deploys;
// reading it live avoids hardcoding.

const _MERGE_HREFS = ["/game/arena/beasts", "/game/arena/adventures"];
const _BEASTS_MIN_LEVEL = 4; // Odjur link is disabled for gladiators below this level.

const _LINK_CONFIGS = [
  {
    href:    "/game/arena/beasts",
    label:   "odjur",
    icon:    "fal fa-skull",
    isDisabled: avatar => avatar != null && avatar.current_level < _BEASTS_MIN_LEVEL,
  },
  {
    href:    "/game/arena/adventures",
    label:   "Äventyr",
    icon:    "fal fa-map-marked-alt",
    isDisabled: () => false,
  },
];

function _mergeScopeAttrFrom(el) {
  if (!el) return null;
  for (const attr of el.attributes) {
    if (attr.name.startsWith("data-v-")) return attr.name;
  }
  return null;
}

function _mergeCreateEl(tag, scopeAttr, className) {
  const el = document.createElement(tag);
  if (scopeAttr) el.setAttribute(scopeAttr, "");
  if (className) el.className = className;
  return el;
}

function _mergeActiveAvatar() {
  // Prefer /api/avatars/me — freshest after level-up (other caches may be stale).
  const avatarMe = apiGetCacheByPattern(/\/api\/avatars\/me(\?|$)/);
  if (avatarMe && avatarMe.current_level !== undefined) return avatarMe;

  const avatars = apiGetCacheByPattern(/\/api\/users\/me\/avatars(\?|$)/);
  if (Array.isArray(avatars)) {
    const active = avatars.find(a => a.active === true);
    if (active) return active;
  }
  const userMe = apiGetCacheByPattern(/\/api\/users\/me(\?|$)/);
  return userMe?.avatar ?? null;
}

function _mergeBuildLink(config, scopeAttr) {
  // Mirrors the game's nav-link structure so _setNavBadge/_setNavLinkVisibility
  // (which target .flex.w-full inside the <a> and the closest <li>) work unchanged.
  const li = _mergeCreateEl("li", scopeAttr, "ext-merged-link");

  const a = _mergeCreateEl("a", scopeAttr, "router-link nav-item nav-command group");
  a.href = config.href;

  const outer = _mergeCreateEl("span", scopeAttr, "flex w-full items-center gap-2");
  const iconWrap = _mergeCreateEl("span", scopeAttr, "inline-flex h-4 w-4 shrink-0 items-center justify-center");
  const icon = _mergeCreateEl("i", scopeAttr, `${config.icon} sidebar-item-icon text-xs`);
  iconWrap.appendChild(icon);

  const label = _mergeCreateEl("span", scopeAttr, "sidebar-label flex-1 truncate");
  label.textContent = config.label;

  outer.appendChild(iconWrap);
  outer.appendChild(label);
  a.appendChild(outer);
  li.appendChild(a);

  a.addEventListener("click", e => {
    if (a.classList.contains("pointer-events-none")) return;
    e.preventDefault();
    e.stopPropagation();
    extRouterPush(config.href);
  });

  return li;
}

function _mergeUpdateState(li, config, avatar) {
  const a = li.querySelector("a");
  if (!a) return;

  const disabled = config.isDisabled(avatar);
  a.classList.toggle("pointer-events-none", disabled);
  a.classList.toggle("opacity-50",          disabled);

  // Active state: SPA routes may include sub-paths (e.g. /game/arena/beasts/123).
  const path = location.pathname;
  const active = path === config.href || path.startsWith(config.href + "/");
  a.classList.toggle("router-link-active",        active);
  a.classList.toggle("router-link-exact-active",  path === config.href);
}

function _mergeRehideSources(adventureSection) {
  for (const href of _MERGE_HREFS) {
    const li = adventureSection.querySelector(`a[href="${href}"]`)?.closest("li");
    if (!li) continue;
    // Vue may re-render the <li> fresh (losing our class) — always re-mark.
    li.classList.add("ext-merged-source");
  }
}

function _mergeUpdateWrapper(adventureSection) {
  const wrapper = adventureSection.parentElement;
  if (!wrapper) return;
  // Skip when section is collapsed — content removed from DOM, hasOtherLinks would be false.
  if (adventureSection.getAttribute("data-state") === "closed") return;
  const contentUl = adventureSection.querySelector('[data-slot="collapsible-content"] ul');
  const hasOtherLinks = contentUl && contentUl.querySelector('li:not(.ext-merged-source) a[href]');
  wrapper.classList.toggle("ext-wrapper-empty-merge", !hasOtherLinks);
}

function _mergeApply() {
  const arenaSection     = findNavSection("Arenan");
  const adventureSection = findNavSection("Äventyr & Odjur");
  if (!arenaSection) return;

  // Mark originals hidden whenever the "Äventyr & Odjur" section is rendered.
  if (adventureSection) _mergeRehideSources(adventureSection);

  // Arenan collapsed (content removed by Vue) — nothing to anchor against.
  const dailiesLi = arenaSection.querySelector('a[href="/game/arena/dailies"]')?.closest("li");
  if (!dailiesLi) {
    if (adventureSection) _mergeUpdateWrapper(adventureSection);
    return;
  }

  const scopeAttr = _mergeScopeAttrFrom(dailiesLi.querySelector("a"));
  const avatar    = _mergeActiveAvatar();

  const insertions = [
    { config: _LINK_CONFIGS[0], before: dailiesLi }, // beasts
    { config: _LINK_CONFIGS[1], after:  dailiesLi }, // adventures
  ];

  for (const { config, before, after } of insertions) {
    let li = arenaSection.querySelector(`.ext-merged-link a[href="${config.href}"]`)?.closest("li");
    if (!li) {
      li = _mergeBuildLink(config, scopeAttr);
      if (before) dailiesLi.parentElement.insertBefore(li, before);
      else        after.after(li);
    }
    _mergeUpdateState(li, config, avatar);
  }

  if (adventureSection) _mergeUpdateWrapper(adventureSection);
}

function _mergeRemove() {
  document.querySelectorAll(".ext-merged-link").forEach(el => el.remove());
  document.querySelectorAll(".ext-merged-source").forEach(el => {
    el.classList.remove("ext-merged-source");
  });
  document.querySelectorAll(".ext-wrapper-empty-merge").forEach(el => {
    el.classList.remove("ext-wrapper-empty-merge");
  });
}

// Avatar-driven refresh is handled centrally by nav/avatar-sync.js, which calls
// _runAllFeatures() — that invokes _mergeApply() via the feature registry.

registerNavFeature({
  name:    "merge-adventure-beasts",
  enabled: s => !!s["merge-adventure-beasts"],
  apply:   _mergeApply,
  remove:  _mergeRemove,
});
