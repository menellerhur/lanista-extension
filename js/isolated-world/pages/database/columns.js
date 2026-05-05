// Column catalog: all addable columns and base column sets per table type.
// Depends on: state.js (itemsCustomCols, itemsColFilters, itemsWeaponSubview, itemsCurrentViewKey, itemsCustomViews),
//             filters.js (itemsSortGetters, itemsGetStrengthReq, itemsGetWeaponSkillReq, itemsFormatPrice),
//             tables.js (itemsTh)

// Returns the current table-type key used to look up standard base columns.
function itemsCurrentBaseKey() {
  const view = ITEM_VIEWS.find(v => v.key === itemsCurrentViewKey);
  if (!view) return "generic";
  if (view.columns === "weapon") {
    if (itemsWeaponSubview && itemsWeaponSubview.startsWith("custom-")) {
      return itemsWeaponSubview;
    }
    return "weapon_" + itemsWeaponSubview;
  }
  if (itemsCurrentViewKey === "consumable" && itemsCurrentSubcat === "Livestridsmixturer") {
    return "consumable_live";
  }
  return view.columns || "generic";
}

// Returns the set of base column keys for the current view (including custom views).
function itemsGetCurrentBaseCols() {
  if (itemsWeaponSubview && itemsWeaponSubview.startsWith("custom-")) {
    const cv = itemsCustomViews.find(v => v.id === itemsWeaponSubview);
    return cv?.baseCols || [];
  }
  return ITEMS_BASE_COLS[itemsCurrentBaseKey()] || [];
}

// Which column keys are shown by default per table type (excludes the always-first "name").
// NOTE: These base arrays control BOTH the column picker UI and the actual table rendering structure.
var ITEMS_BASE_COLS = {
  weapon_standard: ["type_name", "required_level", "is_two_handed", "_damage_range", "durability", "weight", "req_strength", "req_vf", "_merchantName", "_merchantPrice"],
  weapon_parera:   ["required_level", "can_dual_wield", "_damage_range", "durability", "durability_scaling", "_actions_display", "weight", "req_strength", "req_vf"],
  weapon_skada:    ["required_level", "is_two_handed", "_damage_range", "damage_potential", "crit_rate", "max_crit_rate", "_actions_display", "weight", "req_strength", "req_vf"],
  shield:          ["required_level", "absorption", "durability", "max_blocks_per_round", "weight", "req_strength", "req_vf", "_profession", "_merchantName", "_merchantPrice"],
  armor:           ["type_name", "required_level", "base_block", "weight", "req_strength", "_profession", "_merchantName", "_merchantPrice"],
  trinket:         ["required_level", "type_name", "_races", "_profession", "_merchantName", "_merchantPrice"],
  enchant:         ["required_level", "_enchant_tags", "_profession", "_merchantName", "_merchantPrice"],
  material:        ["_loots", "_profession", "_merchantName", "_merchantPrice"],
  generic:         ["required_level", "_races", "_profession", "_merchantName", "_merchantPrice"],
  consumable_live: ["required_level", "only_monster_ladder", "_races", "_profession", "_merchantName", "_merchantPrice"],
};

// Returns true if a column has an active filter.
function itemsIsColFilterActive(key) {
  const f = itemsColFilters[key];
  if (!f) return false;
  if (f.min !== "" && f.min != null) return true;
  if (f.max !== "" && f.max != null) return true;
  if (f.text)                        return true;
  if (f.boolVal != null)             return true;
  if (f.races?.length)               return true;
  if (f.merchants?.length)           return true;
  if (f.professions?.length)         return true;
  if (f.classes?.length)             return true;
  if (f.item_types?.length)          return true;
  if (f.enchant_tags?.length)        return true;
  return false;
}

