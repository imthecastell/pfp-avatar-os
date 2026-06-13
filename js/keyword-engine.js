/**
 * KeywordEngine — valida keywords e inyecta assets desbloqueados en el layer config.
 */

const KeywordEngine = (() => {
  let _config = null;

  async function load(url = 'data/keyword-config.json') {
    const res = await fetch(url);
    _config = await res.json();
  }

  /**
   * Intenta activar una keyword. Devuelve el set si match, null si no.
   */
  function validate(input) {
    if (!_config) return null;
    const upper = input.toUpperCase().trim();
    return _config.keywords.find(k => k.active && k.keyword === upper) || null;
  }

  /**
   * Extrae lista de { layerId, assetId, assetSrc } que desbloquea un set.
   */
  function getUnlockedAssets(kwSet) {
    const result = [];
    if (!kwSet) return result;

    const { unlocks } = kwSet;
    if (unlocks.outfit) {
      for (const [slotHint, src] of Object.entries(unlocks.outfit)) {
        result.push({ layerHint: slotHint, src, fromKeyword: kwSet.keyword });
      }
    }
    if (unlocks.themedAssets) {
      unlocks.themedAssets.forEach(entry => {
        result.push({ layerHint: entry.layer, src: entry.asset, fromKeyword: kwSet.keyword });
      });
    }
    return result;
  }

  return { load, validate, getUnlockedAssets };
})();

if (typeof module !== 'undefined') module.exports = KeywordEngine;
