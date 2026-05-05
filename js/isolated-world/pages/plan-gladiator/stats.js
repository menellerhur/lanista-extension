// Stat computation helpers for Planera Gladiator.
// Depends on: data.js (PG_RACE_NAMES), common/items-data.js (itemsGetBonus)

// Mapping from UI stat key to API stat type
const PG_STAT_TYPES = {
  health:      0,  // STAMINA / Bashälsa
  strength:    1,  // STRENGTH / Styrka
  endurance:   3,  // ENDURANCE / Uthållighet
  initiative:  4,  // INITIATIVE / Initiativstyrka
  dodge:       7,  // DODGE / Undvika anfall
};

// Swedish UI labels per stat key
const PG_STAT_LABELS = {
  health:      "Bashälsa",
  strength:    "Styrka",
  endurance:   "Uthållighet",
  initiative:  "Initiativstyrka",
  dodge:       "Undvika anfall",
  weaponSkill: null, // set dynamically from chosen weapon skill
  shield:      "Sköldar",
};

// bonusable_name strings that appear in item bonus data, mapped to stat key
const PG_BONUS_NAME_MAP = {
  "bashälsa":        "health",
  "styrka":          "strength",
  "uthållighet":     "endurance",
  "initiativstyrka": "initiative",
  "undvika anfall":  "dodge",
};

// Returns race bonus multiplier for a given stat type (from window.ExtConfig.races)
function pgRaceStatMultiplier(raceId, statType) {
  if (!window.ExtConfig?.races) {
    console.error("[Lanista-Ext] races missing from ExtConfig");
    return 1;
  }
  const race = window.ExtConfig.races.find(r => r.id === raceId);
  if (!race) return 1;
  const bonus = race.bonuses?.stats?.find(s => s.type === statType);
  return bonus ? bonus.value : 1;
}

// Returns race weapon-skill multiplier
function pgRaceWeaponSkillMultiplier(raceId, weaponSkillType) {
  if (!window.ExtConfig?.races) {
    console.error("[Lanista-Ext] races missing from ExtConfig");
    return 1;
  }
  const race = window.ExtConfig.races.find(r => r.id === raceId);
  if (!race) return 1;
  const bonus = race.bonuses?.weapon_skills?.find(s => s.type === weaponSkillType);
  return bonus ? bonus.value : 1;
}

// Returns sum of flat and percentage bonuses from equipped items for a given stat.
// statKey: "health"|"strength"|...|"weaponSkill"|"shield"
// weaponSkillName: Swedish name of chosen weapon skill (e.g. "Yxor") for weaponSkill/shield matching
// Returns { flat, percent, breakdown: [{itemName, value, isPercent}] }
function pgEquipBonuses(equipSlots, statKey, weaponSkillName) {
  const result = { flat: 0, percent: 0, breakdown: [] };
  if (!equipSlots) return result;

  const lookupBonusName = bonusableName => {
    const lower = bonusableName?.toLowerCase() || "";
    // Direct stat match
    if (PG_BONUS_NAME_MAP[lower] === statKey) return true;
    // Weapon skill match: "vapenfärdigheten yxor" matches weaponSkillName
    if (statKey === "weaponSkill" && weaponSkillName && lower.includes("vapenfärdigheten") && lower.includes(weaponSkillName.toLowerCase())) return true;
    // Shield skill
    if (statKey === "shield" && lower.includes("vapenfärdigheten") && lower.includes("sköldar")) return true;
    return false;
  };

  for (const [slotKey, itemId] of Object.entries(equipSlots)) {
    if (!itemId) continue;

    // Enchants store stat contributions in `enchant_modifiers`, not `bonuses`,
    // so handle them separately.
    if (slotKey.startsWith("enchant_")) {
      const enchant = pgState.allEnchants.find(i => String(i.id) === String(itemId));
      if (!enchant || !Array.isArray(enchant.enchant_modifiers)) continue;
      for (const m of enchant.enchant_modifiers) {
        // Only static (always-on) modifiers contribute to baseline stats
        if (m.proc_chance !== 100) continue;
        if (!lookupBonusName(m.enchantable_name)) continue;
        const display = String(m.enchant_value_display ?? m.enchant_value ?? "");
        const isPercent = display.includes("%");
        const match = display.match(/([+-]?\d+)/);
        if (!match) continue;
        const val = parseInt(match[1], 10);
        if (isPercent) result.percent += val;
        else           result.flat    += val;
        result.breakdown.push({ itemName: enchant.name, value: val, isPercent });
      }
      continue;
    }

    // Determine correct item list based on slot key to avoid ID collisions
    let list = [];
    if (slotKey === "weapon" || slotKey === "offhand" || slotKey === "ranged") {
      list = pgState.allWeapons;
    } else if (slotKey.startsWith("potion")) {
      list = pgState.allConsumables;
    } else {
      // Armor and items (mantel, ring, etc)
      list = [...pgState.allArmors, ...pgState.allTrinkets];
    }

    const item = list.find(i => String(i.id) === String(itemId));
    if (!item || !item.bonuses) continue;

    for (const b of item.bonuses) {
      if (!lookupBonusName(b.bonusable_name)) continue;
      const display = b.bonus_value_display || "";
      const isPercent = display.includes("%");
      const m = display.match(/([+-]?\d+)/);
      if (!m) continue;
      const val = parseInt(m[1], 10);

      if (isPercent) {
        result.percent += val;
      } else {
        result.flat += val;
      }
      result.breakdown.push({ itemName: item.name, value: val, isPercent });
    }
  }
  return result;
}

