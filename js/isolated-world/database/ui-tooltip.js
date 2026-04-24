// Generic tooltip helper used by the database UI. Attaches mouseover/move/out
// listeners to triggerEl so hovering any descendant matching triggerSelector
// displays showFn(target) inside a shared tooltip element with id=`id`.
// showFn returns either { html } or { text } for the tooltip content, or null
// to suppress display. Positioning follows the cursor and clamps to viewport.

function itemsBindTooltip(triggerEl, id, triggerSelector, showFn) {
  let tipEl = document.getElementById(id);
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = id;
    document.body.appendChild(tipEl);
  }
  triggerEl.addEventListener("mouseover", e => {
    const target = e.target.closest(triggerSelector);
    if (!target) return;
    const content = showFn(target);
    if (content === null) return;
    if (content.html !== undefined) tipEl.innerHTML  = content.html;
    else                            tipEl.textContent = content.text;
    tipEl.style.display = "block";
  });
  triggerEl.addEventListener("mouseout", e => {
    const target = e.target.closest(triggerSelector);
    if (target && !target.contains(e.relatedTarget)) tipEl.style.display = "none";
  });
  triggerEl.addEventListener("mousemove", e => {
    if (tipEl.style.display === "none") return;
    const tipH = tipEl.offsetHeight;
    const margin = 8;
    let top  = e.clientY + 14;
    const left = e.clientX + 14;
    const maxTop = window.innerHeight - tipH - margin;
    if (top > maxTop) top = maxTop;
    if (top < margin) top = margin;
    tipEl.style.top  = top  + "px";
    tipEl.style.left = left + "px";
  });
}
