/**
 * Avatar statistics page enhancements.
 * Injects role statistics (Ledare, Provokatör, Skadegörare) at the bottom.
 */

(function() {
  let _settings = {};

  function isStatisticsPage() {
    return location.pathname === "/game/avatar/me/statistics";
  }

  function getAvatarData() {
    const data = apiGetCacheByPattern(/\/api\/users\/me(\?|$)/);
    return data?.avatar;
  }

  function renderRoleTable() {
    if (!_settings["show-role-stats"] || !isStatisticsPage()) return;
    if (document.querySelector("#ext-role-stats")) return;

    const avatar = getAvatarData();
    if (!avatar) return;

    // Find the right place to inject. We want it after the last data-table-root.
    const tables = document.querySelectorAll(".data-table-root");
    if (tables.length === 0) return;
    const lastTable = tables[tables.length - 1];

    const container = document.createElement("div");
    container.id = "ext-role-stats";
    container.innerHTML = `
      <p class="mt-8 mb-2 md:ml-1 font-semibold">Roller</p>
      <div class="data-table-root space-y-2">
        <div class="data-table-shell overflow-hidden rounded border border-border bg-card text-card-foreground shadow-xl">
          <div data-slot="table-container" class="relative w-full overflow-auto rounded-[inherit]">
            <table data-slot="table" class="w-full caption-bottom text-sm">
              <thead data-slot="table-header" class="surface-table-header [&_tr]:border-b [&_tr]:border-border/75">
                <tr data-slot="table-row" class="surface-row border-b border-border/55 transition-colors hover:bg-accent/20">
                  <th data-slot="table-head" class="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap capitalize">Roll</th>
                  <th data-slot="table-head" class="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap capitalize">Totalt</th>
                </tr>
              </thead>
              <tbody data-slot="table-body" class="[&_tr:last-child]:border-0">
                <tr data-slot="table-row" class="surface-row border-b border-border/55 transition-colors hover:bg-accent/20">
                  <td data-slot="table-cell" class="p-2 align-middle whitespace-nowrap">Provokatör</td>
                  <td data-slot="table-cell" class="p-2 align-middle whitespace-nowrap">${Number(avatar.taunt_role_battles) || 0}</td>
                </tr>
                <tr data-slot="table-row" class="surface-row border-b border-border/55 transition-colors hover:bg-accent/20 surface-row-alt">
                  <td data-slot="table-cell" class="p-2 align-middle whitespace-nowrap">Ledare</td>
                  <td data-slot="table-cell" class="p-2 align-middle whitespace-nowrap">${Number(avatar.leadership_battles) || 0}</td>
                </tr>
                <tr data-slot="table-row" class="surface-row border-b border-border/55 transition-colors hover:bg-accent/20">
                  <td data-slot="table-cell" class="p-2 align-middle whitespace-nowrap">Skadegörare</td>
                  <td data-slot="table-cell" class="p-2 align-middle whitespace-nowrap">${Number(avatar.damage_role_battles) || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    lastTable.insertAdjacentElement("afterend", container);
  }

  function init(settings) {
    _settings = settings;
    
    // Watch for DOM changes to inject the table when the content is ready
    const observer = new MutationObserver(() => {
      if (isStatisticsPage()) {
        renderRoleTable();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also trigger when API data is received (if we are on the page)
    apiRegisterHandler(/\/api\/users\/me(\?|$)/, () => {
      if (isStatisticsPage()) renderRoleTable();
    });

    // Initial check
    if (isStatisticsPage()) renderRoleTable();
  }

  // Handle SPA navigation
  window.addEventListener("ext:navigate", () => {
    if (isStatisticsPage()) renderRoleTable();
  });

  window.addEventListener("popstate", () => {
    if (isStatisticsPage()) renderRoleTable();
  });

  // Handle settings changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    loadSettings().then(s => {
      const oldVal = _settings["show-role-stats"];
      _settings = s;
      if (oldVal !== s["show-role-stats"]) {
        if (!s["show-role-stats"]) {
          document.querySelector("#ext-role-stats")?.remove();
        } else {
          renderRoleTable();
        }
      }
    });
  });

  window.initAvatarStatistics = init;
})();