// Returns all items from all arrays as a flat lookup map by id
function pgBuildItemMap(profile) {
  const map = new Map();
  for (const item of pgState.allWeapons) map.set(item.id, item);
  for (const item of pgState.allArmors) map.set(item.id, item);
  for (const item of pgState.allTrinkets) map.set(item.id, item);
  for (const item of pgState.allConsumables) map.set(item.id, item);
  return map;
}

// ── Grade helpers ───────────────────────────────────────────────────────────

// Returns sorted grade list from profile equipment
function pgGetEquipGrades(profile) {
  return Object.keys(profile.equipment || {})
    .map(Number)
    .sort((a, b) => a - b);
}

// Returns sorted grade list from profile stats
function pgGetStatsGrades(profile) {
  return Object.keys(profile.stats || {})
    .map(Number)
    .sort((a, b) => a - b);
}

// Get nearest lower-or-equal grade equipment for pre-population
function pgGetEquipForGrade(profile, grade) {
  const grades = pgGetEquipGrades(profile).filter(g => g <= grade);
  if (!grades.length) return null;
  return profile.equipment[String(grades[grades.length - 1])];
}

function pgDefaultEquipSlots() {
  return {
    weapon: null, offhand: null, ranged: null,
    head: null, shoulders: null, chest: null, hands: null, legs: null, feet: null,
    back: null, neck: null, finger: null, amulet: null, bracelet: null, trinket: null,
    potion1: null, potion2: null, potion3: null,
    enchant_weapon_1: null, enchant_weapon_2: null,
    enchant_offhand_1: null, enchant_offhand_2: null,
    enchant_ranged_1: null,
  };
}

// Finds the best next grade to select after deleting deletedGrade.
// Priority: 1. Next larger grade, 2. Next smaller grade.
function pgFindNextGradeAfterDelete(remainingGrades, deletedGrade) {
  return remainingGrades.find(g => g > deletedGrade) ?? remainingGrades[remainingGrades.length - 1] ?? null;
}

/**
 * Finds the best matching grade from availableGrades based on preferredGrade.
 * Priority: 1. Exact match, 2. Nearest lower, 3. Nearest higher.
 */
function pgGetBestMatchingGrade(preferredGrade, availableGrades) {
  if (!availableGrades || availableGrades.length === 0) return null;
  if (preferredGrade == null) return availableGrades[0];
  
  if (availableGrades.includes(preferredGrade)) return preferredGrade;
  
  // Nearest lower
  const lower = availableGrades.filter(g => g < preferredGrade).sort((a, b) => b - a);
  if (lower.length > 0) return lower[0];
  
  // Nearest higher
  const higher = availableGrades.filter(g => g > preferredGrade).sort((a, b) => a - b);
  if (higher.length > 0) return higher[0];
  
  return availableGrades[0];
}

/**
 * Sets the preferred grade and synchronizes it to current step's grade state.
 */
function pgSetPreferredGrade(grade) {
  pgState.preferredGrade = grade;
  if (pgState.currentStep === 1) pgState.currentEquipGrade = grade;
  if (pgState.currentStep === 2) pgState.currentStatsGrade = grade;
}

// Returns equipment slots for a grade — uses nearest lower-or-equal defined grade.
function pgEquipSlotsForGrade(profile, grade) {
  if (!profile.equipment) return null;
  return pgGetEquipForGrade(profile, grade) || null;
}

// ── Static stats helpers ────────────────────────────────────────────────────

// Returns sorted list of grades that have explicitly defined non-zero static points.
function pgGetStaticGrades(profile) {
  const keys = Object.keys(profile.staticStats || {});
  const result = [];
  for (const k of keys) {
    const g = Number(k);
    if (pgGradeHasStaticPoints(profile, g)) result.push(g);
  }
  return result.sort((a, b) => a - b);
}

