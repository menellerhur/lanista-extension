// Shared item tooltip — content builders + display helpers.
// Used by the database table (cursor-following, see pages/database/ui-tooltip.js)
// and the planera-gladiator equipment dropdowns (anchored to the dropdown).

const ITEM_TYPE_NAMES = {
  // Weapon types
  axe:         "Yxa",
  sword:       "Svärd",
  mace:        "Hammare",
  stave:       "Stav",
  spear:       "Stickvapen",
  chain:       "Kättingvapen",
  fist_weapon: "Obeväpnad",
  shield:      "Sköld",
  ranged:      "Distansvapen",
  // Armor slots
  head:        "Huvud",
  shoulders:   "Axlar",
  chest:       "Harnesk",
  hands:       "Händer",
  legs:        "Ben",
  feet:        "Fötter",
  back:        "Mantel",
  // Trinket slots
  neck:        "Halsband",
  finger:      "Ring",
  amulet:      "Amulett",
  bracelet:    "Armband",
  trinket:     "Ornament",
};

function itemsBuildItemTooltip(item) {
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function row(label, value) {
    return `<div class="ext-wtip-row"><div class="ext-wtip-label">${label}</div><div class="ext-wtip-value">${value}</div></div>`;
  }
  function req(html) {
    return `<div style="margin-bottom:8px">${html}</div>`;
  }

  const typeName = ITEM_TYPE_NAMES[item.type_name] ?? item.type_name ?? "";
  const leftRows  = [];
  const rightRows = [];

  // --- Basfakta ---

  // Typ
  const handStr = item.is_weapon && !item.is_shield && !item.is_ranged
    ? ` - ${item.is_two_handed ? "Tvåhand" : "Enhand"}`
    : "";
  if (!item.is_consumable && !item.is_enchant) leftRows.push(row("Typ", `${esc(typeName)}${handStr}`));

  // Skada (weapon, not shield)
  if (item.is_weapon && !item.is_shield) {
    leftRows.push(row("Skada", `${item.base_damage_min} - ${item.base_damage_max} | ${item.damage_potential ?? 0}`));
  }

  // PT-potential (weapon, not shield — shown after Skada)
  if (item.is_weapon && !item.is_shield) {
    const v = item.max_crit_rate ?? 0;
    leftRows.push(row("PT-potential", `${v >= 0 ? "+" : ""}${v}%`));
  }

  // Perfect hit type (weapon, not shield, not ranged)
  if (item.is_weapon && !item.is_shield && !item.is_ranged) {
    const parts = [];
    if (item.perfect_hit) parts.push("Oundviklig");
    if (item.critical_strikes) {
      const cdMin = item.crit_damage_min ?? 0;
      const cdMax = item.crit_damage_max ?? 0;
      const pct = cdMin !== cdMax ? `(${cdMin}% - ${cdMax}%) ` : `(${cdMin}%) `;
      parts.push(`Kritisk ${pct}`);
    }
    if (parts.length) leftRows.push(row("Typ av perfekt träff", parts.join(" och ")));
  }

  // Handlingar (weapon, not shield, not ranged) — only if > 1 or defensive > 0
  if (item.is_weapon && !item.is_shield && !item.is_ranged) {
    const actions = item.actions ?? 0;
    const defAct  = item.defensive_actions ?? 0;
    if (actions > 1 || defAct > 0) {
      leftRows.push(row("Handlingar", defAct > 0 ? `${actions} + ${defAct}` : `${actions}`));
    }
  }

  // Momentumskada
  if (item.stack_multiplier) {
    leftRows.push(row("Momentumskada", `${item.stack_multiplier}% - (${item.stack_chance}% chans, max ${item.stack_max})`));
  }

  // Shield hand (Sköldhand) — only shown as "Nej" if 1h, not ranged, not can_dual_wield
  if (item.is_weapon && !item.is_shield && !item.is_two_handed && !item.is_ranged && !item.can_dual_wield) {
    leftRows.push(row("Sköldhand", "Nej"));
  }

  if (item.is_enchant) {
    const v = item.max_crit_rate ?? 0;
    leftRows.push(row("PT-potential", `${v >= 0 ? "+" : ""}${v}%`));
    if (item.soulbound) leftRows.push(row("Själabunden", `Ja <span style="color:red"><i class="fa fa-exclamation-circle"></i></span>`));
    const enchantTags = (item.enchant_tags || []).map(t => t.name).sort();
    leftRows.push(row("Besvärjelsetyper", enchantTags.length ? esc(enchantTags.join(", ")) : "Ingen"));
  } else if (item.is_consumable) {
    const v = item.max_crit_rate ?? 0;
    leftRows.push(row("PT-potential", `${v >= 0 ? "+" : ""}${v}%`));
    if (item.instant)    leftRows.push(row("Omedelbar Effekt", ""));
    if (item.is_hidden)  leftRows.push(row("Dold effekt", ""));
    if (item.duration > 0 && !item.instant) {
      if (item.hide_duration) {
        leftRows.push(row("Verkningstid", "Dold"));
      } else {
        const h = Math.floor(item.duration / 60);
        const m = item.duration % 60;
        leftRows.push(row("Verkningstid", item.duration >= 60 ? `${h} h ${m} m` : `${m} minuter`));
      }
    }
    if (item.cooldown > 0 && item.cooldown_display) leftRows.push(row("Nedkylningstid", esc(item.cooldown_display)));
    leftRows.push(row("Livestrids-mixtur", item.for_live_battle ? "Ja" : "Nej"));
    if (item.for_live_battle) leftRows.push(row("Enbart för monsterjakt", item.only_monster_ladder ? "Ja" : "Nej"));
    if (item.soulbound) leftRows.push(row("Själabunden", `Ja <span style="color:red"><i class="fa fa-exclamation-circle"></i></span>`));
    if (item.augmented_races?.length) leftRows.push(row("Rasskepnad", esc(item.augmented_races.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", "))));
  } else {
    // Armor: Skydd + PT-potential (before Vikt)
    if (item.is_armor && !item.is_trinket) {
      if (item.base_block != null) {
        const skydd = item.percentage_block
          ? `${item.percentage_block}% av skadan (min ${item.min_block} - max ${item.base_block})`
          : item.base_block;
        leftRows.push(row("Skydd", skydd));
      }
    }
    if (!item.is_weapon && !item.is_shield) {
      const v = item.max_crit_rate ?? 0;
      leftRows.push(row("PT-potential", `${v >= 0 ? "+" : ""}${v}%`));
    }

    // Vikt (always for non-consumables)
    leftRows.push(row("Vikt", `${item.weight ?? "–"} KV`));

    // Durability / Brytvärde (weapon not ranged, or shield)
    if (item.is_shield || (item.is_weapon && !item.is_ranged)) {
      leftRows.push(row("Brytvärde", item.durability ?? "–"));
    }

    // Shield: absorption + max blocks + PT-potential (after Durability)
    if (item.is_shield) {
      if (item.absorption != null)          leftRows.push(row("Absorbering", item.absorption));
      if (item.max_blocks_per_round != null) leftRows.push(row("Max antal blockeringar per runda", item.max_blocks_per_round));
      const v = item.max_crit_rate ?? 0;
      leftRows.push(row("PT-potential", `${v >= 0 ? "+" : ""}${v}%`));
    }

    // Soulbound / Själabunden (left column, after item-specific fields)
    if (item.soulbound) leftRows.push(row("Själabunden", `Ja <span style="color:red"><i class="fa fa-exclamation-circle"></i></span>`));
    if (item.augmented_races?.length) leftRows.push(row("Rasskepnad", esc(item.augmented_races.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", "))));
  }

  // Enchantments (weapons, shields, armor)
  const tags = (item.enchant_tags || []).map(t => t.name).sort();
  if (item.is_weapon_or_shield && (tags.length || item.max_enchants)) {
    leftRows.push(`<p class="font-serif" style="margin-top:16px;margin-bottom:8px">Besvärjelser</p>`);
    if (tags.length) leftRows.push(row("Besvärjelsetyper", esc(tags.join(", "))));
    leftRows.push(row("Max antal besvärjelser", item.max_enchants ?? 0));
  }

  // --- Right column: requirements and recommendations ---
  rightRows.push(`<p class="font-serif" style="margin-bottom:8px">Krav och rekommendationer</p>`);

  // required_level / recommended_level / max_level
  rightRows.push(req(`Kräver att du är minst <strong>grad ${item.required_level ?? 0}</strong>`));
  if (item.recommended_level) rightRows.push(req(`Du rekommenderas vara minst <strong>grad ${item.recommended_level}</strong>`));
  if (item.max_level) rightRows.push(req(`Kräver att du är högst <strong>grad ${item.max_level}</strong>`));

  // required_ranking_points
  if (item.required_ranking_points) {
    const t = item.required_ranking_points_type;
    const typeStr = t ? `(${t}vs${t})` : "(alla typer)";
    rightRows.push(req(`Kräver att du har haft som minst <strong>${item.required_ranking_points} rankingpoäng ${typeStr}</strong>`));
  }

  // min/max popularity
  if (item.min_popularity != null) rightRows.push(req(`Kräver att du har som lägst <strong>${item.min_popularity} i rykte</strong>`));
  if (item.max_popularity != null) rightRows.push(req(`Kräver att du har som högst <strong>${item.max_popularity} i rykte</strong>`));

  // Non-race requirements from requirements array (strength, weapon skill, other) — use requirement_text as HTML
  for (const r of (item.requirements || [])) {
    if (r.requirementable?.includes("Race")) continue;
    if (r.requirement_text) rightRows.push(req(r.requirement_text));
  }

  // Race requirements
  const races = [...(item._races || [])].sort((a, b) => a.localeCompare(b, "sv"));
  if (races.length) rightRows.push(req(`Kräver att du är av rasen <strong>${esc(races.join(", "))}</strong>`));

  if (item.requires_legend) rightRows.push(req("Kräver legendarisk status"));

  // Enchant weapon restrictions
  if (item.is_enchant) {
    if (item.restrict_to_two_hand) rightRows.push(req(`Kan enbart appliceras på <strong>tvåhandsvapen</strong>`));
    if (item.restrict_to_one_hand) rightRows.push(req(`Kan enbart appliceras på <strong>enhandsvapen</strong>`));
    if (item.restrict_to_shields)  rightRows.push(req(`Kan enbart appliceras på <strong>sköldar</strong>`));
    if (item.restrict_to_distance) rightRows.push(req(`Kan enbart appliceras på <strong>distansvapen</strong>`));
  }

  // --- Modifikationer (ItemBonuses / WO) ---
  const mods = [];

  // 1. changes_name
  if (item.changes_name) mods.push(`Ändrar namn på vapen/sköld`);

  // 2. slotless
  if (item.slotless) mods.push(`<strong><i class="fal fa-exclamation-circle"></i> Tar ej upp en besvärjelseplats</strong>`);

  // 3. enchant_modifiers
  for (const m of (item.enchant_modifiers || [])) {
    const val = m.enchant_value_display;
    const valStr = typeof val === "string" ? esc(val) : (val >= 0 ? `+${val}` : `${val}`);
    const name = esc(m.enchantable_name);
    const maxStr = `<small class="ext-mod-sub">(Appliceras max ${m.max_procs} gånger per strid)</small>`;
    let text;
    if (m.proc_type_name === "applicering" && m.proc_chance === 100) {
      // modifiers_always — no proc_chance, no max_procs
      text = `<strong>${valStr} i ${name}</strong> vid <strong>${esc(m.proc_type_name)}</strong>`;
    } else if (m.debuff) {
      // debuff_modifiers
      text = `<strong>${m.proc_chance}% chans till ${valStr} i ${name}</strong> för motståndaren vid <strong>${esc(m.proc_type_name)}</strong>${maxStr}`;
    } else {
      // modifiers
      text = `<strong>${m.proc_chance}% chans till ${valStr} i ${name}</strong> vid <strong>${esc(m.proc_type_name)}</strong>${maxStr}`;
    }
    mods.push(text);
  }

  // 4. Numeric stat modifiers
  function modStat(val, label, pct) {
    if (val == null || val === 0) return;
    const sign = val > 0 ? "+" : "";
    const suffix = pct ? "%" : "";
    mods.push(`<strong>${sign}${val}${suffix}</strong> i ${label}`);
  }
  modStat(item.min_damage,       "min skada");
  modStat(item.max_damage,       "max skada");
  if (item.is_enchant) {
    modStat(item.damage_potential, "skadepotential");
    modStat(item.absorption,       "absorbering");
    modStat(item.durability,       "brytvärde");
    modStat(item.weight,           "vikt");
  }
  if (item.block_rate) {
    mods.push(`<strong>${item.block_rate}%</strong> chans att parera/blockera${item.is_enchant ? " med vapen/sköld som besvärjelsen appliceras på" : ""}`);
  }
  if (item.crit_damage_multiplier) {
    mods.push(`<strong>${item.crit_damage_multiplier}%</strong> ökad skada vid kritisk perfekt träff${item.is_enchant ? " med vapen som besvärjelsen appliceras på" : ""}`);
  }
  if (item.reflect_damage) {
    if (item.reflect_damage_type === 1) {
      mods.push(`<strong>${item.reflect_chance}% chans att reflektera ${item.reflect_damage} i skada</strong> vid varje blockering`);
    } else {
      mods.push(`<strong>${item.reflect_chance}% chans att reflektera ${item.reflect_damage}</strong>% av absorberad skada`);
    }
  }
  if (item.lifesteal) {
    mods.push(`<strong>${item.lifesteal_chance}% chans att stjäla ${item.lifesteal}%</strong> av motståndarens maximala KP vid <strong>${esc(item.proc_type_name)}</strong>.<br><small>(Effekten fungerar max ${item.lifesteal_max_procs} gånger per strid)</small><br><small>(I strid mot vidunder eller monsterjakt kan max 5% av ens egna totala KP stjälas)</small>`);
  }

  // 5. increased_hit_rate, crit_rate, min_crit_rate
  if (item.increased_hit_rate) {
    const abs = Math.abs(item.increased_hit_rate);
    const fumbleSuffix = item.is_enchant ? " med vapen som besvärjelsen appliceras på" : "";
    mods.push(item.increased_hit_rate > 0
      ? `<strong>${abs}% lägre</strong> risk att fumla vid attack${fumbleSuffix}`
      : `<strong>${abs}% högre</strong> risk att fumla vid attack${fumbleSuffix}`);
  }
  if (item.crit_rate) {
    const abs = Math.abs(item.crit_rate);
    mods.push(item.crit_rate > 0
      ? `<strong>${abs}% högre</strong> chans till en <strong>perfekt träff</strong>`
      : `<strong>${abs}% lägre</strong> chans till en <strong>perfekt träff</strong>`);
  }
  if (item.min_crit_rate) {
    const abs = Math.abs(item.min_crit_rate);
    mods.push(item.min_crit_rate > 0
      ? `<strong>${abs}% ökning</strong> av lägsta chansen till <strong>perfekt träff</strong>`
      : `<strong>${abs}% minskning</strong> av lägsta chansen till <strong>perfekt träff</strong>`);
  }
  for (const b of (item.bonuses || [])) {
    if (b.bonus_text) mods.push(b.bonus_text);
  }
  for (const e of (item.battle_effects || [])) {
    if (e.text) mods.push(e.text);
  }

  if (item.is_consumable) {
    if (item.weight) {
      mods.push(item.weight > 0
        ? `<strong>Ökar</strong> din vikt med <strong>${item.weight}</strong>`
        : `<strong>Minskar</strong> din vikt med <strong>${Math.abs(item.weight)}</strong>`);
    }
    if (item.redist && item.redist_points > 0) mods.push(`Ger dig möjlighet att omfördela <strong>${item.redist_points} egenskapspoäng</strong> i valfria egenskaper eller vapenfärdigheter.`);
    // (xp, given_coins, popularity, rounds moved to Permanenta effekter section below)
    if (item.restore_hp)      mods.push(`<strong>${item.restore_hp_chance}% chans att hela ${esc(item.restore_hp)} KP</strong> vid ${esc(item.proc_type_name)}`);
    if (item.damage)          mods.push(`<strong>${item.damage_chance}% chans att skada motståndaren ${esc(item.damage)}</strong> vid ${esc(item.proc_type_name)}<br><small>(Skadan går ej att undvika, parera, blockera eller absorbera på något sätt)</small>`);
    if (item.reduced_hit_rate) mods.push(`<strong>${item.reduced_hit_rate_chance}% chans </strong> att öka motståndarens <strong>fummelrisk med ${item.reduced_hit_rate}%</strong>.`);
    if (item.undead)          mods.push(`<strong>${esc(item.undead_chance)}</strong> chans att bli odöd.<br><strong>OBS! Blir du ej odöd av den här mixturen avlider din gladiator.</strong>`);
    if (item.death)           mods.push(`<strong>${esc(item.death_chance)} risk att avlida vid användning!</strong>`);

    if (item.popularity) {
      let s = String(item.popularity);
      if (!s.startsWith("+") && !s.startsWith("-") && parseFloat(s) > 0) s = "+" + s;
      mods.push(`<strong>${s}</strong> rykte`);
    }
  }

  if (mods.length) {
    rightRows.push(`<p class="font-serif" style="margin-top:24px;margin-bottom:8px">Modifikationer</p>`);
    for (const m of mods) rightRows.push(`<div style="margin-bottom:8px">${m}</div>`);
  }

  const instantPoints = item.instant_points || [];
  const hasOtherPermanent = item.xp || item.given_coins || item.rounds;
  if (instantPoints.length || hasOtherPermanent) {
    rightRows.push(`<p class="font-serif" style="margin-top:24px;margin-bottom:8px">Permanenta effekter</p>`);
    for (const p of instantPoints) rightRows.push(`<div style="margin-bottom:8px">${p.effects_text}</div>`);

    const pushPermanent = (val, label) => {
      if (!val) return;
      let s = String(val);
      if (!s.startsWith("+") && !s.startsWith("-") && parseFloat(s) > 0) s = "+" + s;
      rightRows.push(`<div style="margin-bottom:8px"><strong>${s}</strong> ${label}</div>`);
    };
    pushPermanent(item.xp, "erfarenhet");
    pushPermanent(item.given_coins, "silvermynt");
    pushPermanent(item.rounds, "rundor");
  }

  if (item.asset?.url) {
    rightRows.push(`<div class="ext-wtip-img-wrap" style="min-height:120px;display:flex;align-items:center;justify-content:flex-start;margin-top:24px">
      <img style="max-height:120px;height:auto;width:auto" src="${esc(item.asset.url)}">
    </div>`);
  }

  return `<div class="ext-weapon-tip-name">${esc(item.name)}</div>
    <div class="ext-wtip-panels">
      <div style="width:50%;padding-right:12px">
        <p class="font-serif" style="margin-bottom:12px">Basfakta</p>
        ${leftRows.join("")}
      </div>
      <div class="ext-wtip-divider" style="width:50%">
        ${rightRows.join("")}
      </div>
    </div>`;
}

