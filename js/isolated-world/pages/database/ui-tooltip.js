// Generic tooltip helper used by the database UI. Attaches mouseover/move/out
// listeners to triggerEl so hovering any descendant matching triggerSelector
// displays showFn(target) inside a shared tooltip element with id=`id`.
// showFn returns either { html } or { text } for the tooltip content, or null
// to suppress display. Positioning follows the cursor and clamps to viewport.

function itemsBindTooltip(triggerEl, id, triggerSelector, showFn, signal) {
  let tipEl = document.getElementById(id);
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = id;
    document.body.appendChild(tipEl);
  }
  triggerEl.addEventListener("mouseover", e => {
    const target = e.target.closest(triggerSelector);
    if (!target) return;
    
    // For item tooltips, we can track the ID to prevent flickering
    const itemId = target.dataset.itemTooltipId;
    if (itemId && tipEl.dataset.itemId === itemId && tipEl.style.display === "block") return;

    const content = showFn(target);
    if (content === null) return;

    if (tipEl.style.display === "block" && itemId && tipEl.dataset.itemId !== itemId) {
      tipEl.style.minHeight = tipEl.offsetHeight + "px";
    }

    if (content.html !== undefined) tipEl.innerHTML  = content.html;
    else                            tipEl.textContent = content.text;
    
    if (itemId) {
      tipEl.dataset.itemId = itemId;
      const img = tipEl.querySelector("img");
      if (img) {
        img.onload = () => { tipEl.style.minHeight = ""; };
        setTimeout(() => { tipEl.style.minHeight = ""; }, 500);
      } else {
        tipEl.style.minHeight = "";
      }
    } else {
      tipEl.dataset.itemId = "";
      tipEl.style.minHeight = "";
    }

    tipEl.style.display = "block";
  }, { signal });
  triggerEl.addEventListener("mouseout", e => {
    const target = e.target.closest(triggerSelector);
    if (target && !target.contains(e.relatedTarget)) {
      tipEl.style.display = "none";
      tipEl.dataset.itemId = "";
      tipEl.style.minHeight = "";
    }
  }, { signal });
  let lastX = 0, lastY = 0;
  triggerEl.addEventListener("mousemove", e => {
    lastX = e.clientX;
    lastY = e.clientY;
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
  }, { signal });

  // Hide on scroll to prevent ghosting when elements move away from the cursor.
  // When scroll stops, we check if the mouse is still over a trigger to re-show.
  let scrollTimeout = null;
  window.addEventListener("scroll", () => {
    tipEl.style.display = "none";
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const el = document.elementFromPoint(lastX, lastY);
      const target = el?.closest(triggerSelector);
      if (target && triggerEl.contains(target)) {
        const content = showFn(target);
        if (content === null) return;
        if (content.html !== undefined) tipEl.innerHTML  = content.html;
        else                            tipEl.textContent = content.text;
        tipEl.style.display = "block";
        // Position it immediately
        const tipH = tipEl.offsetHeight;
        let top = lastY + 14;
        const maxTop = window.innerHeight - tipH - 8;
        if (top > maxTop) top = maxTop;
        tipEl.style.top = top + "px";
        tipEl.style.left = (lastX + 14) + "px";
      }
    }, 100);
  }, { capture: true, passive: true, signal });
}
