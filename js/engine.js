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

  function _isBitmap(src) {
    if (!src) return false;
    const lower = src.split('?')[0].toLowerCase();
    return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp');
  }

  async function _loadBitmapImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function _loadLayerImage(asset, layer, tokens) {
    const cacheKey = asset.id + JSON.stringify(tokens);
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    const src = asset.src || `placeholder:${layer.id}`;
    // _srcHint: nombre original del archivo cuando src es un blob URL temporal
    const srcForTypeCheck = asset._srcHint || src;
    let img;

    if (_isBitmap(srcForTypeCheck)) {
      // PNG/JPG — cargar como imagen directamente, sin procesar como SVG
      try {
        img = await _loadBitmapImage(src);
      } catch(e) {
        // Fallback: placeholder SVG
        const svgText = SVGProcessor.generatePlaceholder(layer.id);
        img = await AssetLoader.svgToImage(svgText);
      }
    } else {
      // SVG o placeholder — pipeline normal
      let svgText;
      try {
        svgText = await AssetLoader.loadSVGText(src);
      } catch (e) {
        svgText = SVGProcessor.generatePlaceholder(layer.id);
      }

      if (asset.colorOverrides && asset.colorOverrides.length) {
        svgText = SVGProcessor.applyVariant(svgText, asset);
      }
      if (layer.colorToken && tokens[layer.colorToken]) {
        const originalColor = TOKEN_ORIGINALS[layer.colorToken];
        if (originalColor) {
          svgText = SVGProcessor.applyToken(svgText, originalColor, tokens[layer.colorToken]);
        }
      }
      img = await AssetLoader.svgToImage(svgText);
    }

    // Escalar a CANVAS_SIZE via OffscreenCanvas si es necesario
    let result = img;
    if ((img.naturalWidth || img.width) !== CANVAS_SIZE || (img.naturalHeight || img.height) !== CANVAS_SIZE) {
      try {
        const oc = new OffscreenCanvas(CANVAS_SIZE, CANVAS_SIZE);
        const oc_ctx = oc.getContext('2d');
        oc_ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
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
        ctx.globalCompositeOperation = (blend === 'normal' || blend === 'pass-through') ? 'source-over' : blend;
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
