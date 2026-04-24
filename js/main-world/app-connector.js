// Runs in MAIN world — provides a robust bridge (AppContext) to the game's internal modules.
(function() {
  let _contextPromise = null;

  function _waitFor(fn, timeoutMs = 15000, intervalMs = 100) {
    return new Promise(resolve => {
      const start = Date.now();
      (function poll() {
        const v = fn();
        if (v) return resolve(v);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(poll, intervalMs);
      })();
    });
  }

  window.LanistaApp = {
    /**
     * Lazy-discovery of game modules and instances.
     * Returns a promise that resolves to the game's internal objects.
     */
    async getAppContext() {
      if (_contextPromise) return _contextPromise;

      _contextPromise = (async () => {
        try {
          const scriptEl = await _waitFor(
            () => document.querySelector('script[type="module"][src*="/build/assets/main-"]')
          );
          if (!scriptEl) throw new Error("Main bundle script tag not found after timeout");
          const gameModule = await import(scriptEl.src);
          const findModule = (predicate) => Object.values(gameModule).find(predicate);

          // Find game modules and stores
          const apiClient = findModule(exp => exp?.removeCacheForPath);
          const useUserStore = findModule(exp => exp?.$id === "userModule");
          const useAvatarStore = findModule(exp => exp?.$id === "avatarModule");
          const useCooldownStore = findModule(exp => typeof exp === "function" && exp.toString().includes("fetchCooldowns"));

          // Cache router from Vue app instance
          const app = await _waitFor(() => document.querySelector("#app")?.__vue_app__);
          if (!app) throw new Error("Vue app instance not found after timeout");
          
          const router = app.config.globalProperties.$router;

          // Find the event bus in the game module exports (e.g. exported as 'J' or 'bt')
          // It's uniquely identified by having $emit, $on, and $off.
          const bus = Object.values(gameModule).find(
            exp => exp && typeof exp.$emit === "function" && typeof exp.$on === "function" && typeof exp.$off === "function"
          );

          if (!bus) {
            console.warn("[Lanista-Ext] Could not find event bus in game module exports.");
          }

          return {
            apiClient,
            getUserStore: () => useUserStore(),
            getAvatarModule: () => useAvatarStore(),
            getCooldownModule: () => useCooldownStore(),
            getRouter: () => router,
            getBus: () => bus
          };
        } catch (err) {
          console.error("[Lanista-Ext] AppContext initialization failed:", err);
          _contextPromise = null;
          return null;
        }
      })();

      return _contextPromise;
    }
  };
})();
