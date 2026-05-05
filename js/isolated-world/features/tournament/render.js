// Renders the parsed bracket data structure into DOM: gladiator rows, slots,
// cards, columns, SVG connector strips, and the full bracket root with optional
// bronze-match section. Also wires click/middle-click routing to reports and
// installs the horizontal drag-scroll UX on the bracket root.
// Depends on: common/icons.js (iconEl), common/utils.js (extRouterPush),
//             features/tournament/main.js (_T_CONN, _T_COL, _getLayoutVariant),
//             features/tournament/preview.js (_addPreviewHover),
//             features/tournament/reports-menu.js (_showReportsMenu)

function _makePreviewIcon() {
  if (_getLayoutVariant() === 'layout-1') {
    // Mirror game's v-popper eye-icon markup (visual only; hover wired separately)
    const outer = document.createElement('div');
    outer.className = 'v-popper v-popper--theme-dropdown inline';
    const inner = document.createElement('div');
    inner.className = 'inline cursor-pointer';
    const i = document.createElement('i');
    i.className = 'relative fal fa-eye ext-preview-icon-fa';
    inner.appendChild(i);
    outer.appendChild(inner);
    return outer;
  }
  return iconEl("preview", { size: 11, strokeWidth: 1.2, class: "ext-preview-icon" });
}

function _renderGladiatorRow(g) {
  const row = document.createElement('div');
  row.className = 'ext-bracket-gladiator' + (g.isBeast ? ' ext-bracket-beast' : '');

  // Invisible element that extends the hit area into the player's right padding
  const edgeR = document.createElement('div');
  edgeR.className = 'ext-bracket-gladiator-edge-r';
  row.appendChild(edgeR);

  if (g.href && !g.isBeast) {
    // Wrap icon in a div that covers full row height from left edge to name
    const iconWrap = document.createElement('div');
    iconWrap.className = 'ext-preview-icon-wrap';
    const icon = _makePreviewIcon();
    iconWrap.appendChild(icon);
    _addPreviewHover(iconWrap, g.href);
    iconWrap.addEventListener('click', e => e.stopPropagation());
    row.appendChild(iconWrap);
  } else if (g.isBeast) {
    // No eye icon for beasts, but the left zone must still block clicks
    const block = document.createElement('div');
    block.className = 'ext-bracket-beast-block';
    block.addEventListener('click', e => e.stopPropagation());
    row.appendChild(block);
  }

  const nameWrap = document.createElement('div');
  nameWrap.className = 'ext-bracket-name-wrap';

  const nameEl = g.href ? document.createElement('a') : document.createElement('span');
  nameEl.className = 'ext-bracket-name';
  if (g.href) {
    nameEl.href = g.href;
    nameEl.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      extRouterPush(g.href);
    });
  }
  const isV1 = _getLayoutVariant() === 'layout-1';

  // Inner span for text truncation — nameEl itself is full-height hit area
  const nameText = document.createElement('span');
  nameText.className = 'ext-bracket-name-text';
  nameText.textContent = (g.name || '?') + (isV1 ? ' ' : '');
  nameEl.appendChild(nameText);

  // v1: level lives inside the name link so name+level share color, strike-through and hover underline as a visual unit
  if (isV1 && g.level) {
    const lvl = document.createElement('span');
    lvl.className = 'ext-bracket-level';
    lvl.textContent = `(${g.level})`;
    nameEl.appendChild(lvl);
  }

  // v1: star also inside the link for unified hover/unit behavior
  if (isV1 && g.isOwn) {
    const star = document.createElement('i');
    star.className = 'fas fa-star ext-bracket-star';
    nameEl.appendChild(star);
  }

  nameWrap.appendChild(nameEl);
  row.appendChild(nameWrap);

  // v2: level is a row sibling at the far right
  if (!isV1 && g.level) {
    const lvl = document.createElement('span');
    lvl.className = 'ext-bracket-level';
    lvl.textContent = `(${g.level})`;
    row.appendChild(lvl);
  }

  // v2: star between name-wrap and level
  if (!isV1 && g.isOwn) {
    const star = document.createElement('i');
    star.className = 'fas fa-star ext-bracket-star';
    nameWrap.after(star);
  }

  return row;
}

