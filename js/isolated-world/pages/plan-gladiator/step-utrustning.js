// Step 2: Utrustning — per-grade equipment planning.
// Depends on: storage.js, data.js, stats.js, dropdown.js, page.js (pgRefreshPage)

// CSS class suffix per section (kept ASCII-safe)
const PG_SECTION_CLASS = {
  VAPEN:        "vapen",
  RUSTNING:     "rustning",
  FÖREMÅL:      "foremal",
  MIXTURER:     "mixturer",
  BESVÄRJELSER: "besvarjelser",
};

const PG_EQUIP_SLOTS = [
  { section: "VAPEN",    key: "weapon",    label: "Vapenhand" },
  { section: "VAPEN",    key: "offhand",   label: "Sköldhand" },
  { section: "RUSTNING", key: "head",      label: "Huvud",    typeName: "head" },
  { section: "RUSTNING", key: "shoulders", label: "Axlar",    typeName: "shoulders" },
  { section: "RUSTNING", key: "chest",     label: "Harnesk",  typeName: "chest" },
  { section: "RUSTNING", key: "hands",     label: "Händer",   typeName: "hands" },
  { section: "RUSTNING", key: "legs",      label: "Ben",      typeName: "legs" },
  { section: "RUSTNING", key: "feet",      label: "Fötter",   typeName: "feet" },
  { section: "FÖREMÅL",  key: "back",      label: "Mantel",   typeName: "back" },
  { section: "FÖREMÅL",  key: "neck",      label: "Halsband", typeName: "neck" },
  { section: "FÖREMÅL",  key: "finger",    label: "Ring",     typeName: "finger" },
  { section: "FÖREMÅL",  key: "amulet",    label: "Amulett",  typeName: "amulet" },
  { section: "FÖREMÅL",  key: "bracelet",  label: "Armband",  typeName: "bracelet" },
  { section: "FÖREMÅL",  key: "trinket",   label: "Ornament", typeName: "trinket" },
  { section: "MIXTURER", key: "potion1",   label: "Mixtur 1" },
  { section: "MIXTURER", key: "potion2",   label: "Mixtur 2" },
  { section: "MIXTURER", key: "potion3",   label: "Mixtur 3" },
  { section: "BESVÄRJELSER", key: "enchant_weapon_1",  label: "Besvärjelse", parent: "weapon"  },
  { section: "BESVÄRJELSER", key: "enchant_weapon_2",  label: "Besvärjelse", parent: "weapon"  },
  { section: "BESVÄRJELSER", key: "enchant_offhand_1", label: "Besvärjelse", parent: "offhand" },
  { section: "BESVÄRJELSER", key: "enchant_offhand_2", label: "Besvärjelse", parent: "offhand" },
];

