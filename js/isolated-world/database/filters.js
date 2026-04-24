// Item helper extractors, sorting and filter logic.
// Depends on: state.js (itemsCurrentSubcat, itemsFilterSelection, itemsSelectedIds)

function itemsGetStrengthReq(item) {
  const r = item.requirements?.find(r => r.is_strength);
  return r ? r.requirement_value : 0;
}

function itemsGetWeaponSkillReq(item) {
  const r = item.requirements?.find(r => r.requirementable === "App\\Models\\WeaponSkill");
  return r ? r.requirement_value : 0;
}

function itemsGetBonus(item, name) {
  if (!item.bonuses) return null;
  const b = item.bonuses.find(b => b.bonusable_name?.toLowerCase() === name.toLowerCase());
  if (b) {
    const display = b.bonus_value_display || "";
    const match = display.match(/([+-]?\d+)/);
    if (!match) return null;
    const val = parseInt(match[1], 10);
    const isPct = display.includes("%");
    return {
      v: val,
      p: isPct,
      valueOf() { 
        if (!this.p) return this.v;
        return this.v + (this.v >= 0 ? 1000000 : -1000000); 
      },
      toString() { return (this.v >= 0 ? "+" : "") + this.v + (this.p ? "%" : ""); }
    };
  }
  return null;
}

function itemsGetReq(item, statName) {
  if (!item.requirements) return null;
  const r = item.requirements.find(r => r.requirement_text?.includes(statName));
  return r ? r.requirement_value : null;
}

function itemsGetDurabilityParts(item) {
  const bv = item.durability ?? 0;
  let bvb = 0;
  if (typeof itemsGladiatorVf !== "undefined" && itemsGladiatorVf > 0) {
    const bvs = item.durability_scaling ?? null;
    if (bvs !== null && typeof itemsGetWeaponSkillReq === "function") {
      const vfReq = itemsGetWeaponSkillReq(item);
      const vfDiff = Math.max(0, itemsGladiatorVf - vfReq);
      bvb = vfReq > 0 ? Math.min(bv, Math.floor(bvs * (vfDiff / vfReq) * bv)) : 0;
    }
  }
  return { base: bv, bonus: bvb, total: bv + bvb, hasScaling: item.durability_scaling !== null && item.durability_scaling !== undefined };
}

function itemsGetDurability(item) {
  const parts = itemsGetDurabilityParts(item);
  return parts.hasScaling ? parts.total : (item.durability ?? null);
}

function itemsGetAbsorptionParts(item) {
  const abs = item.absorption ?? 0;
  let absB = 0;
  if (typeof itemsGladiatorStr !== "undefined" && itemsGladiatorStr > 0) {
    const absS = item.absorption_scaling ?? null;
    if (absS !== null && typeof itemsGetStrengthReq === "function") {
      const strReq = Math.max(itemsGetStrengthReq(item), 1);
      const r = itemsGladiatorStr / strReq;
      if (r >= 1) {
        const s = absS * (r - 1);
        const maxBonus = Math.round(abs * 0.2);
        absB = Math.floor(Math.min(maxBonus, s * abs));
      }
    }
  }
  return { base: abs, bonus: absB, total: abs + absB, hasScaling: item.absorption_scaling !== null && item.absorption_scaling !== undefined };
}

function itemsGetAbsorption(item) {
  const parts = itemsGetAbsorptionParts(item);
  return parts.hasScaling ? parts.total : (item.absorption ?? null);
}

function itemsGetRaceReqs(item) {
  if (!item.requirements) return [];
  const races = [];
  for (const r of item.requirements) {
    if (!r.requirementable?.includes("Race")) continue;
    const m = r.requirement_text?.match(/<strong>([^<]+)<\/strong>/);
    if (m) races.push(m[1]);
  }
  return races;
}

function itemsGetAllRaces(items) {
  const races = new Set();
  for (const item of items) {
    for (const race of (item._races || [])) races.add(race);
  }
  return [...races].sort();
}


function itemsGetAllProfessions(items) {
  const professions = new Set();
  for (const item of items) {
    if (item._professionName) professions.add(item._professionName);
  }
  return [...professions].sort((a, b) => a.localeCompare(b, "sv"));
}

function itemsGetAllMerchants(items) {
  const merchants = new Set();
  for (const item of items) {
    if (item._merchantName && item._merchantName !== "–") merchants.add(item._merchantName);
  }
  return [...merchants].sort((a, b) => a.localeCompare(b, "sv"));
}

function itemsGetAllEnchantTags(items) {
  const tags = new Set();
  for (const item of items) {
    for (const tag of (item.enchant_tags || [])) if (tag.name) tags.add(tag.name);
  }
  return [...tags].sort((a, b) => a.localeCompare(b, "sv"));
}

function itemsGetAllItemTypes(items) {
  const types = new Set();
  for (const item of items) {
    if (item.type_name) types.add(item.type_name);
  }
  return [...types].sort((a, b) => {
    const la = ARMOR_TYPE_NAMES[a] || TRINKET_TYPE_NAMES[a] || WEAPON_TYPE_LABELS[a] || a;
    const lb = ARMOR_TYPE_NAMES[b] || TRINKET_TYPE_NAMES[b] || WEAPON_TYPE_LABELS[b] || b;
    return la.localeCompare(lb, "sv");
  });
}

function itemsFormatPrice(item) {
  if (item._merchantPrice === null) return "–";
  return `${item._merchantPrice} ${item._merchantCurrency}`;
}

