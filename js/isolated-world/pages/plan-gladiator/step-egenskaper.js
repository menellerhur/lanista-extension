// Step 3: Egenskaper — stats and points allocation.
// Entry point for the attributes step.
// Depends on: state.js, data.js, stats.js, dropdown.js, page.js, 
//            step-egenskaper-table.js, step-egenskaper-grade.js

function pgRenderStepEgenskaper(container) {
  const profile = pgGetActiveProfile();
  if (!profile) { container.innerHTML = '<p class="pg-empty">Välj en profil i Profil-steget först.</p>'; return; }

  const grades = pgGetStatsGrades(profile);
  const currentGrade = pgState.currentStatsGrade;

  const report = pgValidateProfile(profile);
  const anyTotal = grades.some(g => pgGetGradeMode(profile, g) === "total");
  const anyBoth = grades.some(g => !report.grades[String(g)].isValid && pgGetGradeMode(profile, g) === "total");

  const gradeItems = grades.map(g => ({
    value: g,
    label: `Grad ${g}`,
    metaHtml: pgGradeMetaHtml(
      report.grades[String(g)].isValid,
      pgGetGradeMode(profile, g) === "total",
      anyTotal,
      anyBoth,
      pgIsGradeSyncLocked(profile, g)
    ),
  }));

  let statsHtml = "";
  if (currentGrade != null) {
    statsHtml = pgBuildStatsTableHtml(profile, currentGrade);
  } else {
    statsHtml = `<p class="pg-empty">Välj eller lägg till en grad för att ange egenskaper.</p>`;
  }

  const ageData = profile.raceId ? pgState.ageData[profile.raceId] : null;
  let currentAgeType = currentGrade != null ? pgGetAgeForGrade(profile, currentGrade) : 0;
  const ageItems = [];
  if (ageData) {
    const prevGrade = grades.filter(g => g < currentGrade).pop();
    const minAgeType = prevGrade != null ? pgGetAgeForGrade(profile, prevGrade) : 0;
    
    for (const age of ageData.ages) {
      if (age.age_in_days >= 100) continue;
      
      const isTooYoung = age.type < minAgeType;
      
      // Find the first grade where the gladiator reached AT LEAST this age
      let sourceGrade = null;
      for (const g of grades) {
        const gradeAge = pgGetAgeForGrade(profile, g);
        if (gradeAge >= age.type) {
          sourceGrade = g;
          break;
        }
      }

      ageItems.push({
        value: age.type,
        label: age.label.charAt(0).toUpperCase() + age.label.slice(1),
        disabled: isTooYoung,
        meta: (sourceGrade && age.type !== 0) ? `Grad ${sourceGrade}` : ""
      });
    }
  }

  // Ensure currentAgeType is valid for the current race/items
  if (ageItems.length > 0) {
    if (!ageItems.some(i => i.value === currentAgeType)) {
      currentAgeType = ageItems[0].value;
      if (currentGrade != null) {
        profile.ages ||= {};
        profile.ages[String(currentGrade)] = currentAgeType;
        pgUpdateSaveButtonState(profile);
      }
    }
  }

  const html = `
    <div class="pg-step-section">
      <h3 class="pg-section-title">Grad</h3>
      <div class="pg-profile-row">
        ${pgDropdownHtml({
          id: "pg-stats-grade",
          value: currentGrade,
          items: gradeItems,
          noneLabel: false,
          showSearch: false,
          invalid: !pgAreAllStatsGradesValid(profile)
        })}
        <button type="button" class="pg-btn pg-btn-secondary" id="pg-stats-add-grade-btn">
          ${icon("plus", { size: 14 })} Lägg till grad
        </button>
        <input type="number" class="pg-input pg-input-grade" id="pg-stats-grade-input" min="1" hidden>
        <button type="button" class="pg-btn pg-btn-primary" id="pg-stats-grade-confirm" hidden>Lägg till</button>
        <button type="button" class="pg-btn pg-btn-ghost" id="pg-stats-grade-cancel" hidden>Avbryt</button>
        ${currentGrade != null ? `<button type="button" class="pg-btn pg-btn-danger" id="pg-stats-remove-grade-btn">${icon("trash-2", { size: 14 })} Ta bort</button>` : ""}
      </div>
    </div>

    ${currentGrade != null ? `
    <div class="pg-properties-header-layout">
      <div class="pg-egenskaper-config">
        <h4 class="pg-section-title">Egenskaper</h4>
        ${pgBuildModeRowHtml(profile, currentGrade)}
      </div>
      <div class="pg-age-config">
        <h3 class="pg-section-title">Ålder</h3>
        <div class="pg-profile-row">
          ${pgDropdownHtml({
            id: "pg-stats-age",
            value: currentAgeType,
            items: ageItems,
            noneLabel: false,
            showSearch: false,
            disabled: !ageData || pgIsGradeSyncLocked(profile, currentGrade)
          })}
        </div>
      </div>
    </div>` : ""}

    <div id="pg-stats-table-wrap">
      ${statsHtml}
    </div>`;

  container.innerHTML = html;
  pgBindStepEgenskaper(container, profile);
  pgUpdateSaveButtonState(profile);
}

