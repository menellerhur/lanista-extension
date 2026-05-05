// Stats Table component for Step 3: Egenskaper
// Logic for rendering the main attributes table and related warnings.

function pgFormatStatValue(val) {
  return Number(val.toFixed(2));
}

function pgRequirementsWarningHtml(reqStrength, currentStrength) {
  if (reqStrength <= 0 || currentStrength >= reqStrength) return "";

  return `
    <div class="pg-points-info pg-points-error">
      <div class="pg-points-label">Styrkekrav ej uppfyllt!</div>
      <div class="pg-points-val">Du behöver minst ${reqStrength} styrka för din utrustning.</div>
    </div>`;
}

function pgPointsTrackerHtml(profile, grade) {
  const sum = pgSumGradeValues(profile, grade);
  const budget = pgGetGradeMode(profile, grade) === "total"
    ? pgGetCumulativeBudget(grade)
    : pgGetDeltaBudget(grade);
  const diff = budget - sum;
  const statusClass = diff === 0 ? "pg-points-ok" : "pg-points-error";
  const label = diff === 0 ? "Poäng fördelade!" : (diff > 0 ? `Poäng kvar: ${diff}` : `För många poäng: ${Math.abs(diff)}`);

  return `<div class="pg-points-info ${statusClass}">
    <span class="pg-points-label">${label}</span>
    <span class="pg-points-total">Totalt: ${sum} / ${budget}</span>
  </div>`;
}

// Cross-grade conflict warnings (rules 2 + 3).
function pgCrossGradeWarningHtml(profile, grade) {
  if (pgGetGradeMode(profile, grade) !== "total" && !pgIsGradeBudgetValid(profile, grade)) return "";

  const c = pgGetCrossGradeConflicts(profile, grade);
  if (!c.tooHigh.length && !c.tooLow.length) return "";

  const myMode = pgGetGradeMode(profile, grade);
  let html = "";

  for (const e of c.tooHigh) {
    const verb = myMode === "total" ? "Konflikt med" : "Begränsas av";
    html += `
      <div class="pg-points-info pg-points-error">
        <div class="pg-points-label">${verb} grad ${e.grade}</div>
        <div class="pg-points-val">Max ${e.label.toLowerCase()}: ${e.max}</div>
      </div>`;
  }
  for (const e of c.tooLow) {
    html += `
      <div class="pg-points-info pg-points-error">
        <div class="pg-points-label">Konflikt med grad ${e.grade}</div>
        <div class="pg-points-val">Min ${e.label.toLowerCase()}: ${e.min}</div>
      </div>`;
  }

  return html;
}

function pgGetWarnedStatKeys(profile, grade) {
  const result = { regular: new Set(), static: new Set() };
  const isBudgetOk = pgGetGradeMode(profile, grade) === "total" || pgIsGradeBudgetValid(profile, grade);
  const conflicts = pgGetCrossGradeConflicts(profile, grade);

  for (const e of conflicts.tooHigh) {
    if (e.isStatic) result.static.add(e.statKey);
    else if (isBudgetOk) result.regular.add(e.statKey);
  }
  for (const e of conflicts.tooLow) {
    if (e.isStatic) result.static.add(e.statKey);
    else if (isBudgetOk) result.regular.add(e.statKey);
  }
  return result;
}

