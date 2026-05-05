// Shared data-file loading and item parsing utilities.
// Used by pages/database/* and pages/plan-gladiator/* (and any future feature reading data/*.json).
// Loaded early so all dependent scripts can rely on these globals.

var itemsCache = {};

async function itemsLoadFile(filename) {
  if (itemsCache[filename] !== undefined) return itemsCache[filename];
  try {
    const res = await fetch(chrome.runtime.getURL(`data/${filename}.json`));
    if (!res.ok) { itemsCache[filename] = []; return []; }
    itemsCache[filename] = await res.json();
    return itemsCache[filename];
  } catch {
    itemsCache[filename] = [];
    return [];
  }
}

function itemsTypeKey(item) {
  if (item.is_enchant)                   return "enchants";
  if (item.is_weapon || item.is_shield)  return "weapons";
  if (item.is_trinket)                   return "trinkets";
  if (item.is_armor)                     return "armors";
  if (item.is_material)                  return "materials";
  if (item.is_consumable)                return "consumables";
  return "unknown";
}

function itemsNormalizeCategory(cat) {
  if (!cat) return "unknown";
  cat = cat.toLowerCase();
  if (cat === "weapon" || cat === "shield" || cat === "weapons") return "weapons";
  if (cat === "armor" || cat === "armors")                      return "armors";
  if (cat === "trinket" || cat === "trinkets")                  return "trinkets";
  if (cat === "consumable" || cat === "consumables")            return "consumables";
  if (cat === "enchant" || cat === "enchants")                  return "enchants";
  if (cat === "material" || cat === "materials")                return "materials";
  return cat;
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

function itemsGetRaceReqs(item) {
  if (!item.requirements) return [];
  const races = [];
  for (const r of item.requirements) {
    if (!r.requirementable?.includes("Race")) continue;
    if (r.race_name) {
      races.push(r.race_name);
    } else {
      const m = r.requirement_text?.match(/<strong>([^<]+)<\/strong>/);
      if (m) races.push(m[1]);
    }
  }
  return races;
}

// Loads item data and enriches each item with craft/merchant/race info.
// Results are cached per file key.
async function itemsLoadEnriched(fileKey) {
  const cacheKey = "enriched_" + fileKey;
  if (itemsCache[cacheKey] !== undefined) return itemsCache[cacheKey];

  const [items, searchable, craftsRaw, merchantsRaw] = await Promise.all([
    itemsLoadFile(fileKey),
    itemsLoadFile("searchable"),
    itemsLoadFile("crafts"),
    itemsLoadFile("merchants"),
  ]);

  const searchableSet = new Set(searchable);
  const craftsMap    = Object.fromEntries(craftsRaw.map(c => [itemsTypeKey(c) + "_" + c.id, c]));
  const merchantsMap = Object.fromEntries(merchantsRaw.map(m => [itemsNormalizeCategory(m.type_key) + "_" + m.id, m]));

  const enriched = items
    .filter(item => searchableSet.has(itemsTypeKey(item) + "_" + item.id))
    .map(item => {
      const craft    = craftsMap[itemsTypeKey(item) + "_" + item.id];
      const merchant = merchantsMap[itemsTypeKey(item) + "_" + item.id];

      let profession     = "–";
      let professionName = null;
      let professionLevel = null;
      if (craft?.profession_requirements?.length) {
        if (craft.profession_requirements.length > 1) {
          profession = "Flera";
        } else {
          const p = craft.profession_requirements[0];
          professionName  = p.profession.name;
          professionLevel = p.level;
          profession      = `${professionName} ${professionLevel}`;
        }
      }

      let merchantName     = "–";
      let merchantPrice    = null;
      let merchantCurrency = null;
      if (merchant) {
        merchantName = merchant.merchant_name;
        if (merchant.price > 0) {
          merchantPrice    = merchant.price;
          merchantCurrency = "sm";
        } else if (merchant.tokens > 0) {
          merchantPrice    = merchant.tokens;
          merchantCurrency = "gp";
        }
      }

      const races = itemsGetRaceReqs(item);
      const racesDisplay = races.length
        ? races.slice().sort((a, b) => a.localeCompare(b, "sv")).map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")
        : "–";

      return Object.assign({}, item, {
        _profession:       profession,
        _professionName:   professionName,
        _professionLevel:  professionLevel,
        _merchantName:     merchantName,
        _merchantPrice:    merchantPrice,
        _merchantCurrency: merchantCurrency,
        _races:            races,
        _racesDisplay:     racesDisplay,
      });
    });

  itemsCache[cacheKey] = enriched;
  return enriched;
}