// Returns the list of column keys (standard + custom) that should be rendered for the current view.
function itemsGetVisibleColKeys() {
  const base = itemsGetCurrentBaseCols();
  let activeBase = base.filter(k => !itemsHiddenCols.includes(k));
  
  // Special case: hide 'type_name' (Typ) if we are in a subcategory where all items have the same type
  if (itemsCurrentSubcat !== null) {
     activeBase = activeBase.filter(k => k !== "type_name");
  }

  // Find columns that have active filters but are NOT in base or custom
  const filteredKeys = Object.keys(itemsColFilters).filter(k => itemsIsColFilterActive(k));
  
  const defaultMutableKeys = [...new Set([...activeBase, ...itemsCustomCols, ...filteredKeys])].filter(k => k !== "name");

  if (itemsColOrder && itemsColOrder.length > 0) {
    const ordered = itemsColOrder.filter(k => defaultMutableKeys.includes(k));
    const missing = defaultMutableKeys.filter(k => !ordered.includes(k));
    return ["name", ...ordered, ...missing];
  }

  return ["name", ...defaultMutableKeys];
}

// Renders the <th> cells for all visible columns (passed via keys).
function itemsRenderColHeaders(keys) {
  return keys.map(key => {
    const col = ITEMS_ALL_COLUMNS[key];
    if (!col) return "";
    if (col.renderHeader) return col.renderHeader(key);
    return itemsTh(col.shortLabel || col.label, key, col.align || "right", col.tooltip);
  }).join("");
}

// Renders the <td> cells for all visible columns (passed via keys) for one item row.
function itemsRenderColCells(item, keys) {
  return keys.map(key => {
    const col = ITEMS_ALL_COLUMNS[key];
    if (!col) return "";
    if (col.renderCell) return col.renderCell(item, key);

    const display = (() => {
      const rawV = col.getValue(item);
      const v = col.format ? col.format(item, rawV) : rawV;
      return v === null || v === undefined ? "–" : String(v);
    })();
    let cls = "py-1 px-2 text-xs";
    if (col.align === "left")        cls += " whitespace-nowrap";
    else if (col.align === "center") cls += " text-center whitespace-nowrap";
    else                             cls += " text-right tabular-nums whitespace-nowrap";
    return `<td class="${cls}">${display}</td>`;
  }).join("");
}

function itemsRenderDurabilityHeader(key) {
  const filterActive = typeof itemsIsColFilterActive === "function" && itemsIsColFilterActive(key);
  if (itemsGladiatorVf > 0) {
    const activeCls   = filterActive ? " ext-th--filter-active" : "";
    const sepCls      = `ext-bv-sep-hd text-center py-1 text-xs text-muted-foreground cursor-pointer select-none${activeCls}`;
    const bonusCls    = `text-center py-1 px-1 text-xs text-muted-foreground cursor-pointer select-none${activeCls}`;
    const menuDots    = icon("menu-dots", { width: 4, height: 10, style: "pointer-events:none" });
    const menuIconCls = "ext-col-menu-icon" + (filterActive ? " ext-col-menu-icon--active" : "");
    const menuBtn     = `<span class="${menuIconCls}" data-col-menu="durability">${menuDots}</span>`;
    const btnTh       = `<th class="py-1 pr-1 text-xs text-muted-foreground cursor-pointer select-none ext-bv-group-th ext-bv-btn-th${activeCls}" data-sort-col="durability"><div class="ext-th-inner"><div class="ext-th-actions">${menuBtn}</div></div></th>`;
    return itemsTh("BV", "durability", "right", "Brytvärde", { noMenu: true, filterActive }) +
           `<th class="${sepCls} ext-bv-group-th" data-sort-col="durability"><div class="ext-th-inner" style="justify-content:center">(</div></th>` +
           `<th colspan="3" class="${bonusCls} ext-bv-group-th" data-sort-col="durability"><div class="ext-th-inner" style="justify-content:center">Bonus</div></th>` +
           `<th class="${sepCls} ext-bv-group-th" data-sort-col="durability"><div class="ext-th-inner" style="justify-content:center">)</div></th>` +
           btnTh;
  }
  return itemsTh("BV", "durability", "right", "Brytvärde");
}

