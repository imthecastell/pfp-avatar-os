/**
 * Engine — compositor de capas sobre canvas 1000×1000 (v2).
 * Usa SVGProcessor para procesar SVGs de Affinity Designer.
 * Soporta blend modes por capa (usa "source-over" en lugar de "normal").
 */

const Engine = (() => {
  // Usa AssetScaler.SIZES.CANVAS cuando está disponible (2048), sino 1000
  const CANVAS_SIZE = (typeof AssetScaler !== 'undefined')
    ? AssetScaler.SIZES.CANVAS
    : 1000;

  // Cache de imágenes renderizadas { cacheKey: HTMLImageElement }
  const _cache = new Map();

  // ── Carga de assets ───────────────────────────────────────────────────────

  /**
   * Devuelve una Image dibujable para un asset dado.
   * Soporta: placeholder:<layerId>, URLs relativas (SVG/PNG).
   */
  async function _loadAsset(src, bindings, layer, tokens, variantId) {
    if (!src) return null;

    const cacheKey = src + JSON.stringify(bindings || {}) + (variantId || '');
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    let img;

    if (src.startsWith('placeholder:')) {
      const layerId = src.replace('placeholder:', '');
      const svgStr = SVGProcessor.placeholder(layerId);
      const colored = ColorEngine.recolor(svgStr, bindings || {});
      img = await ColorEngine.svgToImage(colored);

    } else if (src.endsWith('.svg')) {
      // Construir reemplazos RGB si la capa tiene originalColor (Affinity)
      const rgbReplacements = {};
      if (layer?.originalColor && layer?.colorBinding && tokens?.[layer.colorBinding]) {
        rgbReplacements[layer.originalColor] = tokens[layer.colorBinding];
      }
      // Cargar SVG como string para poder aplicar variante + RGB replace
      const raw = await ColorEngine.fetchSVG(src);
      let svgStr = (typeof SVGProcessor !== 'undefined') ? SVGProcessor.process(raw) : raw;
      // Aplicar variante (colorOverrides del admin)
      if (variantId && typeof VariantEngine !== 'undefined') {
        svgStr = VariantEngine.applyVariant(svgStr, variantId);
      }
      // Aplicar tokens: primero clases CSS (.skin-fill), luego RGB directo
      svgStr = ColorEngine.recolor(svgStr, bindings || {});
      if (Object.keys(rgbReplacements).length) {
        for (const [from, to] of Object.entries(rgbReplacements)) {
          svgStr = ColorEngine.applyColorReplacement(svgStr, from, to);
        }
      }
      img = await ColorEngine.svgToImage(svgStr);

    } else {
      img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });
    }

    // Escalar al tamaño de composición óptimo via AssetScaler
    if (typeof AssetScaler !== 'undefined') {
      try {
        img = await AssetScaler._scaleTo(img, AssetScaler.SIZES.CANVAS);
      } catch(e) {
        console.warn('[Engine] AssetScaler falló, usando imagen original', e);
      }
    }

    _cache.set(cacheKey, img);
    return img;
  }

  // ── Render principal ──────────────────────────────────────────────────────

  /**
   * Renderiza el avatar completo en el canvas dado.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Array}  layers         — de layer-config.json, ordenados por .order
   * @param {Object} selectedAssets — { layerId: filePath|variantId|null }
   * @param {Object} tokens         — { tokenId: hexColor }
   */
  async function render(canvas, layers, selectedAssets, tokens) {
    const ctx = canvas.getContext('2d');
    canvas.width  = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const sorted = [...layers].sort((a, b) => a.order - b.order);

    for (const layer of sorted) {
      const src = selectedAssets[layer.id];
      if (src === undefined || src === null) continue;

      // Construir bindings de color para esta capa
      const bindings = {};
      if (layer.colorBinding && layer.svgTarget && tokens[layer.colorBinding]) {
        bindings[layer.svgTarget] = tokens[layer.colorBinding];
      }

      // Para variantes: el src es el del padre, pero el id guardado puede ser un variantId
      const variantId = (typeof VariantEngine !== 'undefined' && VariantEngine.isVariant(src))
        ? src : null;
      const resolvedSrc = variantId
        ? VariantEngine.getVariant(variantId).parentSrc
        : src;

      try {
        const img = await _loadAsset(resolvedSrc, bindings, layer, tokens, variantId);
        if (!img) continue;

        ctx.save();
        const blendMode = layer.blendMode || 'source-over';
        // "normal" es alias legacy → mapear a source-over
        ctx.globalCompositeOperation = (blendMode === 'normal') ? 'source-over' : blendMode;
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.restore();
      } catch (e) {
        console.error(`Engine: failed to render layer ${layer.id}`, e);
      }
    }
  }

  function clearCache() {
    _cache.clear();
  }

  return { render, clearCache, CANVAS_SIZE };
})();

if (typeof module !== 'undefined') module.exports = Engine;
