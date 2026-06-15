/**
 * Engine — compositor de capas sobre canvas 2048×2048 (v3).
 * render(canvas, layerConfig, registry, state)
 * - layerConfig: array de capas con { id, order, colorToken, blendMode }
 * - registry: objeto { assets: [{ id, layerId, src, colorOverrides }] }
 * - state: { selectedAssets: { layerId: assetId }, tokens: { tokenId: hex } }
 */
const Engine = (() => {
  const CANVAS_SIZE = 2048;
  const _cache = new Map();

  // Colores originales Affinity para cada token
  const TOKEN_ORIGINALS = {
    'skin-color': 'rgb(249,199,182)',
    'hair-color': 'rgb(0,177,129)',
  };

  async function _loadLayerImage(asset, layer, tokens) {
    const cacheKey = asset.id + JSON.stringify(tokens);
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    const src = asset.src || `placeholder:${layer.id}`;
    let svgText;

    try {
      svgText = await AssetLoader.loadSVGText(src);
    } catch (e) {
      svgText = SVGProcessor.generatePlaceholder(layer.id);
    }

    // Apply variant colorOverrides
    if (asset.colorOverrides && asset.colorOverrides.length) {
      svgText = SVGProcessor.applyVariant(svgText, asset);
    }

    // Apply color token
    if (layer.colorToken && tokens[layer.colorToken]) {
      const originalColor = TOKEN_ORIGINALS[layer.colorToken];
      if (originalColor) {
        svgText = SVGProcessor.applyToken(svgText, originalColor, tokens[layer.colorToken]);
      }
    }

    const img = await AssetLoader.svgToImage(svgText);

    // Scale to CANVAS_SIZE via OffscreenCanvas if needed
    let result = img;
    if (img.naturalWidth !== CANVAS_SIZE || img.naturalHeight !== CANVAS_SIZE) {
      try {
        const oc = new OffscreenCanvas(CANVAS_SIZE, CANVAS_SIZE);
        const ctx = oc.getContext('2d');
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        result = await createImageBitmap(oc);
      } catch (e) {
        result = img;
      }
    }

    _cache.set(cacheKey, result);
    return result;
  }

  async function render(canvas, layerConfig, registry, state) {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.height = CANVAS_SIZE;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const tokens = state.getTokens ? state.getTokens() : (state.tokens || {});
    const selectedAssets = state.getSelectedAssets ? state.getSelectedAssets() : (state.selectedAssets || {});

    const sorted = [...layerConfig].sort((a, b) => a.order - b.order);
    const assetMap = {};
    ((registry && registry.assets) || []).forEach(a => { assetMap[a.id] = a; });

    for (const layer of sorted) {
      const assetId = selectedAssets[layer.id];
      if (!assetId) continue;

      const asset = assetMap[assetId];
      if (!asset) continue;

      try {
        const img = await _loadLayerImage(asset, layer, tokens);
        if (!img) continue;

        ctx.save();
        const blend = layer.blendMode || 'source-over';
        ctx.globalCompositeOperation = blend === 'normal' ? 'source-over' : blend;
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.restore();
      } catch (e) {
        console.error(`Engine: failed to render layer ${layer.id}`, e);
      }
    }
  }

  function clearCache() { _cache.clear(); }

  return { render, clearCache, CANVAS_SIZE };
})();

if (typeof module !== 'undefined') module.exports = Engine;
