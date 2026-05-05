// Depends on: pages/extension/page.js (showExtensionPage), pages/database/page.js (showDatabasePage)

function markSidebarPanels() {
  document.querySelectorAll(".sidebar-panel").forEach(panel => {
    const kicker = panel.querySelector(".section-kicker");
    if (!kicker) return;
    const txt = kicker.textContent;
    if (txt.includes("Konto"))          panel.classList.add("ext-panel-konto");
    if (txt.includes("Passiva"))        panel.classList.add("ext-panel-passiva");
    if (txt.includes("Gladiatorstall")) panel.classList.add("ext-panel-gladiatorstall");
    if (txt.includes("Grupper"))        panel.classList.add("ext-panel-grupper");
  });

  // Mark the avatar nav panel by finding the ul that contains the /info link
  const avatarUl = [...document.querySelectorAll(".sidebar-panel ul")]
    .find(ul => ul.querySelector('a[href="/game/avatar/me/info"]'));
  if (avatarUl) avatarUl.closest(".sidebar-panel").classList.add("ext-panel-avatar-nav");
}

function injectPassiveLink() {
  const ul = document.querySelector(".ext-panel-avatar-nav ul");
  if (!ul || ul.querySelector(".ext-passive-move-link")) return;

  // Copy Vue's scoped CSS attribute from an existing list item for correct styling
  const existingLi = ul.querySelector("li");
  const vAttr = existingLi ? [...existingLi.attributes].find(a => a.name.startsWith("data-v-"))?.name : null;

  const li = document.createElement("li");
  li.className = "ext-passive-move-link";
  if (vAttr) li.setAttribute(vAttr, "");
  li.innerHTML = `<a ${vAttr ? `${vAttr}=""` : ""} href="/game/avatar/me/passive-settings" class="sidebar-nav-link">
    <span ${vAttr ? `${vAttr}=""` : ""} class="inline-flex items-center gap-1.5">
      <i ${vAttr ? `${vAttr}=""` : ""} class="sidebar-link-icon fal fa-cogs" aria-hidden="true"></i>
      <span ${vAttr ? `${vAttr}=""` : ""} class="sidebar-nav-text">Passiva funktioner</span>
    </span>
  </a>`;

  // Prevent full page reload — navigate via Vue Router's popstate listener instead
  li.querySelector("a").addEventListener("click", e => {
    e.preventDefault();
    extRouterPush("/game/avatar/me/passive-settings");
  });

  ul.appendChild(li);
}

function injectSettingsLink() {
  const kontoPanel = document.querySelector(".ext-panel-konto");
  if (!kontoPanel) return;

  const ul = kontoPanel.querySelector("ul");
  if (!ul || ul.querySelector(".ext-extension-link")) return;
  const firstLi = ul.querySelector("li");
  if (!firstLi) return;

  const newLi = firstLi.cloneNode(true);
  newLi.classList.add("ext-extension-link");

  const link = newLi.querySelector("a");
  link.setAttribute("href", "/game/account#extension");
  link.classList.remove("sidebar-nav-link-active");

  const textSpan = newLi.querySelector(".sidebar-nav-text");
  if (textSpan) textSpan.textContent = "Extension";

  const icon = newLi.querySelector("i");
  if (icon) icon.className = "sidebar-link-icon fal fa-sliders-h";

  link.addEventListener("click", e => {
    // Let the browser handle middle-click, ctrl/cmd/shift-click (open in new tab/window)
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    showExtensionPage();
  });

  ul.insertBefore(newLi, firstLi);
}

function injectDatabaseLink() {
  const kontoPanel = document.querySelector(".ext-panel-konto");
  if (!kontoPanel) return;
  const ul = kontoPanel.querySelector("ul");
  if (!ul || ul.querySelector(".ext-database-link")) return;

  // Extension link is always the first li (injected by injectSettingsLink)
  const extLi = ul.querySelector("li");
  if (!extLi) return;

  const newLi = extLi.cloneNode(true);
  newLi.classList.remove("ext-extension-link");
  newLi.classList.add("ext-database-link");

  const link = newLi.querySelector("a");
  link.setAttribute("href", "/game/account#database");
  link.classList.remove("sidebar-nav-link-active");

  const textSpan = newLi.querySelector(".sidebar-nav-text");
  if (textSpan) textSpan.textContent = "Databas";

  const icon = newLi.querySelector("i");
  if (icon) icon.className = "sidebar-link-icon fal fa-database";

  link.addEventListener("click", e => {
    // Let the browser handle middle-click, ctrl/cmd/shift-click (open in new tab/window)
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    showDatabasePage();
  });

  extLi.after(newLi);
}

