// Must be var so these are accessible across all database/* content script files.
var ARMOR_TYPE_NAMES = {
  head:      "Huvud",
  shoulders: "Axlar",
  chest:     "Harnesk",
  hands:     "Händer",
  legs:      "Ben",
  feet:      "Fötter",
};

var TRINKET_TYPE_NAMES = {
  back:     "Mantel",
  neck:     "Halsband",
  finger:   "Ring",
  amulet:   "Amulett",
  bracelet: "Armband",
  trinket:  "Ornament",
};

var WEAPON_TYPE_LABELS = {
  axe:         "Yxor",
  sword:       "Svärd",
  mace:        "Hammare",
  stave:       "Stavar",
  ranged:      "Distansvapen",
  spear:       "Stickvapen",
  chain:       "Kättingvapen",
  fist_weapon: "Obeväpnad",
  shield:      "Sköld",
};

var WEAPON_TYPE_ORDER = ["axe", "sword", "mace", "stave", "ranged", "spear", "chain", "fist_weapon"];

var ITEM_VIEWS = [
  {
    key: "weapon",
    label: "Vapen",
    file: "weapons",
    baseFilter: item => !!(item.is_weapon && !item.is_shield),
    subcatMode: "weapon_types",
    columns: "weapon",
    hasStrengthFilter: true,
  },
  {
    key: "shield",
    label: "Sköldar",
    file: "weapons",
    baseFilter: item => !!item.is_shield,
    subcatMode: null,
    columns: "shield",
    hasStrengthFilter: true,
  },
  {
    key: "armor",
    label: "Rustning",
    file: "armors",
    baseFilter: item => !!item.is_armor && !item.is_trinket && !item.is_shield,
    subcatMode: "static",
    subcats: [
      { label: "Huvud",   filter: item => item.type_name === "head" },
      { label: "Axlar",   filter: item => item.type_name === "shoulders" },
      { label: "Harnesk", filter: item => item.type_name === "chest" },
      { label: "Händer",  filter: item => item.type_name === "hands" },
      { label: "Ben",     filter: item => item.type_name === "legs" },
      { label: "Fötter",  filter: item => item.type_name === "feet" },
    ],
    columns: "armor",
    hasStrengthFilter: true,
  },
  {
    key: "trinket",
    label: "Föremål",
    file: "trinkets",
    baseFilter: item => !!item.is_trinket,
    subcatMode: "static",
    subcats: [
      { label: "Mantel",   filter: item => item.type_name === "back" },
      { label: "Halsband", filter: item => item.type_name === "neck" },
      { label: "Ring",     filter: item => item.type_name === "finger" },
      { label: "Amulett",  filter: item => item.type_name === "amulet" },
      { label: "Armband",  filter: item => item.type_name === "bracelet" },
      { label: "Ornament", filter: item => item.type_name === "trinket" },
    ],
    columns: "trinket",
    hasStrengthFilter: false,
  },
  {
    key: "consumable",
    label: "Mixturer",
    file: "consumables",
    baseFilter: () => true,
    subcatMode: "static",
    noAllTab: true,
    subcats: [
      { label: "Vanliga",            filter: item => !item.for_live_battle },
      { label: "Livestridsmixturer", filter: item => !!item.for_live_battle },
    ],
    columns: "generic",
    hasStrengthFilter: false,
  },
  {
    key: "enchant",
    label: "Besvärjelser",
    file: "enchants",
    baseFilter: () => true,
    subcatMode: null,
    columns: "enchant",
    hasStrengthFilter: false,
  },
  {
    key: "material",
    label: "Material",
    file: "materials",
    baseFilter: () => true,
    subcatMode: null,
    columns: "material",
    hasStrengthFilter: false,
    hasGradeFilter: false,
  },
];
