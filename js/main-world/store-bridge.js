// Runs in MAIN world — bridges reactive Pinia store state to isolated world via
// CustomEvents. One watcher per concern; Vue handles equality so we never need
// manual change-detection. The watch helper from app-connector defaults to
// immediate:true so each watcher fires on the current value too.
(function() {
  (async () => {
    try {
      const context = await window.LanistaApp.getAppContext();
      if (!context) return;

      const watch = context.getWatch?.();
      if (!watch) return;

      const dispatch = (eventName, detail) =>
        window.dispatchEvent(new CustomEvent(eventName, { detail }));

      // --- configModule ---
      // Spreads configStore.raw so isolated-world features can read any config
      // property without API handlers. Fires when the game replaces the object
      // (e.g. on /api/config re-fetch); switch to { deep: true } if the game
      // ever mutates raw in place.
      const configStore = context.getConfigStore?.();
      if (configStore) {
        watch(
          () => configStore.raw,
          raw => { if (raw) dispatch("ext:config-data", { ...raw }); }
        );
      }

      // --- userModule ---
      const userStore = context.getUserStore?.();
      if (!userStore) return;

      // Active gladiator id
      watch(
        () => userStore.avatar?.id,
        id => { if (id != null) dispatch("ext:active-avatar", { id }); }
      );

      // Daily beasts counter
      watch(
        () => userStore.avatar?.daily_beasts,
        dailyBeasts => dispatch("ext:badge-data", { dailyBeasts })
      );

      // Unseen adventures counter
      watch(
        () => userStore.avatar?.unseen_adventures,
        unseenAdventures => dispatch("ext:badge-data", { unseenAdventures })
      );

      // Active tournaments — sidebar sub-items render from avatar.active_tournaments.
      // Derived key so we only re-emit when (id, start_at) tuples actually change.
      watch(
        () => (userStore.avatar?.active_tournaments ?? [])
                .map(t => `${t.id}|${t.start_at}`).join(","),
        () => {
          const active = userStore.avatar?.active_tournaments ?? [];
          dispatch("ext:tournament-data", {
            tournaments: active.map(t => ({ id: t.id, start_at: t.start_at }))
          });
        }
      );

      // Ranked-battle cooldown
      watch(
        () => userStore.avatar?.next_ranked_battle_at,
        v => dispatch("ext:ranked-data", { nextRankedBattleAt: v ?? null })
      );
    } catch (err) {
      console.error("[Lanista-Ext] store-bridge initialization failed:", err);
    }
  })();
})();
