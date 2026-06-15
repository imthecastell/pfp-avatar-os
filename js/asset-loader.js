/**
 * AssetLoader — carga SVGs y bitmaps, escala a 2048px via OffscreenCanvas.
 * Caché en memoria por sesión. Soporta scheme placeholder: inline.
 */
const AssetLoader = (() => {
  const _cache = new Map();

  async function loadSVGText(path) {
    if (_cache.has(path)) return _cache.get(path);

    let text;
    if (path && path.startsWith('placeholder:')) {
      const layerId = path.replace('placeholder:', '');
      text = SVGProcessor.generatePlaceholder(layerId);
    } else {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`AssetLoader: fetch failed ${path} (${res.status})`);
      text = await res.text();
    }

    _cache.set(path, text);
    return text;
  }

  function svgToImage(svgString) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('AssetLoader: svgToImage failed')); };
      img.src = url;
    });
  }

  async function loadBitmap(path, targetSize = 2048) {
    const cacheKey = `bitmap:${path}:${targetSize}`;
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    const res = await fetch(path);
    if (!res.ok) throw new Error(`AssetLoader: fetch failed ${path}`);
    const blob = await res.blob();
    const img = await createImageBitmap(blob);

    let result;
    if (img.width === targetSize && img.height === targetSize) {
      result = img;
    } else {
      const oc = new OffscreenCanvas(targetSize, targetSize);
      const ctx = oc.getContext('2d');
      ctx.drawImage(img, 0, 0, targetSize, targetSize);
      result = await createImageBitmap(oc);
    }

    _cache.set(cacheKey, result);
    return result;
  }

  function clearCache() { _cache.clear(); }

  return { loadSVGText, svgToImage, loadBitmap, clearCache };
})();

if (typeof module !== 'undefined') module.exports = AssetLoader;