function pgRenderStepUtrustning(container) {
  const profile = pgGetActiveProfile();
  if (!profile) { container.innerHTML = '<p class="pg-empty">Välj en profil i Profil-steget först.</p>'; return; }

  const grades = pgGetEquipGrades(profile);
  const currentGrade = pgState.currentEquipGrade;

  // Grade picker
  const gradeItems = grades.map(g => ({ value: g, label: `Grad ${g}` }));

  let slotSectionsHtml = "";
  if (currentGrade != null) {
    const slots = profile.equipment[String(currentGrade)] || pgDefaultEquipSlots();
    slotSectionsHtml = `
      <div class="pg-equip-grid">
        <!-- Row 1: Weapon (Column 1) & Options (Column 3) -->
        <div class="pg-equip-section pg-section-vapen">
          <h4 class="pg-section-title">Vapen</h4>
          <div class="pg-equip-list">
            ${pgBuildEquipSectionInnerHtml(profile, slots, currentGrade, PG_EQUIP_SLOTS.filter(s => s.section === "VAPEN"))}
            ${pgBuildDistansRowHtml(profile, slots, currentGrade)}
          </div>
        </div>
        <div class="pg-equip-section pg-section-besvarjelser">
          <h4 class="pg-section-title">Besvärjelser</h4>
          <div class="pg-equip-list">
            ${pgBuildEnchantSectionHtml(profile, slots, currentGrade)}
          </div>
        </div>
        <div class="pg-equip-section pg-section-options">
          <h4 class="pg-section-title">Alternativ</h4>
          <div class="pg-equip-options">
            <label class="pg-checkbox-label">
              <input type="checkbox" id="pg-hide-legend" ${pgState.hideLegendEquip ? "checked" : ""}>
              <span>Dölj legend-utrustning</span>
            </label>
            <label class="pg-checkbox-label">
              <input type="checkbox" id="pg-hide-unobtainable" ${pgState.hideUnobtainableEquip ? "checked" : ""}>
              <span>Dölj utrustning som inte går att köpa / smida</span>
            </label>
          </div>
        </div>

        <!-- Row 2: Armor, Items, Potions -->
        <div class="pg-equip-section pg-section-rustning">
          <h4 class="pg-section-title">Rustning</h4>
          <div class="pg-equip-list">
            ${pgBuildEquipSectionInnerHtml(profile, slots, currentGrade, PG_EQUIP_SLOTS.filter(s => s.section === "RUSTNING"))}
          </div>
        </div>
        <div class="pg-equip-section pg-section-foremal">
          <h4 class="pg-section-title">Föremål</h4>
          <div class="pg-equip-list">
            ${pgBuildEquipSectionInnerHtml(profile, slots, currentGrade, PG_EQUIP_SLOTS.filter(s => s.section === "FÖREMÅL"))}
          </div>
        </div>
        <div class="pg-equip-section pg-section-mixturer">
          <h4 class="pg-section-title">Mixturer</h4>
          <div class="pg-equip-list">
            ${pgBuildEquipSectionInnerHtml(profile, slots, currentGrade, PG_EQUIP_SLOTS.filter(s => s.section === "MIXTURER"))}
          </div>
        </div>
      </div>`;
  } else {
    slotSectionsHtml = `<p class="pg-empty">Välj eller lägg till en grad för att ange utrustning.</p>`;
  }

  const html = `
    <div class="pg-step-section">
      <h3 class="pg-section-title">Grad</h3>
      <div class="pg-profile-row">
        ${pgDropdownHtml({ id: "pg-equip-grade", value: currentGrade, items: gradeItems, noneLabel: false, showSearch: false })}
        <button type="button" class="pg-btn pg-btn-secondary" id="pg-equip-add-grade-btn">
          ${icon("plus", { size: 14 })} Lägg till grad
        </button>
        <input type="number" class="pg-input pg-input-grade" id="pg-equip-grade-input" min="1" hidden>
        <button type="button" class="pg-btn pg-btn-primary" id="pg-equip-grade-confirm" hidden>Lägg till</button>
        <button type="button" class="pg-btn pg-btn-ghost" id="pg-equip-grade-cancel" hidden>Avbryt</button>
        ${currentGrade != null ? `<button type="button" class="pg-btn pg-btn-danger" id="pg-equip-remove-grade-btn">${icon("trash-2", { size: 14 })} Ta bort</button>` : ""}
      </div>
    </div>
    <div id="pg-equip-slots">
      ${slotSectionsHtml}
    </div>`;

  container.innerHTML = html;
  pgBindStepUtrustning(container, profile);
}



function pgBuildEquipSectionInnerHtml(profile, slots, grade, sectionSlots) {
  let html = "";
  for (const slot of sectionSlots) {
    if (slot.key === "offhand" && profile.weaponHand === "2h") continue;

    const items = pgGetSlotItems(profile, slot, grade, slots[slot.key]);
    const potionExcludes = slot.key.startsWith("potion") ? pgGetSelectedPotions(slots, slot.key) : [];
    let filteredItems = potionExcludes.length
      ? items.filter(i => !potionExcludes.includes(i.id))
      : items;

    // Filter out live battle potions
    filteredItems = filteredItems.filter(i => !i.for_live_battle || i.id === slots[slot.key]);

    // Sort: 1. required_level (desc), 2. sell_price (desc)
    filteredItems.sort((a, b) => {
      if (b.required_level !== a.required_level) {
        return b.required_level - a.required_level;
      }
      return (b.sell_price || 0) - (a.sell_price || 0);
    });

    const ddItems = filteredItems.map(i => ({
      value: i.id,
      label: i.name,
      meta: `grad ${i.required_level || 1}`,
    }));

    html += `<div class="pg-equip-slot">
      <label class="pg-equip-label">${slot.label}</label>
      ${pgDropdownHtml({ id: `pg-equip-${slot.key}`, value: slots[slot.key], items: ddItems, noneLabel: "— Inget —" })}
    </div>`;
  }
  return html;
}

