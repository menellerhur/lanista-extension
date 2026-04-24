// Runs in MAIN world — orchestrates game state synchronization after extension-specific events.
(function() {
  /**
   * Main logic for refreshing the UI after a no-reload gladiator switch.
   */
  window.addEventListener("ext:gladiator-switched", async () => {

    try {
      const context = await window.LanistaApp.getAppContext();
      const { apiClient, getUserStore, getAvatarModule, getRouter, getCooldownModule } = context;
      const userStore = getUserStore();
      const router = getRouter();

      const routerRoute = router?.currentRoute?.value || router?.currentRoute;
      const path = routerRoute?.path || "";

      // Step 1: Invalidate Dailies cache
      if (apiClient) {
        apiClient.removeCacheForPath?.("daily");
        apiClient.removeCacheForPath?.("dailies");
        if (!path.includes("/arena/dailies")) {
          apiClient.get("/avatars/me/daily");
        }
      }

      // Step 2 & 3: Refresh basic avatar data and daily experience (EP)
      if (userStore) {
        if (typeof userStore.fetchAvatar === "function") {
          await userStore.fetchAvatar();
        }
        if (apiClient) {
          const data = await apiClient.get("/avatars/livetoplist?type=todays_xp");
          if (data?.my_todays_xp !== undefined) {
            userStore.myTodaysXp = data.my_todays_xp;
          }
        }
      }

      // Step 4: Refresh avatar module state (needed for gear/stats pages)
      const avatarModule = getAvatarModule();
      if (avatarModule && userStore?.avatar?.id) {
        await avatarModule.fetchAvatar(userStore.avatar.id);
      }

      // Step 5: If user is on the Dailies page, force a re-mount to show fresh state
      // We re-verify the current path right before navigating to ensure accuracy
      const currentRoute = router?.currentRoute?.value || router?.currentRoute;
      const currentPath = currentRoute?.path || "";

      if (router && currentPath.includes("/arena/dailies")) {
        // We navigate away and then back
        await router.push("/arena");
        await router.replace(currentPath);
      }

      // Step 6: Trigger building/cooldown refresh in the sidebar
      const cooldownModule = getCooldownModule();
      if (cooldownModule) {
        const { fetchCooldowns, loaded } = cooldownModule;
        loaded.value = false;
        await fetchCooldowns();
      }
    } catch (err) {
      console.error("[Lanista-Ext] Error during gladiator switch synchronization:", err);
    }
  });

  /**
   * Restores the browser URL to match Vue Router's internal state.
   */
  window.addEventListener("ext:restore-route", async () => {
    try {
      const context = await window.LanistaApp.getAppContext();
      const router = context.getRouter();
      if (!router) return;

      const currentRoute = router.currentRoute?.value || router.currentRoute;
      const path = currentRoute?.fullPath || currentRoute?.path;
      
      if (path) {
        // Use router.replace instead of history.replaceState to ensure Vue is in sync
        router.replace(path);
      }
    } catch (err) {
      console.error("[Lanista-Ext] Error during route restoration:", err);
    }
  });

  /**
   * Performs programmatic navigation using the Vue Router.
   * Event detail should be the path string (relative to /game base).
   */
  window.addEventListener("ext:router-push", async (e) => {
    try {
      const path = e.detail;
      if (!path) return;

      const context = await window.LanistaApp.getAppContext();
      const router = context.getRouter();
      if (router) {
        router.push(path);
      }
    } catch (err) {
      console.error("[Lanista-Ext] Error during router push:", err);
    }
  });

  /**
   * Performs programmatic navigation replacement using the Vue Router.
   * Event detail should be the path string (relative to /game base).
   */
  window.addEventListener("ext:router-replace", async (e) => {
    try {
      const path = e.detail;
      if (!path) return;

      const context = await window.LanistaApp.getAppContext();
      const router = context.getRouter();
      if (router) {
        router.replace(path);
      }
    } catch (err) {
      console.error("[Lanista-Ext] Error during router replace:", err);
    }
  });
})();