// Returns effective static stats for a grade, inheriting from nearest lower defined grade.
function pgGetEffectiveStaticStats(profile, grade) {
  const staticGrades = pgGetStaticGrades(profile).filter(g => g <= grade);
  if (staticGrades.length === 0) return {};

  const nearest = staticGrades[staticGrades.length - 1];
  return { ...(profile.staticStats?.[String(nearest)] || {}) };
}

// Returns the age type for a given grade, inheriting from nearest lower defined grade.
function pgGetAgeForGrade(profile, grade) {
  const allGrades = pgGetStatsGrades(profile).filter(g => g <= grade);
  if (allGrades.length === 0) return 0;

  // Find the latest synced grade that is <= the target grade.
  const syncedGrades = allGrades.filter(g => pgIsGradeSyncLocked(profile, g));
  const latestSynced = syncedGrades.length > 0 ? syncedGrades[syncedGrades.length - 1] : null;

  let startAge = 0;
  let searchFromIdx = 0;

  if (latestSynced != null) {
    startAge = profile.syncedData[String(latestSynced)]?.ageType || 0;
    // If the target grade is the synced grade itself, we are done.
    if (latestSynced === grade) return startAge;
    // Otherwise, we only need to look at manual age changes that occurred AFTER the sync point.
    searchFromIdx = allGrades.indexOf(latestSynced) + 1;
  }

  const sAges = profile.ages || {};
  let maxAge = startAge;
  for (let i = searchFromIdx; i < allGrades.length; i++) {
    const g = allGrades[i];
    const val = sAges[String(g)];
    if (val != null && val > maxAge) maxAge = val;
  }
  return maxAge;
}

/**
 * Ensures all age assignments in a profile are valid for its current race.
 * If an age is too high (>= 100 days or not in race data), it's clamped to the highest valid age.
 */
function pgSanitizeAgesForRace(profile) {
  if (!profile.raceId || !profile.ages) return;
  const ageData = pgState.ageData[profile.raceId];
  if (!ageData) return;

  const validAges = ageData.ages.filter(a => a.age_in_days < 100);
  if (validAges.length === 0) {
    profile.ages = {}; // No valid ages? Clear them (shouldn't happen for most races)
    return;
  }

  const maxValidType = Math.max(...validAges.map(a => a.type));

  for (const [grade, ageType] of Object.entries(profile.ages)) {
    if (ageType > maxValidType) {
      profile.ages[grade] = maxValidType;
    }
  }
}

const PG_AGE_WEAPON_SKILL_MAP = {
  0: "axe",
  1: "sword",
  2: "mace",
  4: "stave",
  6: "shield",
  7: "spear",
  8: "chain"
};

function pgGetAgeLocalMultiplier(profile, ageType, statKey) {
  const ageData = profile.raceId ? pgState.ageData[profile.raceId] : null;
  if (!ageData) return 1;

  const rows = pgStatRows(profile);
  const row = rows.find(r => r.key === statKey);
  if (!row) return 1;

  const lookupKey = row.isSkill ? PG_AGE_WEAPON_SKILL_MAP[row.statType] : statKey;
  const age = ageData.ages.find(a => a.type === ageType);
  if (!age || !lookupKey) return 1;
  
  return age.bonuses[lookupKey] ?? 1;
}

function pgGetAgeMultiplier(profile, ageType, statKey) {
  let totalMult = 1;
  for (let t = 1; t <= ageType; t++) {
    totalMult *= pgGetAgeLocalMultiplier(profile, t, statKey);
  }
  return totalMult;
}

