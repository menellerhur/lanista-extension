// All mutable items state. Must be var so other database/* files can read and write these.
// Note: itemsCache lives in common/items-data.js (shared with plan-gladiator).
var itemsCurrentViewKey = "weapon";
var itemsCurrentSubcat  = null;
var itemsWeaponSubview    = "standard";
var itemsGladiatorVf      = 0;
var itemsGladiatorStr     = 0;
var itemsItemRowMap    = {};
var itemsSelectedIds     = new Set();
var itemsFilterSelection = "all";
var itemsSortCol         = null;
var itemsSortDir         = "asc";
var itemsCustomCols      = [];   // extra columns added by user, persists across view switches
var itemsHiddenCols      = [];   // base columns hidden by user, persists across view switches
var itemsColOrder        = [];   // user-defined ordering of visible columns (overrides default base+custom flow)
var itemsColFilters      = {};   // { colKey: { min?, max?, text?, boolVal?, race? } }
var itemsCurrentViewItems = [];  // unfiltered view items, used for filter panel dropdowns
var itemsCurrentFiltered  = [];  // current filtered/sorted items for virtual rendering
var itemsCurrentView      = null; // current view object for virtual rendering
var itemsNameSearchOpen   = false;
var itemsViewNamingMode     = false;
var itemsCustomViews      = [];   // [ { id, name, parentViewKey, hiddenCols, customCols, colFilters } ]
var itemsLastNavContext   = null; // "viewKey-subcat-subview" used to detect when to reset scroll

const ITEMS_CUSTOM_VIEWS_KEY = "items-custom-views";

// Resolves after initial load completes. Await this before rendering the
// database page to avoid a flash of missing views.
var itemsCustomViewsReady = null;

function itemsLoadCustomViews() {
  itemsCustomViewsReady = (async () => {
    try {
      const stored = await chrome.storage.local.get(ITEMS_CUSTOM_VIEWS_KEY);
      itemsCustomViews = stored[ITEMS_CUSTOM_VIEWS_KEY] || [];
    } catch (e) {
      console.error("Failed to load custom views", e);
      itemsCustomViews = [];
    }
  })();
  return itemsCustomViewsReady;
}

async function itemsSaveCustomViews() {
  try {
    await chrome.storage.local.set({ [ITEMS_CUSTOM_VIEWS_KEY]: itemsCustomViews });
  } catch (e) {
    console.error("Failed to save custom views", e);
  }
}

itemsLoadCustomViews();
