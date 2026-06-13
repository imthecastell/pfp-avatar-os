/**
 * KeywordPanel — CRUD completo de keywords y sets desbloqueables.
 */

const KeywordPanel = (() => {
  let _config = null;
  let _container = null;
  let _layers = [];
  let _onChange = null;

  function init(containerEl, kwConfig, layers, onChange) {
    _container = containerEl;
    _config = kwConfig;
    _layers = layers;
    _onChange = onChange;
    _render();
  }

  function _render() {
    _container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<span class="panel-title">Keywords</span>
      <button class="btn-sm btn-accent" id="btn-new-kw">+ Nueva keyword</button>`;
    _container.appendChild(header);
    _container.querySelector('#btn-new-kw').onclick = () => _openWizard(null);

    const table = document.createElement('table');
    table.className = 'kw-table';
    table.innerHTML = `<thead><tr>
      <th>Keyword</th><th>Label</th><th>Hint</th><th>Assets</th><th>Estado</th><th></th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');
    (_config.keywords || []).forEach(kw => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${kw.keyword}</code></td>
        <td>${kw.label}</td>
        <td class="text-muted">${kw.hint || '—'}</td>
        <td>${_countAssets(kw)}</td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${kw.active ? 'checked' : ''} data-kw="${kw.keyword}">
            <span class="toggle-track"></span>
          </label>
        </td>
        <td>
          <button class="btn-icon" data-edit="${kw.keyword}">✎</button>
          <button class="btn-icon btn-danger" data-del="${kw.keyword}">✕</button>
        </td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    _container.appendChild(table);

    // Bind eventos de tabla
    _container.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.onchange = () => {
        const kw = _config.keywords.find(k => k.keyword === cb.dataset.kw);
        if (kw) { kw.active = cb.checked; _onChange(_config); }
      };
    });
    _container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => {
        const kw = _config.keywords.find(k => k.keyword === btn.dataset.edit);
        if (kw) _openWizard(kw);
      };
    });
    _container.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        if (!confirm(`¿Eliminar keyword "${btn.dataset.del}"?`)) return;
        _config.keywords = _config.keywords.filter(k => k.keyword !== btn.dataset.del);
        _onChange(_config);
        _render();
      };
    });
  }

  function _countAssets(kw) {
    let n = 0;
    if (kw.unlocks?.outfit) n += Object.keys(kw.unlocks.outfit).length;
    if (kw.unlocks?.themedAssets) n += kw.unlocks.themedAssets.length;
    return n;
  }

  function _openWizard(existing) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const box = document.createElement('div');
    box.className = 'modal-box wizard';

    const isNew = !existing;
    const kw = existing ? { ...existing, unlocks: JSON.parse(JSON.stringify(existing.unlocks || {})) }
                        : { keyword: '', label: '', hint: '', active: true, scope: 'cross-collection', unlocks: { outfit: {}, themedAssets: [] } };

    box.innerHTML = `
      <div class="modal-header">
        <h2>${isNew ? 'Nueva keyword' : 'Editar: ' + kw.keyword}</h2>
        <button class="btn-icon modal-close">✕</button>
      </div>

      <div class="wizard-form">
        <div class="form-row">
          <label>Keyword (mayúsculas)</label>
          <input id="wz-keyword" value="${kw.keyword}" placeholder="PATO" ${!isNew ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label>Nombre/Label</label>
          <input id="wz-label" value="${kw.label}" placeholder="Set Pato">
        </div>
        <div class="form-row">
          <label>Hint (pista)</label>
          <input id="wz-hint" value="${kw.hint || ''}" placeholder="Qué hace el pato">
        </div>
        <div class="form-row">
          <label>Scope</label>
          <select id="wz-scope">
            <option value="cross-collection" ${kw.scope==='cross-collection'?'selected':''}>Cross-collection</option>
            <option value="collection" ${kw.scope==='collection'?'selected':''}>Sólo esta colección</option>
          </select>
        </div>
      </div>

      <div class="wizard-section">
        <div class="wizard-section-title">Assets desbloqueados</div>
        <div id="wz-assets-list"></div>
        <button class="btn-sm" id="wz-add-asset">+ Agregar asset</button>
      </div>

      <div class="modal-footer">
        <button class="btn-sm" id="wz-cancel">Cancelar</button>
        <button class="btn-sm btn-accent" id="wz-save">Guardar</button>
      </div>`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    box.querySelector('.modal-close').onclick = close;
    box.querySelector('#wz-cancel').onclick = close;

    // Renderizar assets existentes
    const assetsList = box.querySelector('#wz-assets-list');
    const allAssets = [...Object.entries(kw.unlocks.outfit || {}).map(([slot, src]) => ({ slot, src, type: 'outfit' })),
                       ...(kw.unlocks.themedAssets || []).map(a => ({ slot: a.layer, src: a.asset, type: 'themed' }))];

    let assetRows = [...allAssets];
    function renderAssetRows() {
      assetsList.innerHTML = '';
      assetRows.forEach((row, i) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'asset-row';
        rowEl.innerHTML = `
          <select class="row-layer">
            ${_layers.map(l => `<option value="${l.id}" ${l.id===row.slot?'selected':''}>${l.label}</option>`).join('')}
          </select>
          <input class="row-src" value="${row.src}" placeholder="ruta/al/asset.svg">
          <button class="btn-icon btn-danger row-del">✕</button>`;
        rowEl.querySelector('.row-del').onclick = () => { assetRows.splice(i, 1); renderAssetRows(); };
        assetsList.appendChild(rowEl);
      });
    }
    renderAssetRows();

    box.querySelector('#wz-add-asset').onclick = () => {
      assetRows.push({ slot: _layers[0]?.id || '', src: '', type: 'outfit' });
      renderAssetRows();
    };

    box.querySelector('#wz-save').onclick = () => {
      const keyword = box.querySelector('#wz-keyword').value.toUpperCase().trim();
      const label   = box.querySelector('#wz-label').value.trim();
      const hint    = box.querySelector('#wz-hint').value.trim();
      const scope   = box.querySelector('#wz-scope').value;

      if (!keyword || !label) { alert('Keyword y Label son obligatorios.'); return; }

      // Reconstruir unlocks desde rows
      const outfit = {};
      const themedAssets = [];
      assetsList.querySelectorAll('.asset-row').forEach(rowEl => {
        const slot = rowEl.querySelector('.row-layer').value;
        const src  = rowEl.querySelector('.row-src').value.trim();
        if (!src) return;
        const layerType = _layers.find(l => l.id === slot)?.type;
        if (layerType === 'svg') outfit[slot] = src;
        else themedAssets.push({ layer: slot, asset: src });
      });

      const updated = { keyword, label, hint, active: kw.active ?? true, scope, unlocks: { outfit, themedAssets } };

      if (isNew) {
        if (_config.keywords.find(k => k.keyword === keyword)) { alert('Esta keyword ya existe.'); return; }
        _config.keywords.push(updated);
      } else {
        const idx = _config.keywords.findIndex(k => k.keyword === keyword);
        if (idx !== -1) _config.keywords[idx] = updated;
      }

      _onChange(_config);
      _render();
      close();
    };
  }

  return { init };
})();