function _renderSlotEl(slot, decided) {
  const div = document.createElement('div');

  if (slot.isTom) {
    div.className = 'ext-bracket-player ext-bracket-tom';
    div.textContent = '—';
    return div;
  }

  const stateClass = decided ? (slot.isLoser ? ' ext-bracket-loser' : ' ext-bracket-winner') : '';
  div.className = 'ext-bracket-player' + stateClass;
  const effectiveLevel = s => s.level.match(/\d+/g)?.reduce((sum, n) => sum + parseInt(n), 0) ?? 0;
  const sortedGlads = [...slot.gladiators].sort((a, b) => effectiveLevel(b) - effectiveLevel(a));
  for (const g of sortedGlads) div.appendChild(_renderGladiatorRow(g));

  // Invisible click-blocker inside the first icon-wrap, positioned above it in the dead zone
  const firstIconWrap = div.querySelector('.ext-preview-icon-wrap');
  if (firstIconWrap) {
    const topBlock = document.createElement('div');
    topBlock.className = 'ext-bracket-edge-block-top';
    firstIconWrap.appendChild(topBlock);
  }

  return div;
}

function _renderCard(match) {
  const { s1, s2, reports, score } = match;
  const decided = reports.length > 0 || s1.isTom || s2.isTom;

  const card = document.createElement('div');
  card.className = 'ext-bracket-card';

  const isClickable = e => e.target.closest('.ext-bracket-gladiator') || e.target.closest('.ext-bracket-divider-r');

  // Prevent browser autoscroll on middle-click so auxclick can fire
  card.addEventListener('mousedown', e => { if (e.button === 1 && isClickable(e)) e.preventDefault(); });

  if (reports.length === 1) {
    card.classList.add('ext-bracket-clickable');
    card.addEventListener('click', e => {
      if (!isClickable(e)) return;
      extRouterPush(reports[0].href);
    });
    card.addEventListener('auxclick', e => {
      if (e.button !== 1 || !isClickable(e)) return;
      e.preventDefault();
      window.open(reports[0].href, '_blank');
    });
  } else if (reports.length > 1) {
    card.classList.add('ext-bracket-clickable');
    card.addEventListener('click', e => {
      if (!isClickable(e)) return;
      _showReportsMenu(reports, card, e);
    });
    card.addEventListener('auxclick', e => {
      if (e.button !== 1 || !isClickable(e)) return;
      _showReportsMenu(reports, card, e);
    });
  }

  const s1El = _renderSlotEl(s1, decided);
  const topDeadZone = document.createElement('div');
  topDeadZone.className = 'ext-bracket-dead-zone';
  s1El.prepend(topDeadZone);
  card.appendChild(s1El);

  const divider = document.createElement('div');
  divider.className = 'ext-bracket-divider';
  if (score && score !== '0 - 0') {
    const scoreEl = document.createElement('span');
    scoreEl.className = 'ext-bracket-score';
    scoreEl.textContent = score;
    divider.appendChild(scoreEl);
  }
  const dividerR = document.createElement('div');
  dividerR.className = 'ext-bracket-divider-r';
  divider.appendChild(dividerR);
  const dividerBlockL = document.createElement('div');
  dividerBlockL.className = 'ext-bracket-divider-block-l';
  dividerBlockL.addEventListener('click', e => e.stopPropagation());
  divider.appendChild(dividerBlockL);
  card.appendChild(divider);

  const s2El = _renderSlotEl(s2, decided);
  const bottomDeadZone = document.createElement('div');
  bottomDeadZone.className = 'ext-bracket-dead-zone';
  s2El.appendChild(bottomDeadZone);
  card.appendChild(s2El);

  return card;
}

function _renderColumn(matches, totalH) {
  const slotH = totalH / matches.length;
  const col = document.createElement('div');
  col.className = 'ext-bracket-round';
  col.style.height = totalH + 'px';
  col.style.width = _T_COL + 'px';

  for (const match of matches) {
    const slot = document.createElement('div');
    slot.className = 'ext-bracket-slot';
    slot.style.height = slotH + 'px';
    if (match.cardLabel) {
      const cardContainer = document.createElement('div');
      cardContainer.className = 'ext-bracket-card-wrapper';

      const label = document.createElement('div');
      label.className = 'ext-bracket-round-label font-serif';
      label.textContent = match.cardLabel;

      cardContainer.appendChild(label);
      cardContainer.appendChild(_renderCard(match));
      slot.appendChild(cardContainer);
    } else {
      slot.appendChild(_renderCard(match));
    }
    col.appendChild(slot);
  }
  return col;
}

