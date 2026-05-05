// Sidebar feature: appends start time (HH:MM) to the "Mitt lag" sub-item under
// Rankade lagspel when a matched battle is scheduled. Data source is
// /api/ranked/battles/{id}; the link's href contains the id.

var _rankedBattleStartTimes = new Map(); // id (number) → "HH:MM"
var _rankedBattleInflight   = new Set(); // ids currently being fetched

function _ensureRankedBattleData(id) {
  if (_rankedBattleStartTimes.has(id)) return;
  if (_rankedBattleInflight.has(id))   return;

  // Cache hit from a prior fetch (e.g. user already visited the page)?
  const cached = apiGetCache(`/api/ranked/battles/${id}`);
  if (cached?.plays_at) {
    const t = utcDateTimeToSwedishTime(cached.plays_at);
    if (t) _rankedBattleStartTimes.set(id, t);
    return;
  }

  _rankedBattleInflight.add(id);
  // gameRequest dispatches ext:api on success → API handler below populates the map.
  gameRequest(`/api/ranked/battles/${id}`)
    .catch(() => {})
    .finally(() => _rankedBattleInflight.delete(id));
}

function _applyRankedBattleTime() {
  const links = document.querySelectorAll(
    '.sidebar a[href^="/game/arena/rankedbattles/battle/"]'
  );
  for (const a of links) {
    const m = a.getAttribute("href").match(/\/battle\/(\d+)$/);
    if (!m) continue;
    const id   = Number(m[1]);
    const time = _rankedBattleStartTimes.get(id);

    const labelSpan = a.querySelector(".sidebar-label");
    const inner = labelSpan?.parentElement;
    if (!inner) continue;

    let span = inner.querySelector(".ext-tournament-time");
    if (!time) {
      span?.remove();
      _ensureRankedBattleData(id);
      continue;
    }
    if (!span) {
      span = document.createElement("span");
      span.className = "ext-tournament-time";
      inner.appendChild(span);
    }
    if (span.textContent !== time) span.textContent = time;
  }
}

function _removeRankedBattleTime() {
  // Scope by parent link — .ext-tournament-time is also used by the tournament feature.
  for (const span of document.querySelectorAll(
    '.sidebar a[href^="/game/arena/rankedbattles/battle/"] .ext-tournament-time'
  )) span.remove();
}

apiRegisterHandler(/\/api\/ranked\/battles\/\d+(\?|$)/, (url, data) => {
  const m = url.match(/\/api\/ranked\/battles\/(\d+)/);
  if (!m || !data?.plays_at) return;
  const id = Number(m[1]);
  const t  = utcDateTimeToSwedishTime(data.plays_at);
  if (!t) return;
  _rankedBattleStartTimes.set(id, t);
  if (_navSettings && _navSettings["ranked-battle-show-start-time"]) {
    _applyRankedBattleTime();
  }
});

registerNavFeature({
  name:    "ranked-battle-show-start-time",
  enabled: s => !!s["ranked-battle-show-start-time"],
  apply:   _applyRankedBattleTime,
  remove:  _removeRankedBattleTime,
});
