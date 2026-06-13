/**
 * Engine — compositor de capas sobre canvas 1000×1000.
 * Renderiza placeholders cuando no hay asset real.
 * Soporta blend modes por capa.
 */

const Engine = (() => {
  const CANVAS_SIZE = 1000;

  // Cache de imágenes renderizadas { cacheKey: ImageBitmap|HTMLImageElement }
  const _cache = new Map();

  // ── Placeholders ──────────────────────────────────────────────────────────

  const PLACEHOLDER_COLORS = {
    'bg-green':   '#2D5A27',
    'bg-blue':    '#1A3A5C',
    'bg-sand':    '#C9A96E',
    'bg-teal':    '#1A6B6B'
  };

  /**
   * Genera un SVG placeholder para cada tipo de layer, posicionado
   * dentro del canvas canónico 1000×1000.
   */
  function _makePlaceholderSVG(src) {
    const key = src.replace('placeholder:', '');
    const w = 1000, h = 1000;

    // Fondos sólidos
    if (key in PLACEHOLDER_COLORS) {
      const c = PLACEHOLDER_COLORS[key];
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${w}" height="${h}" fill="${c}"/>
      </svg>`;
    }

    // Emociones — círculo + símbolo flotante, arriba izquierda
    if (key.startsWith('emotion-')) {
      const symbols = { 'emotion-sun': '☀', 'emotion-star': '★', 'emotion-eye': '👁' };
      const sym = symbols[key] || '✦';
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="180" cy="200" r="80" fill="#FFD700" opacity="0.85"/>
        <text x="180" y="215" text-anchor="middle" font-size="72" fill="#333">${sym}</text>
      </svg>`;
    }

    // Cuerpo — torso + brazos, zona y=500-900
    if (key === 'body-default') {
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <rect class="skin-fill" x="340" y="560" width="320" height="320" rx="30" fill="#D4956A"/>
        <rect class="skin-fill" x="210" y="570" width="130" height="220" rx="50" fill="#D4956A"/>
        <rect class="skin-fill" x="660" y="570" width="130" height="220" rx="50" fill="#D4956A"/>
      </svg>`;
    }

    // Camisetas — sobre el torso y=520-880
    if (key.startsWith('shirt-')) {
      const colors = { 'shirt-basic': '#2980B9', 'shirt-vneck': '#27AE60', 'shirt-stripe': '#C0392B' };
      const c = colors[key] || '#888';
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <rect class="shirt-fill" x="330" y="520" width="340" height="360" rx="20" fill="${c}"/>
        <rect class="shirt-fill" x="200" y="530" width="130" height="230" rx="40" fill="${c}"/>
        <rect class="shirt-fill" x="670" y="530" width="130" height="230" rx="40" fill="${c}"/>
        ${key === 'shirt-stripe' ? `<rect x="330" y="600" width="340" height="30" fill="white" opacity="0.4"/>
        <rect x="330" y="670" width="340" height="30" fill="white" opacity="0.4"/>` : ''}
      </svg>`;
    }

    // Cabello atrás — zona y=100-400
    if (key.endsWith('-back')) {
      const shapes = {
        'hair-short-back':  `<ellipse cx="500" cy="270" rx="160" ry="80" fill="#8B4513"/>`,
        'hair-long-back':   `<rect x="330" y="220" width="40" height="400" rx="20" fill="#8B4513"/>
                             <rect x="630" y="220" width="40" height="400" rx="20" fill="#8B4513"/>
                             <ellipse cx="500" cy="260" rx="180" ry="70" fill="#8B4513"/>`,
        'hair-afro-back':   `<ellipse cx="500" cy="230" rx="240" ry="140" fill="#1A1A1A"/>`
      };
      const shape = shapes[key] || `<ellipse cx="500" cy="260" rx="170" ry="80" fill="#8B4513"/>`;
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <g class="hair-fill">${shape}</g>
      </svg>`;
    }

    // Rostros — cabeza oval, zona y=280-550
    if (key.startsWith('head-')) {
      const rx = key === 'head-round' ? 175 : 155;
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <ellipse class="skin-fill" cx="500" cy="420" rx="${rx}" ry="175" fill="#D4956A"/>
        <ellipse cx="440" cy="410" rx="18" ry="20" fill="#2C1810"/>
        <ellipse cx="560" cy="410" rx="18" ry="20" fill="#2C1810"/>
        <path d="M 450 470 Q 500 500 550 470" stroke="#2C1810" stroke-width="5" fill="none" stroke-linecap="round"/>
      </svg>`;
    }

    // Cabello frente — sobre el rostro
    if (key.endsWith('-front')) {
      const shapes = {
        'hair-short-front':  `<path d="M320 300 Q500 200 680 300 L680 350 Q500 270 320 350 Z" fill="#8B4513"/>`,
        'hair-long-front':   `<path d="M300 280 Q500 180 700 280 L700 330 Q500 240 300 330 Z" fill="#8B4513"/>
                              <rect x="305" y="320" width="35" height="280" rx="18" fill="#8B4513"/>`,
        'hair-afro-front':   `<ellipse cx="500" cy="250" rx="230" ry="130" fill="#1A1A1A" opacity="0.9"/>`
      };
      const shape = shapes[key] || `<path d="M330 300 Q500 210 670 300 L670 345 Q500 265 330 345 Z" fill="#8B4513"/>`;
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <g class="hair-fill">${shape}</g>
      </svg>`;
    }

    // Vello facial
    if (key === 'fhair-beard') {
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <path class="hair-fill" d="M390 480 Q500 540 610 480 L615 560 Q500 600 385 560 Z" fill="#8B4513"/>
      </svg>`;
    }

    // Collar
    if (key === 'acc-collar') {
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="500" cy="560" rx="80" ry="18" fill="#D4AF37" opacity="0.9"/>
        <circle cx="500" cy="580" r="14" fill="#D4AF37"/>
      </svg>`;
    }

    // Gorras / accesorios cabeza
    if (key.startsWith('hat-')) {
      const styles = {
        'hat-snapback': `<rect x="330" y="250" width="340" height="80" rx="10" fill="#1A1A1A"/>
                        <rect x="290" y="320" width="420" height="20" rx="5" fill="#333"/>`,
        'hat-bucket':   `<ellipse cx="500" cy="270" rx="200" ry="55" fill="#E8805A"/>
                        <rect x="340" y="270" width="320" height="100" rx="10" fill="#E8805A"/>`,
        'hat-wide':     `<ellipse cx="500" cy="250" rx="250" ry="40" fill="#8B6914"/>
                        <rect x="380" y="180" width="240" height="80" rx="8" fill="#A0772A"/>`
      };
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        ${styles[key] || `<ellipse cx="500" cy="270" rx="180" ry="60" fill="#444"/>`}
      </svg>`;
    }

    // Lentes
    if (key.startsWith('glasses-')) {
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        ${key === 'glasses-round'
          ? `<circle cx="430" cy="400" r="55" fill="none" stroke="#1A1A1A" stroke-width="12"/>
             <circle cx="570" cy="400" r="55" fill="none" stroke="#1A1A1A" stroke-width="12"/>
             <line x1="485" y1="400" x2="515" y2="400" stroke="#1A1A1A" stroke-width="8"/>`
          : `<rect x="375" y="360" width="110" height="80" rx="8" fill="none" stroke="#1A1A1A" stroke-width="12"/>
             <rect x="515" y="360" width="110" height="80" rx="8" fill="none" stroke="#1A1A1A" stroke-width="12"/>
             <line x1="485" y1="400" x2="515" y2="400" stroke="#1A1A1A" stroke-width="8"/>`}
      </svg>`;
    }

    // Máscaras — zona y=360-540, lado derecho
    if (key.startsWith('mask-')) {
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        ${key === 'mask-full'
          ? `<ellipse cx="500" cy="430" rx="155" ry="175" fill="#1A1A1A" opacity="0.75"/>`
          : `<path d="M340 430 Q500 280 660 430 L660 550 Q500 480 340 550 Z" fill="#1A1A1A" opacity="0.7"/>`}
      </svg>`;
    }

    // Efectos — gradiente suave semi-transparente
    if (key.startsWith('effect-')) {
      return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="eg" cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="${w}" height="${h}" fill="url(#eg)"/>
      </svg>`;
    }

    // Fallback genérico
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="350" y="350" width="300" height="300" rx="20" fill="#888" opacity="0.4"/>
      <text x="500" y="510" text-anchor="middle" font-size="36" fill="#555">${key}</text>
    </svg>`;
  }

  // ── Carga de assets ───────────────────────────────────────────────────────

  /**
   * Devuelve una Image dibujable para un asset dado.
   * Soporta: placeholder:xxx, URLs relativas (SVG/PNG).
   */
  async function _loadAsset(src, bindings) {
    if (!src) return null;

    const cacheKey = src + JSON.stringify(bindings || {});
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    let img;

    if (src.startsWith('placeholder:')) {
      const svgStr = _makePlaceholderSVG(src);
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
   * @param {Array} layers — de layer-config.json, ordenados por .order
   * @param {Object} selections — { layerId: assetId }
   * @param {Object} tokens — { tokenId: hexColor }
   */
  async function render(canvas, layers, selections, tokens) {
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const sorted = [...layers].sort((a, b) => a.order - b.order);

    for (const layer of sorted) {
      const selectedId = selections[layer.id];
      if (selectedId === undefined || selectedId === null) continue;

      const asset = layer.assets.find(a => a.id === selectedId);
      if (!asset || !asset.src) continue;

      // Construir bindings de color para esta capa
      const bindings = {};
      if (layer.colorBinding && layer.svgTarget && tokens[layer.colorBinding]) {
        bindings[layer.svgTarget] = tokens[layer.colorBinding];
      }

      try {
        const img = await _loadAsset(asset.src, bindings);
        if (!img) continue;

        ctx.save();
        if (layer.blendMode && layer.blendMode !== 'normal') {
          ctx.globalCompositeOperation = layer.blendMode;
        }
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