function pgGetSlotItems(profile, slot, grade, selectedId) {
  if (slot.key === "weapon") return pgGetWeaponhandItems(profile, grade, selectedId);
  if (slot.key === "offhand") return pgGetOffhandItems(profile, grade, selectedId);
  if (slot.key.startsWith("potion")) return pgGetConsumableItems(profile, grade, selectedId);
  if (slot.section === "RUSTNING") return pgGetArmorItems(profile, slot.typeName, grade, selectedId);
  if (slot.section === "FÖREMÅL") return pgGetTrinketItems(profile, slot.typeName, grade, selectedId);
  return [];
}

function pgGetSelectedPotions(slots, excludeKey) {
  const potionKeys = ["potion1", "potion2", "potion3"].filter(k => k !== excludeKey);
  return potionKeys.map(k => slots[k]).filter(v => v != null);
}

function pgGetSelectedEnchants(slots, parent, excludeKey) {
  const keys = ["1", "2"]
    .map(n => `enchant_${parent}_${n}`)
    .filter(k => k !== excludeKey);
  return keys.map(k => slots[k]).filter(v => v != null);
}

// Rows in BESVÄRJELSER: weapon/offhand enchants (aligned with Vapen section),
// plus always a ranged enchant row as last row (aligned with Distans row).
function pgEnchantRowDescriptors(profile) {
  const rows = profile.weaponHand === "2h"
    ? [
        { parent: "weapon", index: 1, slotKey: "enchant_weapon_1" },
        { parent: "weapon", index: 2, slotKey: "enchant_weapon_2" },
      ]
    : [
        { parent: "weapon",  index: 1, slotKey: "enchant_weapon_1"  },
        { parent: "offhand", index: 1, slotKey: "enchant_offhand_1" },
      ];
  rows.push({ parent: "ranged", index: 1, slotKey: "enchant_ranged_1" });
  return rows;
}

function pgBuildDistansRowHtml(profile, slots, grade) {
  const rangedItems = pgGetRangedItems(profile, grade, slots.ranged);
  rangedItems.sort((a, b) => {
    if (b.required_level !== a.required_level) return b.required_level - a.required_level;
    return (b.sell_price || 0) - (a.sell_price || 0);
  });
  const ddItems = rangedItems.map(i => ({
    value: i.id, label: i.name, meta: `grad ${i.required_level || 1}`,
  }));

  // For 2h: Besvärjelser has 2 rows (v1, v2) while Vapen has only 1 (weapon).
  // A spacer keeps Distans on row 3 in both columns so enchant_ranged_1 aligns.
  const spacer = profile.weaponHand === "2h"
    ? `<div class="pg-equip-slot pg-equip-slot-spacer" aria-hidden="true"><label class="pg-equip-label"></label><div class="pg-equip-spacer-fill"></div></div>`
    : "";

  return spacer + `<div class="pg-equip-slot" id="pg-distans-row">
    <label class="pg-equip-label">Distans</label>
    ${pgDropdownHtml({ id: "pg-equip-ranged", value: slots.ranged, items: ddItems, noneLabel: "— Inget —" })}
  </div>`;
}

function pgBuildEnchantSectionHtml(profile, slots, grade) {
  const rows = pgEnchantRowDescriptors(profile);
  let html = "";
  for (const row of rows) {
    const parentItemId = slots[row.parent];
    const parentItem = parentItemId ? pgState.allWeapons.find(i => i.id === parentItemId) : null;
    const max = parentItem?.max_enchants || 0;
    const active = parentItem && max >= row.index;
    const id = `pg-equip-${row.slotKey}`;

    if (!active) {
      html += `<div class="pg-equip-slot">
        <label class="pg-equip-label">Besvärjelse</label>
        ${pgDropdownHtml({ id, value: null, items: [], showSearch: false })}
      </div>`;
      continue;
    }

    const items = pgGetEnchantItems(parentItem, profile, grade, slots[row.slotKey]);
    const excludes = pgGetSelectedEnchants(slots, row.parent, row.slotKey);
    const filtered = items.filter(e => !excludes.includes(e.id));

    filtered.sort((a, b) => {
      const lvA = a.required_level || 1;
      const lvB = b.required_level || 1;
      if (lvB !== lvA) return lvB - lvA;
      return (b.sell_value || 0) - (a.sell_value || 0);
    });

    const ddItems = filtered.map(e => ({
      value: e.id,
      label: e.name,
      meta: `grad ${e.required_level || 1}`,
    }));

    html += `<div class="pg-equip-slot">
      <label class="pg-equip-label">Besvärjelse</label>
      ${pgDropdownHtml({ id, value: slots[row.slotKey], items: ddItems, noneLabel: "— Inget —" })}
    </div>`;
  }
  return html;
}

