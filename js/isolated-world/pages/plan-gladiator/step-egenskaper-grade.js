// Grade Management component for Step 3: Egenskaper
// Logic for handling grades (add, remove, toggle mode, meta indicators).

function pgGradeMetaHtml(isValid, isTotal, anyTotal, anyBoth, isSyncLocked) {
  // The "first slot" shows either the sync icon (for synced/locked grades)
  // or the Σ glyph (for normal total grades). They never coexist — a synced
  // grade is always total, and the sync icon takes the slot's space.
  const firstIconHtml = isSyncLocked
    ? `<span class="pg-grade-sync-icon" title="Importerad & låst grad">⇅</span>`
    : (isTotal ? '<span class="pg-grade-total-icon" title="Total poäng">Σ</span>' : '');
  const firstSpacerHtml = '<span class="pg-grade-icon-spacer" style="width:13px"></span>';
  const errorDotHtml    = '<span class="pg-error-dot">⏺</span>';
  const errorSpacerHtml = '<span class="pg-grade-icon-spacer" style="width:11px"></span>';

  let html = '<div class="pg-grade-meta-wrap">';
  if (anyBoth) {
    html += firstIconHtml || firstSpacerHtml;
    html += !isValid ? errorDotHtml : errorSpacerHtml;
  } else {
    if (firstIconHtml) html += firstIconHtml;
    else if (!isValid) html += errorDotHtml;
  }
  html += '</div>';
  return html;
}

let pgValidationTimeout = null;
function pgDebouncedUpdateGradeStatuses(container, profile) {
  if (pgValidationTimeout) clearTimeout(pgValidationTimeout);
  pgValidationTimeout = setTimeout(() => {
    pgPushHistory(); // Push to history when changes settle
    pgUpdateAllGradeStatuses(container, profile);
    pgValidationTimeout = null;
  }, 250);
}

function pgUpdateAllGradeStatuses(container, profile) {
  const report = pgValidateProfile(profile);
  const grades = pgGetStatsGrades(profile);

  const anyTotal = grades.some(g => pgGetGradeMode(profile, g) === "total");
  const anyBoth = grades.some(g => !report.grades[String(g)].isValid && pgGetGradeMode(profile, g) === "total");

  for (const g of grades) {
    const isValid = report.grades[String(g)].isValid;
    const isTotal = pgGetGradeMode(profile, g) === "total";
    const isSynced = pgIsGradeSyncLocked(profile, g);
    const html = pgGradeMetaHtml(isValid, isTotal, anyTotal, anyBoth, isSynced);
    pgDropdownSetItemMeta(container, "pg-stats-grade", g, "", "", html);
  }

  const dd = container.querySelector('[data-pg-dd="pg-stats-grade"]');
  if (dd) dd.classList.toggle("pg-dd-invalid", !report.isValid);
}

function pgToggleGradeMode(profile, grade, makeTotal) {
  profile.gradeModes ||= {};
  profile.stats ||= {};
  profile.stats[String(grade)] ||= {};

  if (makeTotal) {
    const eff = pgGetEffectiveStats(profile, grade);
    profile.stats[String(grade)] = { ...eff };
    profile.gradeModes[String(grade)] = "total";
  } else {
    const grades = pgGetStatsGrades(profile);
    const prev = grades.filter(g => g < grade).pop();
    const prevEff = prev != null ? pgGetEffectiveStats(profile, prev) : {};
    const myCumulative = profile.stats[String(grade)];
    const newDelta = {};
    for (const [k, v] of Object.entries(myCumulative)) {
      newDelta[k] = Math.max(0, (v ?? 0) - (prevEff[k] ?? 0));
    }
    profile.stats[String(grade)] = newDelta;
    delete profile.gradeModes[String(grade)];
  }
}

function pgAddStatsGrade(container, profile) {
  const input = container.querySelector("#pg-stats-grade-input");
  const grade = parseInt(input.value, 10);
  if (!grade || grade < 1) return;

  if (!profile.stats[String(grade)]) {
    profile.stats[String(grade)] = {};
    profile.gradeModes ||= {};
    if (pgIsForcedTotalGrade(profile, grade)) {
      profile.gradeModes[String(grade)] = "total";
    }
  }

  pgSetPreferredGrade(grade);
  pgState.staticStatsEditing = pgGradeHasStaticPoints(profile, grade);
  pgRenderStepEgenskaper(container);
}

function pgRemoveStatsGrade(profile, grade) {
  const cumulativeAtRemoved = pgGetEffectiveStats(profile, grade);

  if (profile.stats) delete profile.stats[String(grade)];
  if (profile.gradeModes) delete profile.gradeModes[String(grade)];
  if (profile.staticStats) delete profile.staticStats[String(grade)];
  if (profile.ages) delete profile.ages[String(grade)];
  if (profile.syncedData) delete profile.syncedData[String(grade)];
  if (profile.syncLocked) delete profile.syncLocked[String(grade)];

  const remaining = pgGetStatsGrades(profile);
  const next = remaining.find(x => x > grade);
  if (next != null) {
    const nextMode = profile.gradeModes?.[String(next)] === "total" ? "total" : "delta";
    if (nextMode !== "total") {
      const nextDelta = profile.stats[String(next)] || {};
      const newTotal = {};
      const allKeys = new Set([...Object.keys(cumulativeAtRemoved), ...Object.keys(nextDelta)]);
      for (const k of allKeys) {
        newTotal[k] = (cumulativeAtRemoved[k] ?? 0) + (nextDelta[k] ?? 0);
      }
      profile.stats[String(next)] = newTotal;
      profile.gradeModes ||= {};
      profile.gradeModes[String(next)] = "total";
    }
  }

  const newGrade = pgFindNextGradeAfterDelete(remaining, grade);
  pgSetPreferredGrade(newGrade);
  pgState.staticStatsEditing = pgGradeHasStaticPoints(profile, newGrade);
}
