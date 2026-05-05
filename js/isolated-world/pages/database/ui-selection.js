// Selection count + filter-mode toggle (all / selected / unselected).
// The count pill shows how many rows the user has marked and cycles through
// filter modes when clicked; icons communicate the current mode.
// Depends on: state.js (itemsSelectedIds, itemsFilterSelection), common/icons.js

const _SELECTION_ICONS = {
  all:        icon("lines",           { size: 11, style: "display:inline;vertical-align:middle" }),
  selected:   icon("check",           { size: 11, style: "display:inline;vertical-align:middle" }),
  unselected: icon("eye-off-feather", { size: 11, style: "display:inline;vertical-align:middle" }),
};

function itemsUpdateSelectionUI() {
  const wrap    = document.getElementById("ext-items-selection-wrap");
  const countEl = document.getElementById("ext-items-selection-count");
  if (!wrap) return;
  const count = itemsSelectedIds.size;
  wrap.style.visibility = count > 0 ? "visible" : "hidden";
  if (countEl) {
    countEl.innerHTML = `<span style="position:relative">${_SELECTION_ICONS[itemsFilterSelection]}&nbsp;${count} markerade</span>`;
  }
}
