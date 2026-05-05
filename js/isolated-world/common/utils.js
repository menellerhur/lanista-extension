// Shared utilities for making API requests that match the game's own XHR format.
// Also contains general-purpose helpers for time formatting.

// Converts a UTC time-of-day string ("HH:MM:SS") to Swedish local time ("HH:MM").
// Handles DST automatically via the Europe/Stockholm time zone.
function utcTimeToSwedish(timeStr) {
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setUTCHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

// Converts a UTC ISO datetime string to Swedish local date+time ("YYYY-MM-DD HH:MM").
function utcDateTimeToSwedish(isoString) {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

// Converts a UTC datetime string to Swedish local time-of-day ("HH:MM").
// Accepts both ISO 8601 ("2026-04-25T18:15:00.000000Z") and SQL-ish
// ("2026-04-25 17:40:00") formats — the latter is normalized by replacing
// the space with "T" and appending "Z" so Date treats it as UTC.
function utcDateTimeToSwedishTime(input) {
  if (!input) return null;
  let s = typeof input === "string" ? input : "";
  if (s && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }
  const d = new Date(s || input);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

// Returns today's date ("YYYY-MM-DD") as seen in Europe/Stockholm.
function swedishDateToday() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

// Returns the UTC Date for midnight (00:00) Europe/Stockholm of today.
// Used as the lower bound when counting activity entries "since Swedish midnight".
// Samples the offset at 00:00 UTC of the Swedish date — at that instant Stockholm
// is always at 01:00 (CET) or 02:00 (CEST), which is before either DST transition
// point (02:00 spring-forward, 03:00 fall-back), so the offset matches midnight.
function swedishMidnightUTC() {
  const [y, m, d] = swedishDateToday().split("-").map(n => parseInt(n, 10));
  const sampleUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    timeZoneName: "shortOffset"
  }).formatToParts(sampleUtc).find(p => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = /GMT([+-])(\d+)(?::(\d+))?/.exec(tzName);
  const sign = match && match[1] === "-" ? -1 : 1;
  const hh = match ? parseInt(match[2], 10) : 0;
  const mm = match && match[3] ? parseInt(match[3], 10) : 0;
  const offsetMin = sign * (hh * 60 + mm);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMin * 60 * 1000);
}

// The WebSocket socket ID is captured from the game's outgoing requests by api_interceptor.js
// (main world) and broadcast here via CustomEvent. It is the same for all requests in a session.
let _socketId = "";
window.addEventListener("ext:socket-id", e => { _socketId = e.detail; });

// Central cache for Pinia store data bridged from the main world.
window.ExtConfig = null;
window.addEventListener("ext:config-data", e => { window.ExtConfig = e.detail; });

/**
 * Returns a promise that resolves once ExtConfig is available.
 * If already available, resolves immediately.
 */
function ensureExtConfig() {
  return new Promise(resolve => {
    if (window.ExtConfig) return resolve(window.ExtConfig);
    const onData = e => {
      window.removeEventListener("ext:config-data", onData);
      resolve(e.detail);
    };
    window.addEventListener("ext:config-data", onData);
  });
}


// Reads the XSRF token from the XSRF-TOKEN cookie (used by Laravel CSRF protection).
function getXsrfToken() {
  const prefix = "XSRF-TOKEN=";
  for (let part of document.cookie.split(";")) {
    part = part.trim();
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return "";
}

// Makes an API request that mimics the game's own format (100% same headers and XHR).
// Automatically injects XSRF and Socket-ID headers and dispatches ext:api on success.
function gameRequest(url, options = {}) {
  const method = options.method || "GET";
  const body   = options.body;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    // Standard headers matching the game's native requests
    xhr.setRequestHeader("Accept",           "application/json");
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader("X-XSRF-TOKEN",     getXsrfToken());

    if (_socketId) {
      xhr.setRequestHeader("X-Socket-Id", _socketId);
    }

    // Set Content-Type for JSON bodies if not already specified
    if (body && typeof body !== "string") {
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    // Apply any additional headers provided in options
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        xhr.setRequestHeader(key, value);
      }
    }

    xhr.onload = function() {
      if (this.status >= 200 && this.status < 300) {
        let data;
        try {
          data = JSON.parse(this.responseText);
        } catch (e) {
          reject(new Error(`Lanista Extension: JSON Parse Error (${url})`));
          return;
        }

        // Broadcast to notify other modules (and populate cache)
        window.dispatchEvent(new CustomEvent("ext:api", { detail: { url, data } }));
        resolve(data);
      } else {
        reject(new Error(`Lanista Extension: API Error ${this.status} (${url})`));
      }
    };

    xhr.onerror = () => reject(new Error(`Lanista Extension: Network Error (${url})`));

    xhr.send(body ? (typeof body === "string" ? body : JSON.stringify(body)) : null);
  });
}

// Returns the Vue-rendered main content container if mounted, otherwise body.
// Use as an observer target to avoid reacting to mutations in unrelated chrome
// (sidebars, popovers). Falls back to body when called before Vue has mounted
// the page root so callers never need a null check.
function getGameContentRoot() {
  return document.querySelector(".content.min-w-0.border.bg-card") || document.body;
}

// Programmatic navigation helpers that use the Vue Router bridge (MAIN world).
// They automatically strip the /game prefix to match the router's base path.
function extRouterPush(url) {
  if (!url) return;
  const path = url.replace(/^\/game/, "");
  window.dispatchEvent(new CustomEvent("ext:router-push", { detail: path }));
}

function extRouterReplace(url) {
  if (!url) return;
  const path = url.replace(/^\/game/, "");
  window.dispatchEvent(new CustomEvent("ext:router-replace", { detail: path }));
}

