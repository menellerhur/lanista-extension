// Must be var so it is accessible from main.js (content scripts share window globals via var).
var SETTINGS = [
  { type: "header", label: "Extension" },
  { key: "extension-enabled", label: "Aktivera extension",              default: false},
  { key: "show-database",     label: "Visa Databas-länk i menyn",       default: false},
  { key: "show-notifications-log", label: "Logga notifikationer",       default: false},

  { type: "header", label: "System & Utseende" },
  { key: "full-height",             label: "Fyll hela mittenvyns höjd",                                 default: false},
  { key: "remove-top-bar",          label: "Dölj toppbaren",                                           default: false},
  { key: "hide-scrollbars",         label: "Dölj scrollbars",                                           default: false},
  { key: "hide-item-info",          label: "Dölj extra föremålsinformation",                            default: false},
  { key: "sidebar-no-select",       label: "Inaktivera markering av text i sidopanelerna",       default: false },
  { key: "no-gladiator-reload",     label: "Inaktivera omrendering av sidan vid byte av gladiator",          default: false },

  { type: "header", label: "Vänster Sidomeny" },
  { key: "no-badge-pulse",          label: "Inaktivera pulserande effekt på badges",                  default: false },
  { key: "refresh-ranked-cooldown", label: "Uppdatera nedkylningstid automatiskt för rankat lagspel", default: false},
  { key: "merge-adventure-beasts",  label: "Flytta 'Odjur' & 'Äventyr' till Arenan-sektionen",        default: false},
  { key: "redirect-workshop",       label: "Länka 'Verkstad' direkt till pågående arbeten",           default: false},
  { key: "beasts-badge",            label: "Visa badge för kvarstående odjurskamper per dag",          default: false},
  { key: "dailies-badge",          label: "Visa badge för kvarstående dagliga uppdrag",               default: false},
  { key: "hide-empty-sections",      label: "Dölj tomma sektioner i menypanelen",                       default: false},
  { key: "hide-menu-editor",        label: "Dölj 'Ändra menystruktur'",                               default: false},
  { key: "hide-section-badges",     label: "Dölj badges på sektionshuvud",                         default: false },
  { key: "hide-challenges-badge",   label: "Dölj badge på 'Utmaningar'",                               default: false },
  { key: "hide-ranked-toplists",     label: "Dölj 'Topplistor' under 'Rankade lagspel'",               default: false},
  { key: "hide-adventure-no-badge", label: "Dölj 'Äventyr' om inga olästa äventyr",                   default: false},
  { key: "hide-dailies-completed",  label: "Dölj 'Dagliga uppdrag' om alla uppdrag är klara",         default: false},
  { key: "hide-beasts-completed",     label: "Dölj 'Odjur' om alla dagens odjurskamper är utförda",      default: false},
  { key: "simplify-community-link", label: "Ställ in direktlänk för 'Min gemenskap'",                      default: false},
  { key: "community-link-tab",      label: "Flik", type: "select", parentKey: "simplify-community-link", default: "info", options: [
      { value: "info",            label: "Info" },
      { value: "messages",        label: "Nyheter" },
      { value: "chat",            label: "Chat" },
      { value: "members",         label: "Medlemmar" },
      { value: "battles/battles", label: "Strider" },
      { value: "friendly",        label: "Vänskapsstrider" },
      { value: "bosses",          label: "Vidunder" },
      { value: "buildings",       label: "Byggnader" },
      { value: "coins",           label: "Kassa" },
      { value: "items",           label: "Förråd" },
      { value: "contributions",   label: "Bidrag" },
      { value: "activity",        label: "Aktivitet" },
  ]},
  { key: "hide-cooldowns-master",  label: "Dölj nedkylningstider",                                    default: false },
  { type: "multiselect", parentKey: "hide-cooldowns-master", placeholder: "Välj tider att dölja/auto" },
  { key: "cd-mode-training", label: "Träningslokal",        type: "toggle-group", parentKey: "hide-cooldowns-master", default: "show", options: [{v:"show",l:"Visa"},{v:"hide",l:"Dölj"},{v:"auto",l:"Auto"}] },
  { key: "cd-mode-study",    label: "Lärosal / Biblioteket",  type: "toggle-group", parentKey: "hide-cooldowns-master", default: "show", options: [{v:"show",l:"Visa"},{v:"hide",l:"Dölj"},{v:"auto",l:"Auto"}] },
  { key: "cd-mode-mine",     label: "Gruva",                 type: "toggle-group", parentKey: "hide-cooldowns-master", default: "show", options: [{v:"show",l:"Visa"},{v:"hide",l:"Dölj"},{v:"auto",l:"Auto"}] },
  { key: "cd-mode-health",   label: "Hälsans Sal",          type: "toggle-group", parentKey: "hide-cooldowns-master", default: "show", options: [{v:"show",l:"Visa"},{v:"hide",l:"Dölj"},{v:"auto",l:"Auto"}] },
  { key: "cd-mode-chance",   label: "Slumpduell fullt KP",  type: "toggle-group", parentKey: "hide-cooldowns-master", default: "show", options: [{v:"show",l:"Visa"},{v:"hide",l:"Dölj"},{v:"auto",l:"Auto"}] },
  { key: "cd-mode-ranked",   label: "Rankade lagspel",       type: "toggle-group", parentKey: "hide-cooldowns-master", default: "show", options: [{v:"show",l:"Visa"},{v:"hide",l:"Dölj"},{v:"auto",l:"Auto"}] },

  { type: "header", label: "Höger Sidomeny" },
  { key: "truncate-sidebar-names",  label: "Förkorta långa gladiatornamn",               default: false},
  { key: "hide-sidebar-tooltips",   label: "Dölj frågetecken vid gladiator-info", default: false},
  { key: "hide-sidebar-info-toggle", label: "Dölj 'Dölj KP/EP/SM'", default: false },
  { key: "hide-sidebar-challenge-toggle", label: "Dölj 'Utmaningsredo'", default: false },
  { key: "show-challenge-warning-icon", label: "Visa varningsikon om redo", default: true, parentKey: "hide-sidebar-challenge-toggle" },
  { key: "merge-passive",           label: "Flytta 'Passiva funktioner' till gladiatorsektionen",     default: false},
  { key: "right-panel-collapse-av",      label: "Aktivera hopfällbar gladiatorsektion",               default: false },
  { type: "multiselect", parentKey: "right-panel-collapse-av", placeholder: "Välj länkar att fälla ihop" },
  { key: "rpc-av-info",          label: "Info",               type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-bio",           label: "Biografi",           type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-stats",         label: "Egenskaper",         type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-history",       label: "Historia",           type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-statistics",    label: "Statistik",          type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-gear",          label: "Utrustning",         type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-professions",   label: "Yrken",              type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-achievements",  label: "Bedrifter",          type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-activity",      label: "Aktivitet",          type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "rpc-av-passive",       label: "Passiva funktioner", type: "multiselect-child", parentKey: "right-panel-collapse-av", default: true },
  { key: "right-panel-collapse-ko",      label: "Aktivera hopfällbar kontosektion",                       default: false },
  { type: "multiselect", parentKey: "right-panel-collapse-ko", placeholder: "Välj länkar att fälla ihop" },
  { key: "rpc-ko-extension",     label: "Extension",          type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },
  { key: "rpc-ko-database",      label: "Databas",            type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },
  { key: "rpc-ko-notifications", label: "Notifikationer",     type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },
  { key: "rpc-ko-stable",        label: "Gladiatorstall",     type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },
  { key: "rpc-ko-notes",         label: "Anteckningar",       type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },
  { key: "rpc-ko-friends",       label: "Vänner/Ovänner",     type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },
  { key: "rpc-ko-account",       label: "Mitt konto",         type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },
  { key: "rpc-ko-messages",      label: "Brev",               type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },
  { key: "rpc-ko-logout",        label: "Logga ut",           type: "multiselect-child", parentKey: "right-panel-collapse-ko", default: true },

  { type: "header", label: "Info" },
  { key: "info-compact-spacing",    label: "Tydligare sektionsindelning",                default: false },
  { key: "info-tactics-side-by-side", label: "Visa standardtaktiker sida vid sida",        default: false},
  { key: "show-role-stats",         label: "Visa statistik för roller",                    default: false},
  { key: "hide-ranking-points",     label: "Dölj rankingpoäng",                            default: false },
  { key: "hide-basic-stats",        label: "Dölj grundegenskaper",                         default: false },
  { key: "hide-reputation",         label: "Dölj rykte",                                   default: false },
  { key: "hide-ally",              label: "Dölj allierad",                           default: false },

  { type: "header", label: "Lagspel" },
  { key: "highlight-own-teambattle",         label: "Markera eget lagspel i listan",   default: false},
  { key: "show-my-teambattle-button",         label: "Visa knapp för 'Mitt lagspel'",   default: false},
  { key: "compact-teambattles-create-btn",   label: "Kompakt knapp för 'Skapa lagspel'", default: false},
  { key: "show-team-beasts-quota",           label: "Visa daglig kvot för lagspel mot odjur", default: false},
  { key: "show-teambattles-monster-filter",  label: "Visa filter för att exkludera lagspel mot odjur",             default: false},
  { key: "auto-activate-teambattles-monster-filter", label: "Aktivera filter automatiskt när dagens kvot är nådd",        default: false, parentKey: "show-teambattles-monster-filter" },

  { type: "header", label: "Turneringar" },
  { key: "tournament-info-layout",           label: "Kolumnlayout för turneringsinfo", default: false },
  { key: "tournament-schedule-layout",       label: "Kompakt turneringsschema", default: false },
  { key: "tournament-schedule-layout-variant", type: "select", parentKey: "tournament-schedule-layout", default: "layout-1", options: [
      { value: "layout-1", label: "Layout 1" },
      { value: "layout-2", label: "Layout 2" },
  ]},

  { type: "header", label: "Matchrapport" },
  { key: "battle-stats",            label: "Visa matchstatistik som tabell",                            default: false},
  { key: "battle-stats-hide-original", label: "Dölj original matchstatistik",                         default: false, parentKey: "battle-stats" },
  { key: "battle-stats-hover-popup",   label: "Visa mer statistik när muspekaren hålls över",   default: true, parentKey: "battle-stats" },
  { key: "battle-stats-scroll-top",    label: "Scrolla överst på sidan vid navigering till ny matchrapport",          default: false },
  { key: "battle-report-scroll-bottom",      label: "Lägg till knapp för att scrolla längst ner",              default: false },
  { key: "battle-report-show-winner",        label: "Lägg till knapp för att visa vinnare",                   default: false },
  { key: "mark-gladiator",          label: "Markera egen gladiator i strid tydligare",                            default: false},
  { key: "battle-team-color-enabled", label: "Använd fast färg för egen gladiator",                      default: false },
  { key: "battle-team-color", label: "Färg", type: "select", parentKey: "battle-team-color-enabled", default: "green", options: [
      { value: "green",  label: "Grön" },
      { value: "red",    label: "Röd" },
      { value: "blue",   label: "Blå" },
      { value: "orange", label: "Orange" },
  ]},

  { type: "header", label: "Marknaden" },
  { key: "merchant-info",  label: "Visa info-ikon med handelskrav per köpman på översiktssidan",                    default: false},
  { key: "merchant-times", label: "Visa när köpmän anländer och försvinner på översiktssidan",                    default: false},
  { key: "add-buy-orders-tab", label: "Flytta 'Efterfrågningar' till auktionssidan",       default: false},

  { type: "header", label: "Utmaningar" },
  { key: "save-mass-challenge-settings", label: "Kom ihåg inställningar per ras vid massutmaning", default: false },

];

