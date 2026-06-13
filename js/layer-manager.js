/**
 * LayerManager — carga el stack de capas, filtra por compatibilidad de accesorios.
 */

const LayerManager = (() => {
  let _layers = [];

  async function load(url = 'data/layer-config.json') {
    const res = await fetch(url);
    const data = await res.json();
    _layers = data.layers.sort((a, b) => a.order - b.order);
    return _layers;
  }

  function getLayers() {
    return _layers;
  }

  function getLayer(id) {
    return _layers.find(l => l.id === id) || null;
  }

  /**
   * Devuelve los assets visibles de una capa dado el estado actual.
   * Filtra accesorios bloqueados por el cabello seleccionado.
   */
  function getVisibleAssets(layerId, selections) {
    const layer = getLayer(layerId);
    if (!layer) return [];

    // Detectar si algún cabello seleccionado bloquea accesorios
    const hairLayer = _layers.find(l => l.id === 'hair-back');
    let blocked = [];
    if (hairLayer && selections['hair-back']) {
      const hairAsset = hairLayer.assets.find(a => a.id === selections['hair-back']);
      if (hairAsset?.blocksAccessories) blocked = hairAsset.blocksAccessories;
    }

    return layer.assets.filter(asset => !blocked.includes(asset.id));
  }

  /**
   * Devuelve el estado inicial aleatorio — un assetId por capa.
   */
  function randomSelections() {
    const result = {};
    _layers.forEach(layer => {
      const available = layer.assets.filter(a => a.src !== undefined);
      if (available.length) {
        result[layer.id] = available[Math.floor(Math.random() * available.length)].id;
      }
    });
    return result;
  }

  return { load, getLayers, getLayer, getVisibleAssets, randomSelections };
})();

if (typeof module !== 'undefined') module.exports = LayerManager;