function pgBuildModeRowHtml(profile, grade) {
  const isG1 = grade === 1;
  const mode = pgGetGradeMode(profile, grade);
  const forced = pgIsForcedTotalGrade(profile, grade);
  const isLocked = pgIsGradeSyncLocked(profile, grade);
  const hasSyncData = !!profile.syncedData?.[String(grade)];

  // When locked, the mode + static toggles are inactive — the table is
  // rendered straight from the synced master data.
  const totalChecked = (isLocked ? false : mode === "total") ? "checked" : "";
  const totalDisabled = (forced || isLocked) ? "disabled" : "";

  const staticChecked = (isLocked ? false : pgState.staticStatsEditing) ? "checked" : "";
  const staticDisabled = isLocked ? "disabled" : "";

  // Lock checkbox is only meaningful for grades that have synced data. Without
  // it, the checkbox is disabled and unchecked.
  const lockChecked = isLocked ? "checked" : "";
  const lockDisabled = hasSyncData ? "" : "disabled";
  const lockTitle = hasSyncData
    ? `title="Visa importerad data som låst master-baseline för grad ${grade}."`
    : `title="Ingen importerad data för denna grad. Använd importknappen uppe till vänster."`;

  const hintText = (forced && !isG1 && !isLocked)
    ? `Tvingande eftersom grad ${grade - 1} inte är konfigurerad.`
    : "";
  const titleAttr = hintText ? `title="${hintText}"` : "";

  return `
    <div class="pg-stats-mode-row">
      <label class="pg-checkbox-label" ${titleAttr}>
        <input type="checkbox" id="pg-grade-mode-toggle" ${totalChecked} ${totalDisabled}>
        Ange totala poäng
      </label>
    </div>
    <div class="pg-stats-mode-row">
      <label class="pg-checkbox-label">
        <input type="checkbox" id="pg-static-mode-toggle" ${staticChecked} ${staticDisabled}>
        Ange statiska poäng
      </label>
    </div>
    <div class="pg-stats-mode-row">
      <label class="pg-checkbox-label" ${lockTitle}>
        <input type="checkbox" id="pg-grade-lock-toggle" ${lockChecked} ${lockDisabled}>
        Låst till importerade värden
      </label>
    </div>`;
}