function handleChromeError(e) {
  if (e.message?.includes("Extension context invalidated")) {
    location.reload();
    return true;
  }
  return false;
}

async function loadSettings() {
  try {
    const keys = SETTINGS.filter(s => s.key).map(s => s.key);
    const stored = await chrome.storage.local.get(keys);
    const result = {};
    for (const s of SETTINGS) {
      if (!s.key) continue;
      result[s.key] = s.key in stored ? stored[s.key] : s.default;
    }
    return result;
  } catch (e) {
    const defaults = Object.fromEntries(SETTINGS.filter(s => s.key).map(s => [s.key, s.default]));
    if (!handleChromeError(e)) console.error("Lanista Extension: failed to load settings", e);
    return defaults;
  }
}

async function saveSettings(settings) {
  try {
    await chrome.storage.local.set(settings);
  } catch (e) {
    if (handleChromeError(e)) return;
    console.error("Lanista Extension: failed to save settings", e);
  }
}

function getEffectiveSettings(settings) {
  if (!settings["extension-enabled"]) {
    const off = {};
    for (const s of SETTINGS) { if (s.key) off[s.key] = false; }
    return off;
  }
  return settings;
}

function applySettings(settings) {
  const effective = getEffectiveSettings(settings);
  for (const s of SETTINGS) {
    if (!s.key || s.type === "select" || s.type === "toggle-group" || s.type === "header" || s.type === "multiselect") continue;
    if (s.key === "extension-enabled") continue;
    document.body.classList.toggle(`ext-s-${s.key}`, !!effective[s.key]);
  }
}
