// Data loading and filtering for Planera Gladiator.
// Depends on: common/items-data.js (itemsLoadFile, itemsLoadEnriched, itemsGetRaceReqs)

const PG_RACE_NAMES = {
  HUMAN:     "Människa",
  ELF:       "Alv",
  DWARF:     "Dvärg",
  ORC:       "Ork",
  TROLL:     "Troll",
  GOBLIN:    "Goblin",
  UNDEAD:    "Odöd",
  SALAMANTH: "Salamanth",
};

// Race name as it appears in item requirement_text (lowercase)
const PG_RACE_REQ_NAMES = {
  1: "människa",
  2: "alv",
  3: "dvärg",
  4: "ork",
  5: "troll",
  6: "goblin",
  7: "odöd",
  11: "salamanth",
};

const PG_RACE_INTERNAL_NAMES = {
  1: "human",
  2: "elf",
  3: "dwarf",
  4: "orc",
  5: "troll",
  6: "goblin",
  7: "undead",
  11: "salamanth",
};

async function pgLoadAllItems() {
  const [weapons, armors, trinkets, consumables, enchants] = await Promise.all([
    itemsLoadEnriched("weapons"),
    itemsLoadEnriched("armors"),
    itemsLoadEnriched("trinkets"),
    itemsLoadEnriched("consumables"),
    itemsLoadEnriched("enchants"),
  ]);
  pgState.allWeapons = weapons || [];
  pgState.allArmors = armors || [];
  pgState.allTrinkets = trinkets || [];
  pgState.allConsumables = consumables || [];
  pgState.allEnchants = enchants || [];
}

async function pgLoadAgeData(raceId) {
  if (pgState.ageData[raceId]) return pgState.ageData[raceId];
  const name = PG_RACE_INTERNAL_NAMES[raceId];
  const data = name ? PG_AGE_DATA[name] : null;
  if (data) {
    pgState.ageData[raceId] = data;
  }
  return data || null;
}

function pgRaceAllowsItem(item, raceId) {
  const raceReqs = itemsGetRaceReqs(item);
  if (!raceReqs.length) return true;
  const reqName = PG_RACE_REQ_NAMES[raceId];
  if (!reqName) return true;
  return raceReqs.some(r => r.toLowerCase() === reqName.toLowerCase());
}

// min_popularity is always positive (requires Positiv), max_popularity is always
// negative (requires Negativ); they are never both set on the same item.
function pgReputationAllowsItem(item, reputation) {
  if (!reputation) return true;
  if (reputation === "neutral")  return item.min_popularity == null && item.max_popularity == null;
  if (reputation === "positive") return item.max_popularity == null;
  if (reputation === "negative") return item.min_popularity == null;
  return true;
}

function pgFilterItem(item, selectedId) {
  if (selectedId != null && item.id === selectedId) return true;
  if (pgState.hideLegendEquip && item.requires_legend) return false;
  if (pgState.hideUnobtainableEquip) {
    const canObtain = (item._merchantName && item._merchantName !== "–") || 
                      (item._profession && item._profession !== "–");
    if (!canObtain) return false;
  }
  return true;
}

function pgGetWeaponhandItems(profile, grade, selectedId) {
  const is2h = profile.weaponHand === "2h";
  if (!window.ExtConfig?.weapon_skills) {
    console.error("[Lanista-Ext] weapon_skills missing from ExtConfig");
  }
  const skill = (window.ExtConfig?.weapon_skills || []).find(s => s.type === profile.weaponSkillType);
  const skillName = skill ? skill.name : null;

  return pgState.allWeapons.filter(item => {
    if (!item.is_weapon || item.is_shield) return false;
    if (item.is_two_handed !== is2h) return false;
    
    // Case-insensitive comparison
    if (skillName && item.type_name?.toLowerCase() !== skillName.toLowerCase()) return false;

    if ((item.required_level || 1) > grade) return false;
    if (item.max_level && item.max_level < grade) return false;
    if (profile.raceId && !pgRaceAllowsItem(item, profile.raceId)) return false;
    if (!pgReputationAllowsItem(item, profile.reputation)) return false;
    if (!pgFilterItem(item, selectedId)) return false;
    return true;
  });
}

