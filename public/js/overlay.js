let overlayBoxes = [];
let boxIdCounter = 1;
let selectedBoxId = null;

const canvasEl = $('#overlay-canvas-c3d4')[0];

function getCanvasRect() {
  return canvasEl.getBoundingClientRect();
}

function cellW() {
  return canvasEl.offsetWidth / window.APP.matrixW;
}

function cellH() {
  return canvasEl.offsetHeight / window.APP.matrixH;
}

function addBox() {
  const id = 'box-' + (boxIdCounter++);
  overlayBoxes.push({
    id,
    name: 'Zone-' + String.fromCharCode(64 + overlayBoxes.length + 1),
    color: '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0'),
    opacity: 60,
    x1: 2,
    y1: 2,
    x2: 18,
    y2: 12,
    visible: true,
    locked: false,
    effect: 'None'
  });
  selectedBoxId = id;
  renderOverlayCanvas();
  renderLayerList();
  syncPropsPanel();
}

function renderOverlayCanvas() {
  // Clear old box divs
  $(canvasEl).find('.overlay-box').remove();
  canvasEl.style.setProperty('--ar', window.APP.matrixW / window.APP.matrixH);
  const cw = cellW(),
    ch = cellH();

  // Grid overlay
  canvasEl.style.backgroundImage = 'linear-gradient(#1a1d27 1px, transparent 1px), linear-gradient(90deg, #1a1d27 1px, transparent 1px)';
  canvasEl.style.backgroundSize = (cw) + 'px ' + (ch) + 'px';

  $('#canvas-matrix-name-a1b2').text(window.APP.matrixW + '×' + window.APP.matrixH);
  const odt = $('#overlay-device-title');
  if (odt.length) odt.text(window.APP.name || 'M1');

  overlayBoxes.forEach(box => {
    if (!box.visible) return;
    const div = $('<div>').addClass('overlay-box').attr('data-boxid', box.id);
    const isActive = box.id === selectedBoxId && !box.locked;
    const left = box.x1 * cw,
      top = box.y1 * ch;
    const w = (box.x2 - box.x1) * cw,
      h = (box.y2 - box.y1) * ch;

    div.css({
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      width: w + 'px',
      height: h + 'px',
      background: box.color + (isActive ? '66' : '40'),
      border: (isActive ? '2' : '1') + 'px solid ' + box.color,
      outline: isActive ? '2px solid #f59e0b' : 'none',
      zIndex: isActive ? '10' : '1',
      opacity: isActive ? '1' : '0.25',
      cursor: isActive ? 'move' : 'default',
      pointerEvents: (box.locked || !isActive) ? 'none' : 'auto',
      borderRadius: '2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    // Label
    const lbl = $('<span>').text(box.locked ? '🔒 ' + box.name : box.name);
    lbl.css({
      color: '#fff',
      fontSize: '11px',
      pointerEvents: 'none',
      textShadow: '0 1px 3px rgba(0,0,0,0.8)'
    });
    div.append(lbl);

    if (isActive) {
      div.css('pointer-events', 'auto');
      // Resize handles
      const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
      const cursors = {
        nw: 'nw-resize',
        n: 'n-resize',
        ne: 'ne-resize',
        w: 'w-resize',
        e: 'e-resize',
        sw: 'sw-resize',
        s: 's-resize',
        se: 'se-resize'
      };
      handles.forEach(h => {
        const hdl = $('<div>').addClass('box-handle').attr({ 'data-handle': h, 'data-boxid': box.id });
        const pos = {};
        if (h.includes('n')) pos.top = '-5px';
        if (h.includes('s')) pos.bottom = '-5px';
        if (!h.includes('n') && !h.includes('s')) pos.top = 'calc(50% - 5px)';
        if (h.includes('w')) pos.left = '-5px';
        if (h.includes('e')) pos.right = '-5px';
        if (!h.includes('w') && !h.includes('e')) pos.left = 'calc(50% - 5px)';
        hdl.css({
          ...pos,
          cursor: cursors[h],
          pointerEvents: 'auto'
        });
        div.append(hdl);
      });

      // mousedown on box body = move
      div.on('mousedown', (e) => {
        if ($(e.target).hasClass('box-handle')) return;
        e.preventDefault();
        startDrag('move', box.id, e.clientX, e.clientY);
      });
    }
    $(canvasEl).append(div);
  });

  // Handle mousedowns on handles (delegation)
  $(canvasEl).find('.box-handle').on('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startDrag(this.dataset.handle, this.dataset.boxid, e.clientX, e.clientY);
  });

  updateCanvasStatus();
}

// Click on canvas to select box
$(canvasEl).on('mousedown', (e) => {
  if (e.target === canvasEl) {
    // Check if clicked on an inactive visible box
    const rect = getCanvasRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    const cw = cellW(),
      ch = cellH();
    let found = null;
    for (let i = overlayBoxes.length - 1; i >= 0; i--) {
      const b = overlayBoxes[i];
      if (!b.visible || b.locked) continue;
      if (mx >= b.x1 * cw && mx <= b.x2 * cw && my >= b.y1 * ch && my <= b.y2 * ch) {
        found = b.id;
        break;
      }
    }
    if (found) {
      selectedBoxId = found;
    } else {
      selectedBoxId = null;
    }
    renderOverlayCanvas();
    renderSegCanvas();
    renderSegLayerList();
    renderLayerList();
    syncPropsPanel();
  }
});

// Drag state
let drag = {
  active: false,
  type: null,
  boxId: null,
  sx: 0,
  sy: 0,
  origBox: null
};

function startDrag(type, boxId, sx, sy) {
  const box = overlayBoxes.find(b => b.id === boxId);
  if (!box) return;
  drag = {
    active: true,
    type,
    boxId,
    sx,
    sy,
    origBox: {
      x1: box.x1,
      y1: box.y1,
      x2: box.x2,
      y2: box.y2
    }
  };
}

function clamp(v, mn, mx) {
  return Math.max(mn, Math.min(mx, v));
}

$(document).on('mousemove', (e) => {
  const pill = $('#coord-pill-e5f6');
  const rect = getCanvasRect();
  const mx = e.clientX - rect.left,
    my = e.clientY - rect.top;
  const cw = cellW(),
    ch = cellH();

  if (!drag.active) {
    if (mx >= 0 && mx <= rect.width && my >= 0 && my <= rect.height) {
      const cx = Math.floor(mx / cw),
        cy = Math.floor(my / ch);
      pill.text('X: ' + cx + '  Y: ' + cy);
    }
    return;
  }

  e.preventDefault();
  const dx = Math.round((e.clientX - drag.sx) / cw);
  const dy = Math.round((e.clientY - drag.sy) / ch);
  const box = overlayBoxes.find(b => b.id === drag.boxId);
  if (!box) return;
  const o = drag.origBox;
  let x1 = o.x1,
    y1 = o.y1,
    x2 = o.x2,
    y2 = o.y2;
  const mW = window.APP.matrixW,
    mH = window.APP.matrixH;

  switch (drag.type) {
    case 'move':
      x1 = o.x1 + dx;
      x2 = o.x2 + dx;
      y1 = o.y1 + dy;
      y2 = o.y2 + dy;
      break;
    case 'nw':
      x1 = o.x1 + dx;
      y1 = o.y1 + dy;
      break;
    case 'n':
      y1 = o.y1 + dy;
      break;
    case 'ne':
      x2 = o.x2 + dx;
      y1 = o.y1 + dy;
      break;
    case 'w':
      x1 = o.x1 + dx;
      break;
    case 'e':
      x2 = o.x2 + dx;
      break;
    case 'sw':
      x1 = o.x1 + dx;
      y2 = o.y2 + dy;
      break;
    case 's':
      y2 = o.y2 + dy;
      break;
    case 'se':
      x2 = o.x2 + dx;
      y2 = o.y2 + dy;
      break;
  }

  if (drag.type === 'move') {
    const bw = o.x2 - o.x1,
      bh = o.y2 - o.y1;
    x1 = clamp(x1, 0, mW - bw);
    y1 = clamp(y1, 0, mH - bh);
    x2 = x1 + bw;
    y2 = y1 + bh;
  } else {
    x1 = clamp(x1, 0, mW - 1);
    x2 = clamp(x2, x1 + 1, mW);
    y1 = clamp(y1, 0, mH - 1);
    y2 = clamp(y2, y1 + 1, mH);
  }
  box.x1 = x1;
  box.x2 = x2;
  box.y1 = y1;
  box.y2 = y2;

  if (drag.type === 'move') pill.text('X: ' + x1 + '  Y: ' + y1 + '  [move]');
  else pill.text('X: ' + x1 + '–' + x2 + '  Y: ' + y1 + '–' + y2 + '  [resize]');

  renderOverlayCanvas();
  renderSegCanvas();
  renderSegLayerList();
  syncSegProps();
  syncPropsPanel();
});

$(document).on('mouseup', () => {
  drag.active = false;
});

function renderLayerList() {
  const list = $('#layer-list-w5x6');
  const empty = $('#no-boxes-y7z8');
  // Remove only dynamic rows, keep placeholder in DOM
  list.find('.overlay-layer-row').remove();
  if (overlayBoxes.length === 0) {
    empty.show();
    return;
  }
  empty.hide();
  overlayBoxes.forEach((box, idx) => {
    const row = $('<div>').addClass('layer-row overlay-layer-row' + (box.id === selectedBoxId ? ' selected' : ''));
    row.html(`
      <span style="width:12px;height:12px;border-radius:2px;background:${box.color};display:inline-block;flex-shrink:0;"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;font-size:12px;">${box.name}</span>
      <button class="layer-vis" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px;" title="Toggle visibility">${box.visible?'👁':'👁‍🗨'}</button>
      <button class="layer-lock" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px;${box.locked?'color:var(--amber);':''}" title="Toggle lock">🔒</button>
      <button class="layer-up" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;color:var(--muted);" title="Move up">↑</button>
      <button class="layer-down" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;color:var(--muted);" title="Move down">↓</button>
      <button class="layer-del" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px;color:#ef4444;font-weight:700;" title="Delete">✕</button>
    `);
    row.on('click', (e) => {
      if ($(e.target).closest('button').length) return;
      selectedBoxId = box.id;
      renderOverlayCanvas();
      renderSegCanvas();
      renderSegLayerList();
      renderLayerList();
      syncPropsPanel();
    });
    list.append(row);
  });
  // Layer button events
  list.find('.layer-vis').on('click', function (e) {
    e.stopPropagation();
    const b = overlayBoxes[parseInt(this.dataset.idx)];
    b.visible = !b.visible;
    renderOverlayCanvas();
    renderLayerList();
  });
  list.find('.layer-lock').on('click', function (e) {
    e.stopPropagation();
    const b = overlayBoxes[parseInt(this.dataset.idx)];
    b.locked = !b.locked;
    renderOverlayCanvas();
    renderSegCanvas();
    renderSegLayerList();
    renderLayerList();
    syncPropsPanel();
  });
  list.find('.layer-up').on('click', function (e) {
    e.stopPropagation();
    const i = parseInt(this.dataset.idx);
    if (i > 0) {
      [overlayBoxes[i - 1], overlayBoxes[i]] = [overlayBoxes[i], overlayBoxes[i - 1]];
      renderOverlayCanvas();
      renderLayerList();
    }
  });
  list.find('.layer-down').on('click', function (e) {
    e.stopPropagation();
    const i = parseInt(this.dataset.idx);
    if (i < overlayBoxes.length - 1) {
      [overlayBoxes[i + 1], overlayBoxes[i]] = [overlayBoxes[i], overlayBoxes[i + 1]];
      renderOverlayCanvas();
      renderLayerList();
    }
  });
  list.find('.layer-del').on('click', function (e) {
    e.stopPropagation();
    const b = overlayBoxes[parseInt(this.dataset.idx)];
    overlayBoxes = overlayBoxes.filter(x => x.id !== b.id);
    if (selectedBoxId === b.id) selectedBoxId = overlayBoxes.length ? overlayBoxes[0].id : null;
    renderOverlayCanvas();
    renderLayerList();
    syncPropsPanel();
  });
}

function syncPropsPanel() {
  const empty = $('#props-empty-o5p6');
  const form = $('#props-form-q7r8');
  const box = overlayBoxes.find(b => b.id === selectedBoxId);
  if (!box) {
    empty.show();
    form.hide();
    return;
  }
  empty.hide();
  form.show();
  $('#prop-name-s9t0').val(box.name);
  $('#prop-color-u1v2').val(box.color);
  $('#prop-opacity-w3x4').val(box.opacity);
  $('#prop-opacity-val-y5z6').text(box.opacity + '%');
  $('#prop-x1-a7b8').val(box.x1);
  $('#prop-x2-c9d0').val(box.x2);
  $('#prop-y1-e1f2').val(box.y1);
  $('#prop-y2-g3h4').val(box.y2);
  $('#prop-effect-i5j6').val(box.fx != null ? box.fx : (box.effect || '0'));
  const palEl = $('#prop-pal-i5j7');
  if (palEl.length) palEl.val(box.pal || 0);
  const sxEl = $('#prop-sx-i5j8');
  if (sxEl.length) sxEl.val(box.sx != null ? box.sx : 128);
  const ixEl = $('#prop-ix-i5j9');
  if (ixEl.length) ixEl.val(box.ix != null ? box.ix : 128);
  const sxv = $('#prop-sx-val');
  if (sxv.length) sxv.text(box.sx != null ? box.sx : 128);
  const ixv = $('#prop-ix-val');
  if (ixv.length) ixv.text(box.ix != null ? box.ix : 128);
  const c1 = $('#prop-col1-i5k0');
  if (c1.length) c1.val(box.col1 || '#ffffff');
  const c2 = $('#prop-col2-i5k1');
  if (c2.length) c2.val(box.col2 || '#000000');
}

function updateFromProps() {
  const box = overlayBoxes.find(b => b.id === selectedBoxId);
  if (!box) return;
  box.name = $('#prop-name-s9t0').val();
  box.color = $('#prop-color-u1v2').val();
  box.opacity = parseInt($('#prop-opacity-w3x4').val());
  box.x1 = parseInt($('#prop-x1-a7b8').val()) || 0;
  box.x2 = parseInt($('#prop-x2-c9d0').val()) || 1;
  box.y1 = parseInt($('#prop-y1-e1f2').val()) || 0;
  box.y2 = parseInt($('#prop-y2-g3h4').val()) || 1;
  box.fx = parseInt($('#prop-effect-i5j6').val()) || 0;
  box.effect = box.fx; // keep backward compat
  const pW = $('#prop-pal-i5j7');
  if (pW.length) box.pal = parseInt(pW.val()) || 0;
  const sW = $('#prop-sx-i5j8');
  if (sW.length) {
    box.sx = parseInt(sW.val());
    $('#prop-sx-val').text(box.sx);
  }
  const iW = $('#prop-ix-i5j9');
  if (iW.length) {
    box.ix = parseInt(iW.val());
    $('#prop-ix-val').text(box.ix);
  }
  const c1W = $('#prop-col1-i5k0');
  if (c1W.length) box.col1 = c1W.val();
  const c2W = $('#prop-col2-i5k1');
  if (c2W.length) box.col2 = c2W.val();
  $('#prop-opacity-val-y5z6').text(box.opacity + '%');
  renderOverlayCanvas();
  renderLayerList();
}

['prop-name-s9t0', 'prop-color-u1v2', 'prop-opacity-w3x4', 'prop-x1-a7b8', 'prop-x2-c9d0', 'prop-y1-e1f2', 'prop-y2-g3h4', 'prop-effect-i5j6', 'prop-pal-i5j7', 'prop-sx-i5j8', 'prop-ix-i5j9', 'prop-col1-i5k0', 'prop-col2-i5k1'].forEach(id => {
  $('#' + id).on('input', updateFromProps);
});

function updateCanvasStatus() {
  const st = $('#canvas-status-g7h8');
  const box = overlayBoxes.find(b => b.id === selectedBoxId);
  if (!box) {
    st.text('No box selected — click a box to select');
    return;
  }
  const w = box.x2 - box.x1,
    h = box.y2 - box.y1;
  st.text('Selected: ' + box.name + '  ·  X: ' + box.x1 + '→' + box.x2 + '  ·  Y: ' + box.y1 + '→' + box.y2 + '  ·  ' + w + '×' + h + ' LEDs  ·  ' + (w * h) + ' total');
}

$('#add-box-u3v4').on('click', addBox);
$('#delete-box-k7l8').on('click', () => {
  overlayBoxes = overlayBoxes.filter(b => b.id !== selectedBoxId);
  selectedBoxId = overlayBoxes.length ? overlayBoxes[0].id : null;
  renderOverlayCanvas();
  renderLayerList();
  syncPropsPanel();
});
$('#json-preview-btn-m9n0').on('click', () => {
  const pre = $('#json-preview-o1p2');
  if (!pre.is(':visible')) {
    const box = overlayBoxes.find(b => b.id === selectedBoxId);
    pre.text(box ? JSON.stringify({
      seg: [{
        id: 0,
        start: box.x1,
        stop: box.x2
      }]
    }, null, 2) : '{}');
    pre.show();
  } else {
    pre.hide();
  }
});

$('#overlay-fetch-btn').on('click', async () => {
  const ip = window.APP.ip;
  if (!ip) {
    showToast('⚠ No device IP — connect first', 'warn');
    return;
  }
  showToast('Fetching from ' + ip + '...', 'info', 1500);
  try {
    const res = await deviceFetch('http://' + ip + '/json/state');
    if (!res.ok) {
      showToast('✗ Fetch failed: HTTP ' + res.status, 'error', 4000);
      return;
    }
    const data = await res.json();
    const segs = (data.seg || []).filter(s => s.start != null);
    if (!segs.length) {
      showToast('⚠ No segments found on device', 'warn');
      return;
    }
    const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#14b8a6'];

    function rgbToHex(a) {
      if (!a || a.length < 3) return '#ffffff';
      return '#' + a.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
    }
    overlayBoxes = segs.map((s, i) => ({
      id: 'box-' + (boxIdCounter++),
      name: s.n || ('Overlay-' + i),
      color: colors[i % colors.length],
      x1: s.start != null ? s.start : 0,
      x2: s.stop != null ? s.stop : window.APP.matrixW,
      y1: s.startY != null ? s.startY : 0,
      y2: s.stopY != null ? s.stopY : window.APP.matrixH,
      visible: true,
      locked: false,
      mi: s.mi || 0,
      fx: s.fx || 0,
      pal: s.pal || 0,
      sx: s.sx != null ? s.sx : 128,
      ix: s.ix != null ? s.ix : 128,
      opacity: s.bri != null ? Math.round(s.bri / 255 * 100) : 80,
      col1: rgbToHex(s.col ? s.col[0] : null),
      col2: rgbToHex(s.col ? s.col[1] : null)
    }));
    selectedBoxId = overlayBoxes.length ? overlayBoxes[0].id : null;
    renderOverlayCanvas();
    renderLayerList();
    syncPropsPanel();
    showToast('✓ Fetched ' + segs.length + ' overlay' + (segs.length > 1 ? 's' : ''), 'success');
  } catch (e) {
    showToast('✗ Cannot reach ' + ip + ' — ' + e.message, 'error', 5000);
  }
});

$('#apply-matrix-i9j0').on('click', () => {
  const segs = overlayBoxes.filter(b => b.visible).map((b, i) => ({
    id: i,
    start: b.x1,
    stop: b.x2,
    startY: b.y1,
    stopY: b.y2,
    on: true,
    bri: Math.round((b.opacity || 60) / 100 * 255),
    fx: b.fx || 0,
    pal: b.pal || 0,
    sx: b.sx != null ? b.sx : 128,
    ix: b.ix != null ? b.ix : 128,
    col: [b.col1 ? [parseInt(b.col1.slice(1, 3), 16), parseInt(b.col1.slice(3, 5), 16), parseInt(b.col1.slice(5, 7), 16), 0] : [255, 255, 255, 0],
      b.col2 ? [parseInt(b.col2.slice(1, 3), 16), parseInt(b.col2.slice(3, 5), 16), parseInt(b.col2.slice(5, 7), 16), 0] : [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  }));
  wledPost({
    seg: segs
  });
});
$('#reset-boxes-k1l2').on('click', () => {
  overlayBoxes = [];
  selectedBoxId = null;
  boxIdCounter = 1;
  renderOverlayCanvas();
  renderLayerList();
  syncPropsPanel();
});

// === DEVICES ===
// Panel toggles and redraw on canvas size change
['layers', 'props'].forEach(k => {
  $('#ov-toggle-' + k).on('click', () => {
    $('#page-overlay').toggleClass('hide-' + k);
    renderOverlayCanvas();
  });
});
new ResizeObserver(() => {
  if (canvasEl.offsetWidth) renderOverlayCanvas();
}).observe(canvasEl);