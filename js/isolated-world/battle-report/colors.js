/**
 * Colors Module: Applies user-selected team colors to battle reports.
 */
(function() {
  const COLOR_VALUES = {
    green:  { light: "oklch(50.8% .118 165.612)", dark: "oklch(59.6% .145 163.225)" },
    red:    { light: "oklch(50.5% .213 27.518)",  dark: "oklch(44.4% .177 26.899)" },
    blue:   { light: "oklch(48.8% .243 264.376)", dark: "oklch(48.8% .243 264.376)" },
    orange: { light: "oklch(66.6% .179 58.318)",  dark: "oklch(55.5% .163 48.998)" },
  };

  const REQUIRED_OPPONENT = {
    green:  "red",
    red:    "green",
    blue:   "red",
    orange: "green",
  };

  const module = {
    name: 'colors',
    render: async (ctx) => {
      if (!ctx.settings["battle-team-color-enabled"]) {
        const style = document.getElementById("ext-battle-colors");
        if (style) style.textContent = "";
        return;
      }

      if (!document.querySelector(".battle-text")) return;

      const avatarId = apiGetCacheByPattern(/\/api\/users\/me(\?|$)/)?.avatar?.id;
      if (!avatarId) return;

      const ownNames = getOwnGladiatorNames(avatarId);
      if (ownNames.length === 0) return;

      const ownTag = detectColorTag(ownNames);
      if (!ownTag) return;

      const chosenColor = ctx.settings["battle-team-color"] || "green";
      const requiredOpponent = REQUIRED_OPPONENT[chosenColor];
      const otherTag = detectFirstOtherColorTag(ownTag);

      let css = "";
      if (ownTag !== chosenColor) {
        css += `.battle-text ${ownTag}, #ext-battle-stats-root ${ownTag}, #ext-battle-stats-root a:has(${ownTag}) { color: ${COLOR_VALUES[chosenColor].light} !important; }\n`;
        css += `html.dark .battle-text ${ownTag}, html.dark #ext-battle-stats-root ${ownTag}, html.dark #ext-battle-stats-root a:has(${ownTag}) { color: ${COLOR_VALUES[chosenColor].dark} !important; }\n`;
      }

      if (otherTag && otherTag !== requiredOpponent) {
        css += `.battle-text ${otherTag}, #ext-battle-stats-root ${otherTag}, #ext-battle-stats-root a:has(${otherTag}) { color: ${COLOR_VALUES[requiredOpponent].light} !important; }\n`;
        css += `html.dark .battle-text ${otherTag}, html.dark #ext-battle-stats-root ${otherTag}, html.dark #ext-battle-stats-root a:has(${otherTag}) { color: ${COLOR_VALUES[requiredOpponent].dark} !important; }\n`;
      }

      getStyleEl().textContent = css;
    },
    cleanup: () => {
      const style = document.getElementById("ext-battle-colors");
      if (style) style.textContent = "";
    }
  };

  function getStyleEl() {
    let el = document.getElementById("ext-battle-colors");
    if (!el) {
      el = document.createElement("style");
      el.id = "ext-battle-colors";
      document.head.appendChild(el);
    }
    return el;
  }

  function getOwnGladiatorNames(avatarId) {
    const teamCards = [...document.querySelectorAll("p.font-semibold")]
      .filter(p => /^Lag\s+\d+/.test(p.textContent.trim()))
      .map(p => p.closest("div").parentElement);

    for (const card of teamCards) {
      if (!card.querySelector(`a[href="/game/avatar/${avatarId}"]`)) continue;
      return [...card.querySelectorAll("a[href^='/game/avatar/']")]
        .map(a => a.textContent.trim());
    }
    return [];
  }

  function detectColorTag(names) {
    const containers = [
      ...document.querySelectorAll(".battle-text"),
      ...document.querySelectorAll("#ext-battle-stats-root")
    ];

    for (const container of containers) {
      for (const tag of ["green", "red", "blue", "orange"]) {
        for (const el of container.querySelectorAll(tag)) {
          if (names.includes(el.textContent.trim())) return tag;
        }
      }
    }
    return null;
  }

  function detectFirstOtherColorTag(ownTag) {
    for (const bt of document.querySelectorAll(".battle-text")) {
      for (const tag of ["green", "red", "blue", "orange"]) {
        if (tag !== ownTag && bt.querySelector(tag)) return tag;
      }
    }
    return null;
  }

  BattleReportManager.registerModule(module);

  // Still need to watch for user info changes as they might happen after the report is loaded
  apiRegisterHandler(/\/api\/users\/me(\?|$)/, () => {
    // We don't have direct access to the run() function here without the manager exposing it,
    // but the manager already triggers on mutation. 
    // However, if we want to be safe:
    BattleReportManager.init(); // ensure it's init
  });
})();