function pgGetOffhandItems(profile, grade, selectedId) {
  if (profile.weaponHand === "2h") return [];
  if (profile.weaponHand === "shield") {
    return pgState.allWeapons.filter(item => {
      if (!item.is_shield) return false;
      if ((item.required_level || 1) > grade) return false;
      if (item.max_level && item.max_level < grade) return false;
      if (profile.raceId && !pgRaceAllowsItem(item, profile.raceId)) return false;
      if (!pgReputationAllowsItem(item, profile.reputation)) return false;
      if (!pgFilterItem(item, selectedId)) return false;
      return true;
    });
  }

  // 1h: only weapons with can_dual_wield AND same weapon skill
  if (!window.ExtConfig?.weapon_skills) {
    console.error("[Lanista-Ext] weapon_skills missing from ExtConfig");
  }
  const skill = (window.ExtConfig?.weapon_skills || []).find(s => s.type === profile.weaponSkillType);
  const skillName = skill ? skill.name : null;

  return pgState.allWeapons.filter(item => {
    if (!item.is_weapon || item.is_shield || item.is_two_handed) return false;
    if (!item.can_dual_wield) return false;

    // Case-insensitive comparison
    if (skillName && item.type_name?.toLowerCase() !== skillName.toLowerCase()) return false;

    if ((item.required_level || 1) > grade) return false;
    if (item.max_level && item.max_level < grade) return false;
    if (profile.raceId && !pgRaceAllowsItem(item, profile.raceId)) return false;
    if (!pgReputationAllowsItem(item, profile.reputation)) return false;
    if (!pgFilterItem(item, selectedId)) return false;
    return true;
  });
}

function pgGetRangedItems(profile, grade, selectedId) {
  return pgState.allWeapons.filter(item => {
    if (!item.is_ranged) return false;
    if ((item.required_level || 1) > grade) return false;
    if (item.max_level && item.max_level < grade) return false;
    if (profile.raceId && !pgRaceAllowsItem(item, profile.raceId)) return false;
    if (!pgReputationAllowsItem(item, profile.reputation)) return false;
    if (!pgFilterItem(item, selectedId)) return false;
    return true;
  });
}

function pgGetArmorItems(profile, typeName, grade, selectedId) {
  return pgState.allArmors.filter(item => {
    if (item.type_name !== typeName) return false;
    if ((item.required_level || 1) > grade) return false;
    if (item.max_level && item.max_level < grade) return false;
    if (profile.raceId && !pgRaceAllowsItem(item, profile.raceId)) return false;
    if (!pgReputationAllowsItem(item, profile.reputation)) return false;
    if (!pgFilterItem(item, selectedId)) return false;
    return true;
  });
}

function pgGetTrinketItems(profile, typeName, grade, selectedId) {
  return pgState.allTrinkets.filter(item => {
    if (item.type_name !== typeName) return false;
    if ((item.required_level || 1) > grade) return false;
    if (item.max_level && item.max_level < grade) return false;
    if (profile.raceId && !pgRaceAllowsItem(item, profile.raceId)) return false;
    if (!pgReputationAllowsItem(item, profile.reputation)) return false;
    if (!pgFilterItem(item, selectedId)) return false;
    return true;
  });
}

function pgEnchantAllowedFor(parentItem, enchant, grade, profile, selectedId) {
  if (!parentItem || !enchant) return false;
  if ((enchant.required_level || 1) > grade) return false;
  if (enchant.max_level && enchant.max_level < grade) return false;
  if (profile && !pgReputationAllowsItem(enchant, profile.reputation)) return false;
  if (!pgFilterItem(enchant, selectedId)) return false;

  if (enchant.restrict_to_shields  && !parentItem.is_shield)      return false;
  if (enchant.restrict_to_two_hand && !parentItem.is_two_handed)  return false;
  if (enchant.restrict_to_one_hand && (parentItem.is_two_handed || parentItem.is_shield)) return false;
  if (enchant.restrict_to_distance && !parentItem.is_ranged)      return false;

  // Empty enchant_tags = universal (still subject to restrict_* and required_level)
  const enchantTagIds = (enchant.enchant_tags || []).map(t => t.id);
  if (!enchantTagIds.length) return true;
  const parentTagIds = (parentItem.enchant_tags || []).map(t => t.id);
  return enchantTagIds.some(id => parentTagIds.includes(id));
}

function pgGetEnchantItems(parentItem, profile, grade, selectedId) {
  if (!parentItem) return [];
  return pgState.allEnchants.filter(e => pgEnchantAllowedFor(parentItem, e, grade, profile, selectedId));
}

function pgGetConsumableItems(profile, grade, selectedId) {
  return pgState.allConsumables.filter(item => {
    if ((item.required_level || 1) > grade) return false;
    if (item.max_level && item.max_level < grade) return false;
    if (profile.raceId && !pgRaceAllowsItem(item, profile.raceId)) return false;
    if (!pgReputationAllowsItem(item, profile.reputation)) return false;
    if (!pgFilterItem(item, selectedId)) return false;
    return true;
  });
}


