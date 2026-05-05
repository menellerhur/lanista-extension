// Persistence for Planera Gladiator profiles via chrome.storage.local.

const PG_STORAGE_KEY = "plan_gladiator_profiles";

async function pgLoadProfiles() {
  try {
    const stored = await chrome.storage.local.get(PG_STORAGE_KEY);
    const data = stored[PG_STORAGE_KEY];
    if (data && Array.isArray(data.profiles)) {
      pgState.profiles = data.profiles;
    } else {
      pgState.profiles = [];
    }
  } catch {
    pgState.profiles = [];
  }
  // Defensively initialize sync fields on legacy profiles so callers can
  // assume they exist as objects.
  for (const p of pgState.profiles) {
    p.syncedData ||= {};
    p.syncLocked ||= {};
  }
}

async function pgSaveProfiles() {
  try {
    await chrome.storage.local.set({
      [PG_STORAGE_KEY]: { profiles: pgState.profiles }
    });
    pgState.dirty = false;
    return true;
  } catch (e) {
    console.error("Lanista Extension: Failed to save gladiator plans", e);
    return false;
  }
}

function pgCreateDraft(profileId) {
  const profile = pgState.profiles.find(p => p.id === profileId);
  if (!profile) {
    pgState.activeDraft = null;
    return;
  }
  // Deep clone to ensure draft is isolated
  pgState.activeDraft = JSON.parse(JSON.stringify(profile));
  
  // Initialize history
  pgState.undoStack = [JSON.stringify(pgState.activeDraft)];
  pgState.redoStack = [];
}

function pgDiscardDraft() {
  pgState.activeDraft = null;
  pgState.undoStack = [];
  pgState.redoStack = [];
}

async function pgCommitDraft() {
  if (!pgState.activeDraft) return false;

  const draft = pgState.activeDraft;

  // Final check: Ensure all ages are valid for the race
  pgSanitizeAgesForRace(draft);

  // --- Pruning Logic ---

  // 1. Prune redundant static stats (those that match inheritance or have no values)
  if (draft.staticStats) {
    const grades = Object.keys(draft.staticStats).map(Number).sort((a, b) => a - b);
    for (const g of grades) {
      const stats = draft.staticStats[String(g)];
      const prevEffective = pgGetEffectiveStaticStats(draft, g - 1);
      const hasValues = Object.values(stats).some(v => v !== 0);
      const isRedundant = pgAreStatsEqual(stats, prevEffective);

      if (!hasValues || isRedundant) {
        delete draft.staticStats[String(g)];
      }
    }
  }

  // 2. Prune redundant ages (those that don't increase age)
  if (draft.ages) {
    const sortedGrades = pgGetStatsGrades(draft).sort((a, b) => a - b);
    let currentEffectiveAge = 0;
    for (const g of sortedGrades) {
      const gStr = String(g);
      const explicit = draft.ages[gStr];
      if (explicit !== undefined) {
        if (explicit <= currentEffectiveAge) {
          delete draft.ages[gStr];
        } else {
          currentEffectiveAge = explicit;
        }
      }
    }
  }

  // Update original profiles list
  const originalIndex = pgState.profiles.findIndex(p => p.id === draft.id);
  if (originalIndex !== -1) {
    pgState.profiles[originalIndex] = draft;
  } else {
    pgState.profiles.push(draft);
  }

  const success = await pgSaveProfiles();
  // Refresh the draft so it matches the newly saved state
  pgCreateDraft(draft.id);
  return success;
}

function pgPushHistory() {
  if (!pgState.activeDraft) return;
  const snapshot = JSON.stringify(pgState.activeDraft);
  
  // Don't push if it's identical to the last one
  if (pgState.undoStack.length > 0 && pgState.undoStack[pgState.undoStack.length - 1] === snapshot) {
    return;
  }
  
  pgState.undoStack.push(snapshot);
  pgState.redoStack = []; // Clear redo on new action
  
  if (pgState.undoStack.length > 50) pgState.undoStack.shift();
}

function pgUndo() {
  if (pgState.undoStack.length <= 1) return false;
  
  const current = pgState.undoStack.pop();
  pgState.redoStack.push(current);
  
  const previous = pgState.undoStack[pgState.undoStack.length - 1];
  pgState.activeDraft = JSON.parse(previous);
  return true;
}