function itemsRenderDurabilityCell(item, key) {
  const showVfCols = itemsGladiatorVf > 0;
  if (!showVfCols) {
    return `<td class="py-1 px-2 text-xs text-right tabular-nums whitespace-nowrap">${item.durability || "–"}</td>`;
  }
  const p = itemsGetDurabilityParts(item);
  const itemsTd    = (v) => `<td class="py-1 px-2 text-xs text-right tabular-nums whitespace-nowrap">${v}</td>`;
  const innerNumTd = (v) => `<td class="ext-bv-num py-1 text-xs text-center tabular-nums whitespace-nowrap">${v}</td>`;
  const sepTd      = (v) => `<td class="ext-bv-sep py-1 text-xs text-center text-muted-foreground whitespace-nowrap">${v}</td>`;
  if (p.hasScaling) {
    return `${itemsTd(p.total)}${sepTd("(")}${innerNumTd(p.base || "–")}${sepTd("+")}${innerNumTd(p.bonus)}${sepTd(")")}<td></td>`;
  } else {
    return `${itemsTd("–")}<td></td><td></td><td></td><td></td><td></td><td></td>`;
  }
}

function itemsRenderAbsorptionHeader(key) {
  const filterActive = typeof itemsIsColFilterActive === "function" && itemsIsColFilterActive(key);
  if (itemsGladiatorStr > 0) {
    const activeCls   = filterActive ? " ext-th--filter-active" : "";
    const sepCls      = `ext-bv-sep-hd text-center py-1 text-xs text-muted-foreground cursor-pointer select-none${activeCls}`;
    const bonusCls    = `text-center py-1 px-1 text-xs text-muted-foreground cursor-pointer select-none${activeCls}`;
    const menuDots    = icon("menu-dots", { width: 4, height: 10, style: "pointer-events:none" });
    const menuIconCls = "ext-col-menu-icon" + (filterActive ? " ext-col-menu-icon--active" : "");
    const menuBtn     = `<span class="${menuIconCls}" data-col-menu="absorption">${menuDots}</span>`;
    const btnTh       = `<th class="py-1 pr-1 text-xs text-muted-foreground cursor-pointer select-none ext-bv-group-th ext-bv-btn-th${activeCls}" data-sort-col="absorption"><div class="ext-th-inner"><div class="ext-th-actions">${menuBtn}</div></div></th>`;
    return itemsTh("ABS", "absorption", "right", "Absorbering", { noMenu: true, filterActive }) +
           `<th class="${sepCls} ext-bv-group-th" data-sort-col="absorption"><div class="ext-th-inner" style="justify-content:center">(</div></th>` +
           `<th colspan="3" class="${bonusCls} ext-bv-group-th" data-sort-col="absorption"><div class="ext-th-inner" style="justify-content:center">Bonus</div></th>` +
           `<th class="${sepCls} ext-bv-group-th" data-sort-col="absorption"><div class="ext-th-inner" style="justify-content:center">)</div></th>` +
           btnTh;
  }
  return itemsTh("ABS", "absorption", "right", "Absorbering");
}

function itemsRenderAbsorptionCell(item, key) {
  const showStrCols = itemsGladiatorStr > 0;
  if (!showStrCols) {
    return `<td class="py-1 px-2 text-xs text-right tabular-nums whitespace-nowrap">${item.absorption || "–"}</td>`;
  }
  const p = itemsGetAbsorptionParts(item);
  const itemsTd    = (v) => `<td class="py-1 px-2 text-xs text-right tabular-nums whitespace-nowrap">${v}</td>`;
  const innerNumTd = (v) => `<td class="ext-bv-num py-1 text-xs text-center tabular-nums whitespace-nowrap">${v}</td>`;
  const sepTd      = (v) => `<td class="ext-bv-sep py-1 text-xs text-center text-muted-foreground whitespace-nowrap">${v}</td>`;
  if (p.hasScaling) {
    return `${itemsTd(p.total)}${sepTd("(")}${innerNumTd(p.base || "–")}${sepTd("+")}${innerNumTd(p.bonus)}${sepTd(")")}<td></td>`;
  } else {
    return `${itemsTd("–")}<td></td><td></td><td></td><td></td><td></td><td></td>`;
  }
}

