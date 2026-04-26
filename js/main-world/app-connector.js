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

          // Discover game modules, stores, and event bus.
          // The bus is uniquely identified by having $emit, $on, and $off.
          const apiClient        = findModule(exp => exp?.removeCacheForPath);
          const useUserStore     = findModule(exp => exp?.$id === "userModule");
          const useAvatarStore   = findModule(exp => exp?.$id === "avatarModule");
          const useConfigStore   = findModule(exp => exp?.$id === "configModule");
          const useCooldownStore = findModule(exp => typeof exp === "function" && exp.toString().includes("fetchCooldowns"));
          const bus              = findModule(exp => exp && typeof exp.$emit === "function"
                                                         && typeof exp.$on === "function"
                                                         && typeof exp.$off === "function");

          // Cache router and root proxy from Vue app instance.
          const app = await _waitFor(() => document.querySelector("#app")?.__vue_app__);
          if (!app) throw new Error("Vue app instance not found after timeout");
          const router = app.config.globalProperties.$router;
          const proxy  = document.querySelector("#app")?._vnode?.component?.proxy;

          // Warn for anything that didn't resolve.
          if (!apiClient)        console.warn("[Lanista-Ext] AppContext: apiClient not found");
          if (!useUserStore)     console.warn("[Lanista-Ext] AppContext: userModule store not found");
          if (!useAvatarStore)   console.warn("[Lanista-Ext] AppContext: avatarModule store not found");
          if (!useConfigStore)   console.warn("[Lanista-Ext] AppContext: configModule store not found");
          if (!useCooldownStore) console.warn("[Lanista-Ext] AppContext: cooldownModule store not found");
          if (!bus)              console.warn("[Lanista-Ext] AppContext: event bus not found");
          if (!proxy)            console.warn("[Lanista-Ext] AppContext: Vue root proxy not found");

          // Pre-bound watch with immediate:true defaulted — bridge use-cases
          // always want to fire on the current value too. Callers can override.
          const watch = proxy
            ? (source, callback, options) => proxy.$watch(source, callback, { immediate: true, ...options })
            : null;

          return {
            apiClient,
            getUserStore:     () => useUserStore?.(),
            getAvatarStore:   () => useAvatarStore?.(),
            getConfigStore:   () => useConfigStore?.(),
            getCooldownStore: () => useCooldownStore?.(),
            getRouter: () => router,
            getBus: () => bus,
            getWatch: () => watch,
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