function pgGetAgeBonus(profile, grade, statKey) {
  const allGrades = pgGetStatsGrades(profile);
  const targetGrades = allGrades.filter(g => g <= grade);
  if (targetGrades.length === 0) return 0;

  const rows = pgStatRows(profile);
  const row = rows.find(r => r.key === statKey);
  if (!row) return 0;

  const raceMult = row.isSkill
    ? pgRaceWeaponSkillMultiplier(profile.raceId, row.statType)
    : pgRaceStatMultiplier(profile.raceId, row.statType);

  // Identify all age changes that have occurred up to the current grade.
  const ageChanges = []; // { ageType, reachedAtGrade }
  let lastAge = 0;
  for (const g of allGrades) {
    if (g > grade) break;
    const age = pgGetAgeForGrade(profile, g);
    if (age > lastAge) {
      ageChanges.push({ ageType: age, reachedAtGrade: g });
      lastAge = age;
    }
  }

  // Handle synced/locked baseline.
  const syncedBaseline = targetGrades.slice().reverse().find(g => pgIsGradeSyncLocked(profile, g));
  let totalBonus = 0;
  let baselineTotalWithRaceAndAge = 0;
  let startAfterGrade = -Infinity;
  let ageAtBaseline = 0;

  if (syncedBaseline != null) {
    const snap = profile.syncedData[String(syncedBaseline)]?.stats?.[statKey];
    if (snap) {
      totalBonus = snap.ageBonusPoints ?? 0;
      baselineTotalWithRaceAndAge = snap.placedPoints * raceMult + totalBonus;
      startAfterGrade = syncedBaseline;
      ageAtBaseline = pgGetAgeForGrade(profile, syncedBaseline);
    }
  }

  // 1. Apply future age changes to the points that were already present at the baseline.
  if (baselineTotalWithRaceAndAge > 0) {
    let baselinePointMult = 1;
    for (const change of ageChanges) {
      if (change.reachedAtGrade > startAfterGrade && change.ageType > ageAtBaseline) {
        baselinePointMult *= pgGetAgeLocalMultiplier(profile, change.ageType, statKey);
      }
    }
    totalBonus += baselineTotalWithRaceAndAge * (baselinePointMult - 1);
  }

  // 2. Calculate bonuses for all points added AFTER the baseline (or all points if no baseline).
  for (const g of targetGrades) {
    if (g <= startAfterGrade) continue;

    const mode = pgGetGradeMode(profile, g);
    const stats = profile.stats?.[String(g)] || {};
    let deltaPoints = 0;
    
    if (mode === "total") {
      const prevGrade = allGrades.filter(pg => pg < g).pop();
      const prevEff = prevGrade ? pgGetEffectiveStats(profile, prevGrade) : {};
      deltaPoints = (stats[statKey] ?? 0) - (prevEff[statKey] ?? 0);
    } else {
      deltaPoints = stats[statKey] ?? 0;
    }

    if (deltaPoints === 0) continue;

    const boostedDelta = deltaPoints * raceMult;
    let pointMult = 1;
    for (const change of ageChanges) {
      // Points added at grade 'g' receive bonuses for all age changes that happen AT OR AFTER grade 'g'.
      if (change.reachedAtGrade >= g) {
        pointMult *= pgGetAgeLocalMultiplier(profile, change.ageType, statKey);
      }
    }
    totalBonus += boostedDelta * (pointMult - 1);
  }

  return totalBonus;
}

// True if the user has marked this grade as locked to its synced master data.
// Both flag and data must be present — we never trust one without the other.
function pgIsGradeSyncLocked(profile, grade) {
  if (!profile) return false;
  const gKey = String(grade);
  return !!(profile.syncLocked?.[gKey] && profile.syncedData?.[gKey]);
}

// True if a grade has any non-zero static points.
function pgGradeHasStaticPoints(profile, grade) {
  const data = profile.staticStats?.[String(grade)];
  return data && Object.values(data).some(v => v !== 0);
}

// Returns true if two stat objects are identical in values.
function pgAreStatsEqual(s1, s2) {
  const keys = new Set([...Object.keys(s1 || {}), ...Object.keys(s2 || {})]);
  for (const k of keys) {
    if ((s1?.[k] ?? 0) !== (s2?.[k] ?? 0)) return false;
  }
  return true;
}

// ── Mode helpers ────────────────────────────────────────────────────────────
//
// A grade is either a "delta" grade (values are points added at
// this grade only) or a "total" grade (values are the cumulative
// target for this grade). Grade 1 is always "delta" with a special budget of 150.

// Total cumulative point budget at a given grade.
function pgGetCumulativeBudget(grade) {
  return 150 + (grade - 1) * 20;
}

// Per-grade delta budget for a delta grade: 150 if grade 1, otherwise 20.
function pgGetDeltaBudget(grade) {
  return grade === 1 ? 150 : 20;
}

// True if grade N must be a total grade because grade N-1 is not configured.
// Grade 1 is never forced (it's always a delta grade with the 150-point special case).
function pgIsForcedTotalGrade(profile, grade) {
  if (grade === 1) return true;
  const grades = pgGetStatsGrades(profile);
  return !grades.includes(grade - 1);
}

// Returns the effective mode: "total" if explicit gradeModes flag OR forced, otherwise "delta".
function pgGetGradeMode(profile, grade) {
  if (pgIsForcedTotalGrade(profile, grade)) return "total";
  return profile.gradeModes?.[String(grade)] === "total" ? "total" : "delta";
}