function pgBindStepEgenskaper(container, profile) {
  pgBindAgeTooltipsOnce(container);
  pgBindEquipTooltipsOnce(container); 

  // Grade selector
  pgDropdownBind(container, "pg-stats-grade", val => {
    const newGrade = val != null ? Number(val) : null;
    if (newGrade === pgState.currentStatsGrade) return;

    pgPushHistory();
    if (newGrade != null) {
      pgSetPreferredGrade(newGrade);
      pgState.staticStatsEditing = pgGradeHasStaticPoints(profile, newGrade);
    } else {
      pgState.currentStatsGrade = null;
      pgState.preferredGrade = null;
      pgState.staticStatsEditing = false;
    }
    pgRenderStepEgenskaper(container);
  });

  // Age selector
  pgDropdownBind(container, "pg-stats-age", val => {
    const grade = pgState.currentStatsGrade;
    if (grade == null) return;
    const ageType = val != null ? Number(val) : 0;
    const oldAge = pgGetAgeForGrade(profile, grade);
    if (ageType === oldAge) return;

    pgPushHistory();
    profile.ages ||= {};
    profile.ages[String(grade)] = ageType;
    
    pgUpdateSaveButtonState(profile);
    pgRenderStepEgenskaper(container);
  });

  // Mode toggle (delta ↔ total)
  const modeToggle = container.querySelector("#pg-grade-mode-toggle");
  if (modeToggle) {
    modeToggle.addEventListener("change", () => {
      const grade = pgState.currentStatsGrade;
      if (grade == null) return;
      pgToggleGradeMode(profile, grade, modeToggle.checked);
      pgRenderStepEgenskaper(container);
    });
  }

  // Lock toggle — switches a grade between synced/locked master data and
  // editable fallback data. Sync data must already exist for this to engage.
  const lockToggle = container.querySelector("#pg-grade-lock-toggle");
  if (lockToggle) {
    lockToggle.addEventListener("change", () => {
      const grade = pgState.currentStatsGrade;
      if (grade == null) return;
      if (!profile.syncedData?.[String(grade)]) return;

      pgPushHistory();
      profile.syncLocked ||= {};
      if (lockToggle.checked) {
        profile.syncLocked[String(grade)] = true;
      } else {
        delete profile.syncLocked[String(grade)];
      }
      pgState.staticStatsEditing = pgGradeHasStaticPoints(profile, grade);
      pgUpdateSaveButtonState(profile);
      pgRenderStepEgenskaper(container);
    });
  }

  // Static mode toggle
  const staticToggle = container.querySelector("#pg-static-mode-toggle");
  if (staticToggle) {
    staticToggle.addEventListener("change", () => {
      const grade = pgState.currentStatsGrade;
      const checked = staticToggle.checked;

      if (grade != null) {
        if (checked) {
          const inherited = pgGetEffectiveStaticStats(profile, grade);
          profile.staticStats ||= {};
          profile.staticStats[String(grade)] = { ...inherited };
          pgState.staticStatsEditing = true;
        } else {
          if (profile.staticStats) delete profile.staticStats[String(grade)];
          pgState.staticStatsEditing = false;
        }
      }
      pgRenderStepEgenskaper(container);
    });
  }

  // Add grade
  container.querySelector("#pg-stats-add-grade-btn").addEventListener("click", (e) => {
    const input = container.querySelector("#pg-stats-grade-input");
    const currentGrades = pgGetStatsGrades(profile);
    const activeGrade = pgState.currentStatsGrade;
    let nextGrade = 1;

    if (activeGrade != null) {
      nextGrade = activeGrade + 1;
      while (currentGrades.includes(nextGrade)) nextGrade++;
    } else {
      while (currentGrades.includes(nextGrade)) nextGrade++;
    }

    input.value = nextGrade;
    input.hidden = false;
    container.querySelector("#pg-stats-grade-confirm").hidden = false;
    container.querySelector("#pg-stats-grade-cancel").hidden = false;
    e.currentTarget.hidden = true;
    const removeBtn = container.querySelector("#pg-stats-remove-grade-btn");
    if (removeBtn) removeBtn.hidden = true;
    input.focus();
    input.select();
  });

  container.querySelector("#pg-stats-grade-cancel").addEventListener("click", () => {
    container.querySelector("#pg-stats-grade-input").hidden = true;
    container.querySelector("#pg-stats-grade-confirm").hidden = true;
    container.querySelector("#pg-stats-grade-cancel").hidden = true;
    container.querySelector("#pg-stats-add-grade-btn").hidden = false;
    const removeBtn = container.querySelector("#pg-stats-remove-grade-btn");
    if (removeBtn) removeBtn.hidden = false;
    container.querySelector("#pg-stats-grade-input").value = "";
  });

  container.querySelector("#pg-stats-grade-confirm")?.addEventListener("click", () => {
    pgAddStatsGrade(container, profile);
  });

  container.querySelector("#pg-stats-grade-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") container.querySelector("#pg-stats-grade-confirm").click();
    if (e.key === "Escape") container.querySelector("#pg-stats-grade-cancel").click();
  });

  // Remove grade
  const removeBtn = container.querySelector("#pg-stats-remove-grade-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      const grade = pgState.currentStatsGrade;
      if (grade == null) return;

      pgShowConfirmModal({
        title: "Ta bort egenskaper",
        message: `Är du säker på att du vill ta bort egenskaper för grad ${grade}?`,
        confirmLabel: "Ta bort",
        onConfirm: () => {
          pgRemoveStatsGrade(profile, grade);
          pgRenderStepEgenskaper(container);
        }
      });
    });
  }

  // Stat inputs
  const tableWrap = container.querySelector("#pg-stats-table-wrap");
  if (!tableWrap) return;
  tableWrap.addEventListener("input", e => {
    const input = e.target.closest(".pg-stat-input");
    if (!input) return;
    
    const grade = pgState.currentStatsGrade;
    if (grade == null) return;

    const key = input.dataset.statKey;
    const isStatic = input.classList.contains("pg-static-input");

    if (isStatic) {
      const newVal = parseInt(input.value, 10) || 0;
      profile.staticStats ||= {};
      profile.staticStats[String(grade)] ||= {};
      profile.staticStats[String(grade)][key] = newVal;
      pgUpdateStatRow(container, profile, grade, key);
      pgUpdateStaticToggleState(container, profile, grade);
    } else {
      const newVal = Math.max(0, parseInt(input.value, 10) || 0);
      profile.stats ||= {};
      profile.stats[String(grade)] ||= {};
      profile.stats[String(grade)][key] = newVal;
      pgUpdateStatRow(container, profile, grade, key);
    }
    pgDebouncedUpdateGradeStatuses(container, profile);
  });
}

function pgUpdateStaticToggleState(container, profile, grade) {
  const toggle = container.querySelector("#pg-static-mode-toggle");
  if (!toggle) return;
  toggle.checked = pgState.staticStatsEditing;
}
