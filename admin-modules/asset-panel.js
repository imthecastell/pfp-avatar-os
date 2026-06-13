/**
 * AssetPanel — upload y asignación de assets por capa.
 * Emite eventos: 'asset-add', 'asset-remove', 'asset-select'
 */

const AssetPanel = (() => {
  let _layer = null;
  let _onEvent = null;
  let _container = null;

  function init(containerEl, onEvent) {
    _container = containerEl;
    _onEvent = onEvent;
    _render();
  }

  function setLayer(layer) {
    _layer = layer;
    _render();
  }

  function _render() {
    if (!_container) return;
    _container.innerHTML = '';

    if (!_layer) {
      _container.innerHTML = '<div class="empty-state">← Selecciona una capa para gestionar sus assets</div>';
      return;
    }

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
      <span class="panel-title">Assets · <em>${_layer.label}</em></span>
      <label class="btn-sm btn-accent upload-label">
        + Subir SVG/PNG
        <input type="file" id="asset-file-input" accept=".svg,.png,.jpg" multiple style="display:none">
      </label>`;
    _container.appendChild(header);

    // Bind upload
    header.querySelector('#asset-file-input').onchange = e => _handleUpload(e.target.files);

    // Grid de assets existentes
    const grid = document.createElement('div');
    grid.className = 'asset-admin-grid';
    _container.appendChild(grid);

    (_layer.assets || []).forEach(asset => {
      grid.appendChild(_makeAssetCard(asset));
    });

    // Drop zone
    const dropzone = document.createElement('div');
    dropzone.className = 'dropzone';
    dropzone.textContent = 'Arrastra SVG/PNG aquí';
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('active'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('active'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('active');
      _handleUpload(e.dataTransfer.files);
    });
    _container.appendChild(dropzone);
  }

  function _makeAssetCard(asset) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.dataset.id = asset.id;

    const preview = document.createElement('div');
    preview.className = 'asset-card-preview';
    if (asset.src && asset.src.startsWith('placeholder:')) {
      preview.style.background = '#2A2A3A';
      preview.innerHTML = `<span style="font-size:11px;color:#888">${asset.src.replace('placeholder:','')}</span>`;
    } else if (asset.src) {
      const img = document.createElement('img');
      img.src = asset.src;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain';
      preview.appendChild(img);
    } else {
      preview.innerHTML = '<span style="font-size:22px">✕</span>';
      preview.style.color = '#555';
    }

    const info = document.createElement('div');
    info.className = 'asset-card-info';
    info.innerHTML = `
      <span class="asset-card-name">${asset.label}</span>
      <span class="asset-card-id">${asset.id}</span>
      ${asset.fromKeyword ? `<span class="badge badge-kw">✦ ${asset.fromKeyword}</span>` : ''}
    `;

    const actions = document.createElement('div');
    actions.className = 'asset-card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.title = 'Editar';
    editBtn.textContent = '✎';
    editBtn.onclick = () => _emit('asset-select', { layer: _layer, asset });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-icon btn-danger';
    removeBtn.title = 'Eliminar';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => {
      if (confirm(`¿Eliminar asset "${asset.label}"?`)) {
        _layer.assets = _layer.assets.filter(a => a.id !== asset.id);
        _emit('asset-remove', { layer: _layer, asset });
        _render();
      }
    };

    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);

    card.appendChild(preview);
    card.appendChild(info);
    card.appendChild(actions);
    return card;
  }

  async function _handleUpload(files) {
    for (const file of files) {
      const isSVG = file.name.endsWith('.svg');

      if (isSVG) {
        const result = await AssetManager.validateSVG(file);
        if (!result.valid) {
          _showError(`${file.name}: ${result.error}`);
          continue;
        }
      }

      const dataUrl = await AssetManager.fileToDataURL(file);
      const id = file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '-').toLowerCase();
      const label = file.name.replace(/\.[^.]+$/, '');

      const newAsset = { id: `upload-${id}-${Date.now()}`, label, src: dataUrl, tags: [] };
      _layer.assets.push(newAsset);
      _emit('asset-add', { layer: _layer, asset: newAsset });
      _render();
    }
  }

  function _showError(msg) {
    const err = document.createElement('div');
    err.className = 'toast toast-error';
    err.textContent = msg;
    document.body.appendChild(err);
    setTimeout(() => err.remove(), 4000);
  }

  function _emit(type, data) {
    if (_onEvent) _onEvent({ type, data });
  }

  return { init, setLayer };
})();