// Draws T-bar connectors: each pair of feeder matches → one destination match.
function _renderConnector(fromCount, totalH) {
  const unit = totalH / fromCount;
  // Use integer offsets so 2px strokes align perfectly to the pixel grid (crisp)
  const snap = v => Math.round(v);
  const mid  = snap(_T_CONN / 2);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', _T_CONN);
  svg.setAttribute('height', totalH);
  svg.setAttribute('class', 'ext-bracket-conn');
  svg.setAttribute('overflow', 'visible');

  for (let k = 0; k < fromCount / 2; k++) {
    const y1 = snap((2 * k + 0.5) * unit);
    const y2 = snap((2 * k + 1.5) * unit);
    const ym = snap((2 * k + 1.0) * unit);

    const d = `M 0 ${y1} H ${mid} V ${y2} H 0` +
      ` M ${mid} ${ym} H ${_T_CONN}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'ext-bracket-conn-line');
    svg.appendChild(path);
  }
  return svg;
}

function _addDragScroll(el) {
  let pending = false, dragging = false;
  let startX, startY, hScrollEl, hScrollStart, vScrollStart;

  const findScrollParent = node => {
    while (node && node !== document.body) {
      const { overflow, overflowX, overflowY } = getComputedStyle(node);
      if (/(auto|scroll)/.test(overflow + overflowX + overflowY)) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    hScrollEl    = findScrollParent(el.parentElement);
    pending      = true;
    startX       = e.clientX;
    startY       = e.clientY;
    hScrollStart = hScrollEl.scrollLeft;
    vScrollStart = (document.scrollingElement || document.documentElement).scrollTop;
  });

  document.addEventListener('mousemove', e => {
    if (!pending) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      dragging = true;
      const style = document.createElement('style');
      style.id = 'ext-drag-cursor';
      style.textContent = '* { cursor: grabbing !important; pointer-events: none !important; }';
      document.head.appendChild(style);
    }
    hScrollEl.scrollLeft = hScrollStart - dx;
    (document.scrollingElement || document.documentElement).scrollTop = vScrollStart - dy;
  });

  document.addEventListener('mouseup', () => {
    if (!pending) return;
    pending = false;
    if (dragging) {
      dragging = false;
      document.getElementById('ext-drag-cursor')?.remove();
    }
  });
}

function _renderBracket(cols, bronzeMatches, unit) {
  const totalH = cols[0].length * unit;

  const root = document.createElement('div');
  root.id = 'ext-tournament-bracket';
  root.classList.add(_getLayoutVariant() === 'layout-1' ? 'ext-bracket-v1' : 'ext-bracket-v2');

  const row = document.createElement('div');
  row.className = 'ext-bracket-row';
  for (let i = 0; i < cols.length; i++) {
    if (i > 0) row.appendChild(_renderConnector(cols[i - 1].length, totalH));
    row.appendChild(_renderColumn(cols[i], totalH));
  }
  root.appendChild(row);

  if (bronzeMatches.length > 0) {
    const section = document.createElement('div');
    section.className = 'ext-bracket-bronze';

    for (const match of bronzeMatches) {
      const slot = document.createElement('div');
      slot.className = 'ext-bracket-slot';

      const cardContainer = document.createElement('div');
      cardContainer.className = 'ext-bracket-card-wrapper ext-bracket-bronze-card-wrapper';

      const label = document.createElement('div');
      label.className = 'ext-bracket-round-label ext-bracket-round-label-static font-serif';
      label.textContent = 'Tredjeplats';

      cardContainer.appendChild(label);
      cardContainer.appendChild(_renderCard(match));
      slot.appendChild(cardContainer);
      section.appendChild(slot);
    }
    root.appendChild(section);
  }

  _addDragScroll(root);
  return root;
}