function pgRedo() {
  if (pgState.redoStack.length === 0) return false;
  
  const next = pgState.redoStack.pop();
  pgState.undoStack.push(next);
  
  pgState.activeDraft = JSON.parse(next);
  return true;
}

function pgIsStateDirty() {
  if (pgState.dirty) return true;
  if (!pgState.activeDraft) return false;

  const original = pgState.profiles.find(p => p.id === pgState.activeDraft.id);
  if (!original) return true; // New profile (not yet in profiles list)

  // Use a deep comparison that handles potential structural differences 
  // like missing vs empty objects.
  return !pgAreProfilesEqual(pgState.activeDraft, original);
}

function pgAreProfilesEqual(p1, p2) {
  if (!p1 || !p2) return p1 === p2;
  
  // Basic fields
  if (p1.name !== p2.name) return false;
  if (p1.raceId !== p2.raceId) return false;
  if (p1.weaponHand !== p2.weaponHand) return false;
  if (p1.weaponSkillType !== p2.weaponSkillType) return false;
  if (p1.reputation !== p2.reputation) return false;

  // Complex objects
  const keys = ["equipment", "stats", "gradeModes", "staticStats", "ages", "syncedData", "syncLocked"];
  for (const k of keys) {
    const v1 = p1[k] || {};
    const v2 = p2[k] || {};
    if (JSON.stringify(v1) !== JSON.stringify(v2)) {
      if (k === "stats" || k === "staticStats") {
         const g1 = Object.keys(v1);
         const g2 = Object.keys(v2);
         if (g1.length !== g2.length) return false;
         for (const g of g1) {
           if (!pgAreStatsEqual(v1[g], v2[g])) return false;
         }
      } else {
        if (JSON.stringify(v1) !== JSON.stringify(v2)) return false;
      }
    }
  }

  return true;
}

function pgCreateProfile(name) {
  const id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const profile = {
    id,
    name,
    raceId: null,
    weaponHand: null,
    weaponSkillType: null,
    reputation: null,
    equipment: {},
    stats: {},
    gradeModes: {},
    staticStats: {},
    ages: {},
    syncedData: {},
    syncLocked: {},
  };
  pgState.profiles.push(profile);
  pgState.dirty = true;
  return profile;
}

function pgDeleteProfile(id) {
  pgState.profiles = pgState.profiles.filter(p => p.id !== id);
  if (pgState.activeProfileId === id) {
    pgState.activeProfileId = null;
    pgState.activeDraft = null;
    pgState.currentEquipGrade = null;
    pgState.currentStatsGrade = null;
    pgState.preferredGrade = null;
  }
  pgState.dirty = true;
}

function pgRenameProfile(id, name) {
  const p = pgState.profiles.find(p => p.id === id);
  if (p) {
    p.name = name;
    pgState.dirty = true;
    if (pgState.activeDraft?.id === id) {
      pgState.activeDraft.name = name;
    }
  }
}

function pgCloneProfile(sourceId, newName) {
  const source = pgState.profiles.find(p => p.id === sourceId);
  if (!source) return null;

  const id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const clone = JSON.parse(JSON.stringify(source));
  clone.id = id;
  clone.name = newName;

  pgState.profiles.push(clone);
  pgState.dirty = true;
  return clone;
}

function pgIsNameTaken(name, excludeId = null) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return pgState.profiles.some(p => p.id !== excludeId && p.name.trim().toLowerCase() === normalized);
}

function pgGetActiveProfile() {
  // Always prefer the draft if it exists
  if (pgState.activeDraft) return pgState.activeDraft;
  return pgState.profiles.find(p => p.id === pgState.activeProfileId) || null;
}

// True only when the profile exists in the main profiles list (is persisted) 
// and has basic settings.
function pgIsActiveProfileGrundvalSaved() {
  if (!pgState.activeProfileId) return false;
  const saved = pgState.profiles.find(p => p.id === pgState.activeProfileId);
  if (!saved) return false;
  return saved.raceId != null && saved.weaponHand != null && saved.weaponSkillType != null;
}
