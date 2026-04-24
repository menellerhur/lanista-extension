// Data loading and enrichment.
// Depends on: state.js (itemsCache), filters.js (itemsGetRaceReqs), config.js (itemsTypeKey)

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
  if (item.is_enchant)                   return "enchant";
  if (item.is_weapon && !item.is_shield) return "weapon";
  if (item.is_shield)                    return "shield";
  if (item.is_trinket)                   return "trinket";
  if (item.is_armor)                     return "armor";
  if (item.is_material)                  return "material";
  if (item.is_consumable)                return "consumable";
  return "unknown";
}

// Loads item data and enriches each item with craft/merchant info.
// Results are cached per file key.
async function itemsLoadEnriched(fileKey) {
  const cacheKey = "enriched_" + fileKey;
  if (itemsCache[cacheKey] !== undefined) return itemsCache[cacheKey];

  const [items, craftsRaw, merchantsRaw] = await Promise.all([
    itemsLoadFile(fileKey),
    itemsLoadFile("crafts"),
    itemsLoadFile("merchants"),
  ]);

  const craftsMap    = Object.fromEntries(craftsRaw.map(c => [itemsTypeKey(c) + "_" + c.id, c]));
  const merchantsMap = Object.fromEntries(merchantsRaw.map(m => [m.type_key + "_" + m.id, m]));

  const enriched = items.map(item => {
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
