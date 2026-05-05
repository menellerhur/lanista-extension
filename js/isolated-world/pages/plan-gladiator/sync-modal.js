// Modal that lets the user sync the cached active gladiator into a planner
// profile. The avatar object is snapshotted on open so that a mid-interaction
// gladiator switch in another tab cannot change what we're about to write.
//
// Depends on: state.js, storage.js, data.js, stats.js, sync-mapper.js,
//             sync-apply.js, page.js (pgRefreshPage, pgSyncGetCachedAvatar),
//             common/icons.js

let _pgSyncModalState = null;

function pgOpenSyncModal() {
  const apiAvatar = pgSyncGetCachedAvatar();
  if (!apiAvatar) return;

  const mapped = pgSyncMapAvatar(apiAvatar);
  if (!mapped) return;

  // Filter profiles to those whose race + weapon skill are either unset
  // (null) or match the active gladiator. Null fields will be filled in at
  // sync time, so they shouldn't disqualify a profile.
  const g = mapped.gladiator;
  const matchingProfiles = pgState.profiles.filter(p => {
    if (p.raceId != null && p.raceId !== g.raceId) return false;
    if (p.weaponSkillType != null && p.weaponSkillType !== g.weaponSkillType) return false;
    return true;
  });

  // Pre-select:
  // 1. A profile with the same name as the gladiator (if compatible)
  // 2. Otherwise, the currently active profile (if compatible)
  const sameNameProfile = matchingProfiles.find(p => p.name.trim().toLowerCase() === g.name.trim().toLowerCase());
  const activeProfile = pgGetActiveProfile();
  const activeCompatible = activeProfile && matchingProfiles.find(p => p.id === activeProfile.id);

  const preselect = sameNameProfile ? sameNameProfile.id : (activeCompatible ? activeProfile.id : null);

  // If a profile with the same name already exists (compatible or not), we
  // can't create a new one with that name, so leave the input empty.
  const nameExists = pgIsNameTaken(g.name);

  _pgSyncModalState = {
    mapped,
    matchingProfiles,
    mode: preselect ? "existing" : "new",
    selectedProfileId: preselect,
    newName: nameExists ? "" : g.name,
    syncEquipment: true,
    syncProperties: true,
  };

  pgRenderSyncModal();
}

function pgCloseSyncModal() {
  document.getElementById("pg-sync-modal-backdrop")?.remove();
  document.removeEventListener("keydown", _pgSyncModalKeyHandler);
  _pgSyncModalState = null;
}

function _pgSyncModalKeyHandler(e) {
  if (e.key === "Escape") pgCloseSyncModal();
}

