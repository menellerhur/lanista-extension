// Gladiator preview tooltip (shown on hover of the eye icon in the bracket).
// Two rendering variants: layout-1 mirrors the game's own v-popper dropdown theme,
// layout-2 uses a simpler extension-styled tooltip.
// Depends on: utils.js (gameRequest), tournament/main.js (_getLayoutVariant)

const _RACE_NAMES = {
  human:     'människa',
  elf:       'alv',
  orc:       'ork',
  dwarf:     'dvärg',
  troll:     'troll',
  goblin:    'goblin',
  undead:    'odöd',
  salamanth: 'salamanther',
};

const _previewCache = {}; // avatarId → { promise, time }
const _PREVIEW_TTL = 3000; // ms — match game's own cache duration

function _getPreviewData(avatarId) {
  const cached = _previewCache[avatarId];
  if (cached && Date.now() - cached.time < _PREVIEW_TTL) return cached.promise;
  const promise = gameRequest(`/api/avatars/${avatarId}/gear/preview`)
    .catch(() => null);
  _previewCache[avatarId] = { promise, time: Date.now() };
  return promise;
}

function _getTooltipEl() {
  let el = document.getElementById('ext-preview-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ext-preview-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

function _positionTooltip(tooltip, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  let left = rect.left;
  const maxLeft = window.innerWidth - tooltip.offsetWidth - 8;
  if (left > maxLeft) left = maxLeft;
  tooltip.style.left = Math.max(8, left) + 'px';
  tooltip.style.top  = (rect.top - 6) + 'px';
}

async function _showPreview(avatarId, anchorEl) {
  const tooltip = _getTooltipEl();

  tooltip.innerHTML = '<div class="ext-preview-loading">…</div>';
  tooltip.classList.add('ext-preview-visible');
  _positionTooltip(tooltip, anchorEl);

  const data = await _getPreviewData(avatarId);
  if (!tooltip.classList.contains('ext-preview-visible')) return; // mouse left

  if (!data) {
    tooltip.innerHTML = '<div class="ext-preview-loading">–</div>';
    return;
  }

  const mainHand = data.items?.find(i => i.main_hand);
  const offHand  = data.items?.find(i => i.off_hand);
  const raceKey = data.race?.toLowerCase() || '';
  const raceName = _RACE_NAMES[raceKey] || raceKey;
  const race = raceName.charAt(0).toUpperCase() + raceName.slice(1);

  tooltip.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'ext-preview-title';
  title.textContent = `${race} – Grad ${data.display_level}`;
  tooltip.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'ext-preview-grid';
  for (const [label, item] of [['Vapenhand', mainHand], ['Sköldhand', offHand]]) {
    const lbl = document.createElement('span');
    lbl.className = 'ext-preview-label';
    lbl.textContent = label + ':';
    const val = document.createElement('span');
    val.className = 'ext-preview-value';
    val.textContent = item ? item.name : '—';
    grid.appendChild(lbl);
    grid.appendChild(val);
  }
  tooltip.appendChild(grid);

  _positionTooltip(tooltip, anchorEl); // re-position now that content is rendered
}

function _hidePreview() {
  document.getElementById('ext-preview-tooltip')?.classList.remove('ext-preview-visible');
}

// Layout 1 tooltip — replicates game's v-popper dropdown theme exactly
function _getTooltipElV1() {
  let el = document.getElementById('ext-preview-tooltip-v1');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'ext-preview-tooltip-v1';
  el.className = 'v-popper__popper v-popper--theme-dropdown';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('tabindex', '0');
  el.style.display = 'none';
  el.innerHTML =
    '<div class="v-popper__backdrop"></div>' +
    '<div class="v-popper__wrapper">' +
      '<div class="v-popper__inner">' +
        '<div><div class="main-tooltip"></div></div>' +
      '</div>' +
      '<div class="v-popper__arrow-container">' +
        '<div class="v-popper__arrow-outer"></div>' +
        '<div class="v-popper__arrow-inner"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(el);
  return el;
}

function _positionTooltipV1(tooltip, anchorEl) {
  tooltip.style.position = 'absolute';
  const rect = anchorEl.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const gap = 10;
  const tipW = tooltip.offsetWidth;
  const tipH = tooltip.offsetHeight;

  let placement = 'right';
  let x = rect.right + gap;
  if (x + tipW > window.innerWidth - 8) {
    placement = 'left';
    x = rect.left - gap - tipW;
  }

  const anchorCenterY = rect.top + rect.height / 2;
  let y = anchorCenterY - tipH / 2;
  y = Math.max(8, Math.min(y, window.innerHeight - tipH - 8));

  tooltip.style.transform = `translate3d(${Math.round(x + scrollX)}px, ${Math.round(y + scrollY)}px, 0px)`;
  tooltip.setAttribute('data-popper-placement', placement);

  const arrow = tooltip.querySelector('.v-popper__arrow-container');
  if (arrow) {
    let arrowY = anchorCenterY - y - 7;
    arrowY = Math.max(6, Math.min(arrowY, tipH - 14));
    arrow.style.top = Math.round(arrowY) + 'px';
  }
}

async function _showPreviewV1(avatarId, anchorEl) {
  const tooltip = _getTooltipElV1();
  const mainEl = tooltip.querySelector('.main-tooltip');
  mainEl.textContent = '…';
  tooltip.style.display = '';
  tooltip.classList.add('v-popper__popper--shown', 'v-popper__popper--show-to');
  tooltip.setAttribute('aria-hidden', 'false');
  _positionTooltipV1(tooltip, anchorEl);

  const data = await _getPreviewData(avatarId);
  if (!tooltip.classList.contains('v-popper__popper--shown')) return; // mouse left

  mainEl.textContent = '';
  if (!data) {
    mainEl.textContent = '–';
    _positionTooltipV1(tooltip, anchorEl);
    return;
  }

  const raceKey = (data.race || '').toLowerCase();
  const raceName = _RACE_NAMES[raceKey] || raceKey;
  const raceDisplay = raceName.charAt(0).toUpperCase() + raceName.slice(1);

  const mainHand = data.items?.find(i => i.main_hand);
  const offHand  = data.items?.find(i => i.off_hand);

  const title = document.createElement('strong');
  title.className = 'capitalize text-center block mb-1';
  title.textContent = `${raceDisplay} - Grad ${data.display_level}`;
  mainEl.appendChild(title);

  mainEl.appendChild(document.createTextNode('Vapenhand: '));
  const mh = document.createElement('strong');
  mh.textContent = mainHand ? mainHand.name : 'Inget';
  mainEl.appendChild(mh);
  mainEl.appendChild(document.createTextNode(' '));
  mainEl.appendChild(document.createElement('br'));
  mainEl.appendChild(document.createTextNode(' Sköldhand: '));
  const oh = document.createElement('strong');
  oh.textContent = offHand ? offHand.name : 'Inget';
  mainEl.appendChild(oh);

  _positionTooltipV1(tooltip, anchorEl);
}

function _hidePreviewV1() {
  const el = document.getElementById('ext-preview-tooltip-v1');
  if (el) {
    el.style.display = 'none';
    el.classList.remove('v-popper__popper--shown', 'v-popper__popper--show-to');
    el.setAttribute('aria-hidden', 'true');
  }
}

function _addPreviewHover(el, href) {
  const avatarId = href?.match(/\/(\d+)$/)?.[1];
  if (!avatarId) return;
  el.addEventListener('mouseenter', () => {
    if (_getLayoutVariant() === 'layout-1') _showPreviewV1(avatarId, el);
    else _showPreview(avatarId, el);
  });
  el.addEventListener('mouseleave', () => {
    if (_getLayoutVariant() === 'layout-1') _hidePreviewV1();
    else _hidePreview();
  });
}
