// Thin orchestrator for the settings panel — mounts the ext-panel into the
// game's .content slot, then delegates HTML assembly and event wiring.
// Also owns shared constants (ICON_*, TOGGLE_ACTIVE_COLORS) and the
// applyToggleBtnStyle helper used by both the builder and the handlers.
// Depends on: common/settings.js (SETTINGS, loadSettings), common/icons.js (icon),
//             common/utils.js (getDatabaseLink, getExtensionLink, extRouterPush),
//             pages/extension/page-builder.js (buildSettingsHtml),
//             pages/extension/page-handlers.js (bindSettingsHandlers)

const ICON_SHOW = icon("eye",      { size: 14, strokeWidth: 1.5 });
const ICON_HIDE = icon("eye-off",  { size: 14, strokeWidth: 1.5 });
const ICON_AUTO = icon("sparkles", { size: 14, strokeWidth: 1.5 });

const TOGGLE_ACTIVE_COLORS = {
  light: { show: "#7F663C", hide: "#7F663C", auto: "#7F663C" },
  dark:  { show: "#C4A065", hide: "#C4A065", auto: "#C4A065" },
};

function applyToggleBtnStyle(btn, isActive, isDark) {
  const mode = isDark ? "dark" : "light";
  const bg = isDark ? "#27272a" : "#ffffff";
  btn.className = "ext-toggle-btn" + (isActive ? " active" : "");
  if (isActive) {
    btn.style.cssText = `background-color:${bg};box-shadow:0 1px 3px rgba(0,0,0,0.12);color:${TOGGLE_ACTIVE_COLORS[mode][btn.dataset.v] || ""};`;
  } else {
    btn.style.cssText = "background-color:transparent;box-shadow:none;color:;";
  }
}

async function showExtensionPage() {
  const existing = document.getElementById("ext-panel");
  if (existing) {
    if (existing.dataset.extPage === "settings") return;
    existing.remove();
    const c = document.querySelector(".content");
    if (c) c.style.display = "";
    getDatabaseLink()?.classList.remove("sidebar-nav-link-active");
  }

  const content = document.querySelector(".content");
  if (!content) return;

  // Deactivate all active sidebar links — right sidebar uses sidebar-nav-link-active,
  // left sidebar uses router-link-*
  document.querySelectorAll(".sidebar-nav-link-active").forEach(el => el.classList.remove("sidebar-nav-link-active"));
  document.querySelectorAll(".router-link-active").forEach(el => el.classList.remove("router-link-active"));
  document.querySelectorAll(".router-link-exact-active").forEach(el => el.classList.remove("router-link-exact-active"));
  getExtensionLink()?.classList.add("sidebar-nav-link-active");

  // Create a new history entry for the extension panel so Back works naturally.
  if (window.location.hash !== "#extension") {
    extRouterPush("/game/arena#extension");
  }

  document.title = "Extension | Lanista";

  const settings = await loadSettings();

  // Pre-compute which setting keys have children (exclude multiselect-child —
  // they are rendered by the multiselect block).
  const parentKeys = new Set(
    SETTINGS.filter(s => s.parentKey && s.type !== "multiselect-child").map(s => s.parentKey)
  );
  parentKeys.add("extension-enabled");

  const panel = document.createElement("div");
  panel.id = "ext-panel";
  panel.dataset.extPage = "settings";
  panel.className = content.className;
  panel.innerHTML = buildSettingsHtml(settings, parentKeys);

  content.style.display = "none";
  content.parentNode.insertBefore(panel, content);

  bindSettingsHandlers(panel);
}