function itemsBuildMaterialTooltip(item) {
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // Left: "Plundras från" (looted from) — unique monsters (by id) sorted by min_level ascending
  const seenIds = new Set();
  const monsters = [];
  for (const l of (item.loots || [])) {
    const m = l.lootable;
    if (!m || !m.name || seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    monsters.push(m);
  }
  monsters.sort((a, b) => {
    const maxDiff = (a.max_level ?? 0) - (b.max_level ?? 0);
    if (maxDiff !== 0) return maxDiff;
    const minDiff = (a.min_level ?? 0) - (b.min_level ?? 0);
    if (minDiff !== 0) return minDiff;
    return (a.name ?? "").localeCompare(b.name ?? "", "sv");
  });
  const leftRows = monsters.map(m => {
    const range = `${m.min_level ?? "?"}–${m.max_level ?? "?"}`;
    return `<div style="display:flex;gap:8px;margin-bottom:4px"><span style="min-width:40px;text-align:right;color:var(--muted-foreground)">${esc(range)}</span><span>${esc(m.name)}</span></div>`;
  });

  const rightRows = [];

  // "Säljes av" (sold by) — only if there are merchants
  if (item.merchants?.length) {
    rightRows.push(`<p class="font-serif" style="margin-bottom:8px">Säljes av</p>`);
    for (const m of item.merchants) {
      const price = item._merchantPrice != null ? ` — ${item._merchantPrice} ${item._merchantCurrency}` : "";
      rightRows.push(`<div style="margin-bottom:8px">${esc(m.name)}${esc(price)}</div>`);
    }
  }

  // "Används till" (used for) — unique profession names from material_requirements, without level
  const professions = [...new Set(
    (item.material_requirements || [])
      .flatMap(r => (r.itemable?.profession_requirements || []).map(p => p.profession?.name))
      .filter(Boolean)
  )].sort((a, b) => b.localeCompare(a, "sv"));
  if (professions.length) {
    const hasKopsAv = item.merchants?.length;
    rightRows.push(`<p class="font-serif" style="${hasKopsAv ? "margin-top:16px;" : ""}margin-bottom:8px">Används till</p>`);
    for (const prof of professions) {
      rightRows.push(`<div style="margin-bottom:4px">${esc(prof)}</div>`);
    }
  }

  return `<div class="ext-weapon-tip-name">${esc(item.name)}</div>
    <div style="display:flex">
      <div style="width:50%;padding-right:12px">
        <p class="font-serif" style="margin-bottom:12px">Plundras från</p>
        ${leftRows.length ? leftRows.join("") : "<div>–</div>"}
      </div>
      <div class="ext-wtip-divider" style="width:50%">
        ${rightRows.join("")}
      </div>
    </div>`;
}

// Returns the shared #ext-weapon-tooltip element, creating it if missing.
function itemTooltipEl() {
  let tipEl = document.getElementById("ext-weapon-tooltip");
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = "ext-weapon-tooltip";
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

// Renders the tooltip for `item` and anchors it next to `anchorEl`:
// top edge of tooltip aligns with the anchor's top, prefers the right side
// (falls back to left if there is not enough horizontal room), and clamps
// downward so it stays inside the viewport.
//
// `sideAnchorEl` (optional) overrides the element used for the horizontal
// edge. Useful when the visible widget extends past `anchorEl` — e.g. an open
// dropdown panel that overflows its trigger button — so the tooltip sits past
// the wider panel rather than past the narrower button.
function itemTooltipShowAnchored(anchorEl, item, sideAnchorEl) {
  const tipEl = itemTooltipEl();
  const itemId = String(item.id);

  if (tipEl.style.display === "block" && tipEl.dataset.itemId !== itemId) {
    tipEl.style.minHeight = tipEl.offsetHeight + "px";
  }

  if (tipEl.style.display !== "block" || tipEl.dataset.itemId !== itemId) {
    tipEl.innerHTML = item.is_material ? itemsBuildMaterialTooltip(item) : itemsBuildItemTooltip(item);
    tipEl.dataset.itemId = itemId;
    tipEl.style.display = "block";
    
    const img = tipEl.querySelector("img");
    if (img) {
      img.onload = () => { tipEl.style.minHeight = ""; };
      setTimeout(() => { tipEl.style.minHeight = ""; }, 500);
    } else {
      tipEl.style.minHeight = "";
    }
  }

  const margin = 8;
  const topRect  = anchorEl.getBoundingClientRect();
  const sideRect = (sideAnchorEl || anchorEl).getBoundingClientRect();
  const tipW = tipEl.offsetWidth;
  const tipH = tipEl.offsetHeight;

  let left = sideRect.right + margin;
  if (left + tipW > window.innerWidth - margin) {
    left = sideRect.left - tipW - margin;
    if (left < margin) left = margin;
  }

  let top = topRect.top;
  if (top + tipH > window.innerHeight - margin) top = window.innerHeight - tipH - margin;
  if (top < margin) top = margin;

  tipEl.style.left = left + "px";
  tipEl.style.top  = top  + "px";
}

function itemTooltipHide() {
  const tipEl = document.getElementById("ext-weapon-tooltip");
  if (tipEl) {
    tipEl.style.display = "none";
    tipEl.dataset.itemId = "";
    tipEl.style.minHeight = "";
  }
}
