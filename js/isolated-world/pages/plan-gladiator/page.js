// Planera Gladiator page entry point.
// Depends on: state.js, storage.js, data.js, stats.js, dropdown.js,
//             breadcrumb.js, step-profile.js,
//             step-utrustning.js, step-egenskaper.js, sync-modal.js,
//             common/page-navigation.js (getExtensionLink, getDatabaseLink, extRouterPush),
//             common/api-handler.js (apiRegisterHandler, apiGetCacheByPattern)

async function showPlanGladiatorPage() {
  await ensureExtConfig();
  const existing = document.getElementById("ext-panel");
  if (existing) {
    if (existing.dataset.extPage === "plan-gladiator") return;
    existing.remove();
    const c = document.querySelector(".content");
    if (c) c.style.display = "";
    getExtensionLink()?.classList.remove("sidebar-nav-link-active");
    getDatabaseLink()?.classList.remove("sidebar-nav-link-active");
    getNotificationsLink()?.classList.remove("sidebar-nav-link-active");
  }

  const content = document.querySelector(".content");
  if (!content) return;

  document.querySelectorAll(".sidebar-nav-link-active").forEach(el => el.classList.remove("sidebar-nav-link-active"));
  document.querySelectorAll(".router-link-active").forEach(el => el.classList.remove("router-link-active"));
  document.querySelectorAll(".router-link-exact-active").forEach(el => el.classList.remove("router-link-exact-active"));
  getPlanGladiatorLink()?.classList.add("sidebar-nav-link-active");

  if (window.location.hash !== "#planera-gladiator") {
    extRouterPush("/game/arena#planera-gladiator");
  }

  document.title = "Planera gladiator | Lanista";

  await pgLoadProfiles();
  if (pgState.activeProfileId) {
    pgCreateDraft(pgState.activeProfileId);
  }

  if (pgState.allWeapons.length === 0) {
    await pgLoadAllItems();
  }

  const panel = document.createElement("div");
  panel.id = "ext-panel";
  panel.dataset.extPage = "plan-gladiator";
  panel.className = content.className;

  panel.innerHTML = pgBuildPageHtml();
  content.style.display = "none";
  content.parentNode.insertBefore(panel, content);

  pgBindPage(panel);
  pgRenderCurrentStep(panel);
}

function pgBuildPageHtml() {
  return `
    <div id="pg-planner-card" data-slot="card" class="bg-card text-card-foreground flex flex-col gap-0 border border-border shadow-xl surface-card relative rounded-xl p-4 lg:p-5">
      <button type="button" class="pg-btn pg-btn-secondary pg-sync-btn" id="pg-sync-btn" hidden>
        <span class="pg-sync-icon-text">⇅</span> <span class="pg-sync-btn-name"></span>
      </button>
      <button type="button" class="pg-btn pg-btn-primary pg-save-btn" id="pg-save-btn" disabled title="Inga ändringar att spara.">
        ${icon("save", { size: 14, strokeWidth: 1.5 })} Spara
      </button>
      <div class="pg-header">
        <h2 class="block font-serif uppercase text-foreground">Planera gladiator</h2>
      </div>
      <div id="pg-bc-wrap">
        ${pgBreadcrumbHtml()}
      </div>
      <div class="pg-step-content" id="pg-step-content"></div>
      <div id="pg-nav-wrap">
        ${pgNavButtonsHtml()}
      </div>
    </div>`;
}

function pgBindPage(panel) {
  // Save button
  panel.querySelector("#pg-save-btn").addEventListener("click", async () => {
    const profile = pgGetActiveProfile();
    if (!profile) return;

    await pgCommitDraft();
    pgRefreshPage();
  });

  // Sync button — opens the modal; visibility is driven by cache state.
  panel.querySelector("#pg-sync-btn").addEventListener("click", pgOpenSyncModal);
  pgUpdateSyncButtonState();

  // Breadcrumb uses event delegation — bind once on the panel so re-renders don't stack listeners
  pgBindBreadcrumb(panel);
}

// Read the active gladiator straight from the api-handler cache. The game
// fetches /api/users/me on load and on every gladiator switch so the cache is
// effectively always fresh.
function pgSyncGetCachedAvatar() {
  return apiGetCacheByPattern(/\/api\/users\/me$/)?.avatar ?? null;
}

