// Feature: hide sidebar section wrappers that have no links.
// Uses .ext-wrapper-empty-auto (CSS-owned) so the merge feature's own wrapper-hide
// (.ext-wrapper-empty-merge) can coexist without inline-style collisions.

function _hideEmptyApply() {
  for (const ul of document.querySelectorAll('.sidebar [data-slot="collapsible-content"] > div > ul')) {
    const wrapper = ul.closest('.sidebar nav > div');
    if (!wrapper) continue;
    const hasLinks = !!ul.querySelector(':scope > li');
    wrapper.classList.toggle("ext-wrapper-empty-auto", !hasLinks);
  }
}

function _hideEmptyRemove() {
  document.querySelectorAll(".ext-wrapper-empty-auto").forEach(el => {
    el.classList.remove("ext-wrapper-empty-auto");
  });
}

registerNavFeature({
  name:    "hide-empty-sections",
  enabled: s => !!s["hide-empty-sections"],
  apply:   _hideEmptyApply,
  remove:  _hideEmptyRemove,
});
