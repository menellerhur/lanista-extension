// Database page display.
// Depends on: common/page-navigation.js (getExtensionLink, getDatabaseLink),
//             ui.js (renderItemsTabContent)

async function showDatabasePage() {
  await ensureExtConfig();
  const existing = document.getElementById("ext-panel");
  if (existing) {
    if (existing.dataset.extPage === "database") return;
    existing.remove();
    const c = document.querySelector(".content");
    if (c) c.style.display = "";
    getExtensionLink()?.classList.remove("sidebar-nav-link-active");
  }

  const content = document.querySelector(".content");
  if (!content) return;

  document.querySelectorAll(".sidebar-nav-link-active").forEach(el => el.classList.remove("sidebar-nav-link-active"));
  document.querySelectorAll(".router-link-active").forEach(el => el.classList.remove("router-link-active"));
  document.querySelectorAll(".router-link-exact-active").forEach(el => el.classList.remove("router-link-exact-active"));
  getDatabaseLink()?.classList.add("sidebar-nav-link-active");
  
  // Push to history so Back button works correctly
  if (window.location.hash !== "#database") {
    extRouterPush("/game/arena#database");
  }
  
  document.title = "Databas | Lanista";

  const panel = document.createElement("div");
  panel.id = "ext-panel";
  panel.dataset.extPage = "database";
  panel.className = content.className;
  panel.innerHTML = `
    <div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-0 border border-border shadow-xl surface-card relative rounded-xl p-4 lg:p-5">
      <h2 class="block font-serif uppercase text-foreground">Databas</h2>
      <div class="mt-3" id="ext-database-content"></div>
    </div>
  `;

  content.style.display = "none";
  content.parentNode.insertBefore(panel, content);

  if (typeof renderItemsTabContent === "function") {
    if (itemsCustomViewsReady) await itemsCustomViewsReady;
    renderItemsTabContent(document.getElementById("ext-database-content"));
  }
}