// Clear enchants on the given parent side that are no longer compatible
// with the currently equipped parent item (or with no parent item at all).
function pgCleanupEnchantsForParent(slots, parent, grade, profile) {
  const parentItemId = slots[parent];
  const parentItem = parentItemId ? pgState.allWeapons.find(i => i.id === parentItemId) : null;
  const suffixes = parent === "ranged" ? ["1"] : ["1", "2"];
  for (const idx of suffixes) {
    const key = `enchant_${parent}_${idx}`;
    const enchantId = slots[key];
    if (enchantId == null) continue;
    if (!parentItem) { slots[key] = null; continue; }
    const enchant = pgState.allEnchants.find(e => e.id === enchantId);
    if (!enchant || !pgEnchantAllowedFor(parentItem, enchant, grade, profile, enchantId)) {
      slots[key] = null;
    }
  }
}

function pgFindEquipItem(slotKey, itemId) {
  if (slotKey === "weapon" || slotKey === "offhand" || slotKey === "ranged") {
    return pgState.allWeapons.find(i => i.id === itemId);
  }
  if (slotKey?.startsWith("potion")) {
    return pgState.allConsumables.find(i => i.id === itemId);
  }
  if (slotKey?.startsWith("enchant_")) {
    return pgState.allEnchants.find(i => i.id === itemId);
  }
  return pgState.allArmors.find(i => i.id === itemId) || pgState.allTrinkets.find(i => i.id === itemId);
}

// Hover an item in any equipment dropdown → show item tooltip anchored to the
// dropdown. Bound once per container (the step content div persists across
// step renders, so listeners would otherwise stack).
function pgBindEquipTooltipsOnce(container) {
  if (container._pgEquipTooltipBound) return;
  container._pgEquipTooltipBound = true;

  let lastX = 0, lastY = 0;
  container.addEventListener("mousemove", e => {
    lastX = e.clientX;
    lastY = e.clientY;
  });

  container.addEventListener("mouseover", e => {
    const opt = e.target.closest(".pg-dd-item");
    if (!opt) return;
    const dropdown = opt.closest(".pg-dropdown");
    if (!dropdown) return;
    const ddId = dropdown.dataset.pgDd || "";
    if (!ddId.startsWith("pg-equip-") || ddId === "pg-equip-grade") return;
    const itemIdRaw = opt.dataset.pgDdVal;
    if (!itemIdRaw) { itemTooltipHide(); return; }
    const slotKey = ddId.replace("pg-equip-", "");
    const item = pgFindEquipItem(slotKey, parseInt(itemIdRaw, 10));
    if (!item) { itemTooltipHide(); return; }
    // Anchor to the open panel so the tooltip aligns with the panel's top
    // (below the trigger button) and sits past the panel's right edge —
    // the panel is often wider than the button when option labels are long.
    const panel = dropdown.querySelector(".pg-dd-panel");
    const anchor = (panel && !panel.hidden) ? panel : dropdown;
    itemTooltipShowAnchored(anchor, item);
  });

  container.addEventListener("mouseout", e => {
    // Hide whenever the cursor leaves an item — unless it lands on another
    // item, in which case mouseover will replace the tooltip anyway.
    const fromItem = e.target.closest(".pg-dd-item");
    if (fromItem) {
      const toItem = e.relatedTarget?.closest?.(".pg-dd-item");
      if (!toItem) itemTooltipHide();
      return;
    }
    // Safety net: any other transition that exits the dropdown widget.
    const dropdown = e.target.closest(".pg-dropdown");
    if (dropdown && !dropdown.contains(e.relatedTarget)) {
      itemTooltipHide();
    }
  });

  // Hide on scroll to prevent ghosting when elements move away from the cursor.
  // Re-show when scroll stops if mouse is over an item.
  let scrollTimeout = null;
  window.addEventListener("scroll", () => {
    itemTooltipHide();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const el = document.elementFromPoint(lastX, lastY);
      const opt = el?.closest(".pg-dd-item");
      if (!opt) return;
      const dropdown = opt.closest(".pg-dropdown");
      if (!dropdown) return;
      const ddId = dropdown.dataset.pgDd || "";
      if (!ddId.startsWith("pg-equip-") || ddId === "pg-equip-grade") return;
      const itemIdRaw = opt.dataset.pgDdVal;
      if (!itemIdRaw) return;
      const slotKey = ddId.replace("pg-equip-", "");
      const item = pgFindEquipItem(slotKey, parseInt(itemIdRaw, 10));
      if (!item) return;
      const panel = dropdown.querySelector(".pg-dd-panel");
      const anchor = (panel && !panel.hidden) ? panel : dropdown;
      itemTooltipShowAnchored(anchor, item);
    }, 100);
  }, { capture: true, passive: true });
}

