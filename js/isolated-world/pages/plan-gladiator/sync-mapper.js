// Maps a /api/users/me avatar object into the structures used by the planner.
//
// The non-trivial part is reverse-engineering the age bonus contribution per
// stat. The API gives us:
//   - value:         raw placed points (cumulative at current grade)
//   - decimal_value: total after race + age + equipment, excluding static
//   - static_value:  the additional static points
// but never the age contribution by itself. We isolate it by undoing every
// other modifier in the same order pgCalculateStatDetails applies them.
//
// Forward formula (must mirror stats.js → pgCalculateStatDetails):
//   total = (value × raceMult × ageMult) × (1 + equipPercent/100) + equipFlat
//   (equipFlat is added AFTER the percent multiplier, not before — the
//    planner's pgCalculateStatDetails does it that way and the game agrees.)
// Reverse:
//   afterRaceAndAge = (decimal_value - equipFlat) / (1 + equipPercent/100)
//                  == value × raceMult × ageMult
//   raceContrib     = value × raceMult
//   ageBonus        = afterRaceAndAge - raceContrib
//
// Depends on: state.js (pgState.allWeapons/Armors/Trinkets/Consumables/Enchants),
//             data.js (PG_RACE_INTERNAL_NAMES, PG_RACE_NAMES),
//             ages.js (PG_AGE_DATA), stats.js (PG_STAT_TYPES, pgRaceStatMultiplier,
//             pgRaceWeaponSkillMultiplier, pgEquipBonuses, pgWeaponSkillName, pgDefaultEquipSlots).

// Map equipped API items to our slot keys. Returns slot object compatible with
// pgDefaultEquipSlots (item ids or null).
function pgSyncMapEquipment(apiAvatar) {
  const slots = pgDefaultEquipSlots();
  if (!apiAvatar?.items) return slots;

  const equipped = apiAvatar.items.filter(i => i.equipped);

  const mainHand = equipped.find(i => i.main_hand);
  const offHand  = equipped.find(i => i.off_hand);
  const ranged   = equipped.find(i => i.ranged);

  if (mainHand) slots.weapon  = mainHand.id;
  if (offHand)  slots.offhand = offHand.id;
  if (ranged)   slots.ranged  = ranged.id;

  // Enchant array order maps to enchant slot 1, 2.
  const mapEnchants = (item, slot1, slot2) => {
    if (!item || !Array.isArray(item.enchants)) return;
    if (item.enchants[0]?.enchant?.id != null && slot1) slots[slot1] = item.enchants[0].enchant.id;
    if (item.enchants[1]?.enchant?.id != null && slot2) slots[slot2] = item.enchants[1].enchant.id;
  };
  mapEnchants(mainHand, "enchant_weapon_1",  "enchant_weapon_2");
  mapEnchants(offHand,  "enchant_offhand_1", "enchant_offhand_2");
  mapEnchants(ranged,   "enchant_ranged_1",  null);

  // Armor + trinket slots are matched by type_name.
  const SLOT_TYPE_NAMES = new Set([
    "head", "shoulders", "chest", "hands", "legs", "feet",
    "back", "neck", "finger", "amulet", "bracelet", "trinket",
  ]);
  for (const it of equipped) {
    if (SLOT_TYPE_NAMES.has(it.type_name)) {
      slots[it.type_name] = it.id;
    }
  }

  // Equipped consumables → potion1/2/3 in the order they appear.
  const potions = equipped.filter(i => i.is_consumable);
  for (let i = 0; i < Math.min(potions.length, 3); i++) {
    slots["potion" + (i + 1)] = potions[i].id;
  }

  return slots;
}

function pgSyncDeriveWeaponHand(apiAvatar) {
  if (!apiAvatar?.items) return null;
  const equipped = apiAvatar.items.filter(i => i.equipped);
  const mainHand = equipped.find(i => i.main_hand);
  const offHand  = equipped.find(i => i.off_hand);
  if (mainHand?.is_two_handed) return "2h";
  if (offHand?.is_shield)      return "shield";
  return "1h";
}

// Derive the active weapon skill type from the equipped main-hand weapon.
// type_name on the weapon (e.g. "mace") matches a weapon_skills[].name
// (case-insensitive).
function pgSyncDeriveWeaponSkillType(apiAvatar) {
  if (!apiAvatar?.items) return null;
  const mainHand = apiAvatar.items.find(i => i.equipped && i.main_hand);
  if (!mainHand?.type_name) return null;
  const ws = (apiAvatar.weapon_skills || [])
    .find(s => s.name?.toLowerCase() === mainHand.type_name.toLowerCase());
  return ws ? ws.type : null;
}

// Map age_display (e.g. "gammal") to age type id by looking up the race's age
// data. Falls back to age (days) → highest matching age range.
function pgSyncDeriveAgeType(apiAvatar) {
  if (!apiAvatar?.race?.id) return 0;
  const internal = PG_RACE_INTERNAL_NAMES[apiAvatar.race.id];
  const ageData = internal ? PG_AGE_DATA[internal] : null;
  if (!ageData) return 0;

  if (apiAvatar.age_display) {
    const labelLower = apiAvatar.age_display.toLowerCase();
    const match = ageData.ages.find(a => a.label.toLowerCase() === labelLower);
    if (match) return match.type;
  }

  // Fallback by days: pick the highest age type the gladiator qualifies for.
  const sorted = [...ageData.ages].sort((a, b) => b.age_in_days - a.age_in_days);
  const byDays = sorted.find(a => apiAvatar.age >= a.age_in_days);
  return byDays ? byDays.type : 0;
}

