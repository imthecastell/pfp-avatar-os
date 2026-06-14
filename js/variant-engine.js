/**
 * VariantEngine — duplicado y recoloreo de assets sin nuevos archivos SVG.
 * El admin crea variantes mapeando colores originales a nuevos valores.
 * Las variantes se almacenan como entradas en variant-config.json.
 *
 * Estructura de una variante:
 * {
 *   id: 'shirt-base-rojo',
 *   label: 'Polo Rojo',
 *   parentSrc: 'assets/shirt/shirt-base.svg',   // archivo fuente
 *   layerId: 'shirt',
 *   colorOverrides: [
 *     { original: 'rgb(230,220,202)', replacement: '#C0392B' },
 *   ],
 *   locked: false,
 *   keyword: null,
 * }
 */

const VariantEngine = {

  // Registry: variantId → variantConfig
  _registry: new Map(),

  // ── Registro ──────────────────────────────────────────────────────────────

  /**
   * Registra una variante. Llamado al cargar variant-config.json.
   */
  register(variantConfig) {
    this._registry.set(variantConfig.id, variantConfig);
  },

  /**
   * Registra un bloque completo desde variant-config.json.
   */
  loadConfig(config) {
    (config.variants || []).forEach(v => this.register(v));
    console.log(`[VariantEngine] ${this._registry.size} variantes registradas`);
  },

  isVariant(id) {
    return this._registry.has(id);
  },

  getVariant(id) {
    return this._registry.get(id) ?? null;
  },

  getAllForLayer(layerId) {
    return [...this._registry.values()].filter(v => v.layerId === layerId);
  },

  // ── Aplicación ────────────────────────────────────────────────────────────

  /**
   * Aplica los colorOverrides de una variante a un SVG string.
   * Si el id no es una variante registrada, devuelve el SVG intacto.
   */
  applyVariant(svgString, variantId) {
    const variant = this._registry.get(variantId);
    if (!variant || !variant.colorOverrides?.length) return svgString;

    let result = svgString;
    for (const { original, replacement } of variant.colorOverrides) {
      result = _colorReplace(result, original, replacement);
    }
    return result;
  },

  // ── Creación (desde el admin) ─────────────────────────────────────────────

  /**
   * Crea y registra una nueva variante en memoria.
   * Llama a exportConfig() para persistir.
   */
  createVariant(variantConfig) {
    const v = {
      id:             variantConfig.id || `variant-${Date.now()}`,
      label:          variantConfig.label,
      parentSrc:      variantConfig.parentSrc,
      layerId:        variantConfig.layerId,
      colorOverrides: variantConfig.colorOverrides || [],
      locked:         variantConfig.locked  ?? false,
      keyword:        variantConfig.keyword ?? null,
    };
    this.register(v);
    console.log(`[VariantEngine] Variante creada: ${v.id}`);
    return v;
  },

  deleteVariant(id) {
    return this._registry.delete(id);
  },

  // ── Detección de colores editables ────────────────────────────────────────

  /**
   * Detecta colores únicos en un SVG (excluye negro — contornos).
   * Devuelve [{ rgb, hex, count }] ordenados por frecuencia.
   */
  detectEditableColors(svgString) {
    const matches = svgString.match(/fill:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/g) || [];
    const freq = new Map();
    matches.forEach(m => {
      // Normalizar espacios dentro del rgb()
      const normalized = m.replace(/\s/g, '').replace('fill:', '');
      if (normalized === 'rgb(0,0,0)') return;   // negro = contorno, skip
      freq.set(normalized, (freq.get(normalized) || 0) + 1);
    });
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([rgb, count]) => ({
        rgb,
        hex:   _rgbStrToHex(rgb) || rgb,
        count,
      }));
  },

  // ── Thumbnail ─────────────────────────────────────────────────────────────

  /**
   * Genera un ImageBitmap thumbnail de una variante a tamaño pequeño.
   */
  async generateThumb(baseSvgString, variantId, size = 120) {
    const svg = this.applyVariant(baseSvgString, variantId);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        const oc  = new OffscreenCanvas(size, size);
        const ctx = oc.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(await createImageBitmap(oc));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('thumb failed')); };
      img.src = url;
    });
  },

  // ── Persistencia ──────────────────────────────────────────────────────────

  exportConfig() {
    return JSON.stringify({
      version:    '1.0',
      exportedAt: new Date().toISOString(),
      variants:   [...this._registry.values()],
    }, null, 2);
  },

  downloadConfig() {
    const json = this.exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'variant-config.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  clearRegistry() {
    this._registry.clear();
  },
};

// ── Helpers internos ──────────────────────────────────────────────────────────

function _colorReplace(svgString, fromColor, toHex) {
  const toRgb = _hexToRgbStr(toHex);
  let result = svgString;

  // Reemplazar rgb() directo (con y sin espacios)
  result = result.replaceAll(fromColor, toRgb);
  const noSpace = fromColor.replace(/\s/g, '');
  if (noSpace !== fromColor) result = result.replaceAll(noSpace, toRgb);

  // Reemplazar hex equivalente si existiera
  const fromHex = _rgbStrToHex(fromColor);
  if (fromHex) {
    result = result.replaceAll(fromHex.toLowerCase(), toRgb);
    result = result.replaceAll(fromHex.toUpperCase(), toRgb);
  }
  return result;
}

function _hexToRgbStr(hex) {
  if (!hex || hex[0] !== '#') return hex;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgb(${r},${g},${b})`;
}

function _rgbStrToHex(rgbStr) {
  const m = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return null;
  return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
}

if (typeof module !== 'undefined') module.exports = VariantEngine;
