/**
 * ColorEngine — recolorea SVGs inline usando tokens de color.
 * Aplica color a elementos con clase .skin-fill, .hair-fill, .shirt-fill, etc.
 */

const ColorEngine = (() => {

  /**
   * Dada una cadena SVG y un mapa { svgClass: hexColor }, devuelve el SVG recoloreado.
   */
  function recolor(svgString, bindings) {
    if (!svgString || !bindings || Object.keys(bindings).length === 0) return svgString;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return svgString;

    for (const [className, color] of Object.entries(bindings)) {
      const cls = className.startsWith('.') ? className.slice(1) : className;
      svgEl.querySelectorAll('.' + cls).forEach(el => {
        el.style.fill = color;
        el.setAttribute('fill', color);
      });
    }

    return new XMLSerializer().serializeToString(svgEl);
  }

  /**
   * Convierte SVG string a un objeto Image listo para dibujar en canvas.
   */
  function svgToImage(svgString) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')); };
      img.src = url;
    });
  }

  /**
   * Carga un SVG desde URL como string.
   */
  async function fetchSVG(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SVG fetch failed: ${url}`);
    return res.text();
  }

  /**
   * Pipeline completo: fetch → recolor → Image.
   * bindings: { '.skin-fill': '#D4956A' }
   */
  async function loadRecolored(url, bindings) {
    const raw = await fetchSVG(url);
    const colored = recolor(raw, bindings);
    return svgToImage(colored);
  }

  /**
   * Convierte hex a HSL.
   */
  function hexToHSL(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  /**
   * Valida si un color cumple las constraints del token hair-color.
   */
  function validateHairColor(hex, constraints) {
    const { h, s, l } = hexToHSL(hex);
    if (constraints.saturation?.min !== undefined && s < constraints.saturation.min) return false;
    if (constraints.lightness?.min !== undefined && l < constraints.lightness.min) return false;
    if (constraints.lightness?.max !== undefined && l > constraints.lightness.max) return false;
    return true;
  }

  return { recolor, svgToImage, fetchSVG, loadRecolored, hexToHSL, validateHairColor };
})();

if (typeof module !== 'undefined') module.exports = ColorEngine;
