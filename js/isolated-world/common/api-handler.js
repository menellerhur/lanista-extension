// Runs in isolated world. Bridges the ext:api CustomEvents from main world
// to registered handler callbacks. Also maintains a size-capped response cache.
//
// Usage:
//   apiRegisterHandler(/\/api\/battles\/\d+/, (url, data) => { ... });
//   apiGetCache(url); // returns cached data or undefined

var _apiHandlers = [];
var _apiCache    = {};
var _apiCacheKeys = [];
var _API_CACHE_MAX = 100;

function apiRegisterHandler(pattern, fn) {
  window.postMessage({ type: "ext:register", pattern: pattern.source }, "*");
  _apiHandlers.push({ pattern, fn });
}

function apiGetCache(url) {
  return _apiCache[url];
}

function apiGetCacheByPattern(pattern) {
  const key = Object.keys(_apiCache).find(k => pattern.test(k));
  return key ? _apiCache[key] : undefined;
}

window.addEventListener("ext:api", e => {
  const { url, data, requestData } = e.detail;
  if (!_apiCache[url]) {
    _apiCacheKeys.push(url);
    if (_apiCacheKeys.length > _API_CACHE_MAX) {
      delete _apiCache[_apiCacheKeys.shift()];
    }
  }
  _apiCache[url] = data;
  for (const h of _apiHandlers) {
    if (h.pattern.test(url)) h.fn(url, data, requestData);
  }
});
