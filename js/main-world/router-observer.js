// Runs in MAIN world — wraps history.pushState/replaceState to dispatch ext:navigate
// so isolated-world content scripts can react to Vue Router SPA navigation.
// Cannot use chrome.* APIs here.

(async function() {
  if (window.__lanistaExtRouterObserver) return;
  window.__lanistaExtRouterObserver = true;

  // Use the actual Vue Router for high-fidelity hooks (like scroll reset and navigation detection)
  try {
    const ctx = await window.LanistaApp.getAppContext();
    if (!ctx) return;
    const router = ctx.getRouter();
    if (!router) return;

    router.afterEach((to) => {
      // Dispatched to isolated world. We use JSON.parse/stringify to strip 
      // Vue's reactive proxies for a clean, serializable object.
      window.dispatchEvent(new CustomEvent("ext:navigate", { 
        detail: { 
          fullPath: to.fullPath,
          path: to.path,
          hash: to.hash,
          query: JSON.parse(JSON.stringify(to.query)),
          params: JSON.parse(JSON.stringify(to.params)),
          name: to.name 
        } 
      }));

      // Handle scroll reset for battle reports
      if (document.body.classList.contains("ext-s-battle-stats-scroll-top")) {
        if (to.path.includes("/battles/") || to.path.includes("/battle/")) {
          // Use a small delay to ensure Vue has finished rendering the component
          setTimeout(() => {
            window.scrollTo(0, 0);
          }, 10);
        }
      }
    });

  } catch (err) {
    console.error("[Lanista-Ext] Router observer failed:", err);
  }
})();