function pgRenderSyncModal() {
  const s = _pgSyncModalState;
  if (!s) return;

  document.getElementById("pg-sync-modal-backdrop")?.remove();

  const g = s.mapped.gladiator;
  const noMatching = s.matchingProfiles.length === 0;

  const html = `
    <div class="pg-modal-backdrop" id="pg-sync-modal-backdrop">
      <div class="pg-modal-card" id="pg-sync-modal-card">
        <div class="pg-modal-header">
          <h3 class="pg-modal-title">Importera aktiv gladiator</h3>
          <button type="button" class="pg-modal-close" id="pg-sync-modal-close" title="Stäng">${icon("x", { size: 18 })}</button>
        </div>
        <div class="pg-modal-body">
          <section class="pg-sync-section">
            <h4 class="pg-sync-section-title">Gladiator</h4>
            <dl class="pg-sync-info-grid">
              <dt>Namn</dt>          <dd>${pgEscape(g.name)}</dd>
              <dt>Ras</dt>           <dd>${pgEscape(g.raceName || "—")}</dd>
              <dt>Vapenfärdighet</dt><dd>${pgEscape(g.weaponSkillName || "—")}</dd>
              <dt>Vapenfattning</dt> <dd>${pgFormatWeaponHand(g.weaponHand)}</dd>
              <dt>Rykte</dt>         <dd>${pgFormatReputation(g.reputation)}</dd>
            </dl>
          </section>

          <section class="pg-sync-section">
            <h4 class="pg-sync-section-title">Profil</h4>
            <label class="pg-radio-label">
              <input type="radio" name="pg-sync-mode" value="new" ${s.mode === "new" ? "checked" : ""}>
              Ny profil
            </label>
            <input type="text" class="pg-input pg-sync-name-input" id="pg-sync-name-input"
                   value="${pgEscape(s.newName)}" maxlength="50"
                   ${s.mode !== "new" ? "disabled" : ""}>

            <label class="pg-radio-label" ${noMatching ? 'title="Inga befintliga profiler matchar denna gladiators ras och vapenfärdighet."' : ""}>
              <input type="radio" name="pg-sync-mode" value="existing"
                     ${s.mode === "existing" ? "checked" : ""}
                     ${noMatching ? "disabled" : ""}>
              Befintlig profil
            </label>
            <div class="pg-sync-profile-select-wrap">
              ${pgDropdownHtml({
                id: "pg-sync-profile-select",
                value: s.selectedProfileId,
                items: s.matchingProfiles.map(p => ({
                  value: p.id,
                  label: p.name,
                  meta: pgProfileSummary(p)
                })),
                placeholder: "Välj profil...",
                noneLabel: false,
                showSearch: false,
                disabled: s.mode !== "existing" || noMatching
              })}
            </div>
          </section>

          <section class="pg-sync-section">
            <h4 class="pg-sync-section-title">Synkronisera</h4>
            <label class="pg-checkbox-label" disabled>
              <input type="checkbox" id="pg-sync-base-cb" checked disabled>
              Grundinställningar (ras, vapenfärdighet, vapenfattning, rykte)
            </label>
            <label class="pg-checkbox-label">
              <input type="checkbox" id="pg-sync-equip-cb" ${s.syncEquipment ? "checked" : ""}>
              <span>Utrustning <span class="pg-sync-subtle">(grad ${g.grade})</span></span>
            </label>
            <label class="pg-checkbox-label">
              <input type="checkbox" id="pg-sync-props-cb" ${s.syncProperties ? "checked" : ""}>
              <span>Egenskaper <span class="pg-sync-subtle">(grad ${g.grade})</span></span>
            </label>
          </section>

          <div id="pg-sync-modal-warning"></div>
        </div>
        <div class="pg-modal-footer">
          <button type="button" class="pg-btn pg-btn-ghost" id="pg-sync-modal-cancel">Avbryt</button>
          <button type="button" class="pg-btn pg-btn-primary" id="pg-sync-modal-confirm">
            <span class="pg-sync-icon-text">⇅</span> Importera
          </button>
        </div>
      </div>
    </div>`;

  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  document.body.appendChild(tmp.firstElementChild);

  pgBindSyncModal();
  pgUpdateSyncModalWarning();
  pgUpdateSyncModalConfirmState();
}

function pgFormatWeaponHand(wh) {
  if (wh === "1h") return "Enhandsvapen";
  if (wh === "2h") return "Tvåhandsvapen";
  if (wh === "shield") return "Sköld";
  return "—";
}

function pgFormatReputation(r) {
  if (r === "positive") return "Positivt";
  if (r === "negative") return "Negativt";
  if (r === "neutral")  return "Neutralt";
  return "—";
}

function pgCapitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pgBindSyncModal() {
  const s = _pgSyncModalState;
  if (!s) return;

  const backdrop = document.getElementById("pg-sync-modal-backdrop");
  if (!backdrop) return;

  // Click outside the card closes the modal
  backdrop.addEventListener("click", e => {
    if (e.target === backdrop) pgCloseSyncModal();
  });

  document.addEventListener("keydown", _pgSyncModalKeyHandler);

  document.getElementById("pg-sync-modal-close").addEventListener("click", pgCloseSyncModal);
  document.getElementById("pg-sync-modal-cancel").addEventListener("click", pgCloseSyncModal);

  document.querySelectorAll('input[name="pg-sync-mode"]').forEach(radio => {
    radio.addEventListener("change", () => {
      s.mode = radio.value;
      // When switching to "existing", make sure a profile is actually picked
      // so the confirm button doesn't stay disabled on "Välj profil".
      if (s.mode === "existing" && !s.selectedProfileId && s.matchingProfiles.length) {
        s.selectedProfileId = s.matchingProfiles[0].id;
      }
      pgRenderSyncModal();
    });
  });

  document.getElementById("pg-sync-name-input").addEventListener("input", e => {
    s.newName = e.target.value;
    pgUpdateSyncModalConfirmState();
  });

  pgDropdownBind(backdrop, "pg-sync-profile-select", val => {
    s.selectedProfileId = val;
    const profile = s.matchingProfiles.find(p => p.id === val);
    pgDropdownSetValue(backdrop, "pg-sync-profile-select", val, profile ? profile.name : "");
    pgUpdateSyncModalWarning();
    pgUpdateSyncModalConfirmState();
  });

  document.getElementById("pg-sync-equip-cb").addEventListener("change", e => {
    s.syncEquipment = e.target.checked;
    pgUpdateSyncModalWarning();
    pgUpdateSyncModalConfirmState();
  });

  document.getElementById("pg-sync-props-cb").addEventListener("change", e => {
    s.syncProperties = e.target.checked;
    pgUpdateSyncModalWarning();
    pgUpdateSyncModalConfirmState();
  });

  document.getElementById("pg-sync-modal-confirm").addEventListener("click", pgConfirmSyncModal);
}

