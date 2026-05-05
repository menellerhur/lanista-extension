// Builds the human-readable summary of active filters shown as a tooltip on
// the row count in the items table footer. One line per active filter.
// Depends on: state.js (itemsFilterSelection, itemsCurrentSubcat, itemsColFilters),
//             config.js (ITEMS_ALL_COLUMNS, WEAPON_TYPE_LABELS, ARMOR_TYPE_NAMES, TRINKET_TYPE_NAMES)

function itemsGetActiveFiltersSummary() {
  const active = [];

  // 1. Selection filter
  if (itemsFilterSelection === "selected") active.push("Visar endast markerade");
  else if (itemsFilterSelection === "unselected") active.push("Visar endast ej markerade");

  // 2. Subcategory
  if (itemsCurrentSubcat !== null) {
    const label = WEAPON_TYPE_LABELS[itemsCurrentSubcat] || itemsCurrentSubcat;
    active.push(`Kategori: ${label}`);
  }

  // 3. Column filters
  for (const [key, f] of Object.entries(itemsColFilters)) {
    const col = ITEMS_ALL_COLUMNS[key];
    if (!col || !f) continue;

    if (key === "name" && f.text) {
      active.push(`Namn: "${f.text}"`);
    } else if (key === "_damage_range") {
      const parts = [];
      if (f.avgMin || f.avgMax) parts.push(`Snitt: ${f.avgMin || 0}-${f.avgMax || "∞"}`);
      if (f.botMin || f.botMax) parts.push(`Lägsta: ${f.botMin || 0}-${f.botMax || "∞"}`);
      if (f.topMin || f.topMax) parts.push(`Högsta: ${f.topMin || 0}-${f.topMax || "∞"}`);
      if (parts.length) active.push(`Skada (${parts.join(", ")})`);
    } else if (col.type === "number") {
      if ((f.min != null && f.min !== "") || (f.max != null && f.max !== "")) {
        const range = (f.min || 0) + " – " + (f.max || "∞");
        active.push(`${col.label}: ${range}`);
      }
    } else if (col.type === "string") {
      if (f.text) active.push(`${col.label}: "${f.text}"`);
    } else if (col.type === "bool") {
      if (f.boolVal != null) {
        const label = f.boolVal ? (col.filterLabels?.trueLabel || "Ja") : (col.filterLabels?.falseLabel || "Nej");
        active.push(`${col.label}: ${label}`);
      }
    } else if (["race_select", "merchant_select", "class_select", "tag_select", "item_type_select", "age_select"].includes(col.type)) {
      const keys = { race_select: "races", merchant_select: "merchants", class_select: "classes", tag_select: "enchant_tags", item_type_select: "item_types", age_select: "ages" };
      const arr = f[keys[col.type]];
      if (arr?.length) {
        const formatted = arr.map(v => {
          if (v === "__none__") return "–";
          let val = v;
          if (col.type === "item_type_select" || col.type === "class_select") {
            val = ARMOR_TYPE_NAMES[v] || TRINKET_TYPE_NAMES[v] || WEAPON_TYPE_LABELS[v] || v;
          } else if (col.type === "age_select") {
            val = ITEMS_AGE_LABELS[v] || v;
          }
          if (col.type === "race_select" || col.type === "item_type_select" || col.type === "class_select") {
            return val.charAt(0).toUpperCase() + val.slice(1);
          }
          return val;
        });
        active.push(`${col.label}: ${formatted.join(", ")}`);
      }
    } else if (col.type === "profession_select") {
      if (f.professions?.length) {
        active.push(`${col.label}: ${f.professions.map(p => (p === "__none__" ? "–" : p.replace("\t", " "))).join(", ")}`);
      }
    }
  }

  return active.length > 0 ? active.join("\n") : "Inga aktiva filter";
}