function pgUpdateSyncButtonState() {
  const btn = document.getElementById("pg-sync-btn");
  if (!btn) return;
  const cached = pgSyncGetCachedAvatar();
  if (!cached) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  const nameEl = btn.querySelector(".pg-sync-btn-name");
  if (nameEl) nameEl.textContent = cached.name || "Importera";
  btn.title = `Importera från ${cached.name || "aktiv gladiator"}`;
}

// Refresh the sync button whenever the cache changes or the active gladiator
// switches. ext:active-avatar covers the rare case where the game switches
// without going through /api/users/me.
apiRegisterHandler(/\/api\/users\/me$/, () => pgUpdateSyncButtonState());
window.addEventListener("ext:active-avatar", () => pgUpdateSyncButtonState());

function pgRenderCurrentStep(panel) {
  panel.dataset.pgStep = pgState.currentStep;
  const stepContent = panel.querySelector("#pg-step-content");
  if (!stepContent) return;

  switch (pgState.currentStep) {
    case 0: pgRenderStepProfile(stepContent); break;
    case 1: pgRenderStepUtrustning(stepContent); break;
    case 2: pgRenderStepEgenskaper(stepContent); break;
  }

  // Update breadcrumb HTML (delegation handler already bound once in pgBindPage)
  const bcWrap = panel.querySelector("#pg-bc-wrap");
  if (bcWrap) bcWrap.innerHTML = pgBreadcrumbHtml();

  // Update nav buttons (new DOM nodes — bind fresh listeners)
  const navWrap = panel.querySelector("#pg-nav-wrap");
  if (navWrap) {
    navWrap.innerHTML = pgNavButtonsHtml();
    navWrap.querySelector("#pg-nav-prev")?.addEventListener("click", () => pgGoToStep(pgState.currentStep - 1));
    navWrap.querySelector("#pg-nav-next")?.addEventListener("click", () => pgGoToStep(pgState.currentStep + 1));
  }

  pgUpdateSaveButtonState(pgGetActiveProfile());
  pgUpdateSyncButtonState();
}

function pgGoToStep(step, skipDirtyCheck = false) {
  if (step < 0 || step >= PG_STEPS.length) return;
  if (step > 0 && !pgIsActiveProfileGrundvalSaved()) return;

  const isEnteringNewStep = pgState.currentStep !== step;

  if (isEnteringNewStep) {
    pgPushHistory();
  }

  if (!skipDirtyCheck && isEnteringNewStep && pgIsStateDirty()) {
    pgShowUnsavedChangesModal(step);
    return;
  }

  pgState.currentStep = step;

  if (isEnteringNewStep) {
    const profile = pgGetActiveProfile();
    if (step === 0) { // Profil
      // No auto-selection here
    } else if (profile) {
      if (step === 1) { // Utrustning
        const grades = pgGetEquipGrades(profile);
        pgState.currentEquipGrade = pgGetBestMatchingGrade(pgState.preferredGrade, grades);
      } else if (step === 2) { // Egenskaper
        if (profile.raceId) pgLoadAgeData(profile.raceId);
        const grades = pgGetStatsGrades(profile);
        const g = pgGetBestMatchingGrade(pgState.preferredGrade, grades);
        pgState.currentStatsGrade = g;
        if (g != null) {
          pgState.staticStatsEditing = pgGradeHasStaticPoints(profile, g);
        }
      }
    }
  }

  const panel = document.getElementById("ext-panel");
  if (panel) pgRenderCurrentStep(panel);
}

function pgRefreshPage() {
  const panel = document.getElementById("ext-panel");
  if (!panel || panel.dataset.extPage !== "plan-gladiator") return;
  pgRenderCurrentStep(panel);
}

// Toggle the global Save button based on whether there are unsaved changes.
// Mirrors the navigation guard in pgGoToStep so the two cannot disagree.
function pgUpdateSaveButtonState(profile) {
  const btn = document.getElementById("pg-save-btn");
  if (!btn) return;

  btn.hidden = false;

  if (!profile) {
    btn.disabled = true;
    btn.title = "Välj eller skapa en profil först.";
    return;
  }
  const isDirty = pgIsStateDirty();
  btn.disabled = !isDirty;
  btn.title = isDirty ? "" : "Inga ändringar att spara.";
}
