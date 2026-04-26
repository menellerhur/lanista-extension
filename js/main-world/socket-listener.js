// Runs in MAIN world — listens to Lanista WebSocket events and triggers extra
// data refreshes in cases where the game's own handlers don't cover it.
(async function() {
  if (window.__lanistaExtSocketListener) return;
  window.__lanistaExtSocketListener = true;

  try {
    const ctx = await window.LanistaApp.getAppContext();
    if (!ctx) return;
    const userStore = ctx.getUserStore();

    const pusher = await waitFor(() => window.Pusher?.instances?.[0]);
    const userId = await waitFor(() => userStore?.user?.id);
    if (!pusher || !userId) {
      console.warn("[Lanista-Ext] Socket listener: Pusher or user not ready, aborting.");
      return;
    }

    const privateChannel = await waitFor(() => pusher.channel(`private-App.User.${userId}`));
    if (!privateChannel) {
      console.warn("[Lanista-Ext] Socket listener: private user channel not ready, aborting.");
      return;
    }
    
    const generalChannel = await waitFor(() => pusher.channel("GENERAL"));
    if (!generalChannel) {
      console.warn("[Lanista-Ext] Socket listener: GENERAL channel not ready.");
    }

    const relayNotification = (eventName, payload) => {
      window.dispatchEvent(new CustomEvent("ext:notification", { detail: { eventName, payload } }));
    };

    // --- Private Channel Events ---

    privateChannel.bind("App\\Events\\RankedBattleFinished", () => {
      if (!document.body.classList.contains("ext-s-refresh-ranked-cooldown") &&
          !document.body.classList.contains("ext-s-hide-rankedbattles-on-cooldown")) return;
      userStore.fetchAvatar();
    });

    privateChannel.bind("App\\Events\\AvatarDailyFinished", () => {
      window.dispatchEvent(new CustomEvent("ext:avatar-daily-finished"));
      relayNotification("AvatarDailyFinished", {});
    });

    privateChannel.bind("App\\Events\\BattleFinished", (payload) => {
      const type = payload?.battle?.type;
      if (type !== undefined && type !== null) {
        window.dispatchEvent(new CustomEvent("ext:battle-finished", { detail: { type } }));
      }
      relayNotification("BattleFinished", payload);
    });
    
    privateChannel.bind("Illuminate\\Notifications\\Events\\BroadcastNotificationCreated", (payload) => {
      relayNotification("BroadcastNotification", payload);
    });

    [
      "App\\Events\\MessageCreated",
      "App\\Events\\AvatarReceivedCoins",
      "App\\Events\\AdventureFinished",
      "App\\Events\\AchievementUnlocked",
      "App\\Events\\AvatarInPrison",
      "App\\Events\\AuctionFinished",
      "App\\Events\\AuctionOutbid"
    ].forEach(evt => privateChannel.bind(evt, (p) => relayNotification(evt.split("\\").pop(), p)));

    // --- General Channel Events ---

    if (generalChannel) {
      [
        "App\\Events\\TravelingMerchantVisible",
        "App\\Events\\UpdateAlert",
        "App\\Events\\GlobalAdventureFinished",
        "App\\Events\\StoryPublished",
        "App\\Events\\WorldEventMilestoneReached",
        "App\\Events\\AfterDeploy"
      ].forEach(evt => generalChannel.bind(evt, (p) => relayNotification(evt.split("\\").pop(), p)));
    }
  } catch (err) {
    console.error("[Lanista-Ext] Socket listener failed:", err);
  }

  function waitFor(fn, timeoutMs = 15000, intervalMs = 200) {
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
})();
