// Sidebar feature: appends start time (HH:MM) to tournament/dailybattle sub-items.
// Data flows from main-world store-bridge → ext:tournament-data event, sourced from
// userStore.avatar.active_tournaments (which is what Vue renders the sub-items from).

var _tournamentStartTimes = new Map(); // numeric id → "HH:MM"

window.addEventListener("ext:tournament-data", e => {
  _tournamentStartTimes.clear();
  for (const t of (e.detail?.tournaments || [])) {
    if (t?.id != null && t?.start_at) {
      const time = utcDateTimeToSwedishTime(t.start_at);
      if (time) _tournamentStartTimes.set(t.id, time);
    }
  }
  if (_navSettings && _navSettings["tournament-show-start-times"]) _applyTournamentTimes();
});

function _applyTournamentTimes() {
  const subItems = document.querySelectorAll(
    '.sidebar a[href^="/game/arena/dailybattles/"], .sidebar a[href^="/game/arena/tournaments/"]'
  );
  for (const a of subItems) {
    const m = a.getAttribute("href").match(/\/(\d+)$/);
    if (!m) continue;
    const time = _tournamentStartTimes.get(Number(m[1]));
    const labelSpan = a.querySelector(".sidebar-label");
    const inner = labelSpan?.parentElement;
    if (!inner) continue;
    let span = inner.querySelector(".ext-tournament-time");
    if (!time || a.querySelector(".fa-spin")) { span?.remove(); continue; }
    if (!span) {
      span = document.createElement("span");
      span.className = "ext-tournament-time";
      inner.appendChild(span);
    }
    if (span.textContent !== time) span.textContent = time;
  }
}

function _removeTournamentTimes() {
  for (const el of document.querySelectorAll(".ext-tournament-time")) el.remove();
}

registerNavFeature({
  name:    "tournament-show-start-times",
  enabled: s => !!s["tournament-show-start-times"],
  apply:   _applyTournamentTimes,
  remove:  _removeTournamentTimes,
});
