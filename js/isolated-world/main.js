// Initialization and orchestration.
// Waits for the sidebar to render, then kicks off all feature modules.

// Register API patterns globally needed for gladiator management
apiRegisterHandler(/\/api\/users\/me(\?|$)/, () => {});
apiRegisterHandler(/\/api\/users\/me\/avatars(\?|$)/, () => {});

// Store socket ID globally in isolated world
window.addEventListener("ext:socket-id", e => {
  window._extSocketId = e.detail;
});

const mainObserver = new MutationObserver((_mutations, obs) => {
  const aktivitetSpan = [...document.querySelectorAll("span.sidebar-nav-text")]
    .find(el => el.textContent.trim() === "Aktivitet");

  if (aktivitetSpan) {
    obs.disconnect();
    markSidebarPanels();
    injectSettingsLink();
    injectDatabaseLink();
    injectNotificationsLink();
    injectPassiveLink();
    if (location.hash === "#extension") showExtensionPage();
    else if (location.hash === "#database") showDatabasePage();
    else if (location.hash === "#notifications") showNotificationsPage();
    initNavEnhancements();
    loadSettings().then(settings => {
      const effective = getEffectiveSettings(settings);
      initAuctions(effective);
      initTeambattles(effective);
      initTeamBeastsQuota(effective);
      initTournament(effective);
      initMerchants(effective);
      setupGladiatorSwitchInterception(effective);
      initSidebarSettings(effective);
      initAvatarInfo(effective);
      initAvatarStatistics(effective);
      initMassChallenge(effective);
    });
  }
});

mainObserver.observe(document.body, { childList: true, subtree: true });

loadSettings().then(applySettings);

// Sync settings changes from other tabs/windows
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  loadSettings().then(settings => {
    const effective = getEffectiveSettings(settings);
    applySettings(settings);
    setupGladiatorSwitchInterception(effective);
    initSidebarSettings(effective);
    initMassChallenge(effective);
  });
});

// Periodic heartbeat to detect extension reload/update
setInterval(() => {
  try {
    // Accessing any chrome.runtime property will throw if the context is invalidated
    chrome.runtime.getManifest();
  } catch (e) {
    if (e.message?.includes("Extension context invalidated")) {
      location.reload();
    }
  }
}, 2000);