function pgBuildStatsTableHtml(profile, grade) {
  if (pgIsGradeSyncLocked(profile, grade)) {
    return pgBuildStatsTableHtmlLocked(profile, grade);
  }

  const mode = pgGetGradeMode(profile, grade);
  const data = profile.stats?.[String(grade)] || {};
  const effectiveStats = pgGetEffectiveStats(profile, grade);

  const prevGradeNum = pgGetStatsGrades(profile).filter(g => g < grade).pop();
  const prevEffective = prevGradeNum != null ? pgGetEffectiveStats(profile, prevGradeNum) : {};
  const prevGradeLabel = prevGradeNum ? `G${prevGradeNum}` : "";

  const equipSlots = pgEquipSlotsForGrade(profile, grade);
  const equipReqs = pgGetEquipRequirements(equipSlots);
  const rows = pgStatRows(profile);
  const hasRace = profile.raceId != null;
  const warnedKeys = pgGetWarnedStatKeys(profile, grade);

  const staticStats = pgGetEffectiveStaticStats(profile, grade);
  const hasAnyStatic = Object.values(staticStats).some(v => v !== 0);
  const showStaticCol = pgState.staticStatsEditing || hasAnyStatic;

  const pendingStaticData = profile.staticStats?.[String(grade)] || {};

  // Find current total strength (after race + equip) for the requirement check.
  // Find current total strength for the requirement check.
  const strDetails = pgCalculateStatDetails(profile, grade, "strength");
  const currentStrength = strDetails ? strDetails.totalDisp : 0;

  let html = "";
  html += `<div class="pg-alerts-wrap">
    <div class="pg-points-wrap" id="pg-points-wrap">
      ${pgPointsTrackerHtml(profile, grade)}
    </div>
    <div class="pg-req-wrap" id="pg-req-wrap">
      ${pgRequirementsWarningHtml(equipReqs.strength, currentStrength)}
    </div>
    <div class="pg-cross-warn-wrap" id="pg-cross-warn-wrap">
      ${pgCrossGradeWarningHtml(profile, grade)}
    </div>
  </div>`;

  const showPrevCol = mode === "total" && prevGradeNum != null;
  const showPlusMinusCol = mode === "delta" || (mode === "total" && prevGradeNum != null);

  html += `<table class="pg-stats-table" data-mode="${mode}">
    <thead>
      <tr>
        <th class="pg-stats-th pg-stats-label-col">Egenskap</th>
        ${showPrevCol ? `<th class="pg-stats-th pg-stats-prev-col">${prevGradeLabel}</th>` : ""}
        ${showPlusMinusCol ? `<th class="pg-stats-th pg-stats-bas-plus-col">+/-</th>` : ""}
        <th class="pg-stats-th pg-stats-bas-tot-col">Bas</th>
        <th class="pg-stats-th pg-stats-race-col" colspan="2">Bonus</th>
        ${showStaticCol ? `<th class="pg-stats-th pg-stats-static-col">Statiskt</th>` : ""}
        <th class="pg-stats-th pg-stats-equip-col">Utrustning</th>
        <th class="pg-stats-th pg-stats-total-col">Totalt</th>
      </tr>
    </thead>
    <tbody>`;

  for (const row of rows) {
    const stored = Math.max(0, data[row.key] ?? 0);
    const prevBaseNum = prevGradeNum != null ? (prevEffective[row.key] ?? 0) : 0;
    const prevBaseDisp = prevGradeNum != null ? prevBaseNum : "";

    const d = pgCalculateStatDetails(profile, grade, row.key);
    if (!d) continue;

    const delta = mode === "total" ? Math.max(0, d.base - prevBaseNum) : stored;

    const bonusTooltip = pgRaceAgeBonusTooltip(d);
    
    const raceBonusText = `(${d.racePct >= 0 ? "+" : ""}${d.racePct}%)`;
    const bonusHtml = `<span class="pg-label-race-bonus">${raceBonusText}</span>`;

    const equipActual = d.totalDisp - d.afterRaceAndAgeDisp - d.staticVal;
    const equipDisplay = equipActual !== 0
      ? `<span class="pg-stats-equip" title="${pgBonusTooltip(d.equipBonus.breakdown, d.afterRaceAndAgeExact)}">${equipActual > 0 ? "+" : ""}${equipActual}</span>`
      : `<span class="pg-stats-zero">–</span>`;

    const staticDisp = d.staticVal !== 0 ? (d.staticVal > 0 ? "+" : "") + d.staticVal : "–";
    const staticCellHtml = (pgState.staticStatsEditing || pgGradeHasStaticPoints(profile, grade))
      ? `<input type="number" class="pg-stat-input pg-static-input" data-stat-key="${row.key}" value="${pendingStaticData[row.key] ?? 0}">`
      : `<span class="${d.staticVal !== 0 ? "pg-stats-static" : "pg-stats-zero"}" title="${pgStaticPointsTooltip(profile, grade, row.key)}">${staticDisp}</span>`;

    const inputCell = `<input type="number" class="pg-stat-input" data-stat-key="${row.key}" value="${stored}" min="0">`;
    const basCell = mode === "delta"
      ? `<td class="pg-stats-num pg-stats-bas-plus-col">${inputCell}</td>`
      : `<td class="pg-stats-num pg-cell-readonly pg-stats-bas-plus-col">${delta}</td>`;
    const totalBasCell = mode === "delta"
      ? `<td class="pg-stats-num pg-cell-readonly pg-stats-bas-tot-col">${d.base}</td>`
      : `<td class="pg-stats-num pg-stats-bas-tot-col">${inputCell}</td>`;

    let rowWarnClass = "";
    if (warnedKeys.regular.has(row.key)) rowWarnClass += " pg-stats-row-warn";
    if (warnedKeys.static.has(row.key))  rowWarnClass += " pg-stats-row-static-warn";

    html += `<tr class="pg-stats-row${rowWarnClass}" data-row-key="${row.key}">
      <td class="pg-stats-label">${pgEscape(row.label)} ${bonusHtml}</td>
      ${showPrevCol ? `<td class="pg-stats-num pg-stats-prev-val pg-stats-prev-col">${prevBaseDisp}</td>` : ""}
      ${showPlusMinusCol ? basCell : ""}
      ${totalBasCell}
      <td class="pg-stats-arrow-col"><span>→</span></td>
      <td class="pg-stats-num pg-stats-after-race pg-stats-race-col" title="${bonusTooltip}">${d.afterRaceAndAgeDisp}</td>
      ${showStaticCol ? `<td class="pg-stats-num pg-stats-static-col">${staticCellHtml}</td>` : ""}
      <td class="pg-stats-num pg-stats-equip-col">${equipDisplay}</td>
      <td class="pg-stats-num pg-stats-total pg-stats-total-col" title="${pgFormatStatValue(d.totalExact)}">${d.totalDisp}</td>
    </tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

// Read-only render path for a synced+locked grade. All values come from the
// synced master data via pgCalculateStatDetailsLocked — no inputs, no delta
// columns, no budget tracker. Equipment and its strength requirement still
// matter because the user can change equipment freely on a synced grade.
function pgBuildStatsTableHtmlLocked(profile, grade) {
  const synced = profile.syncedData?.[String(grade)];
  if (!synced) return "";

  const rows = pgStatRows(profile);
  const equipSlots = pgEquipSlotsForGrade(profile, grade);
  const equipReqs  = pgGetEquipRequirements(equipSlots);

  const strDetails = pgCalculateStatDetailsLocked(profile, grade, "strength");
  const currentStrength = strDetails ? strDetails.totalDisp : 0;

  // Show static column only if any synced stat has a non-zero static value.
  const hasAnyStatic = Object.values(synced.stats).some(s => (s.staticPoints ?? 0) !== 0);

  let html = "";
  html += `<div class="pg-alerts-wrap">
    <div class="pg-points-wrap" id="pg-points-wrap">
      <div class="pg-points-info pg-points-locked">
        <span class="pg-points-label">Låst till importerad data!</span>
      </div>
    </div>
    <div class="pg-req-wrap" id="pg-req-wrap">
      ${pgRequirementsWarningHtml(equipReqs.strength, currentStrength)}
    </div>
    <div class="pg-cross-warn-wrap" id="pg-cross-warn-wrap"></div>
  </div>`;

  html += `<table class="pg-stats-table pg-stats-table-locked" data-mode="locked">
    <thead>
      <tr>
        <th class="pg-stats-th pg-stats-label-col">Egenskap</th>
        <th class="pg-stats-th pg-stats-bas-tot-col">Bas</th>
        <th class="pg-stats-th pg-stats-race-col" colspan="2">Bonus</th>
        ${hasAnyStatic ? `<th class="pg-stats-th pg-stats-static-col">Statiskt</th>` : ""}
        <th class="pg-stats-th pg-stats-equip-col">Utrustning</th>
        <th class="pg-stats-th pg-stats-total-col">Totalt</th>
      </tr>
    </thead>
    <tbody>`;

  for (const row of rows) {
    const d = pgCalculateStatDetailsLocked(profile, grade, row.key);
    if (!d) continue;

    const bonusTooltip = pgRaceAgeBonusTooltip(d);

    const racePctText = `(${d.racePct >= 0 ? "+" : ""}${d.racePct}%)`;
    const labelExtra = `<span class="pg-label-race-bonus">${racePctText}</span>`;

    const equipActual = d.totalDisp - d.afterRaceAndAgeDisp - d.staticVal;
    const equipDisplay = equipActual !== 0
      ? `<span class="pg-stats-equip" title="${pgBonusTooltip(d.equipBonus.breakdown, d.afterRaceAndAgeExact)}">${equipActual > 0 ? "+" : ""}${equipActual}</span>`
      : `<span class="pg-stats-zero">–</span>`;

    const staticDisp = d.staticVal !== 0 ? (d.staticVal > 0 ? "+" : "") + d.staticVal : "–";
    const staticCellHtml = `<span class="${d.staticVal !== 0 ? "pg-stats-static" : "pg-stats-zero"}">${staticDisp}</span>`;

    html += `<tr class="pg-stats-row" data-row-key="${row.key}">
      <td class="pg-stats-label">${pgEscape(row.label)} ${labelExtra}</td>
      <td class="pg-stats-num pg-cell-readonly pg-stats-bas-tot-col">${d.base}</td>
      <td class="pg-stats-arrow-col"><span>→</span></td>
      <td class="pg-stats-num pg-stats-after-race pg-stats-race-col" title="${bonusTooltip}">${d.afterRaceAndAgeDisp}</td>
      ${hasAnyStatic ? `<td class="pg-stats-num pg-stats-static-col">${staticCellHtml}</td>` : ""}
      <td class="pg-stats-num pg-stats-equip-col">${equipDisplay}</td>
      <td class="pg-stats-num pg-stats-total pg-stats-total-col" title="${pgFormatStatValue(d.totalExact)}">${d.totalDisp}</td>
    </tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function pgRaceAgeBonusTooltip(d) {
  const tooltip = [];
  tooltip.push(`Ras: ${d.raceBonusPoints >= 0 ? "+" : ""}${pgFormatStatValue(d.raceBonusPoints)} poäng`);
  if (d.ageBonusPoints !== 0)  tooltip.push(`Ålder: ${d.ageBonusPoints > 0 ? "+" : ""}${pgFormatStatValue(d.ageBonusPoints)} poäng`);
  return tooltip.join("\n") || pgFormatStatValue(d.afterRaceAndAgeExact);
}

function pgBonusTooltip(breakdown, baseAfterRaceExact) {
  if (!breakdown.length) return "";
  return breakdown.map(b => {
     const actual = b.isPercent ? baseAfterRaceExact * b.value / 100 : b.value;
     const actualStr = (actual >= 0 ? "+" : "") + pgFormatStatValue(actual);
     const pctStr = b.isPercent ? ` (${b.value >= 0 ? "+" : ""}${b.value}%)` : "";
     return `${b.itemName}: ${actualStr}${pctStr}`;
   }).join("\n");
}

function pgStaticPointsTooltip(profile, grade, statKey) {
  const staticGrades = pgGetStaticGrades(profile).filter(g => g <= grade);
  if (staticGrades.length === 0) return "";
  
  const results = [];
  let prevVal = 0;
  for (const g of staticGrades) {
    const data = profile.staticStats?.[String(g)] || {};
    const val = data[statKey] ?? 0;
    const delta = val - prevVal;
    if (delta !== 0) {
      results.push(`Grad ${g}: ${delta > 0 ? "+" : ""}${delta}`);
      prevVal = val;
    }
  }
  return results.join("\n");
}

function pgUpdateStatRow(container, profile, grade, statKey) {
  const d = pgCalculateStatDetails(profile, grade, statKey);
  if (!d) return;

  const rowEl = container.querySelector(`tr[data-row-key="${statKey}"]`);
  if (rowEl) {
    const totalCell = rowEl.querySelector(".pg-stats-total");
    if (totalCell) { totalCell.textContent = d.totalDisp; totalCell.title = pgFormatStatValue(d.totalExact); }

    const afterBonusCell = rowEl.querySelector(".pg-stats-after-race");
    if (afterBonusCell) {
      afterBonusCell.textContent = d.afterRaceAndAgeDisp;
      afterBonusCell.title = pgRaceAgeBonusTooltip(d);
    }

    const equipSpan = rowEl.querySelector(".pg-stats-equip-col .pg-stats-equip, .pg-stats-equip-col .pg-stats-zero");
    if (equipSpan) {
      const equipActual = d.totalDisp - d.afterRaceAndAgeDisp - d.staticVal;
      if (equipActual !== 0) {
        equipSpan.className = "pg-stats-equip";
        equipSpan.textContent = (equipActual > 0 ? "+" : "") + equipActual;
        equipSpan.title = pgBonusTooltip(d.equipBonus.breakdown, d.afterRaceAndAgeExact);
      } else {
        equipSpan.className = "pg-stats-zero";
        equipSpan.textContent = "–";
        equipSpan.title = "";
      }
    }

    if (!pgState.staticStatsEditing) {
      const staticSpan = rowEl.querySelector(".pg-stats-static-col .pg-stats-static, .pg-stats-static-col .pg-stats-zero");
      if (staticSpan) {
        const staticDisp = d.staticVal !== 0 ? (d.staticVal > 0 ? "+" : "") + d.staticVal : "–";
        staticSpan.className = d.staticVal !== 0 ? "pg-stats-static" : "pg-stats-zero";
        staticSpan.textContent = staticDisp;
        staticSpan.title = pgStaticPointsTooltip(profile, grade, statKey);
      }
    }

    const mode = pgGetGradeMode(profile, grade);
    const prevGradeNum = pgGetStatsGrades(profile).filter(g => g < grade).pop();
    const prevEff = prevGradeNum != null ? pgGetEffectiveStats(profile, prevGradeNum) : {};
    const prevBase = prevEff[statKey] ?? 0;

    const readonlyCell = rowEl.querySelector(".pg-cell-readonly");
    if (readonlyCell) {
      if (mode === "delta") {
        readonlyCell.textContent = d.base;
      } else {
        readonlyCell.textContent = Math.max(0, d.base - prevBase);
      }
    }
  }

  const reqWrap = container.querySelector("#pg-req-wrap");
  if (reqWrap) {
    const equipSlots = pgEquipSlotsForGrade(profile, grade);
    const equipReqs = pgGetEquipRequirements(equipSlots);
    const strDetails = pgCalculateStatDetails(profile, grade, "strength");
    const currentStrength = strDetails ? strDetails.totalDisp : 0;
    reqWrap.innerHTML = pgRequirementsWarningHtml(equipReqs.strength, currentStrength);
  }

  const pointsWrap = container.querySelector("#pg-points-wrap");
  if (pointsWrap) {
    pointsWrap.innerHTML = pgPointsTrackerHtml(profile, grade);
  }

  const crossWrap = container.querySelector("#pg-cross-warn-wrap");
  if (crossWrap) {
    crossWrap.innerHTML = pgCrossGradeWarningHtml(profile, grade);
  }

  const warnedKeys = pgGetWarnedStatKeys(profile, grade);
  container.querySelectorAll(".pg-stats-row").forEach(tr => {
    const key = tr.dataset.rowKey;
    if (key) {
      tr.classList.toggle("pg-stats-row-warn", warnedKeys.regular.has(key));
      tr.classList.toggle("pg-stats-row-static-warn", warnedKeys.static.has(key));
    }
  });

  pgUpdateStaticToggleState(container, profile, grade);
  pgUpdateAllGradeStatuses(container, profile);
  pgUpdateSaveButtonState(profile);
}
