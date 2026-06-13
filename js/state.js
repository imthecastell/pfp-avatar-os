/**
 * State — estado global del avatar actual.
 * Guarda tokens de color (no colores por capa), selecciones de assets,
 * keywords activas y configuración de colección.
 */

const AvatarState = (() => {
  const STORAGE_KEY = 'avatar-os-state';

  const defaults = {
    collection: 'col-06',
    tokens: {
      'skin-color': '#D4956A',
      'hair-color': '#8B4513',
      'shirt-color': '#2980B9'
    },
    selections: {},      // layerId → assetId
    keywords: [],        // keywords activas en esta sesión
    unlockedAssets: {}   // layerId → [assetIds desbloqueados]
  };

  let _state = { ...defaults, tokens: { ...defaults.tokens }, selections: {}, keywords: [], unlockedAssets: {} };
  const _listeners = [];

  function _notify(changed) {
    _listeners.forEach(fn => fn(changed, _state));
  }

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        _state = {
          ...defaults,
          ...parsed,
          tokens: { ...defaults.tokens, ...(parsed.tokens || {}) },
          selections: parsed.selections || {},
          keywords: parsed.keywords || [],
          unlockedAssets: parsed.unlockedAssets || {}
        };
      }
    } catch (e) {
      console.warn('AvatarState: failed to load from localStorage', e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn('AvatarState: failed to save to localStorage', e);
    }
  }

  function get() {
    return { ..._state, tokens: { ..._state.tokens }, selections: { ..._state.selections } };
  }

  function setToken(tokenId, value) {
    _state.tokens[tokenId] = value;
    save();
    _notify({ type: 'token', tokenId, value });
  }

  function setSelection(layerId, assetId) {
    _state.selections[layerId] = assetId;
    save();
    _notify({ type: 'selection', layerId, assetId });
  }

  function getSelection(layerId) {
    return _state.selections[layerId] ?? null;
  }

  function getToken(tokenId) {
    return _state.tokens[tokenId];
  }

  function addKeyword(kw) {
    const upper = kw.toUpperCase().trim();
    if (!_state.keywords.includes(upper)) {
      _state.keywords = [..._state.keywords, upper];
      save();
      _notify({ type: 'keyword', keyword: upper });
    }
    return upper;
  }

  function hasKeyword(kw) {
    return _state.keywords.includes(kw.toUpperCase().trim());
  }

  function unlockAssets(layerId, assetIds) {
    if (!_state.unlockedAssets[layerId]) _state.unlockedAssets[layerId] = [];
    assetIds.forEach(id => {
      if (!_state.unlockedAssets[layerId].includes(id)) {
        _state.unlockedAssets[layerId].push(id);
      }
    });
    save();
    _notify({ type: 'unlock', layerId });
  }

  function isUnlocked(layerId, assetId) {
    return (_state.unlockedAssets[layerId] || []).includes(assetId);
  }

  function onChange(fn) {
    _listeners.push(fn);
    return () => { const i = _listeners.indexOf(fn); if (i !== -1) _listeners.splice(i, 1); };
  }

  function setRandomSelections(layerConfig) {
    layerConfig.layers.forEach(layer => {
      const available = layer.assets.filter(a => a.src !== undefined);
      if (available.length) {
        const pick = available[Math.floor(Math.random() * available.length)];
        _state.selections[layer.id] = pick.id;
      }
    });
    save();
    _notify({ type: 'random' });
  }

  function reset() {
    _state = { ...defaults, tokens: { ...defaults.tokens }, selections: {}, keywords: [], unlockedAssets: {} };
    save();
    _notify({ type: 'reset' });
  }

  return { load, save, get, setToken, getToken, setSelection, getSelection, addKeyword, hasKeyword, unlockAssets, isUnlocked, onChange, setRandomSelections, reset };
})();

if (typeof module !== 'undefined') module.exports = AvatarState;
