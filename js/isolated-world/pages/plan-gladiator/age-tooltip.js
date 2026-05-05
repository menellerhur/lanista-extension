// Tooltip for age options in the Gladiator Planner.
// Depends on: stats.js (pgStatRows, pgGetAgeMultiplier), state.js (pgState.ageData)

function pgAgeTooltipEl() {
  let tipEl = document.getElementById("ext-age-tooltip");
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = "ext-age-tooltip";
    // Reuse the same styling classes as the weapon tooltip
    tipEl.className = "ext-age-tooltip"; 
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function pgBuildAgeTooltipHtml(profile, ageType) {
  let ageData = pgState.ageData[profile.raceId];
  if (!ageData && profile.raceId) {
    const keys = { 1: "human", 2: "dwarf", 3: "beast", 4: "elf" };
    const key = keys[profile.raceId];
    if (key) ageData = PG_AGE_DATA[key];
  }
  if (!ageData) return "";
  
  const age = ageData.ages.find(a => a.type === ageType);
  if (!age) return "";

  const rows = pgStatRows(profile);
  const rowsHtml = rows.map(row => {
    const mult = pgGetAgeLocalMultiplier(profile, ageType, row.key);
    const bonusPct = Math.round((mult - 1) * 100);
    const bonusStr = (bonusPct >= 0 ? "+" : "") + bonusPct + "%";
    
    let valClass = "pg-age-zero";
    if (bonusPct > 0) valClass = "pg-age-pos";
    else if (bonusPct < 0) valClass = "pg-age-neg";

    return `
      <tr class="pg-age-row">
        <td class="pg-age-label">${row.label}</td>
        <td class="pg-age-value"><span class="${valClass}">${bonusStr}</span></td>
      </tr>`;
  });

  const ageLabel = age.label.charAt(0).toUpperCase() + age.label.slice(1);

  return `<div class="ext-weapon-tip-name">${ageLabel}<span class="pg-age-tip-day">${age.age_in_days} dagar</span></div>
    <div class="pg-age-table-wrap">
      <table class="pg-age-table">
        <tbody>
          ${rowsHtml.join("")}
        </tbody>
      </table>
    </div>`;
}

function pgAgeTooltipShowAnchored(anchorEl, html, sideAnchorEl) {
  // Use the shared tooltip element and its ID for CSS compatibility with database.css
  let tipEl = document.getElementById("ext-weapon-tooltip");
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = "ext-weapon-tooltip";
    document.body.appendChild(tipEl);
  }
  
  tipEl.innerHTML = html;
  tipEl.classList.add("ext-age-tip");
  tipEl.style.display = "block";
  tipEl.style.visibility = "visible"; // Extra safety
  tipEl.style.opacity = "1"; // Extra safety

  const margin = 8;
  const topRect  = anchorEl.getBoundingClientRect();
  const sideRect = (sideAnchorEl || anchorEl).getBoundingClientRect();
  
  // Force a reflow to get correct dimensions
  const tipW = tipEl.offsetWidth;
  const tipH = tipEl.offsetHeight;

  let left = sideRect.right + margin;
  if (left + tipW > window.innerWidth - margin) {
    left = sideRect.left - tipW - margin;
    if (left < margin) left = margin;
  }

  let top = topRect.top;
  if (top + tipH > window.innerHeight - margin) top = window.innerHeight - tipH - margin;
  if (top < margin) top = margin;

  tipEl.style.left = left + "px";
  tipEl.style.top  = top  + "px";
}

function pgAgeTooltipHide() {
  const tipEl = document.getElementById("ext-weapon-tooltip");
  if (tipEl) {
    tipEl.style.display = "none";
    tipEl.classList.remove("ext-age-tip");
  }
}

function pgBindAgeTooltipsOnce(container) {
  if (container._pgAgeTooltipBound) return;
  container._pgAgeTooltipBound = true;

  let lastX = 0, lastY = 0;
  container.addEventListener("mousemove", e => {
    lastX = e.clientX;
    lastY = e.clientY;
  });

  container.addEventListener("mouseover", e => {
    const opt = e.target.closest(".pg-dd-item");
    if (!opt) return;

    const dropdown = opt.closest(".pg-dropdown");
    if (!dropdown || dropdown.dataset.pgDd !== "pg-stats-age") return;

    const profile = pgGetActiveProfile();
    if (!profile) return;

    const ageTypeRaw = opt.dataset.pgDdVal;
    if (ageTypeRaw === "" || ageTypeRaw == null) { 
      pgAgeTooltipHide(); 
      return; 
    }
    
    const ageType = parseInt(ageTypeRaw, 10);
    const html = pgBuildAgeTooltipHtml(profile, ageType);
    if (!html) { 
      pgAgeTooltipHide(); 
      return; 
    }

    const panel = dropdown.querySelector(".pg-dd-panel");
    const anchor = (panel && !panel.hidden) ? panel : dropdown;
    pgAgeTooltipShowAnchored(anchor, html);
  });

  container.addEventListener("mouseout", e => {
    const fromItem = e.target.closest(".pg-dd-item");
    if (fromItem) {
      const toItem = e.relatedTarget?.closest?.(".pg-dd-item");
      if (!toItem) pgAgeTooltipHide();
      return;
    }
    const dropdown = e.target.closest(".pg-dropdown");
    if (dropdown && dropdown.dataset.pgDd === "pg-stats-age" && !dropdown.contains(e.relatedTarget)) {
      pgAgeTooltipHide();
    }
  });

  // Hide on scroll to prevent ghosting when elements move away from the cursor.
  // Re-show when scroll stops if mouse is over an age option.
  let scrollTimeout = null;
  window.addEventListener("scroll", () => {
    pgAgeTooltipHide();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const el = document.elementFromPoint(lastX, lastY);
      const opt = el?.closest(".pg-dd-item");
      if (!opt) return;
      const dropdown = opt.closest(".pg-dropdown");
      if (!dropdown || dropdown.dataset.pgDd !== "pg-stats-age") return;
      const profile = pgGetActiveProfile();
      if (!profile) return;
      const ageTypeRaw = opt.dataset.pgDdVal;
      if (!ageTypeRaw) return;
      const ageType = parseInt(ageTypeRaw, 10);
      const html = pgBuildAgeTooltipHtml(profile, ageType);
      if (!html) return;
      const panel = dropdown.querySelector(".pg-dd-panel");
      const anchor = (panel && !panel.hidden) ? panel : dropdown;
      pgAgeTooltipShowAnchored(anchor, html);
    }, 100);
  }, { capture: true, passive: true });
}