// Full catalog of all columns that can be added or filtered.
var ITEMS_ALL_COLUMNS = {
  // Name — always-first column, filter-only (not in column picker)
  "name":                    { label: "Namn",                                                            tooltip: null,                               align: "left",   type: "string",            getValue: i => i.name ?? "", renderCell: (item, key) => `<td class="py-1 px-2 text-xs font-medium" data-item-tooltip-id="${item.id}"><div class="truncate min-w-[240px]">${item.name}</div></td>` },
  // Numeric — direct item fields
  "required_level":          { label: "Grad",                                                            tooltip: null,                               align: "right",  type: "number",            getValue: i => i.required_level ?? null },
  "max_level":               { label: "Max grad",                                                        tooltip: null,                               align: "right",  type: "number",            getValue: i => i.max_level ?? null },
  "weight":                  { label: "Vikt",                                                            tooltip: null,                               align: "right",  type: "number",            getValue: i => i.weight ?? null },
  "sell_value":              { label: "Säljvärde",                                                       tooltip: null,                               align: "right",  type: "number",            getValue: i => i.sell_value ?? null },
  "min_popularity":          { label: "Min rykte",                                                       tooltip: null,                               align: "right",  type: "number",            getValue: i => i.min_popularity ?? null },
  "max_popularity":          { label: "Max rykte",                                                       tooltip: null,                               align: "right",  type: "number",            getValue: i => i.max_popularity ?? null },
  "required_ranking_points": { label: "Rankningspoäng",                   shortLabel: "RP",              tooltip: "Rankningspoäng som krävs",         align: "right",  type: "number",            getValue: i => i.required_ranking_points ?? null },
  "crit_rate":               { label: "Perfekt Träff (%)",                shortLabel: "PT",              tooltip: "Chans till perfekt träff",         align: "right",  type: "number",            getValue: i => i.crit_rate ?? null,             format: (i, v) => v != null ? v + "%" : "–" },
  "max_crit_rate":           { label: "Perfekt Träff potential (%)",      shortLabel: "PTP",             tooltip: "Perfekt Träff potential",          align: "right",  type: "number",            getValue: i => i.max_crit_rate ?? null,         format: (i, v) => v != null ? (v >= 0 ? "+" : "") + v + "%" : "–" },
  "crit_damage":             { label: "Perfekt Träff skada (%)",          shortLabel: "PT skada",        tooltip: "Perfekt Träff skada",              align: "right",  type: "number",            getValue: i => i.crit_damage_max ?? null,       format: (i, v) => v != null ? `${i.crit_damage_min}% – ${v}%` : "–" },
  "damage_roof":             { label: "Skadetak",                                                        tooltip: "Skadetak",                         align: "right",  type: "number",            getValue: i => i.damage_roof ?? null },
  "durability":              { label: "Brytvärde",                        shortLabel: "BV",              tooltip: "Brytvärde",                        align: "right",  type: "number",            getValue: i => itemsGetDurability(i),           renderHeader: itemsRenderDurabilityHeader, renderCell: itemsRenderDurabilityCell },
  "durability_scaling":      { label: "Brytvärde-skalning",               shortLabel: "BV S",            tooltip: "Brytvärde-skalning",               align: "right",  type: "number",            getValue: i => i.durability_scaling ?? null },
  "absorption":              { label: "Absorbering",                      shortLabel: "ABS",             tooltip: "Absorbering",                      align: "right",  type: "number",            getValue: i => itemsGetAbsorption(i),           renderHeader: itemsRenderAbsorptionHeader, renderCell: itemsRenderAbsorptionCell },
  "absorption_scaling":      { label: "Absorberings-skalning",            shortLabel: "ABS S",           tooltip: "Absorberings-skalning",            align: "right",  type: "number",            getValue: i => i.absorption_scaling ?? null },
  "base_block":              { label: "Skydd",                                                           tooltip: null,                               align: "right",  type: "number",            getValue: i => i.base_block ?? null },
  "base_damage_min":         { label: "Skada (min)",                                                     tooltip: null,                               align: "right",  type: "number",            getValue: i => i.base_damage_min ?? null },
  "base_damage_max":         { label: "Skada (max)",                                                     tooltip: null,                               align: "right",  type: "number",            getValue: i => i.base_damage_max ?? null },
  "damage_potential":        { label: "Skadepotential",                   shortLabel: "SP",              tooltip: "Skadepotential",                   align: "right",  type: "number",            getValue: i => i.damage_potential ?? null },
  "max_blocks_per_round":    { label: "Max antal blockeringar per runda", shortLabel: "Block",           tooltip: "Max antal blockeringar per runda", align: "right",  type: "number",            getValue: i => i.max_blocks_per_round ?? null },
  "actions":                 { label: "Handlingar",                       shortLabel: "Handl.",          tooltip: "Handlingar",                       align: "right",  type: "number",            getValue: i => i.actions ?? null },
  "defensive_actions":       { label: "Handlingar (defensiva)",           shortLabel: "Def. handl.",     tooltip: "Defensiva handlingar",             align: "right",  type: "number",            getValue: i => i.defensive_actions ?? null },
  "stack_multiplier":        { label: "Momentumskada (%)",                shortLabel: "Moment. skada",   tooltip: "Extra skada vid momentum-attack",  align: "right",  type: "number",            getValue: i => i.stack_multiplier ?? null,      format: (i, v) => v != null ? v + "%" : "–" },
  "stack_chance":            { label: "Momentumchans (%)",                shortLabel: "Moment. chans",   tooltip: "Chans att behålla momentum",       align: "right",  type: "number",            getValue: i => i.stack_chance ?? null,          format: (i, v) => v != null ? v + "%" : "–" },
  "stack_max":               { label: "Max momentum",                     shortLabel: "Moment. max",     tooltip: "Max antal momentum-attacker",      align: "right",  type: "number",            getValue: i => i.stack_max ?? null },
  "max_enchants":            { label: "Max antal besvärjelser",           shortLabel: "Max besvärj.",    tooltip: "Max antal besvärjelser",           align: "right",  type: "number",            getValue: i => i.max_enchants ?? null },
  "cooldown":                { label: "Nedkylningstid (sekunder)",        shortLabel: "Nedkylning",      tooltip: "Nedkylningstid (sekunder)",        align: "right",  type: "number",            getValue: i => i.cooldown ?? null },
  "duration":                { label: "Verkningstid (minuter)",           shortLabel: "Varaktighet",     tooltip: "Verkningstid (minuter)",           align: "right",  type: "number",            getValue: i => i.duration ?? null },
  "xp":                      { label: "Erfarenhet",                       shortLabel: "EP",              tooltip: null,                               align: "right",  type: "number",            getValue: i => itemsGetSignedNumber(i.xp) },
  "given_coins":             { label: "Silvermynt",                       shortLabel: "SM",              tooltip: null,                               align: "right",  type: "number",            getValue: i => itemsGetSignedNumber(i.given_coins) },
  "popularity":              { label: "Bonus Rykte",                      shortLabel: "Rykte+",          tooltip: "Bonus Rykte",                      align: "right",  type: "number",            getValue: i => itemsGetSignedNumber(i.popularity) },
  "rounds":                  { label: "Rundor",                                                          tooltip: null,                               align: "right",  type: "number",            getValue: i => itemsGetSignedNumber(i.rounds) },
  // Bonuses (Modifikationer)
  "bonus_stamina":           { label: "Bonus Bashälsa",                   shortLabel: "Bashälsa+",       tooltip: "Bonus Bashälsa",                   align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Bashälsa") },
  "bonus_strength":          { label: "Bonus Styrka",                     shortLabel: "Styrka+",         tooltip: "Bonus Styrka",                     align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Styrka") },
  "bonus_dodge":             { label: "Bonus Undvika Anfall",             shortLabel: "Undvika+",        tooltip: "Bonus Undvika",                    align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Undvika anfall") },
  "bonus_wisdom":            { label: "Bonus Intellekt",                  shortLabel: "Intellekt+",      tooltip: "Bonus Intellekt",                  align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Intellekt") },
  "bonus_endurance":         { label: "Bonus Uthållighet",                shortLabel: "Uthållighet+",    tooltip: "Bonus Uthållighet",                align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Uthållighet") },
  "bonus_initiative":        { label: "Bonus Initiativ",                  shortLabel: "Initiativ+",      tooltip: "Bonus Initiativ",                  align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Initiativstyrka") },
  "bonus_leadership":        { label: "Bonus Ledarskap",                  shortLabel: "Ledarskap+",      tooltip: "Bonus Ledarskap",                  align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Ledarskap") },
  "bonus_learning_capacity": { label: "Bonus Inlärning",                  shortLabel: "Inlärning+",      tooltip: "Bonus Inlärning",                  align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Inlärningsförmåga") },
  "bonus_luck":              { label: "Bonus Tur",                        shortLabel: "Tur+",            tooltip: "Bonus Tur",                        align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Tur") },
  "bonus_discipline":        { label: "Bonus Disciplin",                  shortLabel: "Disciplin+",      tooltip: "Bonus Disciplin",                  align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Disciplin") },
  "bonus_taunt":             { label: "Bonus Provokation",                shortLabel: "Provokation+",    tooltip: "Bonus Provokation",                align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Provokation") },
  "bonus_unarmed":           { label: "Bonus Obeväpnat",                  shortLabel: "Obeväpnat+",      tooltip: "Bonus Obeväpnat",                  align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "Obeväpnat slagsmål") },
  "bonus_sword":             { label: "Bonus Svärd",                      shortLabel: "Svärd+",          tooltip: "Bonus Svärd",                      align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "vapenfärdigheten svärd") },
  "bonus_axe":               { label: "Bonus Yxa",                        shortLabel: "Yxa+",            tooltip: "Bonus Yxa",                        align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "vapenfärdigheten yxor") },
  "bonus_mace":              { label: "Bonus Hammare",                    shortLabel: "Hammare+",        tooltip: "Bonus Hammare",                    align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "vapenfärdigheten hammare") },
  "bonus_dagger":            { label: "Bonus Dolk",                       shortLabel: "Dolk+",           tooltip: "Bonus Dolk",                       align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "vapenfärdigheten dolkar") },
  "bonus_stave":             { label: "Bonus Stav",                       shortLabel: "Stav+",           tooltip: "Bonus Stav",                       align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "vapenfärdigheten stavar") },
  "bonus_spear":             { label: "Bonus Stickvapen",                 shortLabel: "Stickvapen+",     tooltip: "Bonus Stickvapen",                 align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "vapenfärdigheten stickvapen") },
  "bonus_chain":             { label: "Bonus Kätting",                    shortLabel: "Kätting+",        tooltip: "Bonus Kätting",                    align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "vapenfärdigheten kättingvapen") },
  "bonus_shield":            { label: "Bonus Sköld",                      shortLabel: "Sköld+",          tooltip: "Bonus Sköld",                      align: "right",  type: "number",            getValue: i => itemsGetBonus(i, "vapenfärdigheten sköldar") },
  // Requirements
  "req_strength":            { label: "Styrka",                                                          tooltip: "Styrkekrav",                       align: "right",  type: "number",            getValue: i => itemsGetStrengthReq(i) || null },
  "req_vf":                  { label: "Vapenfärdighet",                   shortLabel: "VF",              tooltip: "Rekommenderad vapenfärdighet",     align: "right",  type: "number",            getValue: i => itemsGetWeaponSkillReq(i) || null },
  "req_wisdom":              { label: "Krav Intellekt",                   shortLabel: "Krav Int",        tooltip: "Krav Intellekt",                   align: "right",  type: "number",            getValue: i => itemsGetReq(i, "Intellekt") },
  "req_stamina":             { label: "Krav Bashälsa",                    shortLabel: "Krav Bashälsa",   tooltip: null,                               align: "right",  type: "number",            getValue: i => itemsGetReq(i, "Bashälsa") },
  "req_dodge":               { label: "Krav Undvika anfall",              shortLabel: "Krav UA",         tooltip: "Krav Undvika anfall",              align: "right",  type: "number",            getValue: i => itemsGetReq(i, "Undvika anfall") },
  "req_luck":                { label: "Krav Tur",                         shortLabel: "Krav Tur",        tooltip: null,                               align: "right",  type: "number",            getValue: i => itemsGetReq(i, "Tur") },
  "req_age":                 { label: "Ålder",                            shortLabel: "Ålder",           tooltip: "Krav på ålder",                    align: "left",   type: "age_select",        getValue: i => { const codes = itemsGetAgeReq(i); return codes ? codes[0] : null; }, format: (i, v) => itemsFormatAgeReq(itemsGetAgeReq(i)) },
  // Boolean — direct item fields
  "is_two_handed":           { label: "Hand (1h/2h)",                     shortLabel: "Hand",            tooltip: null,                               align: "center", type: "bool",              getValue: i => !!i.is_two_handed,              filterLabels: { falseLabel: "1h", trueLabel: "2h", falseFirst: true }, format: (i, v) => v ? "2h" : "1h" },
  "can_dual_wield":          { label: "Sköldhand",                                                       tooltip: "Kan användas i sköldhand",         align: "center", type: "bool",              getValue: i => !!i.can_dual_wield,             format: (i, v) => v ? "✓" : "" },
  "soulbound":               { label: "Själabunden",                                                     tooltip: null,                               align: "center", type: "bool",              getValue: i => !!i.soulbound,                  format: (i, v) => v ? "✓" : "" },
  "requires_legend":         { label: "Legend",                                                          tooltip: "Kräver legendarisk status",        align: "center", type: "bool",              getValue: i => !!i.requires_legend,            format: (i, v) => v ? "✓" : "" },
  "instant":                 { label: "Omedelbar",                                                       tooltip: "Omedelbar effekt",                 align: "center", type: "bool",              getValue: i => !!i.instant,                    format: (i, v) => v ? "✓" : "" },
  "for_live_battle":         { label: "Livestrids",                                                      tooltip: "Livestrids-mixtur",                align: "center", type: "bool",              getValue: i => !!i.for_live_battle,            format: (i, v) => v ? "✓" : "" },
  "is_hidden":               { label: "Dold effekt",                                                     tooltip: null,                               align: "center", type: "bool",              getValue: i => !!i.is_hidden,                  format: (i, v) => v ? "✓" : "" },
  "only_monster_ladder":     { label: "Enbart för monsterjakt",           shortLabel: "Monsterjakt",     tooltip: "Enbart för monsterjakt",           align: "center", type: "bool",              getValue: i => !!i.only_monster_ladder,        format: (i, v) => v ? "✓" : "" },
  // Derived
  "type_name":               { label: "Typ",                                                             tooltip: null,                               align: "left",   type: "item_type_select",  getValue: i => (i.is_armor && !i.is_trinket ? ARMOR_TYPE_NAMES[i.type_name] : (i.is_trinket ? TRINKET_TYPE_NAMES[i.type_name] : WEAPON_TYPE_LABELS[i.type_name])) || i.type_name || "–" },
  "_profession":             { label: "Yrke",                                                            tooltip: null,                               align: "left",   type: "profession_select", getValue: i => i._profession === "–" ? "" : (i._profession ?? ""), format: i => `<div class="truncate max-w-[7rem] min-w-[3rem]">${i._profession ?? "–"}</div>` },
  "_merchantName":           { label: "Köpman",                                                          tooltip: null,                               align: "left",   type: "merchant_select",   getValue: i => i._merchantName === "–" ? "" : (i._merchantName ?? ""), format: i => `<div class="truncate max-w-[5rem] min-w-[3rem]">${i._merchantName ?? "–"}</div>` },
  "_merchantPrice":          { label: "Pris",                                                            tooltip: null,                               align: "right",  type: "number",            getValue: i => i._merchantPrice,               format: (i, v) => itemsFormatPrice(i, v) },
  "_races":                  { label: "Ras",                                                             tooltip: null,                               align: "left",   type: "race_select",       getValue: i => i._races || [],                 format: i => i._racesDisplay || "–" },
  "_enchant_tags":           { label: "Besvärjelsetyp",                                                  tooltip: null,                               align: "left",   type: "tag_select",        getValue: i => (i.enchant_tags || []).map(t => t.name),        format: (i, v) => { const s = [...v].sort().join(", "); return s || "–"; } },
  "_can_obtain":             { label: "Köpa / Smida",                     shortLabel: "K/S",             tooltip: "Går att köpa eller tillverka",     align: "center", type: "bool",              getValue: i => !!((i._merchantName && i._merchantName !== "–") || (i._profession && i._profession !== "–")), format: (i, v) => v ? "✓" : "" },
  "_loots":                  { label: "Plundra",                                                         tooltip: "Kan plundras från monster",        align: "center", type: "bool",              getValue: i => !!(i.loots?.length),            format: (i, v) => v ? "✓" : "–" },
  "_damage_range":           { label: "Skada",                                                           tooltip: null,                               align: "right",  type: "number",            getValue: i => i.base_damage_min ?? null,      format: (i, v) => v != null ? `${v}–${i.base_damage_max}` : "–" },
  "_avg_damage":             { label: "Skada (avg)",                                                     tooltip: "Genomsnittlig skada",              align: "right",  type: "number",            getValue: i => i.base_damage_min != null ? (i.base_damage_min + i.base_damage_max) / 2 : null, format: (i, v) => v != null ? String(Number.isInteger(v) ? v : v.toFixed(1)) : "–" },
  "_pt_max_damage":          { label: "Perfekt Träff max skada",          shortLabel: "PT max skada",    tooltip: "Vapenskada vid maximal PT",        align: "right",  type: "number",            getValue: i => i.base_damage_max != null && i.crit_damage_max_info != null ? (i.base_damage_max + 1) * i.crit_damage_max_info : null, format: (i, v) => v != null ? String(Number.isInteger(v) ? v : v.toFixed(1)) : "–" },
  "_actions_display":        { label: "Handlingar (totalt)",              shortLabel: "Tot. handl.",     tooltip: null,                               align: "right",  type: "number",            getValue: i => (i.actions ?? 0) * 10000 + (i.defensive_actions ?? 0), format: (i, v) => { const d = i.defensive_actions ?? 0; const a = i.actions ?? "–"; return d > 0 ? `${a} + ${d}` : String(a); } },
  "_crit_type":              { label: "Perfekt Träff typ",                shortLabel: "PT Typ",          tooltip: "Typ av Perfekt Träff",             align: "center", type: "string",            getValue: i => i.perfect_hit ? "Oundviklig" : (i.critical_strikes ? "Kritisk" : null), format: (i, v) => v || "–" },
  "_redist":                 { label: "Omfördelningsbara egenskapspoäng", shortLabel: "Omfördela EP",    tooltip: "Omfördelningsbara egenskapspoäng", align: "right",  type: "number",            getValue: i => i.redist ? (i.redist_points ?? 0) : null, format: (i, v) => v !== null ? String(v) : "–" },
};

// Extend itemsSortGetters (defined in filters.js) with getters for all catalog columns.
if (typeof itemsSortGetters !== "undefined") {
  for (const [key, col] of Object.entries(ITEMS_ALL_COLUMNS)) {
    if (!itemsSortGetters[key]) itemsSortGetters[key] = col.getValue;
  }
}