// ── Effective (cumulative) stats ────────────────────────────────────────────
//
// For a grade N, the effective (cumulative) stat values depend on the modes
// of all grades ≤ N:
//   - The nearest total grade ≤ N (if any) provides a "locked" baseline:
//     its stored values ARE the cumulative totals at that grade.
//   - All grades above the baseline (which by construction are delta grades
//     storing deltas) are summed on top of the baseline.
//   - If no total grade ≤ N exists, all grades ≤ N are delta grades and
//     their deltas are summed from scratch.
function pgGetEffectiveStats(profile, grade) {
  const effective = {};
  const grades = pgGetStatsGrades(profile).filter(g => g <= grade);
  if (grades.length === 0) return effective;

  let startIdx = -1;
  for (let i = grades.length - 1; i >= 0; i--) {
    if (pgGetGradeMode(profile, grades[i]) === "total") { startIdx = i; break; }
  }

  const readData = g => profile.stats?.[String(g)] || {};

  if (startIdx >= 0) {
    Object.assign(effective, { ...readData(grades[startIdx]) });
    for (let i = startIdx + 1; i < grades.length; i++) {
      const data = readData(grades[i]);
      for (const [k, v] of Object.entries(data)) {
        effective[k] = (effective[k] ?? 0) + (v ?? 0);
      }
    }
  } else {
    for (const g of grades) {
      const data = readData(g);
      for (const [k, v] of Object.entries(data)) {
        effective[k] = (effective[k] ?? 0) + (v ?? 0);
      }
    }
  }
  return effective;
}

// Sum of stored values at this specific grade (deltas for delta grade, totals for total grade).
function pgSumGradeValues(profile, grade) {
  const data = profile.stats?.[String(grade)] || {};
  const rows = pgStatRows(profile);
  let sum = 0;
  for (const row of rows) sum += (data[row.key] ?? 0);
  return sum;
}

// Budget check for a single grade — mode-aware.
function pgIsGradeBudgetValid(profile, grade) {
  const sum = pgSumGradeValues(profile, grade);
  if (pgGetGradeMode(profile, grade) === "total") {
    return sum === pgGetCumulativeBudget(grade);
  }
  return sum === pgGetDeltaBudget(grade);
}

// True if every defined grade in the profile passes pgIsGradeValid.
function pgAreAllStatsGradesValid(profile) {
  const grades = pgGetStatsGrades(profile);
  return grades.every(g => pgIsGradeValid(profile, g));
}

// Returns requirements for equipped items (currently only strength)
function pgGetEquipRequirements(equipSlots) {
  const reqs = { strength: 0 };
  if (!equipSlots) return reqs;

  for (const [slotKey, itemId] of Object.entries(equipSlots)) {
    if (!itemId) continue;

    let list = [];
    if (slotKey === "weapon" || slotKey === "offhand" || slotKey === "ranged") {
      list = pgState.allWeapons;
    } else if (slotKey.startsWith("potion")) {
      list = pgState.allConsumables;
    } else {
      list = [...pgState.allArmors, ...pgState.allTrinkets];
    }

    const item = list.find(i => String(i.id) === String(itemId));
    if (!item) continue;

    const strReqRaw = typeof itemsGetStrengthReq === "function"
      ? itemsGetStrengthReq(item)
      : (item.req_strength || 0);

    // Off-hand weapons (not shields) require double strength
    let strReq = strReqRaw;
    if (slotKey === "offhand" && !item.is_shield) strReq *= 2;

    if (strReq > reqs.strength) reqs.strength = strReq;
  }
  return reqs;
}

// Swedish weapon skill name for a given type
function pgWeaponSkillName(skillType) {
  if (!window.ExtConfig?.weapon_skills) {
    console.error("[Lanista-Ext] weapon_skills missing from ExtConfig");
    return "";
  }
  const skill = window.ExtConfig.weapon_skills.find(s => s.type === skillType);
  if (!skill) return "";
  return WEAPON_TYPE_LABELS[skill.name.toLowerCase()] || skill.name;
}

function pgStatRows(profile) {
  const rows = [
    { key: "health",     label: "Bashälsa",       statType: PG_STAT_TYPES.health,     isSkill: false },
    { key: "strength",   label: "Styrka",          statType: PG_STAT_TYPES.strength,   isSkill: false },
    { key: "endurance",  label: "Uthållighet",     statType: PG_STAT_TYPES.endurance,  isSkill: false },
    { key: "initiative", label: "Initiativstyrka", statType: PG_STAT_TYPES.initiative, isSkill: false },
    { key: "dodge",      label: "Undvika Anfall",  statType: PG_STAT_TYPES.dodge,      isSkill: false },
  ];

  const vfName = profile.weaponSkillType != null ? pgWeaponSkillName(profile.weaponSkillType) : "Vapenfärdighet";
  rows.push({
    key: "weaponSkill",
    label: vfName,
    statType: profile.weaponSkillType,
    isSkill: true,
    skillName: vfName,
  });

  if (profile.weaponHand === "shield") {
    rows.push({
      key: "shield",
      label: "Sköldar",
      statType: 6,
      isSkill: true,
      skillName: "Sköldar",
    });
  }
  return rows;
}

