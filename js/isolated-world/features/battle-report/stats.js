/**
 * Stats Module: Renders a statistics table on the battle report page.
 */
(function() {
  const normalize = name => (name || "").toLowerCase().trim().replace(/\s+/g, " ");

  const module = {
    name: 'stats',
    render: (ctx) => {
      if (!ctx.settings["battle-stats"]) return;
      
      let data = ctx.apiData;
      if (!data) {
        const battleId = window.location.pathname.split("/").pop();
        if (!/^\d+$/.test(battleId)) return;
        data = apiGetCacheByPattern(new RegExp(`/api/battles/${battleId}$`));
      }

      if (!data || !data.rounds || data.rounds.length === 0) return;

      const lastRound = data.rounds.reduce((prev, curr) =>
        prev.order > curr.order ? prev : curr
      );
      const statEntries = lastRound.text.filter(t => t.key === "battle.stats.stats_text_1");
      if (statEntries.length > 0) maybeRenderTable(statEntries, data.participants);
    },
    cleanup: () => {
      document.querySelector("#ext-battle-stats-root")?.remove();
      document.querySelector(".ext-stats-tooltip")?.classList.remove("visible");
    }
  };

  function maybeRenderTable(statEntries, participants) {
    const battleId = window.location.pathname.split("/").pop();
    if (!/^\d+$/.test(battleId)) return;

    const summaries = document.querySelectorAll(".content .battle-text .summary");
    if (summaries.length === 0) return;

    const lastSummary = summaries[summaries.length - 1];
    const targetElement = lastSummary.closest('[data-slot="card"]') || lastSummary.closest(".surface-card");
    if (!targetElement) return;

    const existing = document.querySelector("#ext-battle-stats-root");
    if (existing) {
      if (existing.dataset.battleId === battleId) {
        if (targetElement.nextElementSibling === existing) return;
      }
      existing.remove();
    }

    renderTable(statEntries, targetElement, battleId, participants);
  }

  function renderTable(statEntries, targetElement, battleId, participants) {
    if (document.querySelector("#ext-battle-stats-root")) return;

    const nameToHref = getNameToHrefMap(participants);

    const rows = statEntries.map(entry => {
      const s = entry.args;
      const cleanName = (s.name || "").replace(/<[^>]*>?/gm, '');
      const normName = normalize(cleanName);
      const href = nameToHref[normName];

      let displayName = s.name;
      if (href) {
        displayName = `<a href="${href}" class="hover:underline">${displayName}</a>`;
      }
      const statsData = encodeURIComponent(JSON.stringify({ ...s, cleanName }));

      return `
        <tr class="ext-battle-stats-row" data-stats="${statsData}">
          <td>${displayName}</td>
          <td>${s.damage_done}</td>
          <td>(${s.total_damage_done})</td>
          <td>${s.max_damage_done}</td>
          <td>${s.damage_taken}</td>
          <td>${s.attacks_against || 0}</td>
          <td>${s.dodges}</td>
          <td>${s.blocks}</td>
          <td>${s.misses}</td>
          <td>${s.critical_hits}</td>
        </tr>`;
    }).join("");

    targetElement.insertAdjacentHTML("afterend", `
      <div id="ext-battle-stats-root" data-battle-id="${battleId}" class="bg-card text-card-foreground flex flex-col gap-0 border border-border shadow-xl surface-card relative rounded-xl p-4 lg:p-5 mb-4">
        <h2 class="block font-serif uppercase text-foreground leading-tight mb-3">Matchstatistik</h2>
        <div class="overflow-x-auto w-full">
          <table class="ext-battle-stats-table">
            <thead>
              <tr>
                <th title="Gladiatorns namn">Deltagare</th>
                <th title="Utdelad skada (faktisk skada som minskat motståndarens hälsa)">Skada</th>
                <th title="Total utdelad skada (inklusive skada som blockerades)"> (Tot)</th>
                <th title="Högsta skada utdelad i ett enskilt slag">Max</th>
                <th title="Total mottagen skada">Skadad</th>
                <th title="Antal attacker som riktats mot gladiatorn">Attack</th>
                <th title="Undvikta attacker">UA</th>
                <th title="Antal blockerade eller parerade attacker">Block</th>
                <th title="Antal egna missade attacker">Miss</th>
                <th title="Antal perfekta träffar">PT</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`);

    const root = document.querySelector("#ext-battle-stats-root");
    root.querySelectorAll(".ext-battle-stats-row").forEach(row => {
      row.addEventListener("mouseenter", (e) => {
        const settings = BattleReportManager.getSettings();
        if (!settings?.["battle-stats-hover-popup"]) return;
        if (e.target.closest('td:first-child')) return;

        const stats = JSON.parse(decodeURIComponent(row.dataset.stats));
        showStatsTooltip(e, stats);
      });
      row.addEventListener("mousemove", (e) => {
        const settings = BattleReportManager.getSettings();
        if (!settings?.["battle-stats-hover-popup"]) return;

        const tooltip = document.querySelector(".ext-stats-tooltip");
        if (!tooltip) return;

        if (e.target.closest('td:first-child')) {
          tooltip.classList.remove("visible");
          return;
        }

        if (!tooltip.classList.contains("visible")) {
          const stats = JSON.parse(decodeURIComponent(row.dataset.stats));
          showStatsTooltip(e, stats);
        }

        const x = e.clientX + 10;
        const y = e.clientY - 8;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.style.transform = 'translateY(-100%)';
      });
      row.addEventListener("mouseleave", () => {
        document.querySelector(".ext-stats-tooltip")?.classList.remove("visible");
      });
    });

    // Handle SPA navigation for links in the table
    root.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (link) {
        document.querySelector(".ext-stats-tooltip")?.classList.remove("visible");
        const href = link.getAttribute("href");
        if (href && !href.startsWith("http") && !href.startsWith("//")) {
          e.preventDefault();
          extRouterPush(href);
        }
      }
    });
  }

  function showStatsTooltip(event, s) {
    let tooltip = document.querySelector(".ext-stats-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "ext-stats-tooltip";
      tooltip.className = "ext-stats-tooltip";
      document.body.appendChild(tooltip);
    }

    const rows = [
      ["Vapenpareringar", s.weapon_blocks],
      ["Sköldblockeringar", s.shield_blocks],
      ["Partiella undvikningar", s.glancing_dodges],
      ["Partiella blockeringar", s.glancing_shield_blocks],
      ["Partiella missar", s.partial_misses]
    ];

    tooltip.innerHTML = `
      ${rows.map(([label, val]) => `
        <div class="tooltip-row">
          <span class="label">${label}</span>
          <span class="value">${val || 0}</span>
        </div>
      `).join("")}
    `;

    tooltip.style.display = ""; // Ensure it's not hidden by display:none from navigation
    tooltip.classList.add("visible");
    const x = event.clientX + 10;
    const y = event.clientY - 8;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.transform = 'translateY(-100%)';
  }

  function getNameToHrefMap(participants) {
    const map = {};

    if (participants) {
      participants.forEach(p => {
        const f = p.fighter;
        if (!f) return;
        const cleanName = normalize(f.name);
        if (cleanName) {
          map[cleanName] = f.is_avatar 
            ? `/game/avatar/${f.id}` 
            : `/game/arena/beasts/${f.id}`;
        }
      });
    }

    return map;
  }

  BattleReportManager.registerModule(module);
})();
