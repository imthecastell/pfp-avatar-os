/**
 * BatchUploader — organiza archivos SVG/PNG en lote según nomenclatura.
 *
 * Convenciones de nombre detectadas automáticamente:
 *   head-*            → head
 *   hair-back-*       → hair-back
 *   hair-front-*      → hair-front
 *   hair-*            → hair-back  (default, se puede corregir)
 *   acc-back-*        → accessory-back
 *   acc-front-*       → accessory-front
 *   acc-face-* / glasses-* → accessory-face
 *   bg-*              → background
 *   shirt-*           → shirt
 *   body-*            → body-base
 *   mask-*            → mask
 *   fhair-* / facial-* → facial-hair
 *   frame-*           → frame
 *   emotion-*         → emotion
 *
 * El src generado usa la ruta:  assets/{layerId}/{filename}
 */

const BatchUploader = {

  // Mapa prefijo → layerId, ordenado de más específico a menos específico
  RULES: [
    { test: /^head/,         layer: 'head' },
    { test: /^hair-back/,    layer: 'hair-back' },
    { test: /^hair-front/,   layer: 'hair-front' },
    { test: /^hair/,         layer: 'hair-back' },
    { test: /^acc-back/,     layer: 'accessory-back' },
    { test: /^acc-front/,    layer: 'accessory-front' },
    { test: /^acc-face/,     layer: 'accessory-face' },
    { test: /^glasses/,      layer: 'accessory-face' },
    { test: /^acc/,          layer: 'accessory-face' },
    { test: /^bg[-_]/,       layer: 'background' },
    { test: /^background/,   layer: 'background' },
    { test: /^shirt/,        layer: 'shirt' },
    { test: /^body/,         layer: 'body-base' },
    { test: /^mask/,         layer: 'mask' },
    { test: /^fhair/,        layer: 'facial-hair' },
    { test: /^facial/,       layer: 'facial-hair' },
    { test: /^frame/,        layer: 'frame' },
    { test: /^emotion/,      layer: 'emotion' },
  ],

  /**
   * Detecta el layer de destino a partir del nombre del archivo.
   * Devuelve null si no hay match.
   */
  detectLayer(filename) {
    const name = filename.toLowerCase().replace(/\.(svg|png|jpg|jpeg)$/, '');
    for (const rule of this.RULES) {
      if (rule.test.test(name)) return rule.layer;
    }
    return null;
  },

  /**
   * Procesa un array de Files.
   * Devuelve un array de objetos { file, name, ext, detectedLayer, previewUrl, valid, errors, warnings }
   */
  async processFiles(files) {
    const results = [];

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      const item = {
        file,
        name:          file.name,
        ext,
        detectedLayer: this.detectLayer(file.name),
        previewUrl:    null,
        valid:         true,
        errors:        [],
        warnings:      [],
      };

      if (!['svg', 'png', 'jpg', 'jpeg'].includes(ext)) {
        item.valid = false;
        item.errors.push(`Extensión no soportada: .${ext}`);
        results.push(item);
        continue;
      }

      // Leer contenido
      const content = await this._readFile(file);

      // Validar SVG via SVGProcessor
      if (ext === 'svg' && typeof SVGProcessor !== 'undefined') {
        const validation = SVGProcessor.validate(content);
        if (!validation.valid) {
          item.valid  = false;
          item.errors = validation.errors;
        }
        item.warnings = validation.warnings;
      }

      // Preview URL (blob)
      item.previewUrl = URL.createObjectURL(file);

      if (!item.detectedLayer) {
        item.warnings.push('No se pudo detectar la capa — selecciona manualmente');
      }

      results.push(item);
    }

    return results;
  },

  /**
   * Agrupa los resultados por layerId.
   * { 'head': [...items], 'hair-back': [...items], ... }
   */
  groupByLayer(items) {
    const groups = {};
    for (const item of items) {
      const key = item.assignedLayer || item.detectedLayer || '__unknown__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  },

  /**
   * Convierte los items confirmados en entradas de assets para layer-config.json.
   * Añade directamente a los layers pasados por referencia.
   * Devuelve { added, skipped } y lista de instrucciones de copia de archivos.
   */
  applyToLayers(items, layers) {
    let added = 0, skipped = 0;
    const copyInstructions = [];

    for (const item of items) {
      if (!item.valid) { skipped++; continue; }
      const layerId = item.assignedLayer || item.detectedLayer;
      if (!layerId) { skipped++; continue; }

      const layer = layers.find(l => l.id === layerId);
      if (!layer) { skipped++; continue; }

      const src   = `assets/${layerId}/${item.name}`;
      const newId = item.name.replace(/\.(svg|png|jpg|jpeg)$/i, '').toLowerCase();

      // No duplicar si ya existe
      if (layer.assets.find(a => a.id === newId || a.src === src)) {
        skipped++;
        continue;
      }

      layer.assets.push({
        id:    newId,
        label: this._toLabel(newId),
        src,
        tags:  [],
      });

      copyInstructions.push({ file: item.name, dest: `assets/${layerId}/` });
      added++;
    }

    return { added, skipped, copyInstructions };
  },

  // ── Helpers internos ──

  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      if (file.type.includes('svg')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  },

  _toLabel(id) {
    return id
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  },
};

if (typeof module !== 'undefined') module.exports = BatchUploader;
