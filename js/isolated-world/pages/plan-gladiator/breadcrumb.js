// Breadcrumb component for Planera Gladiator.
// Depends on: state.js, storage.js (pgIsActiveProfileGrundvalSaved, pgGetActiveProfile),
//             step-profile.js (pgProfileSummary), page.js (pgGoToStep)

const PG_STEPS = ["Profil", "Utrustning", "Egenskaper"];

function pgBreadcrumbHtml() {
  const grundvalSaved = pgIsActiveProfileGrundvalSaved();
  let html = `<nav class="pg-breadcrumb" aria-label="Steg">`;
  for (let i = 0; i < PG_STEPS.length; i++) {
    const isActive = pgState.currentStep === i;
    const isDisabled = i > 0 && !grundvalSaved;
    const cls = ["pg-bc-step"];
    if (isActive) cls.push("pg-bc-active");
    if (isDisabled) cls.push("pg-bc-disabled");

    html += `<button type="button" class="${cls.join(" ")}" data-pg-step="${i}" ${isDisabled ? "disabled" : ""} aria-current="${isActive ? "step" : "false"}">
      <span class="pg-bc-num">${i + 1}</span>
      <span class="pg-bc-label" data-label="${PG_STEPS[i]}">${PG_STEPS[i]}</span>
    </button>`;
    if (i < PG_STEPS.length - 1) {
      html += `<span class="pg-bc-sep" aria-hidden="true">›</span>`;
    }
  }
  if (pgState.currentStep > 0) {
    html += pgBreadcrumbProfileInfoHtml();
  }
  html += `</nav>`;
  return html;
}

function pgBreadcrumbProfileInfoHtml() {
  const profile = pgGetActiveProfile();
  if (!profile) return "";
  const raceName = (() => {
    if (!profile.raceId) return "";
    if (!window.ExtConfig?.races) {
      console.error("[Lanista-Ext] races missing from ExtConfig");
      return "";
    }
    const race = window.ExtConfig.races.find(r => r.id === profile.raceId);
    return race ? (PG_RACE_NAMES[race.name] || race.name) : "";
  })();
  const handLabel = { "1h": "Enhand", "2h": "Tvåhand", "shield": "Sköld" }[profile.weaponHand] || "";
  const vfName = profile.weaponSkillType != null ? pgWeaponSkillName(profile.weaponSkillType) : "";
  const parts = [raceName, handLabel, vfName].filter(Boolean);
  const sep = `<span class="pg-bc-info-sep">•</span>`;
  let html = `<div class="pg-bc-info"><span class="pg-bc-info-name">${profile.name}</span>`;
  for (const p of parts) html += `${sep}<span>${p}</span>`;
  html += `</div>`;
  return html;
}

function pgNavButtonsHtml() {
  const grundvalSaved = pgIsActiveProfileGrundvalSaved();
  const step = pgState.currentStep;
  const isFirst = step === 0;
  const isLast = step === PG_STEPS.length - 1;
  const nextDisabled = (isLast || !grundvalSaved) ? "disabled" : "";

  return `
    <div class="pg-nav-row">
      ${isFirst ? "<span></span>" : `
        <button type="button" class="pg-btn pg-btn-secondary" id="pg-nav-prev">
          ${icon("chevron-left", { size: 14 })} Tillbaka
        </button>
      `}
      ${!isLast ? `
        <button type="button" class="pg-btn pg-btn-primary" id="pg-nav-next" ${nextDisabled}>
          Nästa ${icon("chevron-right", { size: 14 })}
        </button>
      ` : ""}
    </div>`;
}

function pgBindBreadcrumb(panel) {
  // Delegation on the panel element — handles all current and future [data-pg-step] buttons.
  panel.addEventListener("click", e => {
    const btn = e.target.closest(".pg-bc-step[data-pg-step]");
    if (!btn || btn.disabled) return;
    const step = parseInt(btn.dataset.pgStep, 10);
    pgGoToStep(step);
  });
}
