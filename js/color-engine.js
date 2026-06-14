/**
 * ColorEngine — recolorea SVGs inline usando tokens de color.
 * Aplica color a elementos con clase .skin-fill, .hair-fill, .shirt-fill, etc.
 * Las clases FIXED (outline, shadow, blush, etc.) nunca son modificadas.
 */

const ColorEngine = (() => {

  const FIXED_CLASSES = ['outline', 'shadow', 'blush', 'detail', 'whites', 'texture', 'crack'];

  /**
   * Dada una cadena SVG y un mapa { svgClass: hexColor }, devuelve el SVG recoloreado.
   * Nunca toca elementos con clase FIXED (outline, shadow, etc.).
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
        // Nunca modificar elementos con clase FIXED
        if (FIXED_CLASSES.some(fc => el.classList.contains(fc))) return;
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
   * Pipeline completo: fetch → process (Affinity compat) → recolor → Image.
   * bindings: { '.skin-fill': '#D4956A' }
   * Si la capa también tiene originalColor, aplica reemplazo RGB como fallback.
   */
  async function loadRecolored(url, bindings, rgbReplacements) {
    const raw = await fetchSVG(url);
    const processed = (typeof SVGProcessor !== 'undefined') ? SVGProcessor.process(raw) : raw;
    let colored = recolor(processed, bindings);
    // Reemplazo RGB directo (Affinity inline fills)
    if (rgbReplacements) {
      for (const [from, toHex] of Object.entries(rgbReplacements)) {
        colored = applyColorReplacement(colored, from, toHex);
      }
    }
    return svgToImage(colored);
  }

  /**
   * Reemplaza un color RGB/hex en el SVG string directamente.
   * Útil para SVGs de Affinity que exportan fill:rgb() inline.
   */
  function applyColorReplacement(svgString, fromColor, toHex) {
    const toRgb = hexToRgbStr(toHex);
    let result = svgString;
    result = result.replaceAll(fromColor, toRgb);
    const noSpace = fromColor.replace(/\s/g, '');
    if (noSpace !== fromColor) result = result.replaceAll(noSpace, toRgb);
    const fromHex = rgbStrToHex(fromColor);
    if (fromHex) {
      result = result.replaceAll(fromHex.toLowerCase(), toRgb);
      result = result.replaceAll(fromHex.toUpperCase(), toRgb);
    }
    return result;
  }

  /**
   * Aplica tokens de color a un SVG de Affinity usando el originalColor de la capa.
   * layerDef: { colorBinding, originalColor }  (de layer-config.json)
   * tokens: { 'skin-color': '#D4956A', ... }
   */
  function applyTokensToSVG(svgString, layerDef, tokens) {
    if (!layerDef.originalColor || !layerDef.colorBinding) return svgString;
    const newHex = tokens[layerDef.colorBinding];
    if (!newHex) return svgString;
    return applyColorReplacement(svgString, layerDef.originalColor, newHex);
  }

  function hexToRgbStr(hex) {
    if (!hex || hex[0] !== '#') return hex;
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgb(${r},${g},${b})`;
  }

  function rgbStrToHex(rgbStr) {
    const m = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!m) return null;
    return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
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

  /**
   * Genera paleta de presets para el selector de cabello (8 tonos curativos).
   */
  function generateHairPalette() {
    return [
      { name: 'Negro',      hex: '#1A1A1A' },
      { name: 'Castaño',    hex: '#5C3317' },
      { name: 'Café',       hex: '#8B4513' },
      { name: 'Miel',       hex: '#C68642' },
      { name: 'Rubio',      hex: '#D4A017' },
      { name: 'Platino',    hex: '#E8DCCA' },
      { name: 'Rojizo',     hex: '#8B2500' },
      { name: 'Pelirrojo',  hex: '#C0392B' },
    ];
  }

  return { recolor, svgToImage, fetchSVG, loadRecolored, applyColorReplacement, applyTokensToSVG, hexToRgbStr, rgbStrToHex, hexToHSL, validateHairColor, generateHairPalette };
})();

if (typeof module !== 'undefined') module.exports = ColorEngine;
