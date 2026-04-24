// Tab bar injection for the auctions and buy-orders market pages.
// Hides native Vue/Reka tab triggers via CSS and replaces them with a custom
// tab bar that uses direct URL navigation for all tabs.
// Active state is determined from location.pathname — we never fight Vue.
// Depends on: settings.js (loadSettings)

let _buyOrdersSettings = {};
let _auctionNavObs = null;
let _tabObs = null;

const TAB_DEFS = [
  { label: "Pågående Auktioner",   url: "/game/market/auctions/ongoing"  },
  { label: "Mina Auktioner/Bud",   url: "/game/market/auctions/mine"     },
  { label: "Avslutade",            url: "/game/market/auctions/finished" },
  { label: "Efterfrågningar",      url: "/game/market/buy-orders"        },
  { label: "Mina Efterfrågningar", url: "/game/market/buy-orders/mine"   },
];

// --- Shared helpers ---

function _onMarketPage() {
  const p = location.pathname;
  return p.startsWith("/game/market/auctions") || p.startsWith("/game/market/buy-orders");
}

function _activeTabIdx() {
  const p = location.pathname;
  if (p.startsWith("/game/market/auctions/mine"))     return 1;
  if (p.startsWith("/game/market/auctions/finished")) return 2;
  if (p.startsWith("/game/market/auctions"))          return 0;
  if (p.startsWith("/game/market/buy-orders/mine"))   return 4;
  if (p.startsWith("/game/market/buy-orders"))        return 3;
  return -1;
}

function _makeBtn(refBtn, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = refBtn.className;
  btn.dataset.state = "inactive";
  btn.setAttribute("role", "tab");
  btn.setAttribute("aria-selected", "false");
  btn.textContent = label;
  return btn;
}

function _setActive(bar, activeBtn) {
  for (const btn of bar.querySelectorAll("button[role='tab']")) {
    const on = btn === activeBtn;
    btn.dataset.state = on ? "active" : "inactive";
    btn.setAttribute("aria-selected", on ? "true" : "false");
  }
}

function _navTo(url) {
  extRouterPush(url);
}

// --- Tab bar injection ---

function _injectTabBar() {
  if (!_buyOrdersSettings["add-buy-orders-tab"]) return false;
  if (!_onMarketPage()) return false;

  const nativeList = [...document.querySelectorAll('[data-slot="tabs-list"]')]
    .find(tl => [...tl.querySelectorAll(".tab-trigger")]
      .some(b => b.textContent.includes("Pågående auktioner") || b.textContent.includes("Efterfrågningar")));
  if (!nativeList) return false;

  const parent = nativeList.parentElement;
  if (!parent) return false;

  // If bar already exists, just update the active state to match current URL
  const existingBar = parent.querySelector(".ext-tab-bar");
  if (existingBar) {
    const idx = _activeTabIdx();
    const btns = existingBar.querySelectorAll("button[role='tab']");
    if (idx >= 0 && btns[idx]) _setActive(existingBar, btns[idx]);
    return true;
  }

  const refBtn = nativeList.querySelector(".tab-trigger");
  if (!refBtn) return false;

  const bar = document.createElement("div");
  bar.className = "ext-tab-bar " + nativeList.className;
  bar.setAttribute("role", "tablist");

  const btns = TAB_DEFS.map(({ label, url }) => {
    const b = _makeBtn(refBtn, label);
    b.addEventListener("click", () => {
      _setActive(bar, b);
      _navTo(url);
    });
    bar.appendChild(b);
    return b;
  });

  parent.insertBefore(bar, nativeList);

  const idx = _activeTabIdx();
  if (idx >= 0) _setActive(bar, btns[idx]);

  return true;
}

// --- Persistent tab observer ---
// Re-inject or update the tab bar if Vue re-renders.
// Self-disconnects when navigated away from the market pages.

function _setupTabObs() {
  if (_tabObs) return;
  _tabObs = new MutationObserver(() => {
    if (!_onMarketPage()) {
      _tabObs.disconnect(); _tabObs = null; return;
    }
    _injectTabBar();
  });
  _tabObs.observe(getGameContentRoot(), { childList: true, subtree: true });
}

function _waitForTab() {
  _injectTabBar();
  _setupTabObs();
}

// --- Active nav state ---
// Keep "auktioner" highlighted in the left menu when on the buy-orders page.
// Cleanup is synchronous (before Vue processes navigation) to prevent stale state.

function _cleanupAuctionNavActive() {
  if (_auctionNavObs) { _auctionNavObs.disconnect(); _auctionNavObs = null; }
  const link = document.querySelector('.sidebar a[href="/game/market/auctions"]');
  if (link?.dataset.extForceActive) {
    link.classList.remove("router-link-active");
    delete link.dataset.extForceActive;
  }
}

function _applyAuctionNavActive() {
  setTimeout(() => {
    if (!location.pathname.startsWith("/game/market/buy-orders")) return;
    if (!_buyOrdersSettings["add-buy-orders-tab"]) return;
    const link = document.querySelector('.sidebar a[href="/game/market/auctions"]');
    if (!link) return;

    link.dataset.extForceActive = "1";
    link.classList.add("router-link-active");
    link.classList.remove("not-active");

    if (_auctionNavObs) return;
    const obs = new MutationObserver(() => {
      if (!location.pathname.startsWith("/game/market/buy-orders")) {
        link.classList.remove("router-link-active");
        delete link.dataset.extForceActive;
        obs.disconnect();
        if (_auctionNavObs === obs) _auctionNavObs = null;
        return;
      }
      if (!link.classList.contains("router-link-active") || link.classList.contains("not-active")) {
        link.classList.add("router-link-active");
        link.classList.remove("not-active");
      }
    });
    _auctionNavObs = obs;
    obs.observe(link, { attributes: true, attributeFilter: ["class"] });
  }, 0);
}

function _updateBuyOrdersBodyClass() {
  document.body.classList.toggle("ext-on-buy-orders",
    location.pathname.startsWith("/game/market/buy-orders"));
}

// --- Event listeners ---

// Fired by router-observer.js (MAIN world) on every navigation
window.addEventListener("ext:navigate", e => {
  if (!_onMarketPage()) _cleanupAuctionNavActive();
  if (_onMarketPage()) _waitForTab();
  _updateBuyOrdersBodyClass();
  _applyAuctionNavActive();
});

// Fired on browser back/forward and our manual popstate dispatches
window.addEventListener("popstate", () => {
  if (!location.pathname.startsWith("/game/market/buy-orders")) _cleanupAuctionNavActive();
  if (_onMarketPage()) _waitForTab();
  _updateBuyOrdersBodyClass();
  _applyAuctionNavActive();
});

function initAuctions(settings) {
  _buyOrdersSettings = settings;
  if (_onMarketPage()) _waitForTab();
  _updateBuyOrdersBodyClass();
  _applyAuctionNavActive();
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  loadSettings().then(s => {
    const had = _buyOrdersSettings["add-buy-orders-tab"];
    _buyOrdersSettings = s;
    if (s["add-buy-orders-tab"] && !had) {
      if (_onMarketPage()) _waitForTab();
      _applyAuctionNavActive();
    } else if (!s["add-buy-orders-tab"] && had) {
      document.querySelectorAll(".ext-tab-bar").forEach(el => el.remove());
      if (_tabObs) { _tabObs.disconnect(); _tabObs = null; }
      _cleanupAuctionNavActive();
    }
  });
});
