/**
 * Engine — compositor de capas sobre canvas 1000×1000 (v2).
 * Usa SVGProcessor para procesar SVGs de Affinity Designer.
 * Soporta blend modes por capa (usa "source-over" en lugar de "normal").
 */

const Engine = (() => {
  const CANVAS_SIZE = 1000;

  // Cache de imágenes renderizadas { cacheKey: HTMLImageElement }
  const _cache = new Map();

  // ── Carga de assets ───────────────────────────────────────────────────────

  /**
   * Devuelve una Image dibujable para un asset dado.
   * Soporta: placeholder:<layerId>, URLs relativas (SVG/PNG).
   */
  async function _loadAsset(src, bindings) {
    if (!src) return null;

    const cacheKey = src + JSON.stringify(bindings || {});
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    let img;

    if (src.startsWith('placeholder:')) {
      const layerId = src.replace('placeholder:', '');
      const svgStr = SVGProcessor.placeholder(layerId);
      const colored = ColorEngine.recolor(svgStr, bindings || {});
      img = await ColorEngine.svgToImage(colored);

    } else if (src.endsWith('.svg')) {
      img = await ColorEngine.loadRecolored(src, bindings || {});

    } else {
      img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });
    }

    _cache.set(cacheKey, img);
    return img;
  }

  // ── Render principal ──────────────────────────────────────────────────────

  /**
   * Renderiza el avatar completo en el canvas dado.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Array}  layers     — de layer-config.json, ordenados por .order
   * @param {Object} selectedAssets — { layerId: filePath|null }
   * @param {Object} tokens     — { tokenId: hexColor }
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

      try {
        const img = await _loadAsset(src, bindings);
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
