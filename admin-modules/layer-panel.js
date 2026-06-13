/**
 * LayerPanel — UI drag & drop para gestión del stack de capas.
 * Emite eventos: 'layer-reorder', 'layer-edit', 'layer-new', 'layer-select'
 */

const LayerPanel = (() => {
  let _layers = [];
  let _onEvent = null;
  let _selectedId = null;
  let _dragSrc = null;

  function init(containerEl, layers, onEvent) {
    _layers = layers;
    _onEvent = onEvent;
    _render(containerEl);
  }

  function _render(container) {
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<span class="panel-title">Capas</span>
      <button class="btn-sm btn-accent" id="btn-new-layer">+ Nueva capa</button>`;
    container.appendChild(header);
    container.querySelector('#btn-new-layer').onclick = () => _emit('layer-new', null);

    const list = document.createElement('div');
    list.className = 'layer-list';
    list.id = 'layer-list';
    container.appendChild(list);

    _renderList(list);
  }

  function _renderList(list) {
    list.innerHTML = '';
    const sorted = [..._layers].sort((a, b) => a.order - b.order);
    sorted.forEach(layer => {
      const item = _makeItem(layer);
      list.appendChild(item);
    });
  }

  function _makeItem(layer) {
    const el = document.createElement('div');
    el.className = 'layer-item' + (layer.id === _selectedId ? ' selected' : '') + (layer.locked ? ' locked' : '');
    el.dataset.id = layer.id;
    el.draggable = !layer.locked;

    el.innerHTML = `
      <span class="drag-handle ${layer.locked ? 'disabled' : ''}">⠿</span>
      <span class="layer-order">${layer.order}</span>
      <div class="layer-info">
        <span class="layer-item-name">${layer.label}</span>
        <span class="layer-item-meta">${layer.id} · ${layer.blendMode}${layer.colorBinding ? ' · 🎨 ' + layer.colorBinding : ''}</span>
      </div>
      <div class="layer-badges">
        ${layer.locked ? '<span class="badge badge-lock">🔒</span>' : ''}
        ${layer.optional ? '<span class="badge badge-opt">opt</span>' : ''}
      </div>
      <button class="btn-icon btn-edit" title="Editar capa">✎</button>
    `;

    // Selección
    el.onclick = (e) => {
      if (e.target.classList.contains('btn-edit')) return;
      _selectedId = layer.id;
      document.querySelectorAll('.layer-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      _emit('layer-select', layer);
    };

    el.querySelector('.btn-edit').onclick = (e) => {
      e.stopPropagation();
      _emit('layer-edit', layer);
    };

    // Drag & drop (solo capas no locked)
    if (!layer.locked) {
      el.addEventListener('dragstart', e => {
        _dragSrc = layer.id;
        e.dataTransfer.effectAllowed = 'move';
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.layer-item').forEach(i => i.classList.remove('drag-over'));
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (_dragSrc && _dragSrc !== layer.id) {
          _swapLayers(_dragSrc, layer.id);
        }
      });
    }

    return el;
  }

  function _swapLayers(srcId, dstId) {
    const src = _layers.find(l => l.id === srcId);
    const dst = _layers.find(l => l.id === dstId);
    if (!src || !dst || src.locked || dst.locked) return;
    const tmp = src.order;
    src.order = dst.order;
    dst.order = tmp;
    const list = document.getElementById('layer-list');
    if (list) _renderList(list);
    _emit('layer-reorder', _layers);
  }

  function refresh(layers) {
    _layers = layers;
    const list = document.getElementById('layer-list');
    if (list) _renderList(list);
  }

  function _emit(type, data) {
    if (_onEvent) _onEvent({ type, data });
  }

  return { init, refresh };
})();