function pgSyncDeriveReputation(apiAvatar) {
  const t = apiAvatar?.popularity_type_name?.toUpperCase();
  if (t === "POSITIVE") return "positive";
  if (t === "NEGATIVE") return "negative";
  return "neutral";
}

// Reverse the forward stat formula to isolate the age bonus points. See file
// header for the derivation. Negative results are valid (age can be a penalty).
// Rounded to 3 decimals — the API decimal_value never has more precision than
// that and rounding cleans up floating-point noise (e.g. -1.13e-13 → 0).
function pgSyncReverseAgeBonus(apiValue, apiDecimal, raceMult, equipFlat, equipPercent) {
  if (apiValue == null || apiDecimal == null) return 0;
  const afterRaceAndAge = (apiDecimal - equipFlat) / (1 + (equipPercent / 100));
  const raceContrib = apiValue * raceMult;
  return Math.round((afterRaceAndAge - raceContrib) * 1000) / 1000;
}

// Build a per-stat snapshot. Returns an object keyed by our internal stat
// names (health, strength, …, weaponSkill, shield).
function pgSyncMapStats(apiAvatar, raceId, weaponSkillType, weaponHand, equipSlots, ageType) {
  const out = {};
  const weaponSkillName = weaponSkillType != null ? pgWeaponSkillName(weaponSkillType) : null;
  // A "ung" gladiator (ageType 0) is guaranteed to have zero age bonus, so
  // skip the reverse-engineering — the API's rounded decimal_value would
  // otherwise produce small spurious bonus values (~±0.1 points).
  const skipAgeBonus = ageType === 0;

  const mapStat = (apiStat, statKey, raceMult) => {
    if (!apiStat) return;
    const equipBonus = pgEquipBonuses(equipSlots, statKey, weaponSkillName);
    const ageBonus = skipAgeBonus
      ? 0
      : pgSyncReverseAgeBonus(
          apiStat.value,
          apiStat.decimal_value,
          raceMult,
          equipBonus.flat,
          equipBonus.percent
        );
    out[statKey] = {
      placedPoints:   apiStat.value ?? 0,
      staticPoints:   apiStat.static_value ?? 0,
      ageBonusPoints: ageBonus,
      apiDecimal:     apiStat.decimal_value,
    };
  };

  // Five plain stats — keys come from PG_STAT_TYPES.
  for (const [statKey, statType] of Object.entries(PG_STAT_TYPES)) {
    const apiStat = (apiAvatar.stats || []).find(s => s.type === statType);
    const raceMult = pgRaceStatMultiplier(raceId, statType);
    mapStat(apiStat, statKey, raceMult);
  }

  // Active weapon skill
  if (weaponSkillType != null) {
    const apiSkill = (apiAvatar.weapon_skills || []).find(s => s.type === weaponSkillType);
    const raceMult = pgRaceWeaponSkillMultiplier(raceId, weaponSkillType);
    mapStat(apiSkill, "weaponSkill", raceMult);
  }

  // Shield skill (only when a shield is equipped)
  if (weaponHand === "shield") {
    const apiShield = (apiAvatar.weapon_skills || []).find(s => s.type === 6);
    const raceMult = pgRaceWeaponSkillMultiplier(raceId, 6);
    mapStat(apiShield, "shield", raceMult);
  }

  return out;
}

// Top-level mapper — turns an API avatar into a snapshot the sync flow can
// apply. Returns null when the avatar can't be interpreted (missing race etc.).
// Caller must ensure pgState.allWeapons/Armors/… are loaded so item-bonus
// lookups inside pgEquipBonuses succeed.
function pgSyncMapAvatar(apiAvatar) {
  if (!apiAvatar || !apiAvatar.race?.id) return null;

  const raceId = apiAvatar.race.id;
  const equipment = pgSyncMapEquipment(apiAvatar);
  const weaponHand = pgSyncDeriveWeaponHand(apiAvatar);
  const weaponSkillType = pgSyncDeriveWeaponSkillType(apiAvatar);
  const reputation = pgSyncDeriveReputation(apiAvatar);
  const ageType = pgSyncDeriveAgeType(apiAvatar);
  const stats = pgSyncMapStats(apiAvatar, raceId, weaponSkillType, weaponHand, equipment, ageType);

  return {
    gladiator: {
      id:               apiAvatar.id,
      name:             apiAvatar.name,
      raceId,
      raceName:         PG_RACE_NAMES[apiAvatar.race.name] || apiAvatar.race.name,
      grade:            apiAvatar.current_level,
      ageType,
      ageDays:          apiAvatar.age,
      ageDisplay:       apiAvatar.age_display,
      weaponHand,
      weaponSkillType,
      weaponSkillName:  weaponSkillType != null ? pgWeaponSkillName(weaponSkillType) : null,
      reputation,
    },
    equipment,
    stats,
  };
}
