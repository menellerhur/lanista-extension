// Feature: hide individual cooldown links in the sidebar's quick status bar.
// Identifies links by href + icon (stable) rather than localized label text.

// href-based overrides (arena & fixed city routes). Checked first.
const _CD_HREF_KEYS = {
  "/game/arena/chance-game":   "cd-mode-chance",
  "/game/arena/rankedbattles": "cd-mode-ranked",
  "/game/city/buildings/1":    "cd-mode-study",    // Library (Biblioteket)
  "/game/city/buildings/2":    "cd-mode-training", // Training hall (Träningslokal)
  "/game/city/buildings/3":    "cd-mode-health",   // Hall of health (Hälsans Sal)
};

// Icon-class → setting key. Used for clan building links.
// Order matters: first match wins.
const _CD_ICON_KEYS = [
  ["fa-book",     "cd-mode-study"],     // Clan: study hall (Lärosal)
  ["fa-swords",   "cd-mode-training"],  // Clan: training hall (Träningslokal)
  ["fa-coins",    "cd-mode-mine"],      // Clan: mine (Gruva)
];

function _cdClassify(a) {
  const href = a.getAttribute("href") || "";

  // 1. Exact href matches (Static routes for arena games and city buildings)
  if (_CD_HREF_KEYS[href]) return _CD_HREF_KEYS[href];

  // 2. Icon-based matches (For clan buildings which share hrefs)
  const icon = a.querySelector("i[class*='fa-']");
  if (!icon) return null;
  for (const [iconClass, key] of _CD_ICON_KEYS) {
    if (icon.classList.contains(iconClass)) return key;
  }
  return null;
}

function _cdFindContainer() {
  for (const div of document.querySelectorAll('.sidebar nav > div')) {
    if (div.querySelector('a[href*="buildings"], a[href*="chance-game"], a[href*="rankedbattles"]')) {
      return div.querySelector('.flex-col') || div;
    }
  }
  return null;
}

function _cdApply() {
  const container = _cdFindContainer();
  if (!container) return;

  const links = container.querySelectorAll('a');
  let visibleCooldowns = 0;
  let knownCount = 0;

  links.forEach(a => {
    const key = _cdClassify(a);
    if (!key) {
      a.classList.remove("ext-cd-hidden");
      return;
    }
    knownCount++;

    const mode = _navSettings[key] || "show";
    let shouldHide = false;
    if (mode === "hide") {
      shouldHide = true;
    } else if (mode === "auto") {
      // "Ready" items have bg-primary — only hide when NOT ready.
      const isReady = a.classList.contains("bg-primary") || a.className.includes("bg-primary");
      if (!isReady) shouldHide = true;
    }

    a.classList.toggle("ext-cd-hidden", shouldHide);
    if (!shouldHide) visibleCooldowns++;
  });

  // Hide the entire top block if we identified cooldown links and all are hidden.
  const wrapper = container.closest('.sidebar nav > div');
  if (wrapper && knownCount > 0) {
    wrapper.classList.toggle("ext-cd-wrapper-empty", visibleCooldowns === 0);
  }
}

function _cdRemove() {
  document.querySelectorAll(".ext-cd-hidden").forEach(el => el.classList.remove("ext-cd-hidden"));
  document.querySelectorAll(".ext-cd-wrapper-empty").forEach(el => el.classList.remove("ext-cd-wrapper-empty"));
}

registerNavFeature({
  name:    "cooldowns",
  // Always "enabled" when the master toggle is on; individual modes handled inside apply.
  enabled: s => !!s["hide-cooldowns-master"],
  apply:   _cdApply,
  remove:  _cdRemove,
  // Sub-settings change (individual cd-mode-* toggles) — re-run apply.
  onSettingsChange: () => _cdApply(),
});
