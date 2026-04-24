// Central avatar-sync handlers. One place to hook API endpoints that deliver
// active-avatar state — each handler delegates to _refreshNavForAvatar, which
// updates shared badge state and re-runs every registered nav feature.
//
// Without this, DOM-only features (hide-empty, simplify-community) wouldn't
// react to avatar changes that Vue handles without mutating the sidebar.
//
// Depends on: api-handler.js, badges.js (_applyAvatarToBadges),
//             enhancements.js (_runAllFeatures).

function _refreshNavForAvatar(avatar) {
  if (!avatar) return;
  _applyAvatarToBadges(avatar);
  _runAllFeatures();
}

apiRegisterHandler(/\/api\/avatars\/me(\?|$)/,  (_u, d) => _refreshNavForAvatar(d));
apiRegisterHandler(/\/api\/avatars\/create$/,   (_u, d) => _refreshNavForAvatar(d));
apiRegisterHandler(/\/api\/users\/me$/,         (_u, d) => _refreshNavForAvatar(d?.avatar));
apiRegisterHandler(/\/api\/users\/me\/avatars/, (_u, d) => {
  if (Array.isArray(d)) _refreshNavForAvatar(d.find(a => a.active === true));
});
apiRegisterHandler(/\/api\/npcs\/\d+\/battle/,  (_u, d) => _refreshNavForAvatar(d?.avatar));
