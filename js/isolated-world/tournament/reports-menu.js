// Popup menu for multi-report matches — shown when a card with more than one
// battle report is clicked. One link per report; click-outside or scroll closes it.
// Depends on: utils.js (extRouterPush)

function _getReportsMenuEl() {
  let el = document.getElementById('ext-reports-menu');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ext-reports-menu';
    document.body.appendChild(el);
  }
  return el;
}

function _hideReportsMenu() {
  document.getElementById('ext-reports-menu')?.classList.remove('ext-reports-menu-visible');
}

function _showReportsMenu(reports, anchorEl, e) {
  e.stopPropagation();
  const menu = _getReportsMenuEl();

  menu.innerHTML = '';
  for (const rep of reports) {
    const a = document.createElement('a');
    a.className = 'ext-reports-menu-item';
    a.href = rep.href;
    a.textContent = rep.strid ? `Matchrapport ${rep.strid}` : 'Matchrapport';
    a.addEventListener('click', ev => {
      ev.preventDefault();
      _hideReportsMenu();
      extRouterPush(rep.href);
    });
    menu.appendChild(a);
  }

  // Position below card, flip above if too close to bottom
  const rect = anchorEl.getBoundingClientRect();
  const estH = reports.length * 26 + 8;
  const top = rect.bottom + 4 + estH > window.innerHeight
    ? rect.top - estH - 4
    : rect.bottom + 4;
  let left = rect.left;
  if (left + 140 > window.innerWidth) left = window.innerWidth - 148;
  menu.style.top  = top + 'px';
  menu.style.left = Math.max(8, left) + 'px';
  menu.classList.add('ext-reports-menu-visible');

  setTimeout(() => {
    document.addEventListener('click', _hideReportsMenu, { once: true });
    window.addEventListener('scroll', _hideReportsMenu, { once: true, capture: true });
  }, 0);
}