// True when a total grade has valid budget AND no tooLow conflict with any
// lower total grade that itself has valid budget. Used as a stricter gate:
// a normal grade is only constrained by a higher total if that total is "clean"
// (rule 3 — if the total has its own problems its limit is not authoritative).
//
// Synced+locked grades are always clean — their values come from the API and
// cannot be in conflict with anything; comparisons against them are skipped.
function pgIsTotalGradeClean(profile, grade) {
  if (pgIsGradeSyncLocked(profile, grade)) return true;
  if (!pgIsGradeBudgetValid(profile, grade)) return false;
  const allGrades = pgGetStatsGrades(profile);
  const myEff = pgGetEffectiveStats(profile, grade);
  const rows = pgStatRows(profile);

  // A total grade is "clean" only if it has no conflicts in EITHER direction
  // with other budget-valid total grades. A normal grade must not be constrained
  // by a total that is itself in conflict (rule 3).
  for (const other of allGrades.filter(g => g !== grade)) {
    if (pgIsGradeSyncLocked(profile, other)) continue;
    if (pgGetGradeMode(profile, other) !== "total") continue;
    if (!pgIsGradeBudgetValid(profile, other)) continue;
    const otherEff = pgGetEffectiveStats(profile, other);
    for (const r of rows) {
      const mine = myEff[r.key] ?? 0;
      const theirs = otherEff[r.key] ?? 0;
      // Lower total has more → conflict upward; higher total has less → conflict downward.
      if (other < grade && theirs > mine) return false;
      if (other > grade && mine > theirs) return false;
    }
  }
  return true;
}

// ── Cross-grade conflicts (rules 2 + 3) ─────────────────────────────────────
//
// Returns { tooHigh: [...], tooLow: [...] }.
//   tooHigh: this grade's cumulative stat exceeds a higher total grade's value.
//     - For a total grade: reference must only have valid budget.
//     - For a delta grade: reference must be "clean" (budget valid + no own tooLow
//       conflicts), because a conflicted/broken total is not authoritative (rule 3).
//     - Only the tightest constraint per attribute is kept (lowest max value).
//   tooLow: only when this grade is a total grade: a lower total with valid budget
//           has more of an attribute than this grade (rule 3).
function pgGetCrossGradeConflicts(profile, grade) {
  const conflicts = { tooHigh: [], tooLow: [] };

  // Synced+locked grades are baselines outside the normal conflict graph —
  // they cannot conflict with anything. Skip them entirely.
  if (pgIsGradeSyncLocked(profile, grade)) return conflicts;

  const allGrades = pgGetStatsGrades(profile);
  const myEff = pgGetEffectiveStats(profile, grade);
  const rows = pgStatRows(profile);
  const myMode = pgGetGradeMode(profile, grade);

  const pId = profile.id;
  // Data stored for this specific grade (deltas if delta, totals if total grade)
  const myData = profile.stats?.[String(grade)] || {};

  for (const higher of allGrades.filter(g => g > grade)) {
    if (pgIsGradeSyncLocked(profile, higher)) continue;
    if (pgGetGradeMode(profile, higher) !== "total") continue;
    const refOk = myMode === "total"
      ? pgIsGradeBudgetValid(profile, higher)
      : pgIsTotalGradeClean(profile, higher);
    if (!refOk) continue;
    const hiEff = pgGetEffectiveStats(profile, higher);
    for (const r of rows) {
      const my = myEff[r.key] ?? 0;
      const hi = hiEff[r.key] ?? 0;
      const myAllocated = myData[r.key] ?? 0;
      if (my > hi && myAllocated > 0) {
        conflicts.tooHigh.push({ grade: higher, statKey: r.key, label: r.label, max: hi });
      }
    }
  }

  // Keep only the tightest (lowest max) constraint per attribute for tooHigh.
  // If G10 limits strength to 70 and G25 limits it to 80, G10 is the binding constraint.
  // Tie-break: prefer the lower (nearest) grade.
  const tightestHigh = {};
  for (const e of conflicts.tooHigh) {
    const prev = tightestHigh[e.statKey];
    if (!prev || e.max < prev.max || (e.max === prev.max && e.grade < prev.grade)) {
      tightestHigh[e.statKey] = e;
    }
  }
  conflicts.tooHigh = Object.values(tightestHigh);

  if (myMode === "total") {
    for (const lower of allGrades.filter(g => g < grade)) {
      if (pgIsGradeSyncLocked(profile, lower)) continue;
      if (pgGetGradeMode(profile, lower) !== "total") continue;
      if (!pgIsGradeBudgetValid(profile, lower)) continue;
      const loEff = pgGetEffectiveStats(profile, lower);
      for (const r of rows) {
        const my = myEff[r.key] ?? 0;
        const lo = loEff[r.key] ?? 0;
        if (lo > my) conflicts.tooLow.push({ grade: lower, statKey: r.key, label: r.label, min: lo });
      }
    }

    // Keep only the tightest (highest min) constraint per attribute for tooLow.
    // If G5 requires strength ≥ 100 and G10 requires strength ≥ 80, G5 is the binding constraint.
    // Tie-break: prefer the higher (nearest) grade.
    const tightestLow = {};
    for (const e of conflicts.tooLow) {
      const prev = tightestLow[e.statKey];
      if (!prev || e.min > prev.min || (e.min === prev.min && e.grade > prev.grade)) {
        tightestLow[e.statKey] = e;
      }
    }
    conflicts.tooLow = Object.values(tightestLow);
  }

  // ── Static point conflicts ──
  const myStaticData = profile.staticStats?.[String(grade)];
  const hasMyStatic = myStaticData && Object.values(myStaticData).some(v => v !== 0);

  if (hasMyStatic) {
    const staticGrades = pgGetStaticGrades(profile);
    for (const other of staticGrades) {
      if (other === grade) continue;
      const otherStaticData = profile.staticStats?.[String(other)];
      if (!otherStaticData || !Object.values(otherStaticData).some(v => v !== 0)) continue;

      for (const r of rows) {
        const myVal = myStaticData[r.key] ?? 0;
        const otherVal = otherStaticData[r.key] ?? 0;

        if (other > grade && myVal > otherVal) {
          conflicts.tooHigh.push({
            grade: other,
            statKey: r.key,
            label: r.label + " (statiskt)",
            max: otherVal,
            isStatic: true
          });
        }
        if (other < grade && otherVal > myVal) {
          conflicts.tooLow.push({
            grade: other,
            statKey: r.key,
            label: r.label + " (statiskt)",
            min: otherVal,
            isStatic: true
          });
        }
      }
    }
  }

  return conflicts;
}

