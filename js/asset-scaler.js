/**
 * asset-scaler.js
 * Escala automáticamente assets HD al tamaño óptimo según su uso.
 *
 * TAMAÑOS DEL SISTEMA:
 *   CANVAS_SIZE   = 2048px  — canvas interno de composición (calidad)
 *   PREVIEW_SIZE  = 600px   — preview en el builder (velocidad)
 *   EXPORT_SIZE   = 2048px  — PNG final exportado (calidad máxima)
 *
 * Los assets de Affinity Designer vienen a 5936×5936px.
 * Este módulo los normaliza en el momento de carga, en el browser,
 * sin necesidad de preprocesarlos manualmente.
 */

const AssetScaler = {

  SIZES: {
    CANVAS:  1000,
    PREVIEW: 600,
    EXPORT:  1000,
    THUMB:   120,
  },

  _cache: new Map(),

  /**
   * Punto de entrada principal.
   * Recibe un File (upload) o una URL (asset preexistente).
   */
  async process(source, options = {}) {
    const { type = 'svg', generateThumb = true } = options;

    const cacheKey = source instanceof File
      ? `${source.name}-${source.size}`
      : source;

    if (this._cache.has(cacheKey)) {
      console.log(`[Scaler] Cache hit: ${cacheKey}`);
      return this._cache.get(cacheKey);
    }

    console.log(`[Scaler] Processing: ${cacheKey}`);

    const bitmap = await this._loadBitmap(source);
    console.log(`[Scaler] Original: ${bitmap.width}×${bitmap.height}px`);

    const result = {
      original: { width: bitmap.width, height: bitmap.height },
      canvas:   await this._scaleTo(bitmap, this.SIZES.CANVAS),
      thumb:    generateThumb ? await this._scaleTo(bitmap, this.SIZES.THUMB) : null,
      _bitmap:  bitmap,
    };

    this._cache.set(cacheKey, result);

    const savings = (1 - (this.SIZES.CANVAS / bitmap.width) ** 2) * 100;
    console.log(`[Scaler] Done. Reducción de memoria: ${savings.toFixed(0)}%`);

    return result;
  },

  /**
   * Carga un File o URL como ImageBitmap.
   */
  async _loadBitmap(source) {
    if (source instanceof File) {
      return await createImageBitmap(source);
    }
    const response = await fetch(source);
    const blob = await response.blob();
    return await createImageBitmap(blob);
  },

  /**
   * Escala un ImageBitmap o HTMLImageElement a targetSize×targetSize
   * via OffscreenCanvas. Devuelve un ImageBitmap.
   */
  async _scaleTo(source, targetSize) {
    const sw = source.width  ?? source.naturalWidth;
    const sh = source.height ?? source.naturalHeight;
    if (sw === targetSize && sh === targetSize) {
      return source instanceof ImageBitmap ? source : await createImageBitmap(source);
    }
    const offscreen = new OffscreenCanvas(targetSize, targetSize);
    const ctx = offscreen.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, targetSize, targetSize);
    return await createImageBitmap(offscreen);
  },

  /**
   * Versión para exportación — usa el bitmap original sin escalar
   * o lo escala al EXPORT_SIZE para máxima calidad.
   */
  async getForExport(cacheKey) {
    const cached = this._cache.get(cacheKey);
    if (!cached) throw new Error(`Asset no encontrado en cache: ${cacheKey}`);
    const { _bitmap } = cached;
    if (_bitmap.width > this.SIZES.EXPORT) {
      return await this._scaleTo(_bitmap, this.SIZES.EXPORT);
    }
    return _bitmap;
  },

  /**
   * Precarga todos los assets de una colección en paralelo.
   */
  async preloadCollection(assetPaths) {
    console.log(`[Scaler] Precargando ${assetPaths.length} assets...`);
    const results = await Promise.allSettled(
      assetPaths.map(path => this.process(path))
    );
    const loaded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[Scaler] Precarga completa: ${loaded} OK, ${failed} fallidos`);
    return { loaded, failed };
  },

  clearCache() {
    this._cache.forEach(result => {
      result._bitmap?.close?.();
      result.canvas?.close?.();
      result.thumb?.close?.();
    });
    this._cache.clear();
    console.log('[Scaler] Cache limpiado');
  },

  getCacheInfo() {
    return {
      entries: this._cache.size,
      keys: [...this._cache.keys()],
    };
  },
};

if (typeof module !== 'undefined') module.exports = AssetScaler;
