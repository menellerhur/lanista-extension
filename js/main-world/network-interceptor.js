// Runs in MAIN world — wraps window.fetch and XMLHttpRequest to intercept API responses.
// Dispatches results as events for the isolated world to consume.
(function() {
  const _patterns = [];
  let _socketId = "";

  // Listen for registration of API patterns from the isolated world
  window.addEventListener("message", event => {
    if (event.source === window && event.data?.type === "ext:register") {
      _patterns.push(new RegExp(event.data.pattern));
    }
  });

  const dispatch = (url, responseData, requestData) => {
    window.dispatchEvent(new CustomEvent("ext:api", { 
      detail: { url, data: responseData, requestData } 
    }));
  };
  
  const captureSocketId = (value) => {
    if (value && value !== _socketId) {
      _socketId = value;
      window.dispatchEvent(new CustomEvent("ext:socket-id", { detail: value }));
    }
  };

  // --- API Interception (Fetch) ---
  const _origFetch = window.fetch;
  window.fetch = async (...args) => {
    const headers = args[0]?.headers || args[1]?.headers;
    if (headers) {
      const socketId = (headers instanceof Headers) 
        ? headers.get("x-socket-id") 
        : (headers["x-socket-id"] || headers["X-Socket-Id"]);
      if (socketId) captureSocketId(socketId);
    }

    const response = await _origFetch(...args);
    const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
    
    if (_patterns.some(pattern => pattern.test(url))) {
      let requestData = null;
      try {
        const body = args[1]?.body || (typeof args[0] !== "string" ? args[0]?.body : null);
        if (body) {
          if (typeof body === "string") requestData = JSON.parse(body);
        }
      } catch {
        // Request body parsing is best-effort; some endpoints use FormData or
        // other non-JSON bodies and we simply pass requestData=null in that case.
      }

      // Response cloning is best-effort too: if the response is not JSON (HTML
      // error pages, etc.) we skip dispatch rather than propagate errors back
      // to the page's own fetch handling.
      response.clone().json().then(data => dispatch(url, data, requestData)).catch(() => {});
    }
    return response;
  };

  // --- API Interception (XMLHttpRequest) ---
  const _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._extUrl = url;
    return _origOpen.call(this, method, url, ...rest);
  };

  const _origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (name.toLowerCase() === "x-socket-id") captureSocketId(value);
    return _origSetRequestHeader.call(this, name, value);
  };

  const _origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    this._extRequestData = body;
    this.addEventListener("load", () => {
      const url = this._extUrl;
      if (this.status >= 200 && this.status < 300 && _patterns.some(p => p.test(url))) {
        let requestData = null;
        try { if (this._extRequestData && typeof this._extRequestData === "string") requestData = JSON.parse(this._extRequestData); } catch {}
        try { dispatch(url, JSON.parse(this.responseText), requestData); } catch {}
      }
    });
    return _origSend.call(this, body);
  };
})();
