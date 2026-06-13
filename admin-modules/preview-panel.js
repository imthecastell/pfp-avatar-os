/**
 * PreviewPanel — preview en vivo para admin.
 * Canvas 1000×1000 con toggles por capa y test aleatorio.
 */

const PreviewPanel = (() => {
  let _canvas = null;
  let _layers = [];
  let _tokens = {};
  let _visibleLayers = {};   // layerId → boolean
  let _selections = {};

  function init(canvasEl, layers, tokens) {
    _canvas = canvasEl;
    _canvas.width = _canvas.height = 1000;
    _layers = layers;
    _tokens = tokens;

    // Todos visibles por defecto
    layers.forEach(l => { _visibleLayers[l.id] = true; });

    _randomize();
  }

  function _randomize() {
    _selections = {};
    _layers.forEach(layer => {
      const available = layer.assets.filter(a => a.src !== undefined);
      if (available.length) _selections[layer.id] = available[Math.floor(Math.random() * available.length)].id;
    });
    render();
  }

  async function render() {
    const activeLayers = _layers.filter(l => _visibleLayers[l.id]);
    await Engine.render(_canvas, activeLayers, _selections, _tokens);
  }

  function setLayerVisible(layerId, visible) {
    _visibleLayers[layerId] = visible;
    render();
  }

  function setToken(tokenId, value) {
    _tokens[tokenId] = value;
    Engine.clearCache();
    render();
  }

  function updateLayers(layers) {
    _layers = layers;
    layers.forEach(l => {
      if (_visibleLayers[l.id] === undefined) _visibleLayers[l.id] = true;
    });
    _randomize();
  }

  function randomize() { _randomize(); }

  return { init, render, setLayerVisible, setToken, updateLayers, randomize };
})();
