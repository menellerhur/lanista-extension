// Feature: replace "gemenskap" clan/association link (with sub-links) with a single
// direct link to the user's configured tab. Original is hidden via .ext-simplified-orig.

const _simplifyMirrored = new WeakSet();

function _simplifyFindOrigLink(section) {
  for (const a of section.querySelectorAll('a[href*="/game/clans/"], a[href*="/game/associations/"]')) {
    if (/\/game\/(clans|associations)\/\d+$/.test(a.getAttribute("href"))) return a;
  }
  return null;
}

function _simplifyApply() {
  const section = findNavSection("gemenskap");
  if (!section) return;

  const origLink = _simplifyFindOrigLink(section);
  // No clan/association on current gladiator — tear down any leftover clone from a
  // previous gladiator that was a member.
  if (!origLink) {
    _simplifyRemove();
    return;
  }

  const origLi = origLink.closest("li");
  if (!origLi) return;
  origLi.classList.add("ext-simplified-orig");

  // Guard: if our clone exists AND its target matches current settings, nothing to do.
  const existing = section.querySelector(".ext-simplified-gemenskap");
  const match    = origLink.getAttribute("href").match(/\/game\/(clans|associations)\/(\d+)$/);
  if (!match) return;

  const type   = match[1];
  const id     = match[2];
  const tab    = _navSettings["community-link-tab"] || "info";
  const target = `/game/${type}/${id}/${tab}`;
  const label  = type === "clans" ? "Min klan" : "Min sammanslutning";

  if (existing) {
    const a = existing.querySelector("a");
    // Rebuild if target URL changed OR if Vue re-rendered origLink (our mirror observer is now stale).
    const hrefMatches    = a?.getAttribute("href") === target;
    const origStillBound = a?._extOrigLink === origLink;
    if (hrefMatches && origStillBound) return;
    a?._extActiveObs?.disconnect();
    if (a) _simplifyMirrored.delete(a);
    existing.remove();
  }

  const newLi = origLi.cloneNode(true);
  newLi.classList.remove("ext-simplified-orig");
  newLi.classList.add("ext-simplified-gemenskap");

  newLi.querySelector("ul")?.remove();
  const labelSpan = newLi.querySelector(".sidebar-label");
  if (labelSpan) labelSpan.textContent = label;

  const newA = newLi.querySelector("a");
  if (newA) {
    newA.setAttribute("href", target);
    newA.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      extRouterPush(target);
    });
  }

  origLi.parentElement.insertBefore(newLi, origLi.nextSibling);

  // Mirror active classes from Vue-managed origLink to newA.
  if (newA && !_simplifyMirrored.has(newA)) {
    _simplifyMirrored.add(newA);
    const syncActive = () => {
      const active = origLink.classList.contains("router-link-active");
      const exact  = origLink.classList.contains("router-link-exact-active");
      newA.classList.toggle("router-link-active", active);
      newA.classList.toggle("router-link-exact-active", exact);
      // Game adds "not-active" on parent links when on a sub-page — strip for our flat link.
      if (active) newA.classList.remove("not-active");
    };
    syncActive();
    const obs = new MutationObserver(syncActive);
    obs.observe(origLink, { attributes: true, attributeFilter: ["class"] });
    newA._extActiveObs = obs;
    newA._extOrigLink  = origLink;
  }
}

function _simplifyRemove() {
  document.querySelectorAll(".ext-simplified-gemenskap").forEach(el => {
    el.querySelector("a")?._extActiveObs?.disconnect();
    el.remove();
  });
  document.querySelectorAll(".ext-simplified-orig").forEach(el => {
    el.classList.remove("ext-simplified-orig");
  });
}

registerNavFeature({
  name:    "simplify-community-link",
  enabled: s => !!s["simplify-community-link"],
  apply:   _simplifyApply,
  remove:  _simplifyRemove,
  // Handle tab change (enabled stayed true, but target URL differs).
  onSettingsChange: (next, prev) => {
    if (next["community-link-tab"] !== prev["community-link-tab"]) {
      _simplifyRemove();
      _simplifyApply();
    }
  },
});
