// Parses the game's .ladder-full DOM into a neutral bracket data structure —
// columns of matches, each with two slots, zero or more battle reports, and
// optional score/label strings. Bronze/third-place matches are split out so
// they can be rendered in their own section below the main bracket.
// Depends on: api-handler.js (apiGetCacheByPattern), tournament/main.js (_T_GLAD_H)

function _getOwnAvatarIds() {
  const me      = apiGetCacheByPattern(/\/api\/users\/me(\?|$)/);
  const avatars = apiGetCacheByPattern(/\/api\/users\/me\/avatars(\?|$)/);
  const list    = (Array.isArray(avatars) ? avatars : null) || me?.avatars || [];
  return new Set(list.map(a => String(a.id)));
}

function _parseSlot(half) {
  const p = half.querySelector('p');
  if (!p || p.textContent.trim() === 'Tom') return { isTom: true };

  const ownIds = _getOwnAvatarIds();
  const gladiators = [...half.querySelectorAll('a[href^="/game/avatar/"], a[href^="/game/arena/beasts/"]')].map(a => {
    const href  = a.getAttribute('href');
    const small = a.querySelector('small');
    const id    = href?.match(/\/(\d+)$/)?.[1];
    return {
      name:   small ? (a.childNodes[0]?.textContent || '').trim() : a.textContent.trim(),
      level:  small ? small.textContent.replace(/[()]/g, '').trim() : '',
      href,
      isBeast: href.startsWith('/game/arena/beasts/'),
      isOwn:   id ? ownIds.has(id) : false,
    };
  });

  return {
    isTom: false,
    label: p.textContent.trim(), // "Lag X"
    gladiators,
    isLoser: p.classList.contains('line-through'),
  };
}

function _parseCard(card) {
  const halves = [...card.children].filter(el => el.classList.contains('w-1/2'));
  if (halves.length < 2) return null;

  // Battle report links — sort by strid so multi-report matches list chronologically
  const reports = [...card.querySelectorAll('a[href*="/game/arena/battles/"]')].map(a => {
    const stridSpan = a.querySelector('span');
    const m = (stridSpan?.textContent || '').match(/\d+/);
    return { href: a.getAttribute('href'), strid: m ? parseInt(m[0]) : 0 };
  }).sort((a, b) => a.strid - b.strid);

  // Score line ("1 - 2") — only in team matches
  const scoreEl = [...card.children].find(el =>
    el.tagName === 'P' && el.classList.contains('w-full') && el.classList.contains('font-semibold')
  );

  // "Final" / "Tredjeplats" label — only in the last column
  const cardLabelEl = [...card.children].find(el =>
    el.tagName === 'P' && el.classList.contains('font-serif')
  );

  return {
    s1: _parseSlot(halves[0]),
    s2: _parseSlot(halves[1]),
    reports,
    score: scoreEl?.textContent.trim() || null,
    cardLabel: cardLabelEl?.textContent.trim() || null,
  };
}

function _parseColumns() {
  const ladderFull = document.querySelector('.ladder-full');
  if (!ladderFull) return null;

  const cols = [];
  for (const colEl of ladderFull.children) {
    if (!colEl.classList.contains('flex-col')) continue;
    const matches = [];
    for (const card of colEl.children) {
      if (card.classList.contains('hidden')) continue;
      const parsed = _parseCard(card);
      if (parsed) matches.push(parsed);
    }
    if (matches.length > 0) cols.push(matches);
  }
  if (cols.length < 2) return null;

  // Extract bronze/third-place matches identified by their "Tredjeplats" font-serif label
  const bronzeMatches = [];
  for (const col of cols) {
    for (let i = col.length - 1; i >= 0; i--) {
      if (col[i].cardLabel?.toLowerCase().includes('tredjeplats')) {
        bronzeMatches.unshift(...col.splice(i, 1));
      }
    }
  }
  for (let i = cols.length - 1; i >= 0; i--) {
    if (cols[i].length === 0) cols.splice(i, 1);
  }

  return cols.length >= 2 ? { cols, bronzeMatches } : null;
}

// Compute the slot height unit based on the max number of gladiators
// across all matches. Larger teams → taller slots.
function _computeUnit(cols) {
  let maxGlads = 0;

  for (const col of cols) {
    for (const m of col) {
      if (!m.s1.isTom) maxGlads = Math.max(maxGlads, m.s1.gladiators.length);
      if (!m.s2.isTom) maxGlads = Math.max(maxGlads, m.s2.gladiators.length);
    }
  }
  if (maxGlads <= 1) return 64; // Solo: 2×(18px min-height + 6px padding) + borders + divider + gap
  const slotH = maxGlads * _T_GLAD_H + 6;
  return slotH * 2 + 19; // ×2 slots + 2px borders + 1px divider + 16px gap
}
