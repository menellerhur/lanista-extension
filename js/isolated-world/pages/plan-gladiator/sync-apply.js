// Writes a mapped sync snapshot into a profile. Mutates the profile in place.
//
// Behaviour:
//   - Basic settings: a new (empty) profile gets all of them; an existing
//     profile only gets fields that are still null (silent fill).
//   - Equipment: when applyEquipment, profile.equipment[grade] is replaced
//     wholesale. Equipment lives in the regular structure — the planner makes
//     no distinction between synced and manually-chosen equipment.
//   - Properties: when applyProperties, the synced grade becomes a "total"
//     baseline. Both the regular fallback structures (stats, gradeModes,
//     staticStats, ages) and the master sync structure (syncedData, syncLocked)
//     are written so that toggling lock off later still produces sensible data.

function pgSyncApply(profile, mapped, opts) {
  if (!profile || !mapped) return;
  const g = mapped.gladiator;
  const grade = g.grade;
  const gKey = String(grade);

  // Basic settings are always synchronized.
  profile.raceId          = g.raceId;
  profile.weaponHand      = g.weaponHand;
  profile.weaponSkillType = g.weaponSkillType;
  profile.reputation      = g.reputation;

  // ── Equipment ─────────────────────────────────────────────────────────────
  if (opts.applyEquipment) {
    profile.equipment ||= {};
    profile.equipment[gKey] = { ...mapped.equipment };
  }

  // ── Properties ────────────────────────────────────────────────────────────
  if (opts.applyProperties) {
    profile.stats        ||= {};
    profile.gradeModes   ||= {};
    profile.staticStats  ||= {};
    profile.ages         ||= {};
    profile.syncedData   ||= {};
    profile.syncLocked   ||= {};

    // Fallback (regular) data — values the user gets back when they unlock.
    const placed = {};
    let hasAnyStatic = false;
    const staticVals = {};
    for (const [statKey, snap] of Object.entries(mapped.stats)) {
      placed[statKey] = snap.placedPoints;
      if (snap.staticPoints !== 0) hasAnyStatic = true;
      staticVals[statKey] = snap.staticPoints;
    }
    profile.stats[gKey]      = placed;
    profile.gradeModes[gKey] = "total";
    profile.ages[gKey]       = g.ageType;

    if (hasAnyStatic) {
      profile.staticStats[gKey] = staticVals;
    } else {
      // Drop any stale static row so the static-mode toggle reflects "off".
      delete profile.staticStats[gKey];
    }

    // Master sync data — locked, isolated copy that user edits cannot mutate.
    profile.syncedData[gKey] = {
      syncedAt:       new Date().toISOString(),
      gladiatorId:    g.id,
      gladiatorName:  g.name,
      ageType:        g.ageType,
      ageDays:        g.ageDays,
      ageDisplay:     g.ageDisplay,
      stats:          {}, // filled below
    };
    for (const [statKey, snap] of Object.entries(mapped.stats)) {
      profile.syncedData[gKey].stats[statKey] = {
        placedPoints:   snap.placedPoints,
        staticPoints:   snap.staticPoints,
        ageBonusPoints: snap.ageBonusPoints,
        apiDecimal:     snap.apiDecimal,
      };
    }
    profile.syncLocked[gKey] = true;
  }
}