function injectNotificationsLink() {
  const kontoPanel = document.querySelector(".ext-panel-konto");
  if (!kontoPanel) return;
  const ul = kontoPanel.querySelector("ul");
  if (!ul || ul.querySelector(".ext-notifications-link")) return;

  const dbLi = ul.querySelector(".ext-database-link");
  if (!dbLi) return;

  const newLi = dbLi.cloneNode(true);
  newLi.classList.remove("ext-database-link");
  newLi.classList.add("ext-notifications-link");

  const link = newLi.querySelector("a");
  link.setAttribute("href", "/game/account#notifications");
  link.classList.remove("sidebar-nav-link-active");

  const textSpan = newLi.querySelector(".sidebar-nav-text");
  if (textSpan) textSpan.textContent = "Notifikationer";

  const icon = newLi.querySelector("i");
  if (icon) icon.className = "sidebar-link-icon fal fa-bell";

  link.addEventListener("click", e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    if (typeof showNotificationsPage === "function") showNotificationsPage();
  });

  dbLi.after(newLi);
}


function injectPlanGladiatorLink() {
  const kontoPanel = document.querySelector(".ext-panel-konto");
  if (!kontoPanel) return;
  const ul = kontoPanel.querySelector("ul");
  if (!ul || ul.querySelector(".ext-plan-gladiator-link")) return;

  const notifLi = ul.querySelector(".ext-notifications-link");
  if (!notifLi) return;

  const newLi = notifLi.cloneNode(true);
  newLi.classList.remove("ext-notifications-link");
  newLi.classList.add("ext-plan-gladiator-link");

  const link = newLi.querySelector("a");
  link.setAttribute("href", "/game/account#planera-gladiator");
  link.classList.remove("sidebar-nav-link-active");

  const textSpan = newLi.querySelector(".sidebar-nav-text");
  if (textSpan) textSpan.textContent = "Planera gladiator";

  const iconEl = newLi.querySelector("i");
  if (iconEl) iconEl.className = "sidebar-link-icon fal fa-sword";

  link.addEventListener("click", e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    if (typeof showPlanGladiatorPage === "function") showPlanGladiatorPage();
  });

  notifLi.after(newLi);
}

let _gladiatorSettings = {};
let _gladiatorListenerAdded = false;

function setupGladiatorSwitchInterception(settings) {
  _gladiatorSettings = settings;
  if (_gladiatorListenerAdded) return;
  _gladiatorListenerAdded = true;

  document.addEventListener("click", async e => {
    if (!_gladiatorSettings["no-gladiator-reload"]) return;
    const item = e.target.closest(".ext-panel-gladiatorstall div.flex.items-center.justify-between");
    if (!item) return;

    // Determine name
    const nameEl = item.querySelector("span.truncate");
    const name   = nameEl?.textContent?.trim();
    if (!name) return;

    // Check if it's already active (Lanista uses the sword icon for the active one)
    if (item.querySelector(".fa-sword")) return;

    // Prevent Lanista's own reload logic
    e.preventDefault();
    e.stopPropagation();

    // Find the ID from our cached API data
    const avatars = apiGetCacheByPattern(/\/api\/users\/me\/avatars(\?|$)/);
    const userMe  = apiGetCacheByPattern(/\/api\/users\/me(\?|$)/);
    const allAvatars = (avatars || userMe?.avatars || []);
    
    const gladiator = allAvatars.find(a => a.name === name);
    if (!gladiator) {
      console.warn("Lanista Extension: Could not find ID for gladiator", name);
      // Fallback: let the original click happen if we don't have the ID? 
      // No, because we already stopped it. Just reload manually as fallback.
      location.reload();
      return;
    }

    try {
      // Send the API call
      // Note: Lanista uses PUT to /api/users/me/avatars/stable/{id}/active
      await gameRequest(`/api/users/me/avatars/stable/${gladiator.id}/active`, {
        method: "PUT"
      });
      
      window.dispatchEvent(new CustomEvent("ext:gladiator-switched"));
    } catch (err) {
      console.error("Lanista Extension: Failed to switch gladiator", err);
      location.reload();
    }
  }, true);
}

let _sidebarSettings = {};
let _sidebarObserver = null;

function initSidebarSettings(settings) {
  _sidebarSettings = settings;
  
  if (!_sidebarObserver) {
    _sidebarObserver = new MutationObserver(() => {
      updateChallengeWarning();
    });

    _sidebarObserver.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['aria-checked'] 
    });
  }
  
  updateChallengeWarning();
}

function updateChallengeWarning() {
  const challengeHidden = _sidebarSettings["hide-sidebar-challenge-toggle"];
  const showIcon = _sidebarSettings["show-challenge-warning-icon"];
  const toggle = document.getElementById('challenge_ready');
  const challengesLink = document.querySelector('a[href="/game/arena/challenges"]');
  
  if (!challengesLink) return;

  const isReady = toggle?.getAttribute('aria-checked') === 'true';

  if (challengeHidden && showIcon && isReady) {
    if (!challengesLink.querySelector('.ext-challenge-warning')) {
      const icon = document.createElement('i');
      icon.className = 'fas fa-exclamation-triangle ext-challenge-warning';
      icon.title = 'Varning: Du är utmaningsredo!';
      
      const badge = challengesLink.querySelector('.badge-notify, [data-slot="badge"]');
      if (badge) {
        badge.parentNode.insertBefore(icon, badge);
      } else {
        const inner = challengesLink.querySelector('.flex.w-full') || challengesLink;
        inner.appendChild(icon);
      }
    }
  } else {
    challengesLink.querySelector('.ext-challenge-warning')?.remove();
  }
}
