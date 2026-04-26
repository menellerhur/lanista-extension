// Re-runs DOM-only nav features (hide-empty, simplify-community, etc.) on avatar
// state changes that Vue handles without mutating the sidebar — the MutationObserver
// in enhancements.js wouldn't fire in those cases.
//
// Avatar-derived badge state is now pushed in via main-world/store-bridge.js
// (ext:badge-data, ext:active-avatar). This file only triggers feature reruns.
//
// Depends on: api-handler.js, enhancements.js (_runAllFeatures).

apiRegisterHandler(/\/api\/avatars\/me(\?|$)/,  () => _runAllFeatures());
apiRegisterHandler(/\/api\/avatars\/create$/,   () => _runAllFeatures());
apiRegisterHandler(/\/api\/users\/me$/,         () => _runAllFeatures());
apiRegisterHandler(/\/api\/users\/me\/avatars/, () => _runAllFeatures());
apiRegisterHandler(/\/api\/npcs\/\d+\/battle/,  () => _runAllFeatures());
