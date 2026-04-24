// Merchant availability times and requirements info on /game/market/merchants.
// Intercepts /api/merchants and injects info icon + time label next to each merchant name.
// Depends on: settings.js, api_handler.js, utils.js

let _merchantsSettings = {};
let _merchantsData = null;
let _merchantsObserver = null;

function _isMerchantsPage() {
  return location.pathname.startsWith("/game/market/merchants");
}

// Returns a display string for when this merchant arrives or leaves, or null if N/A.
function _getMerchantTimeInfo(merchant) {
  if (merchant.randomly_visible) {
    if (!merchant.should_be_shown && merchant.last_visible_at) {
      return "senast sedd " + utcDateTimeToSwedish(merchant.last_visible_at);
    }
    return null;
  }

  if (merchant.should_be_shown && merchant.visible_to) {
    return "försvinner " + utcTimeToSwedish(merchant.visible_to);
  }
  if (!merchant.should_be_shown && merchant.visible && merchant.visible_from) {
    return "anländer " + utcTimeToSwedish(merchant.visible_from);
  }

  return null;
}

// Returns true if this merchant has at least one restriction worth displaying.
function _hasRequirements(merchant) {
  return !merchant.sells_to_avatar ||
    merchant.min_level > 1 ||
    merchant.min_popularity !== null ||
    merchant.max_popularity !== null;
}

// Builds the info icon element with a hover tooltip.
function _buildInfoIcon(merchant) {
  const wrap = document.createElement("span");
  wrap.className = "ext-merchant-info-icon";

  const icon = document.createElement("i");
  icon.className = "fal fa-info-circle";
  wrap.appendChild(icon);

  const tip = document.createElement("span");
  tip.className = "ext-merchant-info-tooltip";

  const sentences = [];

  if (!merchant.sells_to_avatar) {
    sentences.push({ text: "Din gladiator kan ej handla här", warning: true });
  }
  if (merchant.min_level > 1) {
    sentences.push({ before: "Kräver att du är minst ", bold: "grad " + merchant.min_level });
  }
  if (merchant.min_popularity !== null && merchant.min_popularity !== undefined) {
    sentences.push({ before: "Kräver att du har som lägst ", bold: merchant.min_popularity + " i rykte" });
  }
  if (merchant.max_popularity !== null && merchant.max_popularity !== undefined) {
    sentences.push({ before: "Kräver att du har som mest ", bold: merchant.max_popularity + " i rykte" });
  }

  for (const s of sentences) {
    const row = document.createElement("span");
    row.className = "ext-mit-row" + (s.warning ? " ext-mit-warning" : "");
    if (s.text) {
      row.textContent = s.text;
    } else {
      row.appendChild(document.createTextNode(s.before));
      const b = document.createElement("strong");
      b.textContent = s.bold;
      row.appendChild(b);
    }
    tip.appendChild(row);
  }

  tip.style.display = "none";
  document.body.appendChild(tip);

  wrap.addEventListener("mouseenter", () => {
    const rect = wrap.getBoundingClientRect();
    tip.style.left = (rect.left + rect.width / 2) + "px";
    tip.style.top = (rect.top - 6) + "px";
    tip.style.transform = "translateX(-50%) translateY(-100%)";
    tip.style.display = "block";
  });
  wrap.addEventListener("mouseleave", () => { tip.style.display = "none"; });

  return wrap;
}

// Injects info icon and/or time label for all merchant links on the page.
function _injectMerchants() {
  if (!_isMerchantsPage()) return;
  if (!_merchantsData) return;

  const showTimes = _merchantsSettings["merchant-times"];
  const showInfo  = _merchantsSettings["merchant-info"];
  if (!showTimes && !showInfo) return;

  const merchantMap = {};
  for (const m of _merchantsData) merchantMap[m.id] = m;

  for (const a of document.querySelectorAll('a[href^="/game/market/merchants/"]')) {
    const match = a.getAttribute("href").match(/\/game\/market\/merchants\/(\d+)$/);
    if (!match) continue;
    const m = merchantMap[parseInt(match[1], 10)];
    if (!m) continue;

    // Elements are injected as siblings AFTER the <a> tag, not inside it.
    // This prevents the merchant link's hover underline and click navigation
    // from triggering when interacting with the icon or time label.
    // Use a data attribute to guard against double-injection.
    if (a.dataset.extMerchantDone) continue;
    a.dataset.extMerchantDone = "1";

    let insertAfter = a;

    if (showInfo && _hasRequirements(m)) {
      const icon = _buildInfoIcon(m);
      insertAfter.after(icon);
      insertAfter = icon;
    }

    if (showTimes) {
      const timeInfo = _getMerchantTimeInfo(m);
      if (timeInfo) {
        const span = document.createElement("span");
        span.className = "ext-merchant-time";
        span.textContent = ` (${timeInfo})`;
        insertAfter.after(span);
      }
    }
  }
}

function _setupMerchantsObserver() {
  if (_merchantsObserver) return;
  _merchantsObserver = new MutationObserver(() => {
    if (!_isMerchantsPage()) {
      _merchantsObserver.disconnect();
      _merchantsObserver = null;
      return;
    }
    _injectMerchants();
  });
  _merchantsObserver.observe(getGameContentRoot(), { childList: true, subtree: true });
}

apiRegisterHandler(/\/api\/merchants(\?|$)/, (url, data) => {
  _merchantsData = data;
  if (_isMerchantsPage()) _injectMerchants();
});

function _handleNavChange() {
  document.querySelectorAll(".ext-merchant-info-tooltip").forEach(el => el.remove());
  if (_isMerchantsPage()) {
    _setupMerchantsObserver();
    _injectMerchants();
  }
}

window.addEventListener("ext:navigate", _handleNavChange);
window.addEventListener("popstate", _handleNavChange);

function initMerchants(settings) {
  _merchantsSettings = settings;
  if (_isMerchantsPage()) {
    const cached = apiGetCacheByPattern(/\/api\/merchants(\?|$)/);
    if (cached) {
      _merchantsData = cached;
      _injectMerchants();
    }
    _setupMerchantsObserver();
  }
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  loadSettings().then(s => {
    _merchantsSettings = s;
    if (_isMerchantsPage()) _injectMerchants();
  });
});
