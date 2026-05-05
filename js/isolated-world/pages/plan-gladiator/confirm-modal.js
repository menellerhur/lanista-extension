// Generic confirmation modal for Planera Gladiator.
// Shows a modal with a title, message, and confirm/cancel buttons.

function pgShowConfirmModal({ title, message, confirmLabel = "Ta bort", cancelLabel = "Avbryt", confirmClass = "pg-btn-danger", onConfirm }) {
  const backdrop = document.createElement("div");
  backdrop.className = "pg-modal-backdrop";
  backdrop.id = "pg-confirm-modal-backdrop";

  backdrop.innerHTML = `
    <div class="pg-modal-card pg-unsaved-modal-card">
      <div class="pg-modal-header">
        <h3 class="pg-modal-title">${title}</h3>
        <button type="button" class="pg-modal-close" id="pg-confirm-modal-close" title="Stäng">${icon("x", { size: 18 })}</button>
      </div>
      <div class="pg-modal-body">
        <p class="pg-unsaved-modal-text">
          ${message}
        </p>
      </div>
      <div class="pg-modal-footer pg-unsaved-modal-footer">
        <button type="button" class="pg-btn ${confirmClass}" id="pg-confirm-modal-ok">${confirmLabel}</button>
        <button type="button" class="pg-btn pg-btn-ghost" id="pg-confirm-modal-cancel">${cancelLabel}</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", keyHandler);
  };

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      close();
    }
    // We don't auto-confirm on Enter for destructive actions like delete
  };
  document.addEventListener("keydown", keyHandler);

  backdrop.addEventListener("click", e => {
    if (e.target === backdrop) close();
  });

  document.getElementById("pg-confirm-modal-close").addEventListener("click", close);
  document.getElementById("pg-confirm-modal-cancel").addEventListener("click", close);
  document.getElementById("pg-confirm-modal-ok").addEventListener("click", () => {
    onConfirm();
    close();
  });
}
