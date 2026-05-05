// Step 1: Profil — profile selection, management, and grundinställningar.
// Depends on: storage.js, data.js, dropdown.js, page.js (pgRefreshPage)

function pgProfileSummary(profile) {
  if (!profile.raceId && !profile.weaponHand && profile.weaponSkillType == null) return "";
  const raceName = (() => {
    if (!profile.raceId) return "";
    if (!window.ExtConfig?.races) {
      console.error("[Lanista-Ext] races missing from ExtConfig");
      return "";
    }
    const race = window.ExtConfig.races.find(r => r.id === profile.raceId);
    return race ? (PG_RACE_NAMES[race.name] || race.name) : "";
  })();
  const handLabel = { "1h": "1h", "2h": "2h", "shield": "Sköld" }[profile.weaponHand] || "";
  const vfName = profile.weaponSkillType != null ? pgWeaponSkillName(profile.weaponSkillType) : "";
  const parts = [raceName, handLabel, vfName].filter(Boolean);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function pgRenderStepProfile(container) {
  const profiles = pgState.profiles;
  const activeId = pgState.activeProfileId;
  const profile = pgGetActiveProfile();

  const profileItems = profiles.map(p => ({
    value: p.id,
    label: p.name,
    meta: pgProfileSummary(p),
  }));

  if (!window.ExtConfig?.races) {
    console.error("[Lanista-Ext] races missing from ExtConfig");
  }
  const races = (window.ExtConfig?.races || []).map(r => ({
    value: r.id,
    label: PG_RACE_NAMES[r.name] || r.name,
  }));

  const handOptions = [
    { value: "1h",     label: "Enhand" },
    { value: "2h",     label: "Tvåhand" },
    { value: "shield", label: "Sköld" },
  ];

  if (!window.ExtConfig?.weapon_skills) {
    console.error("[Lanista-Ext] weapon_skills missing from ExtConfig");
  }
  const vfOptions = (window.ExtConfig?.weapon_skills || [])
    .filter(s => s.visible !== false)
    .map(s => ({
      value: s.type,
      label: WEAPON_TYPE_LABELS[s.name.toLowerCase()] || s.name,
    }));

  const reputationOptions = [
    { value: "neutral",  label: "Neutral" },
    { value: "positive", label: "Positiv" },
    { value: "negative", label: "Negativ" },
  ];

  const grundvalSection = profile ? `
    <div class="pg-step-section">
      <h3 class="pg-section-title">Gladiator</h3>
      <div class="pg-field-row">
        <label class="pg-field-label">Ras</label>
        ${pgDropdownHtml({ id: "pg-gv-race", value: profile.raceId, items: races, noneLabel: false, showSearch: false })}
      </div>
      <div class="pg-field-row">
        <label class="pg-field-label">Vapenfattning</label>
        ${pgDropdownHtml({ id: "pg-gv-hand", value: profile.weaponHand, items: handOptions, noneLabel: false, showSearch: false })}
      </div>
      <div class="pg-field-row">
        <label class="pg-field-label">Vapenfärdighet</label>
        ${pgDropdownHtml({ id: "pg-gv-vf", value: profile.weaponSkillType, items: vfOptions, noneLabel: false, showSearch: false })}
      </div>
      <div class="pg-field-row">
        <label class="pg-field-label">Rykte</label>
        ${pgDropdownHtml({ id: "pg-gv-reputation", value: profile.reputation, items: reputationOptions, noneLabel: false, showSearch: false })}
      </div>
    </div>` : "";

  const html = `
    <div class="pg-step-section">
      <h3 class="pg-section-title">Välj profil</h3>
      <div class="pg-profile-row">
        ${pgDropdownHtml({ id: "pg-profile-select", value: activeId, items: profileItems, placeholder: "Välj profil...", noneLabel: false, showSearch: false })}

        <button type="button" class="pg-btn pg-btn-secondary" id="pg-profile-new-btn">
          ${icon("plus", { size: 14 })} Skapa profil
        </button>
        <input type="text" class="pg-input" id="pg-profile-name-input" placeholder="Profilnamn..." maxlength="50" hidden>
        <button type="button" class="pg-btn pg-btn-primary" id="pg-profile-name-confirm" hidden>Skapa</button>
        <button type="button" class="pg-btn pg-btn-ghost" id="pg-profile-name-cancel" hidden>Avbryt</button>

        <button type="button" class="pg-btn pg-btn-secondary" id="pg-profile-rename-btn" ${!activeId ? 'hidden' : ''}>
          ${icon("pencil", { size: 14 })} Byt namn
        </button>
        <input type="text" class="pg-input" id="pg-profile-rename-input" placeholder="Nytt namn..." maxlength="50" hidden>
        <button type="button" class="pg-btn pg-btn-primary" id="pg-profile-rename-confirm" hidden>Spara</button>
        <button type="button" class="pg-btn pg-btn-ghost" id="pg-profile-rename-cancel" hidden>Avbryt</button>

        <button type="button" class="pg-btn pg-btn-secondary" id="pg-profile-copy-btn" ${!activeId ? 'hidden' : ''}>
          ${icon("copy", { size: 14 })} Kopiera
        </button>
        <input type="text" class="pg-input" id="pg-profile-copy-input" placeholder="Namn på kopia..." maxlength="50" hidden>
        <button type="button" class="pg-btn pg-btn-primary" id="pg-profile-copy-confirm" hidden>Kopiera</button>
        <button type="button" class="pg-btn pg-btn-ghost" id="pg-profile-copy-cancel" hidden>Avbryt</button>

        <button type="button" class="pg-btn pg-btn-danger" id="pg-profile-delete-btn" ${!activeId ? 'hidden' : ''}>
          ${icon("trash-2", { size: 14 })} Ta bort
        </button>
      </div>
    </div>
    ${grundvalSection}`;

  container.innerHTML = html;
  pgBindStepProfile(container, profile);
}

function pgBindStepProfile(container, profile) {
  const pgValidateProfileName = (inputEl, confirmBtnEl, excludeId = null) => {
    const name = inputEl.value.trim();
    const isTaken = pgIsNameTaken(name, excludeId);
    confirmBtnEl.disabled = !name || isTaken;
  };

  pgDropdownBind(container, "pg-profile-select", val => {
    if (pgState.activeProfileId === val) return;
    pgState.activeProfileId = val;
    pgCreateDraft(val);
    pgState.dirty = false;
    pgState.currentEquipGrade = null;
    pgState.currentStatsGrade = null;
    pgState.preferredGrade = null;
    pgRefreshPage();
    pgUpdateSaveButtonState(pgGetActiveProfile());
  });

  const newBtn = container.querySelector("#pg-profile-new-btn");
  const renameBtn = container.querySelector("#pg-profile-rename-btn");
  const deleteBtn = container.querySelector("#pg-profile-delete-btn");
  const copyBtn = container.querySelector("#pg-profile-copy-btn");

  const setActionsHidden = (hidden) => {
    newBtn.hidden = hidden;
    if (renameBtn && pgState.activeProfileId) renameBtn.hidden = hidden;
    if (deleteBtn && pgState.activeProfileId) deleteBtn.hidden = hidden;
    if (copyBtn && pgState.activeProfileId) copyBtn.hidden = hidden;
  };

  newBtn.addEventListener("click", () => {
    const input = container.querySelector("#pg-profile-name-input");
    const confirm = container.querySelector("#pg-profile-name-confirm");
    const cancel = container.querySelector("#pg-profile-name-cancel");
    input.hidden = confirm.hidden = cancel.hidden = false;
    setActionsHidden(true);
    pgValidateProfileName(input, confirm);
    input.focus();
  });
  const newCancel = container.querySelector("#pg-profile-name-cancel");
  newCancel.addEventListener("click", () => {
    const input = container.querySelector("#pg-profile-name-input");
    input.hidden = container.querySelector("#pg-profile-name-confirm").hidden = newCancel.hidden = true;
    input.value = "";
    setActionsHidden(false);
  });
  container.querySelector("#pg-profile-name-confirm").addEventListener("click", async () => {
    const input = container.querySelector("#pg-profile-name-input");
    const name = input.value.trim();
    if (!name || pgIsNameTaken(name)) return;

    const newProfile = pgCreateProfile(name);
    pgState.activeProfileId = newProfile.id;
    pgCreateDraft(newProfile.id);
    pgState.currentEquipGrade = null;
    pgState.currentStatsGrade = null;
    pgState.preferredGrade = null;
    await pgSaveProfiles();
    pgRefreshPage();
    pgUpdateSaveButtonState(pgGetActiveProfile());
  });
  const newNameInput = container.querySelector("#pg-profile-name-input");
  newNameInput.addEventListener("input", () => pgValidateProfileName(newNameInput, container.querySelector("#pg-profile-name-confirm")));
  newNameInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !container.querySelector("#pg-profile-name-confirm").disabled) container.querySelector("#pg-profile-name-confirm").click();
    if (e.key === "Escape") newCancel.click();
  });

  // Rename
  if (renameBtn) {
    renameBtn.addEventListener("click", () => {
      const p = pgGetActiveProfile();
      const input = container.querySelector("#pg-profile-rename-input");
      const confirmBtn = container.querySelector("#pg-profile-rename-confirm");
      const cancelBtn = container.querySelector("#pg-profile-rename-cancel");

      input.value = p ? p.name : "";
      input.hidden = confirmBtn.hidden = cancelBtn.hidden = false;
      setActionsHidden(true);
      pgValidateProfileName(input, confirmBtn, p ? p.id : null);
      input.focus();
    });
  }
  const renameCancel = container.querySelector("#pg-profile-rename-cancel");
  if (renameCancel) {
    renameCancel.addEventListener("click", () => {
      container.querySelector("#pg-profile-rename-input").hidden = container.querySelector("#pg-profile-rename-confirm").hidden = renameCancel.hidden = true;
      setActionsHidden(false);
    });
  }
  const renameConfirm = container.querySelector("#pg-profile-rename-confirm");
  if (renameConfirm) {
    renameConfirm.addEventListener("click", async () => {
      const input = container.querySelector("#pg-profile-rename-input");
      const name = input.value.trim();
      if (!name || pgIsNameTaken(name, pgState.activeProfileId)) return;

      pgRenameProfile(pgState.activeProfileId, name);
      await pgSaveProfiles();
      pgRefreshPage();
    });
    const renameInput = container.querySelector("#pg-profile-rename-input");
    renameInput.addEventListener("input", () => pgValidateProfileName(renameInput, renameConfirm, pgState.activeProfileId));
    renameInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && !renameConfirm.disabled) renameConfirm.click();
      if (e.key === "Escape") renameCancel.click();
    });
  }

  // Copy
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const p = pgGetActiveProfile();
      const input = container.querySelector("#pg-profile-copy-input");
      const confirmBtn = container.querySelector("#pg-profile-copy-confirm");
      const cancelBtn = container.querySelector("#pg-profile-copy-cancel");

      input.value = p ? `${p.name} - kopia` : "";
      input.hidden = confirmBtn.hidden = cancelBtn.hidden = false;
      setActionsHidden(true);
      pgValidateProfileName(input, confirmBtn);
      input.focus();
    });
  }
  const copyCancel = container.querySelector("#pg-profile-copy-cancel");
  if (copyCancel) {
    copyCancel.addEventListener("click", () => {
      container.querySelector("#pg-profile-copy-input").hidden = container.querySelector("#pg-profile-copy-confirm").hidden = copyCancel.hidden = true;
      setActionsHidden(false);
    });
  }
  const copyConfirm = container.querySelector("#pg-profile-copy-confirm");
  if (copyConfirm) {
    copyConfirm.addEventListener("click", async () => {
      const name = container.querySelector("#pg-profile-copy-input").value.trim();
      if (!name || pgIsNameTaken(name)) return;
      const newProfile = pgCloneProfile(pgState.activeProfileId, name);
      pgState.activeProfileId = newProfile.id;
      pgCreateDraft(newProfile.id);
      pgState.currentEquipGrade = null;
      pgState.currentStatsGrade = null;
      pgState.preferredGrade = null;
      await pgSaveProfiles();
      pgRefreshPage();
    });
    const copyInput = container.querySelector("#pg-profile-copy-input");
    copyInput.addEventListener("input", () => pgValidateProfileName(copyInput, copyConfirm));
    copyInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && !copyConfirm.disabled) copyConfirm.click();
      if (e.key === "Escape") copyCancel.click();
    });
  }

  // Delete
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const p = pgGetActiveProfile();
      if (!p) return;

      pgShowConfirmModal({
        title: "Ta bort profil",
        message: `Är du säker på att du vill ta bort profilen "${p.name}"? Detta kan inte ångras.`,
        confirmLabel: "Ta bort",
        onConfirm: async () => {
          pgDeleteProfile(p.id);
          await pgSaveProfiles();
          pgRefreshPage();
          pgUpdateSaveButtonState(null);
        }
      });
    });
  }

  // Grundinställningar — only bind when a profile is active (dropdowns are rendered)
  if (profile) {
    pgDropdownBind(container, "pg-gv-race", async val => {
      if (profile.raceId !== val) {
        pgPushHistory();
        profile.raceId = val;
        
        // Ensure age data is loaded for the new race, then sanitize
        await pgLoadAgeData(val);
        pgSanitizeAgesForRace(profile);

        const item = (window.ExtConfig?.races || [])
          .map(r => ({ value: r.id, label: PG_RACE_NAMES[r.name] || r.name }))
          .find(r => r.value === val);
        pgDropdownSetValue(container, "pg-gv-race", val, item ? item.label : "");
        pgUpdateSaveButtonState(profile);
      }
    });

    pgDropdownBind(container, "pg-gv-hand", val => {
      if (profile.weaponHand !== val) {
        pgPushHistory();
        profile.weaponHand = val;
        const handLabels = {
          "1h":     "Enhand",
          "2h":     "Tvåhand",
          "shield": "Sköld",
        };
        pgDropdownSetValue(container, "pg-gv-hand", val, val ? handLabels[val] : "");
        pgUpdateSaveButtonState(profile);
      }
    });

    pgDropdownBind(container, "pg-gv-vf", val => {
      if (profile.weaponSkillType !== val) {
        pgPushHistory();
        profile.weaponSkillType = val;
        const item = (window.ExtConfig?.weapon_skills || [])
          .map(s => ({ value: s.type, label: WEAPON_TYPE_LABELS[s.name.toLowerCase()] || s.name }))
          .find(s => s.value === val);
        pgDropdownSetValue(container, "pg-gv-vf", val, item ? item.label : "");
        pgUpdateSaveButtonState(profile);
      }
    });

    pgDropdownBind(container, "pg-gv-reputation", val => {
      if (profile.reputation !== val) {
        pgPushHistory();
        profile.reputation = val;
        const repLabels = { neutral: "Neutral", positive: "Positiv", negative: "Negativ" };
        pgDropdownSetValue(container, "pg-gv-reputation", val, val ? repLabels[val] : "");
        pgUpdateSaveButtonState(profile);
      }
    });
  }
}
