// Avatar info page enhancements.
// Currently handles moving standard tactics side-by-side.
// Depends on: common/settings.js (loadSettings)

let _infoSettings = {};
let _infoObserver = null;

function _isInfoPage() {
  return location.pathname === "/game/avatar/me/info";
}

function _isAnyInfoPage() {
  return /^\/game\/avatar\/(me|\d+)\/info$/.test(location.pathname);
}

function _applyTacticsSideBySide() {
  if (!_infoSettings["info-tactics-side-by-side"] || !_isInfoPage()) return;

  const headers = [...document.querySelectorAll('p.font-serif')];
  const gladHeader = headers.find(h => h.textContent.includes("Standardtaktik för strider"));
  const beastHeader = headers.find(h => h.textContent.includes("Standardtaktik för odjursstrider"));

  if (!gladHeader || !beastHeader) return;
  
  // Guard: already applied (only if they are children of our col class)
  if (gladHeader.parentElement.classList.contains("ext-info-tactics-col")) return;

  const wrapper = gladHeader.parentElement;
  if (!wrapper) return;

  const grid = document.createElement("div");
  grid.className = "ext-info-tactics-grid";
  
  const leftCol = document.createElement("div");
  leftCol.className = "ext-info-tactics-col";
  
  const rightCol = document.createElement("div");
  rightCol.className = "ext-info-tactics-col";
  
  grid.appendChild(leftCol);
  grid.appendChild(rightCol);

  // Collect Gladiator elements (Header + 4 siblings)
  const gladNodes = [gladHeader];
  let next = gladHeader.nextElementSibling;
  for (let i = 0; i < 4 && next && next !== beastHeader; i++) {
    gladNodes.push(next);
    next = next.nextElementSibling;
  }

  // Collect Beast elements (Header + 2 siblings)
  const beastNodes = [beastHeader];
  next = beastHeader.nextElementSibling;
  const actionsHeader = headers.find(h => h.textContent.includes("Handlingar"));
  for (let i = 0; i < 2 && next && next !== actionsHeader; i++) {
    beastNodes.push(next);
    next = next.nextElementSibling;
  }

  // Move them
  gladNodes.forEach(n => leftCol.appendChild(n));
  beastNodes.forEach(n => rightCol.appendChild(n));

  // Insert grid
  wrapper.appendChild(grid);
}

function _applyInfoVisibility() {
  if (!_isAnyInfoPage()) return;

  if (_infoSettings["hide-ranking-points"]) {
    [...document.querySelectorAll('div.flex')].forEach(div => {
      const p = div.querySelector('p');
      if (!p) return;
      const text = p.textContent.trim();
      if (text === "Rankingpoäng:" || text === "Max RP:") {
        div.style.display = "none";
      }
    });
  }

  if (_infoSettings["hide-basic-stats"]) {
    const kicker = [...document.querySelectorAll('.section-kicker')]
      .find(el => el.textContent.includes("Grundegenskaper"));
    if (kicker && kicker.parentElement) {
      kicker.parentElement.style.display = "none";
    }
  }

  if (_infoSettings["hide-reputation"]) {
    [...document.querySelectorAll('div.flex')].forEach(div => {
      const p = div.querySelector('p');
      if (!p) return;
      const text = p.textContent.trim().toLowerCase();
      if (text === "rykte:" || text === "ryktestyp:") {
        div.style.display = "none";
      }
    });
  }

  if (_infoSettings["hide-ally"]) {
    [...document.querySelectorAll('div.flex')].forEach(div => {
      const p = div.querySelector('p');
      if (!p) return;
      if (p.textContent.trim() === "Allierad med:") {
        div.style.display = "none";
      }
    });
  }
}

function _setupInfoObserver() {
  if (_infoObserver) return;
  _infoObserver = new MutationObserver(() => {
    if (!_isAnyInfoPage()) {
      _teardownInfoObserver();
      return;
    }
    if (_isInfoPage()) _applyTacticsSideBySide();
    _applyInfoVisibility();
  });
  _infoObserver.observe(getGameContentRoot(), { childList: true, subtree: true });
}

function _teardownInfoObserver() {
  if (!_infoObserver) return;
  _infoObserver.disconnect();
  _infoObserver = null;
}

async function initAvatarInfo(settings) {
  _infoSettings = settings || await loadSettings();
  if (!_isAnyInfoPage()) return;
  if (_isInfoPage()) _applyTacticsSideBySide();
  _applyInfoVisibility();
  _setupInfoObserver();
}

function _handleInfoNav() {
  if (!_isAnyInfoPage()) {
    _teardownInfoObserver();
    return;
  }
  if (_isInfoPage()) _applyTacticsSideBySide();
  _applyInfoVisibility();
  _setupInfoObserver();
}

// React to SPA navigation
window.addEventListener("ext:navigate", _handleInfoNav);
window.addEventListener("popstate", _handleInfoNav);

// React to settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  loadSettings().then(s => {
    const sideBySideChanged = s["info-tactics-side-by-side"] !== _infoSettings["info-tactics-side-by-side"];
    const visibilityChanged = s["hide-ranking-points"] !== _infoSettings["hide-ranking-points"] ||
                              s["hide-basic-stats"] !== _infoSettings["hide-basic-stats"] ||
                              s["hide-reputation"] !== _infoSettings["hide-reputation"] ||
                              s["hide-ally"] !== _infoSettings["hide-ally"];
    
    _infoSettings = s;
    
    if (sideBySideChanged && _isInfoPage()) location.reload();
    else if (visibilityChanged && _isAnyInfoPage()) location.reload();
  });
});
