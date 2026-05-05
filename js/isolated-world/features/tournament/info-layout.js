// Aligns key/value pairs in the tournament info tab into visual columns and
// stacks comma-separated participant names vertically under a compact header.
// Depends on: none (pure DOM transformation on game's info wrapper)

function _applyInfoLayout() {
  if (!_tournamentSettings['tournament-info-layout']) return;
  if (!_onTournamentPage()) return;

  const infoWrapper = document.querySelector('.space-y-4.mt-4 > .gap-y-4');
  if (!infoWrapper || infoWrapper.querySelector('.ext-info-col')) return;

  const cols = [...infoWrapper.children].filter(el => el.classList.contains('md:w-1/3'));
  for (const col of cols) {
    col.classList.add('ext-info-col');
    for (const p of col.querySelectorAll('p.mb-1')) {
      const keySpan = p.querySelector(':scope > span.font-semibold');
      if (!keySpan) continue;
      // Collect all nodes after the key span and wrap them in a value container
      const valueNodes = [];
      let node = keySpan.nextSibling;
      while (node) {
        valueNodes.push(node);
        node = node.nextSibling;
      }
      if (!valueNodes.length) continue;
      // Normalize "key : value" where colon is in the value text, not the key span
      const firstVal = valueNodes[0];
      if (firstVal && firstVal.nodeType === Node.TEXT_NODE) {
        const m = firstVal.textContent.match(/^(\s*):(\s*)/);
        if (m) {
          keySpan.textContent = keySpan.textContent.trimEnd() + ': ';
          firstVal.textContent = firstVal.textContent.slice(m[0].length);
        }
      }
      const valWrap = document.createElement('span');
      valWrap.className = 'ext-info-val';
      for (const n of valueNodes) valWrap.appendChild(n);
      for (const n of valWrap.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) n.textContent = n.textContent.trimEnd();
      }
      p.appendChild(valWrap);
    }
  }

  // Process results section: remove "Lag X - " and stack names vertically
  for (const entry of infoWrapper.querySelectorAll('div.mb-2')) {
    const valueSpan = entry.querySelector(':scope > span');
    if (!valueSpan || valueSpan.classList.contains('ext-result-names')) continue;
    const textNode = [...valueSpan.childNodes].find(
      n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
    );
    if (textNode) {
      valueSpan.dataset.extLagText = textNode.textContent;
      textNode.remove();
    }
    valueSpan.classList.add('ext-result-names');
    for (const a of [...valueSpan.querySelectorAll('a')]) {
      const row = document.createElement('span');
      row.className = 'ext-result-entry';
      const bullet = document.createElement('span');
      bullet.className = 'ext-result-bullet';
      bullet.textContent = '•';
      bullet.setAttribute('aria-hidden', 'true');
      a.replaceWith(row);
      row.appendChild(bullet);
      row.appendChild(a);
    }
  }
}

function _removeInfoLayout() {
  for (const col of document.querySelectorAll('.ext-info-col')) {
    col.classList.remove('ext-info-col');
    for (const wrap of col.querySelectorAll('.ext-info-val')) {
      while (wrap.firstChild) wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      wrap.remove();
    }
  }
  for (const span of document.querySelectorAll('.ext-result-names')) {
    for (const row of span.querySelectorAll('.ext-result-entry')) {
      const a = row.querySelector('a');
      if (a) row.replaceWith(a);
      else row.remove();
    }
    if (span.dataset.extLagText) {
      span.prepend(document.createTextNode(span.dataset.extLagText));
      delete span.dataset.extLagText;
    }
    span.classList.remove('ext-result-names');
  }
}