// Show a warning when syncing properties into an existing profile that already
// has data at the synced grade — that data will be replaced.
function pgUpdateSyncModalWarning() {
  const s = _pgSyncModalState;
  if (!s) return;
  const wrap = document.getElementById("pg-sync-modal-warning");
  if (!wrap) return;

  const g = s.mapped.gladiator;
  const grade = g.grade;
  const parts = [];

  if (s.mode === "existing" && s.selectedProfileId) {
    const profile = pgState.profiles.find(p => p.id === s.selectedProfileId);
    if (profile) {
      // 1. Check basic settings (always synced)
      const diffBasic = profile.raceId != null && (
        profile.raceId !== g.raceId ||
        profile.weaponSkillType !== g.weaponSkillType ||
        profile.weaponHand !== g.weaponHand ||
        profile.reputation !== g.reputation
      );
      if (diffBasic) parts.push("grundinställningar");

      // 2. Check grade-specific data
      const hasStats = profile.stats?.[String(grade)] && Object.keys(profile.stats[String(grade)]).length > 0;
      const hasEquip = profile.equipment?.[String(grade)];
      if (s.syncProperties && hasStats) parts.push("egenskaper");
      if (s.syncEquipment && hasEquip)  parts.push("utrustning");
    }
  }

  if (parts.length === 0) { wrap.innerHTML = ""; return; }

  // Format parts: "A, B och C"
  let labelParts = "";
  if (parts.length === 1) {
    labelParts = parts[0];
  } else {
    labelParts = parts.slice(0, -1).join(", ") + " och " + parts[parts.length - 1];
  }

  const gradeSuffix = parts.every(p => p === "grundinställningar") ? "" : ` för grad ${grade}`;

  wrap.innerHTML = `
    <div class="pg-points-info pg-points-error">
      <div class="pg-points-label">Befintliga ${labelParts}${gradeSuffix} ersätts</div>
    </div>`;
}

function pgUpdateSyncModalConfirmState() {
  const s = _pgSyncModalState;
  if (!s) return;
  const btn = document.getElementById("pg-sync-modal-confirm");
  if (!btn) return;

  let canConfirm = true;
  let reason = "";

  if (s.mode === "new") {
    const name = (s.newName || "").trim();
    if (!name) { canConfirm = false; reason = "Ange ett namn för den nya profilen."; }
    else if (pgIsNameTaken(name)) { canConfirm = false; reason = "En profil med detta namn finns redan."; }
  } else {
    if (!s.selectedProfileId) { canConfirm = false; reason = "Välj en profil."; }
  }

  btn.disabled = !canConfirm;
  btn.title = reason;
}

async function pgConfirmSyncModal() {
  const s = _pgSyncModalState;
  if (!s) return;

  const oldProfileId = pgState.activeProfileId;
  let profileId;
  if (s.mode === "new") {
    const newProfile = pgCreateProfile(s.newName.trim());
    profileId = newProfile.id;
  } else {
    profileId = s.selectedProfileId;
  }
  if (!profileId) return;

  // Navigate to profile step if we're creating a new profile or switching to a different one
  if (s.mode === "new" || profileId !== oldProfileId) {
    pgState.currentStep = 0;
  }

  pgState.activeProfileId = profileId;
  // Always ensure we have a draft for the target profile
  if (!pgState.activeDraft || pgState.activeDraft.id !== profileId) {
    pgCreateDraft(profileId);
  }
  const draft = pgState.activeDraft;
  if (!draft) return;

  pgSyncApply(draft, s.mapped, {
    applyEquipment: s.syncEquipment,
    applyProperties: s.syncProperties,
  });

  // Auto-save changes immediately
  await pgCommitDraft();

  // Jump to the newly imported grade
  const grade = s.mapped.gladiator.grade;
  pgSetPreferredGrade(grade);
  pgState.staticStatsEditing = pgGradeHasStaticPoints(draft, grade);

  pgCloseSyncModal();

  pgRefreshPage();
}