var itemsSortGetters = {
  "_merchantPrice":     item => item._merchantPrice ?? -Infinity,
  "_races":             item => [...(item._races || [])].sort((a, b) => a.localeCompare(b, "sv")).join(", ").toLowerCase(),
  "_enchant_tags":      item => (item.enchant_tags || []).map(t => t.name).sort().join(",").toLowerCase(),
  "_damage_range":      item => ((item.base_damage_min ?? 0) + (item.base_damage_max ?? 0)) * 10000 + (item.base_damage_max ?? 0),
};

function itemsDefaultCmp(a, b) {
  const la = a.required_level ?? 0, lb = b.required_level ?? 0;
  if (la !== lb) return la - lb;
  const aCur = a._merchantCurrency, bCur = b._merchantCurrency;
  if (aCur !== bCur) {
    if (aCur === "gp") return 1;
    if (bCur === "gp") return -1;
  }
  return (a._merchantPrice ?? Infinity) - (b._merchantPrice ?? Infinity);
}

function itemsSort(items) {
  if (itemsSortCol && itemsSortGetters[itemsSortCol]) {
    const getter = itemsSortGetters[itemsSortCol];
    return [...items].sort((a, b) => {
      const va = getter(a), vb = getter(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb, "sv") : (va - vb);
      if (cmp !== 0) return itemsSortDir === "asc" ? cmp : -cmp;
      return itemsSortDir === "asc" ? itemsDefaultCmp(a, b) : itemsDefaultCmp(b, a);
    });
  }
  return [...items].sort(itemsDefaultCmp);
}

// Applies per-column filters from itemsColFilters. Called after itemsApplyFilters.
// References ITEMS_ALL_COLUMNS from columns.js — safe because this is only called at runtime.
function itemsApplyColFilters(items) {
  if (!Object.keys(itemsColFilters).length) return items;
  return items.filter(item => {
    for (const [key, f] of Object.entries(itemsColFilters)) {
      const col = ITEMS_ALL_COLUMNS[key];
      if (!col || !f) continue;
      const val = col.getValue(item);
      if (key === "_damage_range") {
        const minVal = item.base_damage_min ?? 0;
        const maxVal = item.base_damage_max ?? 0;
        const avgVal = (minVal + maxVal) / 2;
        if (f.avgMin !== "" && f.avgMin != null && avgVal < Number(f.avgMin)) return false;
        if (f.avgMax !== "" && f.avgMax != null && avgVal > Number(f.avgMax)) return false;
        if (f.botMin !== "" && f.botMin != null && minVal < Number(f.botMin)) return false;
        if (f.botMax !== "" && f.botMax != null && minVal > Number(f.botMax)) return false;
        if (f.topMin !== "" && f.topMin != null && maxVal < Number(f.topMin)) return false;
        if (f.topMax !== "" && f.topMax != null && maxVal > Number(f.topMax)) return false;
      } else if (col.type === "number") {
        // max_level: missing value means no upper cap, treat as Infinity so the item
        // always passes a min-filter ("show items usable up to at least grade X").
        const raw = (val && typeof val === "object" && "v" in val) ? val.v : val;
        const n = (raw == null && key === "max_level") ? Infinity : (raw == null ? 0 : Number(raw));
        if (f.min !== "" && f.min != null && n < Number(f.min)) return false;
        if (f.max !== "" && f.max != null && n > Number(f.max)) return false;
      } else if (col.type === "string") {
        if (f.text && !String(val ?? "").toLowerCase().includes(f.text.toLowerCase())) return false;
      } else if (col.type === "bool") {
        if (f.boolVal === true  && !val) return false;
        if (f.boolVal === false &&  val) return false;
      } else if (col.type === "race_select") {
        if (!f.races?.length) continue;
        const raceArr = item._races || [];
        const passes = f.races.some(r => r === "__none__" ? raceArr.length === 0 : raceArr.includes(r));
        if (!passes) return false;
      } else if (col.type === "merchant_select") {
        if (!f.merchants?.length) continue;
        const name = item._merchantName;
        const passes = f.merchants.some(m => m === "__none__" ? name === "–" : name === m);
        if (!passes) return false;
      } else if (col.type === "class_select") {
        if (!f.classes?.length) continue;
        const val = col.getValue(item);
        if (!f.classes.includes(val)) return false;
      } else if (col.type === "profession_select") {
        if (!f.professions?.length) continue;
        if (f.professions.some(p => p === "__none__")) {
          if (!item._professionName) continue;
        }
        const profName = item._professionName;
        const profLevel = item._professionLevel;
        const passes = f.professions.some(p => {
          if (p === "__none__") return !profName;
          const [name, lvl] = p.split("\t");
          return profName === name && (lvl === "*" || profLevel === Number(lvl));
        });
        if (!passes) return false;
      } else if (col.type === "tag_select") {
        if (!f.enchant_tags?.length) continue;
        const tags = (item.enchant_tags || []).map(t => t.name);
        const passes = f.enchant_tags.some(t => {
          if (t === "__none__") return tags.length === 0;
          return tags.includes(t);
        });
        if (!passes) return false;
      } else if (col.type === "item_type_select") {
        if (!f.item_types?.length) continue;
        if (!f.item_types.includes(item.type_name)) return false;
      }
    }
    return true;
  });
}

function itemsApplyFilters(items, view) {
  return items.filter(item => {
    if (itemsFilterSelection === "selected"   && !itemsSelectedIds.has(item.id)) return false;
    if (itemsFilterSelection === "unselected" &&  itemsSelectedIds.has(item.id)) return false;
    if (itemsCurrentSubcat !== null) {
      if (view.subcatMode === "weapon_types") {
        if (item.type_name !== itemsCurrentSubcat) return false;
      } else if (view.subcatMode === "static") {
        const subcat = view.subcats.find(s => s.label === itemsCurrentSubcat);
        if (subcat && !subcat.filter(item)) return false;
      }
    }
    return true;
  });
}