// ── Full validation ─────────────────────────────────────────────────────────
function pgIsGradeValid(profile, grade) {
  // Synced+locked grades skip budget and cross-grade checks — the only thing
  // that can invalidate them is unmet equipment strength requirements (and
  // equipment is freely editable on a synced grade).
  if (pgIsGradeSyncLocked(profile, grade)) {
    const equipSlots = pgEquipSlotsForGrade(profile, grade);
    const reqs = pgGetEquipRequirements(equipSlots);
    if (reqs.strength > 0) {
      const details = pgCalculateStatDetailsLocked(profile, grade, "strength");
      if (details && details.totalDisp < reqs.strength) return false;
    }
    return true;
  }

  if (!pgIsGradeBudgetValid(profile, grade)) return false;

  const conflicts = pgGetCrossGradeConflicts(profile, grade);
  if (conflicts.tooHigh.length || conflicts.tooLow.length) return false;

  // Equipment strength requirement check
  const equipSlots = pgEquipSlotsForGrade(profile, grade);
  const reqs = pgGetEquipRequirements(equipSlots);
  if (reqs.strength > 0) {
    const details = pgCalculateStatDetails(profile, grade, "strength");
    if (details && details.totalDisp < reqs.strength) return false;
  }

  return true;
}



// Computes a stat's display components for a synced+locked grade. Mirrors the
// shape of pgCalculateStatDetails so renderers can use either interchangeably,
// but pulls placed points / static / age bonus directly from the synced
// snapshot instead of recomputing them from profile.stats and ages.
// Race and equipment bonuses are applied normally — the user can change
// equipment freely on a synced grade.
function pgCalculateStatDetailsLocked(profile, grade, statKey) {
  const gKey = String(grade);
  const synced = profile.syncedData?.[gKey];
  const snap = synced?.stats?.[statKey];
  if (!snap) return null;

  const rows = pgStatRows(profile);
  const row = rows.find(r => r.key === statKey);
  if (!row) return null;

  const hasRace = profile.raceId != null;
  const raceMult = hasRace
    ? (row.isSkill
        ? pgRaceWeaponSkillMultiplier(profile.raceId, row.statType)
        : pgRaceStatMultiplier(profile.raceId, row.statType))
    : 1;

  const totalBase = snap.placedPoints;
  const raceBonusPoints = totalBase * (raceMult - 1);
  const ageBonusPoints = snap.ageBonusPoints;
  const afterRaceAndAgeExact = totalBase + raceBonusPoints + ageBonusPoints;
  const afterRaceAndAgeDisp = Math.round(afterRaceAndAgeExact);

  const equipSlots = pgEquipSlotsForGrade(profile, grade);
  const equipBonus = pgEquipBonuses(equipSlots, statKey, row.isSkill ? row.skillName : null);

  const staticVal = snap.staticPoints;

  const totalExact = afterRaceAndAgeExact * (1 + equipBonus.percent / 100) + equipBonus.flat + staticVal;
  const totalDisp = Math.round(totalExact);

  const racePct = Math.round((raceMult - 1) * 100);

  return {
    key: statKey,
    label: row.label,
    base: totalBase,
    raceMult,
    racePct,
    raceBonusPoints,
    ageBonusPoints,
    agePct: null,             // synced grades don't expose an age %, only raw points
    afterRaceAndAgeExact,
    afterRaceAndAgeDisp,
    equipBonus,
    staticVal,
    totalExact,
    totalDisp,
    locked: true,
  };
}