function pgBindStepUtrustning(container, profile) {
  pgBindEquipTooltipsOnce(container);

  // Grade selector
  pgDropdownBind(container, "pg-equip-grade", val => {
    if (val != null) {
      pgSetPreferredGrade(val);
    } else {
      pgState.currentEquipGrade = null;
      pgState.preferredGrade = null;
    }
    pgRerenderUtrustning(container);
  });

  // Add grade
  container.querySelector("#pg-equip-add-grade-btn").addEventListener("click", (e) => {
    const input = container.querySelector("#pg-equip-grade-input");
    input.value = "";
    input.hidden = false;
    container.querySelector("#pg-equip-grade-confirm").hidden = false;
    container.querySelector("#pg-equip-grade-cancel").hidden = false;
    e.currentTarget.hidden = true;
    const removeBtn = container.querySelector("#pg-equip-remove-grade-btn");
    if (removeBtn) removeBtn.hidden = true;
    input.focus();
  });
  container.querySelector("#pg-equip-grade-cancel").addEventListener("click", () => {
    container.querySelector("#pg-equip-grade-input").hidden = true;
    container.querySelector("#pg-equip-grade-confirm").hidden = true;
    container.querySelector("#pg-equip-grade-cancel").hidden = true;
    container.querySelector("#pg-equip-add-grade-btn").hidden = false;
    const removeBtn = container.querySelector("#pg-equip-remove-grade-btn");
    if (removeBtn) removeBtn.hidden = false;
    container.querySelector("#pg-equip-grade-input").value = "";
  });
  container.querySelector("#pg-equip-grade-confirm").addEventListener("click", () => {
    pgAddEquipGrade(container, profile);
  });
  container.querySelector("#pg-equip-grade-input").addEventListener("keydown", e => {
    if (e.key === "Enter") container.querySelector("#pg-equip-grade-confirm").click();
    if (e.key === "Escape") container.querySelector("#pg-equip-grade-cancel").click();
  });

  // Remove grade
  const removeBtn = container.querySelector("#pg-equip-remove-grade-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      const grade = pgState.currentEquipGrade;
      if (grade == null) return;

      pgShowConfirmModal({
        title: "Ta bort utrustning",
        message: `Är du säker på att du vill ta bort utrustning för grad ${grade}?`,
        confirmLabel: "Ta bort",
        onConfirm: () => {
          delete profile.equipment[String(grade)];
          const remaining = pgGetEquipGrades(profile);
          pgSetPreferredGrade(pgFindNextGradeAfterDelete(remaining, grade));
          pgRerenderUtrustning(container);
          pgUpdateSaveButtonState(profile);
        }
      });
    });
  }

  // Options checkboxes
  container.querySelector("#pg-hide-legend")?.addEventListener("change", (e) => {
    pgState.hideLegendEquip = e.target.checked;
    pgRerenderUtrustning(container);
  });
  container.querySelector("#pg-hide-unobtainable")?.addEventListener("change", (e) => {
    pgState.hideUnobtainableEquip = e.target.checked;
    pgRerenderUtrustning(container);
  });

  // Equipment slot dropdowns
  const currentGrade = pgState.currentEquipGrade;
  if (currentGrade == null) return;

  if (!profile.equipment[String(currentGrade)]) {
    profile.equipment[String(currentGrade)] = pgDefaultEquipSlots();
  }
  const slots = profile.equipment[String(currentGrade)];

  for (const slot of PG_EQUIP_SLOTS) {
    if (slot.key === "offhand" && profile.weaponHand === "2h") continue;
    if (slot.section === "BESVÄRJELSER") continue;
    pgDropdownBind(container, `pg-equip-${slot.key}`, val => {
      if (slots[slot.key] === val) return;
      pgPushHistory();
      slots[slot.key] = val;
      pgUpdateSaveButtonState(profile);

      if (slot.key.startsWith("potion")) {
        // Potions affect each other (exclusions), so re-render just the mixturer section
        pgRerenderEquipSection(container, profile, slots, currentGrade, "MIXTURER");
      } else if (slot.key === "weapon" || slot.key === "offhand") {
        // Update the weapon dropdown label, then drop incompatible enchants and
        // re-render the BESVÄRJELSER section since the parent item changed.
        const items = pgGetSlotItems(profile, slot, currentGrade, val);
        const item = items.find(i => i.id === val);
        pgDropdownSetValue(container, `pg-equip-${slot.key}`, val, item ? item.name : "— Inget —");
        pgCleanupEnchantsForParent(slots, slot.key, currentGrade, profile);
        pgRerenderEquipSection(container, profile, slots, currentGrade, "BESVÄRJELSER");
      } else {
        // For armor / trinkets, just update the dropdown label and selection state
        const items = pgGetSlotItems(profile, slot, currentGrade, val);
        const item = items.find(i => i.id === val);
        pgDropdownSetValue(container, `pg-equip-${slot.key}`, val, item ? item.name : "— Inget —");
      }
    });
  }

  pgBindEnchantSection(container, profile, slots, currentGrade);
  pgBindDistansRow(container, profile, slots, currentGrade);
}

