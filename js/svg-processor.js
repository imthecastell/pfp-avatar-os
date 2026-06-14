/**
 * SVGProcessor — puente entre Affinity Designer iPad y el engine.
 * Affinity exporta grupos con id="skin-fill"; este módulo propaga
 * esas clases a los hijos para que ColorEngine pueda seleccionarlos.
 */

const SVGProcessor = {

  COLORABLE_CLASSES: ['skin-fill', 'hair-fill', 'shirt-fill', 'acc-fill', 'mask-fill'],
  FIXED_CLASSES:     ['outline', 'shadow', 'blush', 'detail', 'whites', 'texture', 'crack'],

  process(svgContent) {
    const doc = this.parse(svgContent);
    this.convertGroupIdsToClasses(doc);
    this.ensureViewBox(doc);
    this.cleanInlineStyles(doc);
    return this.serialize(doc);
  },

  parse(svgContent) {
    return new DOMParser().parseFromString(svgContent, 'image/svg+xml');
  },

  serialize(doc) {
    return new XMLSerializer().serializeToString(doc.documentElement || doc);
  },

  // <g id="skin-fill"> → clase propagada a todos los shapes hijos
  convertGroupIdsToClasses(doc) {
    const ALL = [...this.COLORABLE_CLASSES, ...this.FIXED_CLASSES];
    doc.querySelectorAll('g[id]').forEach(group => {
      const id = group.getAttribute('id');
      if (!ALL.includes(id)) return;
      group.setAttribute('class', (group.getAttribute('class') || '') + ' ' + id);
      group.querySelectorAll('path, circle, rect, ellipse, polygon, polyline, line')
           .forEach(el => el.classList.add(id));
    });
  },

  ensureViewBox(doc) {
    const svg = doc.querySelector('svg');
    if (!svg) return;
    const vb = svg.getAttribute('viewBox');
    if (vb !== '0 0 1000 1000') {
      console.warn(`[SVGProcessor] viewBox incorrecto: "${vb}" — corrigiendo a 1000×1000`);
      svg.setAttribute('viewBox', '0 0 1000 1000');
      svg.setAttribute('width',   '1000');
      svg.setAttribute('height',  '1000');
    }
  },

  // Elimina fill inline de elementos coloreables (para que los atributos dominen)
  cleanInlineStyles(doc) {
    const sel = this.COLORABLE_CLASSES.map(c => `.${c}`).join(', ');
    doc.querySelectorAll(sel).forEach(el => {
      const style = el.getAttribute('style') || '';
      if (!style.includes('fill:')) return;
      const fillMatch = style.match(/fill:\s*([^;]+)/);
      if (fillMatch && !el.getAttribute('fill')) {
        el.setAttribute('fill', fillMatch[1].trim());
      }
      el.setAttribute('style', style.replace(/fill:[^;]+;?/g, '').trim());
    });
  },

  // Valida un SVG antes de guardarlo en el admin
  validate(svgContent) {
    const errors   = [];
    const warnings = [];
    let doc;
    try {
      doc = this.parse(svgContent);
    } catch(e) {
      return { valid: false, errors: ['No se pudo parsear el SVG'], warnings };
    }

    const svg = doc.querySelector('svg');
    if (!svg) return { valid: false, errors: ['No es un SVG válido'], warnings };

    const vb = svg.getAttribute('viewBox');
    if (vb !== '0 0 1000 1000') {
      errors.push(`viewBox debe ser "0 0 1000 1000", encontrado: "${vb}"`);
    }

    const colorableSel = [...this.COLORABLE_CLASSES, ...this.COLORABLE_CLASSES.map(c => `[id="${c}"]`)].join(', ');
    const hasColorable = doc.querySelector(colorableSel);
    const hasOutline   = doc.querySelector('.outline, [id="outline"]');

    if (!hasOutline)   warnings.push('No se encontró capa "outline" — contornos no separados');
    if (!hasColorable) warnings.push('No se encontró zona coloreable — no responderá a tokens de color');

    return { valid: errors.length === 0, errors, warnings };
  },

  // Genera SVG placeholder con viewBox correcto y zona visual marcada
  placeholder(layerId) {
    const COLORS = {
      'body-base':       '#F5C5A3',
      'head':            '#F5C5A3',
      'shirt':           '#4A90D9',
      'hair-back':       '#5C8A3C',
      'hair-front':      '#5C8A3C',
      'facial-hair':     '#5C8A3C',
      'emotion':         '#F39C12',
      'mask':            '#7F8C8D',
      'accessory-back':  '#2C2C2C',
      'accessory-front': '#2C2C2C',
      'accessory-face':  '#1A1A2E',
      'background':      '#1A6B6B',
      'frame':           '#D4AF37',
    };
    const ZONES = {
      'emotion':         { x: 80,  y: 60,  w: 200, h: 200 },
      'body-base':       { x: 150, y: 520, w: 700, h: 430 },
      'head':            { x: 280, y: 280, w: 440, h: 300 },
      'shirt':           { x: 170, y: 550, w: 660, h: 380 },
      'hair-back':       { x: 260, y: 190, w: 480, h: 230 },
      'hair-front':      { x: 270, y: 190, w: 460, h: 200 },
      'facial-hair':     { x: 340, y: 460, w: 320, h: 120 },
      'mask':            { x: 480, y: 300, w: 300, h: 280 },
      'accessory-back':  { x: 250, y: 220, w: 500, h: 200 },
      'accessory-front': { x: 200, y: 330, w: 580, h: 100 },
      'accessory-face':  { x: 320, y: 360, w: 360, h: 100 },
      'background':      { x: 0,   y: 0,   w: 1000,h: 1000 },
      'frame':           { x: 0,   y: 0,   w: 1000,h: 1000 },
    };
    const CLASS_MAP = {
      'body-base': 'skin-fill', 'head': 'skin-fill',
      'shirt': 'shirt-fill',
      'hair-back': 'hair-fill', 'hair-front': 'hair-fill', 'facial-hair': 'hair-fill',
    };

    const z   = ZONES[layerId]    || { x: 100, y: 100, w: 800, h: 800 };
    const col = COLORS[layerId]   || '#AAAAAA';
    const cls = CLASS_MAP[layerId]|| 'acc-fill';
    const isFullCanvas = (z.w === 1000 && z.h === 1000);

    return `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <rect class="${cls}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"
        fill="${col}" rx="${isFullCanvas ? 0 : 20}" opacity="${isFullCanvas ? 0.7 : 1}"/>
  ${!isFullCanvas ? `<rect class="outline"
        x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"
        fill="none" stroke="#1a1a1a" stroke-width="8" rx="20"/>
  <text x="${z.x + z.w/2}" y="${z.y + z.h/2}"
        text-anchor="middle" dominant-baseline="middle"
        fill="#1a1a1a" font-size="28" font-family="sans-serif">${layerId}</text>` : ''}
</svg>`;
  }
};

if (typeof module !== 'undefined') module.exports = SVGProcessor;
