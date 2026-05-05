// Tournament schedule bracket enhancement — entry point.
// Owns shared constants (_T_CONN, _T_COL, _T_GLAD_H), module-level settings and
// observer state, and the lifecycle (apply/remove, navigation, settings-change).
// The pipeline is: parse DOM → compute slot height → render bracket → swap
// .ladder-full for our bracket, plus optional info-tab layout changes.
// Depends on: common/utils.js (getGameContentRoot), common/settings.js (loadSettings),
//             features/tournament/parse.js (_parseColumns, _computeUnit),
//             features/tournament/render.js (_renderBracket),
//             features/tournament/info-layout.js (_applyInfoLayout, _removeInfoLayout)

const _T_CONN   = 24;  // px width of SVG connector strip between rounds
const _T_COL    = 164; // px width of each round column
const _T_GLAD_H = 18;  // px height per gladiator row (font-size × line-height, must match CSS)

let _tournamentSettings = {};
let _tournamentObs = null;

function _getLayoutVariant() {
  return _tournamentSettings['tournament-schedule-layout-variant'] || 'layout-1';
}

function _onTournamentPage() {
  return /\/game\/arena\/(tournaments|dailybattles)\/\d+/.test(location.pathname);
}

function _applyBracket() {
  if (!_tournamentSettings['tournament-schedule-layout']) return;
  if (!_onTournamentPage()) return;
  if (document.getElementById('ext-tournament-bracket')) return;

  const parsed = _parseColumns();
  if (!parsed) return;

  const unit = _computeUnit(parsed.cols);
  const ladderFull = document.querySelector('.ladder-full')
    || document.querySelector('.ladder-holder > div:not(#ext-tournament-bracket)');
  ladderFull.style.display = 'none';
  ladderFull.parentElement.insertBefore(
    _renderBracket(parsed.cols, parsed.bronzeMatches, unit),
    ladderFull
  );
}

function _removeBracket() {
  document.getElementById('ext-tournament-bracket')?.remove();
  const lf = document.querySelector('.ladder-full');
  if (lf) lf.style.display = '';
}

// Reacts to tab switches within the tournament page: the ladder DOM can appear
// and disappear as the user navigates info/schedule tabs, and the observer
// disconnects itself once we leave the tournament route entirely.
function _setupObs() {
  if (_tournamentObs) return;
  _tournamentObs = new MutationObserver(() => {
    if (!_onTournamentPage()) {
      _removeBracket();
      _tournamentObs.disconnect();
      _tournamentObs = null;
      return;
    }
    const hasBracket = !!document.getElementById('ext-tournament-bracket');
    const hasLadder  = !!(document.querySelector('.ladder-full') || document.querySelector('.ladder-holder > div:not(#ext-tournament-bracket)'));
    if (!hasLadder && hasBracket) {
      document.getElementById('ext-tournament-bracket')?.remove();
    } else if (hasLadder && !hasBracket) {
      _applyBracket();
    }

    const hasInfoWrapper = !!document.querySelector('.space-y-4.mt-4 > .gap-y-4');
    const hasInfoLayout  = !!document.querySelector('.ext-info-col');
    if (hasInfoWrapper && !hasInfoLayout) {
      _applyInfoLayout();
    }
  });
  _tournamentObs.observe(getGameContentRoot(), { childList: true, subtree: true });
}

function _handleNav(url) {
  _removeBracket();
  _removeInfoLayout();
  _tournamentObs?.disconnect();
  _tournamentObs = null;
  if (/\/game\/arena\/(tournaments|dailybattles)\/\d+/.test(url)) {
    _applyBracket();
    _applyInfoLayout();
    _setupObs();
  }
}

window.addEventListener('ext:navigate', () => _handleNav(location.pathname));
window.addEventListener('popstate', () => _handleNav(location.pathname));

function initTournament(settings) {
  _tournamentSettings = settings;
  if (_onTournamentPage()) {
    _applyBracket();
    _applyInfoLayout();
    _setupObs();
  }
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== 'local') return;
  loadSettings().then(settings => {
    const wasBracket = _tournamentSettings['tournament-schedule-layout'];
    const wasVariant = _tournamentSettings['tournament-schedule-layout-variant'];
    const wasInfo    = _tournamentSettings['tournament-info-layout'];
    _tournamentSettings = settings;
    if (settings['tournament-schedule-layout'] && !wasBracket) {
      _applyBracket();
      _setupObs();
    } else if (!settings['tournament-schedule-layout'] && wasBracket) {
      _removeBracket();
    } else if (settings['tournament-schedule-layout']
               && settings['tournament-schedule-layout-variant'] !== wasVariant) {
      _removeBracket();
      _applyBracket();
    }
    if (settings['tournament-info-layout'] && !wasInfo) {
      _applyInfoLayout();
    } else if (!settings['tournament-info-layout'] && wasInfo) {
      _removeInfoLayout();
    }
  });
});
