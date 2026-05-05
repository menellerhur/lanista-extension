// Global mutable state for the Planera Gladiator page.
// Must be var so sibling files can read/write pgState without import.

var pgState = {
  profiles: [],
  activeProfileId: null,
  activeDraft: null,   // Deep copy of the active profile used for editing
  currentStep: 0,      // 0=Profil 1=Utrustning 2=Egenskaper
  dirty: false,
  currentEquipGrade: null,
  currentStatsGrade: null,
  preferredGrade: null,
  staticStatsEditing: false, 
  undoStack: [],
  redoStack: [],
  allWeapons: [],
  allArmors: [],
  allTrinkets: [],
  allConsumables: [],
  allEnchants: [],
  hideLegendEquip: true,
  hideUnobtainableEquip: true,
  ageData: {}, // raceId -> age data object
};