/**
 * Calculates all components of a specific stat for a profile at a given grade.
 * Returns a structured object with all intermediate values.
 */
function pgCalculateStatDetails(profile, grade, statKey) {
  const rows = pgStatRows(profile);
  const row = rows.find(r => r.key === statKey);
  if (!row) return null;

  const hasRace = profile.raceId != null;
  const raceMult = hasRace
    ? (row.isSkill
        ? pgRaceWeaponSkillMultiplier(profile.raceId, row.statType)
        : pgRaceStatMultiplier(profile.raceId, row.statType))
    : 1;

  const effectiveStats = pgGetEffectiveStats(profile, grade);
  const totalBase = effectiveStats[statKey] ?? 0;
  
  const raceBonusPoints = totalBase * (raceMult - 1);
  const ageBonusPoints = pgGetAgeBonus(profile, grade, statKey);
  const afterRaceAndAgeExact = totalBase + raceBonusPoints + ageBonusPoints;
  const afterRaceAndAgeDisp = Math.round(afterRaceAndAgeExact);

  const equipSlots = pgEquipSlotsForGrade(profile, grade);
  const equipBonus = pgEquipBonuses(equipSlots, statKey, row.isSkill ? row.skillName : null);
  
  const staticStats = pgGetEffectiveStaticStats(profile, grade);
  const staticVal = staticStats[statKey] ?? 0;

  const totalExact = afterRaceAndAgeExact * (1 + equipBonus.percent / 100) + equipBonus.flat + staticVal;
  const totalDisp = Math.round(totalExact);

  const racePct = Math.round((raceMult - 1) * 100);
  const currentAgeType = pgGetAgeForGrade(profile, grade);
  const ageMult = pgGetAgeMultiplier(profile, currentAgeType, statKey);
  const agePct = Math.round((ageMult - 1) * 100);

  return {
    key: statKey,
    label: row.label,
    base: totalBase,
    raceMult,
    racePct,
    raceBonusPoints,
    ageBonusPoints,
    agePct,
    afterRaceAndAgeExact,
    afterRaceAndAgeDisp,
    equipBonus, // { flat, percent, breakdown }
    staticVal,
    totalExact,
    totalDisp
  };
}

/**
 * Performs a full validation of a profile and returns a report of all issues.
 */
function pgValidateProfile(profile) {
  const report = {
    isValid: true,
    grades: {} // grade -> { isValid: boolean, issues: { budget: boolean, conflicts: [], reqs: [] } }
  };

  const grades = pgGetStatsGrades(profile);
  for (const g of grades) {
    const isSyncLocked = pgIsGradeSyncLocked(profile, g);
    const gradeReport = {
      isValid: true,
      issues: {
        // Synced grades have no notion of budget validity in our planner.
        budget: isSyncLocked ? false : !pgIsGradeBudgetValid(profile, g),
        conflicts: pgGetCrossGradeConflicts(profile, g),
        reqs: []
      }
    };

    // Strength requirement check — synced grades read locked stat values.
    const equipSlots = pgEquipSlotsForGrade(profile, g);
    const reqs = pgGetEquipRequirements(equipSlots);
    if (reqs.strength > 0) {
      const details = isSyncLocked
        ? pgCalculateStatDetailsLocked(profile, g, "strength")
        : pgCalculateStatDetails(profile, g, "strength");
      if (details && details.totalDisp < reqs.strength) {
        gradeReport.issues.reqs.push({ type: "strength", required: reqs.strength, current: details.totalDisp });
      }
    }

    if (gradeReport.issues.budget || 
        gradeReport.issues.conflicts.tooHigh.length > 0 || 
        gradeReport.issues.conflicts.tooLow.length > 0 ||
        gradeReport.issues.reqs.length > 0) {
      gradeReport.isValid = false;
      report.isValid = false;
    }

    report.grades[String(g)] = gradeReport;
  }

  return report;
}
