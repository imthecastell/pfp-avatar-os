/**
 * SVGProcessor — normaliza SVGs de Affinity Designer y gestiona recoloreo.
 * Affinity exporta colores como fill:rgb(r,g,b) inline → string replace directo.
 * Los contornos negros (stroke/fill < 40,40,40) NUNCA se modifican.
 */
const SVGProcessor = (() => {

  const CANVAS_SIZE = 5936; // viewBox canónico de Affinity iPad

  function _isOutline(r, g, b) {
    return r < 40 && g < 40 && b < 40;
  }

  /**
   * Detecta colores únicos editables en un SVG string.
   * Excluye negros (contornos).
   * @returns [{ original: 'rgb(249,199,182)', count: 7 }]
   */
  function detectEditableColors(svgString) {
    const re = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
    const map = new Map();
    let m;
    while ((m = re.exec(svgString)) !== null) {
      const [, r, g, b] = m;
      if (_isOutline(+r, +g, +b)) continue;
      const key = `rgb(${r},${g},${b})`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([original, count]) => ({ original, count }));
  }

  /**
   * Reemplaza un color rgb() por otro hex en el SVG string.
   * fromColor: 'rgb(249,199,182)'  toHex: '#D4956A'
   * Los contornos negros NUNCA se tocan.
   */
  function recolorSVG(svgString, fromColor, toHex) {
    if (!fromColor || !toHex || !svgString) return svgString;
    const toRgb = _hexToRgb(toHex);
    if (!toRgb) return svgString;
    let result = svgString.replaceAll(fromColor, toRgb);
    // Variante compacta (sin espacios después de comas)
    const compact = fromColor.replace(/,\s+/g, ',');
    if (compact !== fromColor) result = result.replaceAll(compact, toRgb);
    return result;
  }

  /**
   * Aplica todos los colorOverrides de una variante al SVG.
   * variantAsset: { colorOverrides: [{ original, replacement }] }
   */
  function applyVariant(svgString, variantAsset) {
    let result = svgString;
    for (const { original, replacement } of (variantAsset.colorOverrides || [])) {
      result = recolorSVG(result, original, replacement);
    }
    return result;
  }

  /**
   * Aplica un token de color (reemplaza originalColor por tokenHex).
   */
  function applyToken(svgString, originalColor, tokenHex) {
    return recolorSVG(svgString, originalColor, tokenHex);
  }

  /**
   * Genera un SVG placeholder para desarrollo (viewBox 5936×5936).
   * Respeta los colores originales de Affinity para que el recoloreo funcione.
   */
  function generatePlaceholder(layerId) {
    const ZONES = {
      'background':   { x:0,    y:0,    w:5936, h:5936, full:true  },
      'emotion':      { x:200,  y:200,  w:1200, h:1200             },
      'hair-back':    { x:1600, y:800,  w:2700, h:1500             },
      'head':         { x:1500, y:1200, w:2900, h:2200             },
      'shirt':        { x:1000, y:2800, w:3900, h:2500             },
      'acc-back':     { x:1500, y:900,  w:2900, h:1200             },
      'hair-front':   { x:1700, y:900,  w:2500, h:1400             },
      'facial-hair':  { x:2300, y:2600, w:1300, h:700              },
      'mask':         { x:2600, y:1400, w:1800, h:1800             },
      'acc-front':    { x:1500, y:900,  w:2900, h:1200             },
      'acc-face':     { x:2100, y:1900, w:1700, h:600              },
      'effect-front': { x:0,    y:0,    w:5936, h:5936, full:true  },
      'effect-final': { x:0,    y:0,    w:5936, h:5936, full:true  },
      'frame':        { x:0,    y:0,    w:5936, h:5936, full:true  },
    };
    // Colores que coinciden con los originales de Affinity para que el recoloreo funcione
    const COLORS = {
      'background':   '#1A6B6B',
      'emotion':      '#D4AA1A',
      'hair-back':    'rgb(0,177,129)',
      'head':         'rgb(249,199,182)',
      'shirt':        'rgb(230,220,202)',
      'acc-back':     '#2C2C2C',
      'hair-front':   'rgb(0,177,129)',
      'facial-hair':  'rgb(0,177,129)',
      'mask':         '#969696',
      'acc-front':    '#3C3C3C',
      'acc-face':     '#1A1A2E',
      'effect-front': 'rgba(255,255,255,0.05)',
      'effect-final': 'rgba(200,180,255,0.2)',
      'frame':        '#D4AF37',
    };

    const z   = ZONES[layerId] || { x:500, y:500, w:4936, h:4936 };
    const col = COLORS[layerId] || '#888888';

    return `<svg viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">
  <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"
        fill="${col}" rx="${z.full ? 0 : 80}" opacity="${z.full ? 0.5 : 1}"/>
  ${!z.full ? `<text x="${z.x + z.w/2}" y="${z.y + z.h/2}" text-anchor="middle"
        dominant-baseline="middle" fill="rgba(0,0,0,0.3)"
        font-size="200" font-family="sans-serif">${layerId}</text>` : ''}
</svg>`;
  }

  function _hexToRgb(hex) {
    if (!hex) return null;
    if (hex[0] !== '#') return hex; // ya es rgb()
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgb(${r},${g},${b})`;
  }

  function _rgbToHex(rgb) {
    const m = rgb.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (!m) return null;
    return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  }

  return {
    detectEditableColors,
    recolorSVG,
    applyVariant,
    applyToken,
    generatePlaceholder,
    CANVAS_SIZE,
  };
})();

if (typeof module !== 'undefined') module.exports = SVGProcessor;
