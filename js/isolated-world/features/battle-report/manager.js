/**
 * Battle Report Manager
 * Centralizes observers and API handlers for all battle report enhancements.
 */
window.BattleReportManager = (function() {
  const modules = [];
  let settings = null;
  let observer = null;
  let isInitialized = false;

  function registerModule(module) {
    modules.push(module);
  }

  async function init() {
    if (isInitialized) return;
    isInitialized = true;

    settings = await loadSettings();
    setupObserver();
    setupApiHandler();
    setupStorageListener();
    
    run();
  }

  function setupObserver() {
    observer = new MutationObserver(() => run());
    const target = document.querySelector('.content') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  function setupApiHandler() {
    apiRegisterHandler(/\/api\/battles\/\d+/, (_url, data) => {
      modules.forEach(m => {
        try {
          m.cleanup?.();
        } catch (e) {
          console.error(`[BattleReport] Module ${m.name} cleanup error:`, e);
        }
      });
      
      setTimeout(() => run(data), 100);
    });
  }

  function setupStorageListener() {
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area !== "local") return;
      
      const hasBattleChanges = Object.keys(changes).some(key => key.startsWith('battle-'));
      if (hasBattleChanges) {
        settings = await loadSettings();
        run();
      }
    });
  }

  async function run(apiData = null) {
    // Relaxed check: just look for battle in path
    if (!location.pathname.includes('/battle')) return;
    
    if (!settings) settings = await loadSettings();

    const context = {
      settings,
      content: document.querySelector('.content'),
      apiData
    };

    if (!context.content) return;

    modules.forEach(m => {
      try {
        m.render?.(context);
      } catch (e) {
        console.error(`[BattleReport] Module ${m.name} render error:`, e);
      }
    });
  }

  return { registerModule, init, getSettings: () => settings };
})();