function pgBindDistansRow(container, profile, slots, grade) {
  pgDropdownBind(container, "pg-equip-ranged", val => {
    if (slots.ranged === val) return;
    pgPushHistory();
    slots.ranged = val;
    slots.enchant_ranged_1 = null;
    pgUpdateSaveButtonState(profile);
    const item = pgGetRangedItems(profile, grade, val).find(i => i.id === val);
    pgDropdownSetValue(container, "pg-equip-ranged", val, item ? item.name : "— Inget —");
    pgCleanupEnchantsForParent(slots, "ranged", grade, profile);
    pgRerenderEquipSection(container, profile, slots, grade, "BESVÄRJELSER");
  });
}

function pgBindEnchantSection(container, profile, slots, grade) {
  const rows = pgEnchantRowDescriptors(profile);
  for (const row of rows) {
    pgDropdownBind(container, `pg-equip-${row.slotKey}`, val => {
      if (slots[row.slotKey] === val) return;
      pgPushHistory();
      slots[row.slotKey] = val;
      pgUpdateSaveButtonState(profile);
      // Selecting one enchant must update its sibling on the same parent
      // (dedup), so re-render the whole BESVÄRJELSER section.
      pgRerenderEquipSection(container, profile, slots, grade, "BESVÄRJELSER");
    });
  }
}

function pgRerenderEquipSection(container, profile, slots, grade, sectionName) {
  const sectionClass = `pg-section-${PG_SECTION_CLASS[sectionName]}`;
  const sectionEl = container.querySelector(`.${sectionClass} .pg-equip-list`);
  if (!sectionEl) return;

  if (sectionName === "BESVÄRJELSER") {
    sectionEl.innerHTML = pgBuildEnchantSectionHtml(profile, slots, grade);
    pgBindEnchantSection(container, profile, slots, grade);
    return;
  }

  const sectionSlots = PG_EQUIP_SLOTS.filter(s => s.section === sectionName);
  sectionEl.innerHTML = pgBuildEquipSectionInnerHtml(profile, slots, grade, sectionSlots);

  // Re-bind dropdowns in this section because innerHTML destroyed them
  for (const slot of sectionSlots) {
      if (slot.key === "offhand" && profile.weaponHand === "2h") continue;
      pgDropdownBind(container, `pg-equip-${slot.key}`, val => {
        slots[slot.key] = val;
        pgUpdateSaveButtonState(profile);
        if (slot.key.startsWith("potion")) {
          pgRerenderEquipSection(container, profile, slots, grade, "MIXTURER");
        } else {
          const items = pgGetSlotItems(profile, slot, grade, val);
          const item = items.find(i => i.id === val);
          pgDropdownSetValue(container, `pg-equip-${slot.key}`, val, item ? item.name : "— Inget —");
        }
      });
  }
}

function pgAddEquipGrade(container, profile) {
  const input = container.querySelector("#pg-equip-grade-input");
  const grade = parseInt(input.value, 10);
  if (!grade || grade < 1) {
    return;
  }

  if (!profile.equipment[String(grade)]) {
    // Pre-populate from nearest lower grade
    const lower = pgGetEquipForGrade(profile, grade - 1);
    profile.equipment[String(grade)] = lower ? { ...lower } : pgDefaultEquipSlots();
    pgUpdateSaveButtonState(profile);
  }
  pgSetPreferredGrade(grade);
  pgRerenderUtrustning(container);
}

// Re-render only this step's content area
function pgRerenderUtrustning(container) {
  pgRenderStepUtrustning(container);
}
