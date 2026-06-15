/**
 * State — gestiona selecciones y tokens del builder (v3).
 * selectedAssets[layerId] = assetId (not filePath).
 * tokens = flat { tokenId: hexColor }.
 */
const State = (() => {
  const STORAGE_KEY = 'avatar-os-state-v3';

  const DEFAULTS = {
    tokens: {
      'skin-color': '#F9C7B6',
      'hair-color': '#00B181',
    },
    selectedAssets: {},
    activeKeywords: [],
  };

  let _state = _clone(DEFAULTS);

  function _clone(s) {
    return {
      tokens: { ...s.tokens },
      selectedAssets: { ...s.selectedAssets },
      activeKeywords: [...(s.activeKeywords || [])],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        _state = {
          tokens: { ...DEFAULTS.tokens, ...(saved.tokens || {}) },
          selectedAssets: saved.selectedAssets || {},
          activeKeywords: saved.activeKeywords || [],
        };
      }
    } catch (e) {
      console.warn('State: load failed, using defaults', e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn('State: save failed', e);
    }
  }

  function get() { return _clone(_state); }

  function getToken(id) { return _state.tokens[id] || null; }
  function setToken(id, hex) { _state.tokens[id] = hex; save(); }
  function getTokens() { return { ..._state.tokens }; }

  function getSelectedAsset(layerId) { return _state.selectedAssets[layerId] || null; }
  function setSelectedAsset(layerId, assetId) { _state.selectedAssets[layerId] = assetId; save(); }
  function getSelectedAssets() { return { ..._state.selectedAssets }; }

  function getActiveKeywords() { return [..._state.activeKeywords]; }
  function setActiveKeywords(keywords) { _state.activeKeywords = [...keywords]; save(); }

  function reset() { _state = _clone(DEFAULTS); save(); }

  return {
    load, save, get,
    getToken, setToken, getTokens,
    getSelectedAsset, setSelectedAsset, getSelectedAssets,
    getActiveKeywords, setActiveKeywords,
    reset,
  };
})();

if (typeof module !== 'undefined') module.exports = State;
