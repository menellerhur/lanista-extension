// Unsaved Changes Modal for Planera Gladiator.
// Shows when navigating away from a dirty step.

function pgShowUnsavedChangesModal(targetStep) {
  const backdrop = document.createElement("div");
  backdrop.className = "pg-modal-backdrop";
  backdrop.id = "pg-unsaved-modal-backdrop";

  backdrop.innerHTML = `
    <div class="pg-modal-card pg-unsaved-modal-card">
      <div class="pg-modal-header">
        <h3 class="pg-modal-title">Osparade ändringar</h3>
        <button type="button" class="pg-modal-close" id="pg-unsaved-modal-close" title="Stäng">${icon("x", { size: 18 })}</button>
      </div>
      <div class="pg-modal-body">
        <p class="pg-unsaved-modal-text">
          Du har gjort ändringar som inte har sparats än. Vad vill du göra?
        </p>
      </div>
      <div class="pg-modal-footer pg-unsaved-modal-footer">
        <button type="button" class="pg-btn pg-btn-ghost" id="pg-unsaved-modal-cancel">Stanna kvar</button>
        <button type="button" class="pg-btn pg-btn-secondary" id="pg-unsaved-modal-discard">Släng ändringar</button>
        <button type="button" class="pg-btn pg-btn-primary" id="pg-unsaved-modal-save">Spara & gå vidare</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", keyHandler);
  };

  const keyHandler = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", keyHandler);

  backdrop.addEventListener("click", e => {
    if (e.target === backdrop) close();
  });

  document.getElementById("pg-unsaved-modal-close").addEventListener("click", close);
  document.getElementById("pg-unsaved-modal-cancel").addEventListener("click", close);

  document.getElementById("pg-unsaved-modal-discard").addEventListener("click", () => {
    pgDiscardDraft();
    if (pgState.activeProfileId) {
      pgCreateDraft(pgState.activeProfileId);
    }
    pgState.dirty = false;
    close();
    pgGoToStep(targetStep, true); // Pass true to skip the dirty check
  });

  document.getElementById("pg-unsaved-modal-save").addEventListener("click", async () => {
    await pgCommitDraft();
    close();
    pgGoToStep(targetStep, true); // Pass true to skip the dirty check
  });
}
