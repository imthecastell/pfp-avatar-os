/**
 * State — estado global del avatar actual (v2).
 * selectedAssets[layerId] = filePath (string) o null.
 * Soporta selección de estilos de cabello y accesorios como pares.
 */

const State = (() => {
  const STORAGE_KEY = 'avatar-os-state-v2';

  const defaults = {
    collection: 'col-06',
    tokens: {
      'skin-color':  '#D4956A',
      'hair-color':  '#8B4513',
      'shirt-color': '#2980B9'
    },
    selectedAssets: {},   // layerId → filePath|null
    activeHairStyle: null,      // id del estilo de cabello activo
    activeHeadAccessory: null,  // id del accesorio de cabeza activo
    keywords: [],
    unlockedAssets: {}          // layerId → [filePaths desbloqueados]
  };

  let _state = _clone(defaults);
  const _listeners = [];

  function _clone(s) {
    return {
      ...s,
      tokens:         { ...s.tokens },
      selectedAssets: { ...s.selectedAssets },
      keywords:       [...(s.keywords || [])],
      unlockedAssets: JSON.parse(JSON.stringify(s.unlockedAssets || {}))
    };
  }

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
          tokens:         { ...defaults.tokens, ...(parsed.tokens || {}) },
          selectedAssets: parsed.selectedAssets || {},
          activeHairStyle:      parsed.activeHairStyle      ?? null,
          activeHeadAccessory:  parsed.activeHeadAccessory  ?? null,
          keywords:       parsed.keywords       || [],
          unlockedAssets: parsed.unlockedAssets || {}
        };
      }
    } catch (e) {
      console.warn('State: failed to load from localStorage', e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn('State: failed to save to localStorage', e);
    }
  }

  function get() {
    return _clone(_state);
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  function setToken(tokenId, value) {
    _state.tokens[tokenId] = value;
    save();
    _notify({ type: 'token', tokenId, value });
  }

  function getToken(tokenId) {
    return _state.tokens[tokenId];
  }

  // ── Assets individuales ───────────────────────────────────────────────────

  function setAsset(layerId, filePath) {
    _state.selectedAssets[layerId] = filePath;
    save();
    _notify({ type: 'asset', layerId, filePath });
  }

  function getAsset(layerId) {
    return _state.selectedAssets[layerId] ?? null;
  }

  // ── Estilos de cabello (par back+front) ───────────────────────────────────

  /**
   * Selecciona un estilo de cabello completo.
   * hairStyleConfig: { id, back: filePath|null, front: filePath|null, blockedAccessories: [] }
   */
  function selectHairStyle(hairStyleConfig) {
    _state.activeHairStyle = hairStyleConfig.id;
    _state.selectedAssets['hair-back']  = hairStyleConfig.back  ?? null;
    _state.selectedAssets['hair-front'] = hairStyleConfig.front ?? null;

    // Verificar compatibilidad con accesorio de cabeza activo
    const blocked = hairStyleConfig.blockedAccessories || [];
    if (_state.activeHeadAccessory && blocked.includes(_state.activeHeadAccessory)) {
      _clearHeadAccessory();
    }

    save();
    _notify({ type: 'hairStyle', hairStyleConfig });
  }

  // ── Accesorios de cabeza (par back+front) ─────────────────────────────────

  /**
   * Selecciona un accesorio de cabeza completo.
   * accConfig: { id, back: filePath|null, front: filePath|null, blockedHairStyles: [] }
   */
  function selectHeadAccessory(accConfig) {
    _state.activeHeadAccessory = accConfig.id;
    _state.selectedAssets['accessory-back']  = accConfig.back  ?? null;
    _state.selectedAssets['accessory-front'] = accConfig.front ?? null;

    // Verificar compatibilidad con estilo de cabello activo
    const blocked = accConfig.blockedHairStyles || [];
    if (_state.activeHairStyle && blocked.includes(_state.activeHairStyle)) {
      _clearHairStyle();
    }

    save();
    _notify({ type: 'headAccessory', accConfig });
  }

  function _clearHeadAccessory() {
    _state.activeHeadAccessory = null;
    _state.selectedAssets['accessory-back']  = null;
    _state.selectedAssets['accessory-front'] = null;
  }

  function _clearHairStyle() {
    _state.activeHairStyle = null;
    _state.selectedAssets['hair-back']  = null;
    _state.selectedAssets['hair-front'] = null;
  }

  // ── Keywords ──────────────────────────────────────────────────────────────

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

  function unlockAssets(layerId, filePaths) {
    if (!_state.unlockedAssets[layerId]) _state.unlockedAssets[layerId] = [];
    filePaths.forEach(fp => {
      if (!_state.unlockedAssets[layerId].includes(fp)) {
        _state.unlockedAssets[layerId].push(fp);
      }
    });
    save();
    _notify({ type: 'unlock', layerId });
  }

  function isUnlocked(layerId, filePath) {
    return (_state.unlockedAssets[layerId] || []).includes(filePath);
  }

  // ── Aleatorio ─────────────────────────────────────────────────────────────

  /**
   * Selecciona assets aleatorios para todas las capas individuales.
   * collectionConfig: { backgrounds, emotions, hairStyles, headAccessories, masks, ... }
   */
  function randomize(collectionConfig) {
    if (!collectionConfig) return;

    const pick = arr => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;

    if (collectionConfig.backgrounds?.length) {
      const bg = pick(collectionConfig.backgrounds);
      if (bg) _state.selectedAssets['background'] = bg.file ?? bg;
    }
    if (collectionConfig.emotions?.length) {
      const em = pick(collectionConfig.emotions);
      _state.selectedAssets['emotion'] = em ? (em.file ?? em) : null;
    }
    if (collectionConfig.hairStyles?.length) {
      const hs = pick(collectionConfig.hairStyles);
      if (hs) selectHairStyle(hs);
    }
    if (collectionConfig.headAccessories?.length) {
      const ha = pick(collectionConfig.headAccessories);
      if (ha) selectHeadAccessory(ha);
    }
    if (collectionConfig.masks?.length) {
      const mk = pick(collectionConfig.masks);
      _state.selectedAssets['mask'] = mk ? (mk.file ?? mk) : null;
    }

    save();
    _notify({ type: 'random' });
  }

  // ── Observadores ──────────────────────────────────────────────────────────

  function onChange(fn) {
    _listeners.push(fn);
    return () => { const i = _listeners.indexOf(fn); if (i !== -1) _listeners.splice(i, 1); };
  }

  function reset() {
    _state = _clone(defaults);
    save();
    _notify({ type: 'reset' });
  }

  return {
    load, save, get,
    setToken, getToken,
    setAsset, getAsset,
    selectHairStyle, selectHeadAccessory,
    addKeyword, hasKeyword,
    unlockAssets, isUnlocked,
    randomize, onChange, reset
  };
})();

if (typeof module !== 'undefined') module.exports = State;
