// Shared navigation helpers for the extension and database pages.
// Used by: extension/page.js, database/page.js

function getExtensionLink() {
  return document.querySelector(".ext-panel-konto li:not(.ext-database-link) .sidebar-nav-link");
}

function getDatabaseLink() {
  return document.querySelector(".ext-database-link .sidebar-nav-link");
}

function getNotificationsLink() {
  return document.querySelector(".ext-notifications-link .sidebar-nav-link");
}


function hideCustomPage(skipHistory = false) {
  const panel = document.getElementById("ext-panel");
  if (!panel) return;
  
  hideAllExtensionPopups();
  panel.remove();
  const content = document.querySelector(".content");
  if (content) content.style.display = "";
  
  getDatabaseLink()?.classList.remove("sidebar-nav-link-active");
  getExtensionLink()?.classList.remove("sidebar-nav-link-active");
  getNotificationsLink()?.classList.remove("sidebar-nav-link-active");

  if (skipHistory) return;

  // Ask the main-world (Vue Router) to sync the browser URL back to its internal state
  window.dispatchEvent(new CustomEvent("ext:restore-route"));
}

/**
 * Hides all extension-created tooltips and popups that are appended to document.body.
 * Helps prevent "stuck" popups when the triggering element is removed during navigation.
 */
function hideAllExtensionPopups() {
  const ids = [
    "ext-items-stats-tooltip",
    "ext-weapon-tooltip",
    "ext-col-filter-panel",
    "ext-stats-tooltip",
    "ext-preview-tooltip",
    "ext-preview-tooltip-v1",
    "ext-reports-menu"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.classList.remove("visible", "ext-preview-visible", "v-popper__popper--shown", "ext-reports-menu-visible");
    }
  });

  // Also handle class-based tooltips (like in merchants.js)
  document.querySelectorAll(".ext-merchant-info-tooltip").forEach(el => {
    el.style.display = "none";
  });
}


// Hide extension page when any navigating element is clicked (capture phase runs before Vue Router).
// Catches <a href> links (incl. portrait rendered by router-link) and nav-specific elements.
document.addEventListener("click", e => {
  if (!document.getElementById("ext-panel")) return;
  const link = e.target.closest("a[href], .nav-item, .nav-command");
  if (!link) return;
  if (link === getExtensionLink() || link === getDatabaseLink() || link === getNotificationsLink()) return;
  const href = link.getAttribute ? link.getAttribute("href") : null;
  if (href === "javascript:void(0)" || href === "") return;
  hideCustomPage();
}, true);

// Sync view with browser history (Back/Forward buttons).
window.addEventListener("popstate", () => {
  hideAllExtensionPopups();
  const hash = window.location.hash;
  if (hash === "#extension") {
    if (typeof showExtensionPage === "function") showExtensionPage();
  } else if (hash === "#database") {
    if (typeof showDatabasePage === "function") showDatabasePage();
  } else if (hash === "#notifications") {
    if (typeof showNotificationsPage === "function") showNotificationsPage();
  } else {
    hideCustomPage(true);
  }
});

// Fallback: hide extension page on Vue Router programmatic navigation (e.g. notification links).
// Vue Router has already set the URL via pushState — only clean up the DOM, don't touch history.
window.addEventListener("ext:navigate", (e) => {
  hideAllExtensionPopups();
  const path = e.detail?.fullPath || "";
  // Don't hide if we are just navigating to one of our own virtual pages
  if (path.includes("#extension") || path.includes("#database") || path.includes("#notifications")) {
    return;
  }
  hideCustomPage(true);
});
