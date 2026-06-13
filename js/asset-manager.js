/**
 * AssetManager — validación y almacenamiento de assets.
 * Valida que SVGs cargados tengan viewBox="0 0 1000 1000".
 */

const AssetManager = (() => {

  /**
   * Valida que un archivo SVG tenga el viewBox canónico.
   * Devuelve { valid, error }.
   */
  async function validateSVG(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (!svg) return resolve({ valid: false, error: 'Archivo no es un SVG válido' });

        const vb = svg.getAttribute('viewBox');
        if (!vb) return resolve({ valid: false, error: 'SVG sin viewBox — debe ser "0 0 1000 1000"' });

        const parts = vb.trim().split(/[\s,]+/);
        if (parts.length !== 4 || parts[0] !== '0' || parts[1] !== '0' ||
            parts[2] !== '1000' || parts[3] !== '1000') {
          return resolve({ valid: false, error: `viewBox incorrecto: "${vb}" — debe ser "0 0 1000 1000"` });
        }

        resolve({ valid: true, error: null, svgText: text });
      };
      reader.onerror = () => resolve({ valid: false, error: 'Error leyendo archivo' });
      reader.readAsText(file);
    });
  }

  /**
   * Convierte un File a data URL para preview inmediato.
   */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Exporta el layer-config actual como JSON descargable.
   */
  function exportLayerConfig(layers) {
    const data = JSON.stringify({ layers }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layer-config.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Importa layer-config desde un File JSON.
   */
  async function importLayerConfig(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.layers || !Array.isArray(data.layers)) {
            reject(new Error('JSON inválido: falta el array "layers"'));
          } else {
            resolve(data);
          }
        } catch (err) {
          reject(new Error('Error parseando JSON: ' + err.message));
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  return { validateSVG, fileToDataURL, exportLayerConfig, importLayerConfig };
})();

if (typeof module !== 'undefined') module.exports = AssetManager;
