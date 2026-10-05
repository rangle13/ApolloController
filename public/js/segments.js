// ===========================
let segZones = [];
let segIdCounter = 1;
let selectedSegId = null;

const segCanvas = document.getElementById('seg-canvas');

function segCellW() {
  return segCanvas.offsetWidth / window.APP.matrixW;
}

function segCellH() {
  return segCanvas.offsetHeight / window.APP.matrixH;
}

function segHexToRgbw(hex) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 0];
}

function addSegZone() {
  const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];
  const id = 'seg-' + (segIdCounter++);
  segZones.push({
    id,
    name: 'Seg-' + (segZones.length),
    color: colors[segZones.length % colors.length],
    x1: 0,
    y1: 0,
    x2: 16,
    y2: 16,
    visible: true,
    locked: false,
    mi: 0,
    fx: 0,
    pal: 0,
    bri: 200,
    sx: 128,
    ix: 128,
    col1: '#ffffff',
    col2: '#000000',
    col3: '#000000',
    on: true,
    rev: false,
    mi: 0
  });
  selectedSegId = id;
  renderSegCanvas();
  renderSegLayerList();
  syncSegProps();
}

function renderSegCanvas() {
  segCanvas.querySelectorAll('.seg-zone').forEach(e => e.remove());
  segCanvas.style.setProperty('--ar', window.APP.matrixW / window.APP.matrixH);
  const cw = segCellW(),
    ch = segCellH();
  segCanvas.style.backgroundImage = 'linear-gradient(#1a1d27 1px, transparent 1px), linear-gradient(90deg, #1a1d27 1px, transparent 1px)';
  segCanvas.style.backgroundSize = cw + 'px ' + ch + 'px';
  document.getElementById('seg-canvas-label').textContent = window.APP.matrixW + '×' + window.APP.matrixH;
  const sdt = document.getElementById('seg-device-title');
  if (sdt) sdt.textContent = window.APP.name || 'M1';

  segZones.forEach(seg => {
    if (!seg.visible) return;
    const div = document.createElement('div');
    div.className = 'seg-zone';
    div.dataset.segid = seg.id;
    const isActive = seg.id === selectedSegId && !seg.locked;
    const left = seg.x1 * cw,
      top = seg.y1 * ch;
    const w = (seg.x2 - seg.x1) * cw,
      h = (seg.y2 - seg.y1) * ch;
    Object.assign(div.style, {
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      width: w + 'px',
      height: h + 'px',
      background: seg.color + (isActive ? '66' : '33'),
      border: (isActive ? '2' : '1') + 'px solid ' + seg.color,
      outline: isActive ? '2px solid #f59e0b' : 'none',
      zIndex: isActive ? '10' : '1',
      opacity: isActive ? '1' : '0.3',
      cursor: isActive ? 'move' : 'default',
      pointerEvents: (seg.locked || !isActive) ? 'none' : 'auto',
      borderRadius: '2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    });
    const lbl = document.createElement('span');
    lbl.textContent = (seg.locked ? '🔒 ' : '') + seg.name;
    Object.assign(lbl.style, {
      color: '#fff',
      fontSize: '10px',
      pointerEvents: 'none',
      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
      textAlign: 'center'
    });
    div.appendChild(lbl);
    const fxLbl = document.createElement('span');
    fxLbl.textContent = 'fx:' + seg.fx + ' pal:' + seg.pal;
    Object.assign(fxLbl.style, {
      color: 'rgba(255,255,255,0.6)',
      fontSize: '9px',
      pointerEvents: 'none'
    });
    div.appendChild(fxLbl);

    if (isActive) {
      div.style.pointerEvents = 'auto';
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
        const hdl = document.createElement('div');
        hdl.className = 'box-handle'; // reuse same CSS
        hdl.dataset.handle = h;
        hdl.dataset.segid = seg.id;
        const pos = {};
        if (h.includes('n')) pos.top = '-5px';
        if (h.includes('s')) pos.bottom = '-5px';
        if (!h.includes('n') && !h.includes('s')) pos.top = 'calc(50% - 5px)';
        if (h.includes('w')) pos.left = '-5px';
        if (h.includes('e')) pos.right = '-5px';
        if (!h.includes('w') && !h.includes('e')) pos.left = 'calc(50% - 5px)';
        Object.assign(hdl.style, pos, {
          cursor: cursors[h],
          pointerEvents: 'auto'
        });
        div.appendChild(hdl);
      });
      div.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('box-handle')) return;
        e.preventDefault();
        startSegDrag('move', seg.id, e.clientX, e.clientY);
      });
    }
    segCanvas.appendChild(div);
  });

  segCanvas.querySelectorAll('.seg-zone .box-handle').forEach(hdl => {
    hdl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startSegDrag(hdl.dataset.handle, hdl.dataset.segid, e.clientX, e.clientY);
    });
  });
  updateSegStatus();
}

// Click canvas background to select a zone
segCanvas.addEventListener('mousedown', (e) => {
  if (e.target !== segCanvas) return;
  const rect = segCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left,
    my = e.clientY - rect.top;
  const cw = segCellW(),
    ch = segCellH();
  let found = null;
  for (let i = segZones.length - 1; i >= 0; i--) {
    const s = segZones[i];
    if (!s.visible || s.locked) continue;
    if (mx >= s.x1 * cw && mx <= s.x2 * cw && my >= s.y1 * ch && my <= s.y2 * ch) {
      found = s.id;
      break;
    }
  }
  selectedSegId = found;
  renderSegCanvas();
  renderSegLayerList();
  syncSegProps();
});

// Seg drag state
let segDrag = {
  active: false,
  type: null,
  segId: null,
  sx: 0,
  sy: 0,
  origSeg: null
};

function startSegDrag(type, segId, sx, sy) {
  const seg = segZones.find(s => s.id === segId);
  if (!seg) return;
  segDrag = {
    active: true,
    type,
    segId,
    sx,
    sy,
    origSeg: {
      x1: seg.x1,
      y1: seg.y1,
      x2: seg.x2,
      y2: seg.y2
    }
  };
}

document.addEventListener('mousemove', (e) => {
  const pill = document.getElementById('seg-coord-pill');
  if (!pill) return;
  const rect = segCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left,
    my = e.clientY - rect.top;
  const cw = segCellW(),
    ch = segCellH();

  if (!segDrag.active) {
    if (window.APP.activePage === 'segments' && mx >= 0 && mx <= rect.width && my >= 0 && my <= rect.height) {
      pill.textContent = 'X: ' + Math.floor(mx / cw) + '  Y: ' + Math.floor(my / ch);
    }
    return;
  }
  if (!segDrag.active) return;
  e.preventDefault();
  const dx = Math.round((e.clientX - segDrag.sx) / cw);
  const dy = Math.round((e.clientY - segDrag.sy) / ch);
  const seg = segZones.find(s => s.id === segDrag.segId);
  if (!seg) return;
  const o = segDrag.origSeg;
  let x1 = o.x1,
    y1 = o.y1,
    x2 = o.x2,
    y2 = o.y2;
  const mW = window.APP.matrixW,
    mH = window.APP.matrixH;
  switch (segDrag.type) {
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
  if (segDrag.type === 'move') {
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
  seg.x1 = x1;
  seg.x2 = x2;
  seg.y1 = y1;
  seg.y2 = y2;
  if (segDrag.type === 'move') pill.textContent = 'X: ' + x1 + '  Y: ' + y1 + '  [move]';
  else pill.textContent = 'X: ' + x1 + '–' + x2 + '  Y: ' + y1 + '–' + y2 + '  [resize]';
  renderSegCanvas();
  syncSegProps();
});

document.addEventListener('mouseup', () => {
  segDrag.active = false;
});

function renderSegLayerList() {
  const list = document.getElementById('seg-layer-list');
  const empty = document.getElementById('seg-no-items');
  // Remove only dynamic rows, keep placeholder in DOM
  list.querySelectorAll('.seg-layer-row').forEach(r => r.remove());
  document.getElementById('seg-delete-all-btn').style.display = segZones.length ? '' : 'none';
  if (segZones.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  segZones.forEach((seg, idx) => {
    const row = document.createElement('div');
    row.className = 'layer-row seg-layer-row' + (seg.id === selectedSegId ? ' selected' : '');
    row.innerHTML = `
      <span style="width:12px;height:12px;border-radius:2px;background:${seg.color};display:inline-block;flex-shrink:0;"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;font-size:12px;">${seg.name}</span>
      <button class="sl-vis" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px;" title="Toggle visibility">${seg.visible?'👁':'👁'}</button>
      <button class="sl-lock" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px;${seg.locked?'color:var(--amber);':''}" title="Toggle lock">🔒</button>
      <button class="sl-up" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;color:var(--muted);">↑</button>
      <button class="sl-down" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;color:var(--muted);">↓</button>
      <button class="sl-del" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px;color:#ef4444;font-weight:700;" title="Delete">✕</button>
    `;
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectedSegId = seg.id;
      renderSegCanvas();
      renderSegLayerList();
      syncSegProps();
    });
    list.appendChild(row);
  });
  list.querySelectorAll('.sl-vis').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = segZones[+btn.dataset.idx];
    s.visible = !s.visible;
    renderSegCanvas();
    renderSegLayerList();
  }));
  list.querySelectorAll('.sl-lock').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = segZones[+btn.dataset.idx];
    s.locked = !s.locked;
    renderSegCanvas();
    renderSegLayerList();
    syncSegProps();
  }));
  list.querySelectorAll('.sl-up').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const i = +btn.dataset.idx;
    if (i > 0) {
      [segZones[i - 1], segZones[i]] = [segZones[i], segZones[i - 1]];
      renderSegCanvas();
      renderSegLayerList();
    }
  }));
  list.querySelectorAll('.sl-down').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const i = +btn.dataset.idx;
    if (i < segZones.length - 1) {
      [segZones[i + 1], segZones[i]] = [segZones[i], segZones[i + 1]];
      renderSegCanvas();
      renderSegLayerList();
    }
  }));
  list.querySelectorAll('.sl-del').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = segZones[+btn.dataset.idx];
    segZones = segZones.filter(x => x.id !== s.id);
    if (selectedSegId === s.id) selectedSegId = segZones.length ? segZones[0].id : null;
    renderSegCanvas();
    renderSegLayerList();
    syncSegProps();
  }));
}

function syncSegProps() {
  const empty = document.getElementById('seg-props-empty');
  const form = document.getElementById('seg-props-form');
  const seg = segZones.find(s => s.id === selectedSegId);
  if (!seg) {
    empty.style.display = 'block';
    form.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  form.style.display = 'block';
  document.getElementById('sp-name').value = seg.name;
  document.getElementById('sp-color').value = seg.color;
  document.getElementById('sp-x1').value = seg.x1;
  document.getElementById('sp-x2').value = seg.x2;
  document.getElementById('sp-y1').value = seg.y1;
  document.getElementById('sp-y2').value = seg.y2;
  document.getElementById('sp-fx').value = seg.fx;
  document.getElementById('sp-pal').value = seg.pal;
  document.getElementById('sp-bri').value = seg.bri;
  document.getElementById('sp-bri-val').textContent = seg.bri;
  document.getElementById('sp-sx').value = seg.sx;
  document.getElementById('sp-sx-val').textContent = seg.sx;
  document.getElementById('sp-ix').value = seg.ix;
  document.getElementById('sp-ix-val').textContent = seg.ix;
  document.getElementById('sp-col1').value = seg.col1;
  document.getElementById('sp-col2').value = seg.col2;
  document.getElementById('sp-col3').value = seg.col3;
  document.getElementById('sp-on').checked = seg.on;
  document.getElementById('sp-rev').checked = seg.rev;
  const miEl = document.getElementById('sp-mi');
  if (miEl) miEl.value = seg.mi || 0;
  updateSegStatus();
}

function updateFromSegProps() {
  const seg = segZones.find(s => s.id === selectedSegId);
  if (!seg) return;
  seg.name = document.getElementById('sp-name').value;
  seg.color = document.getElementById('sp-color').value;
  seg.x1 = parseInt(document.getElementById('sp-x1').value) || 0;
  seg.x2 = parseInt(document.getElementById('sp-x2').value) || 1;
  seg.y1 = parseInt(document.getElementById('sp-y1').value) || 0;
  seg.y2 = parseInt(document.getElementById('sp-y2').value) || 1;
  seg.fx = parseInt(document.getElementById('sp-fx').value);
  seg.pal = parseInt(document.getElementById('sp-pal').value);
  seg.bri = parseInt(document.getElementById('sp-bri').value);
  document.getElementById('sp-bri-val').textContent = seg.bri;
  seg.sx = parseInt(document.getElementById('sp-sx').value);
  document.getElementById('sp-sx-val').textContent = seg.sx;
  seg.ix = parseInt(document.getElementById('sp-ix').value);
  document.getElementById('sp-ix-val').textContent = seg.ix;
  seg.col1 = document.getElementById('sp-col1').value;
  seg.col2 = document.getElementById('sp-col2').value;
  seg.col3 = document.getElementById('sp-col3').value;
  seg.on = document.getElementById('sp-on').checked;
  seg.rev = document.getElementById('sp-rev').checked;
  const miW = document.getElementById('sp-mi');
  if (miW) seg.mi = parseInt(miW.value) || 0;
  renderSegCanvas();
  renderSegLayerList();
  updateSegStatus();
}

function segZoneToWled(seg, idx) {
  // WLED 2D API: start/stop = X column range, startY/stopY = Y row range
  return {
    id: idx,
    start: seg.x1, // X start column (inclusive)
    stop: seg.x2, // X stop column (exclusive)
    startY: seg.y1, // Y start row (inclusive)
    stopY: seg.y2, // Y stop row (exclusive)
    on: seg.on,
    bri: seg.bri,
    fx: seg.fx,
    pal: seg.pal,
    sx: seg.sx,
    ix: seg.ix,
    rev: seg.rev,
    mi: seg.mi || 0,
    col: [segHexToRgbw(seg.col1), segHexToRgbw(seg.col2), segHexToRgbw(seg.col3)]
  };
}

function updateSegStatus() {
  const st = document.getElementById('seg-status-bar');
  if (!st) return;
  const seg = segZones.find(s => s.id === selectedSegId);
  if (!seg) {
    st.textContent = 'No segment selected — click a segment to select';
    return;
  }
  const w = seg.x2 - seg.x1,
    h = seg.y2 - seg.y1;
  const total = w * h;
  st.textContent = 'Selected: ' + seg.name + '  ·  X: ' + seg.x1 + '→' + seg.x2 + '  ·  Y: ' + seg.y1 + '→' + seg.y2 + '  ·  ' + w + '×' + h + ' = ' + total + ' LEDs  ·  fx:' + seg.fx + ' pal:' + seg.pal;
}

// Wire up all property inputs
['sp-name', 'sp-color', 'sp-x1', 'sp-x2', 'sp-y1', 'sp-y2', 'sp-fx', 'sp-pal', 'sp-bri', 'sp-sx', 'sp-ix', 'sp-col1', 'sp-col2', 'sp-col3', 'sp-on', 'sp-rev', 'sp-mi'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateFromSegProps);
  if (el) el.addEventListener('change', updateFromSegProps);
});

document.getElementById('seg-add-btn').addEventListener('click', addSegZone);

document.getElementById('seg-delete-all-btn').addEventListener('click', async () => {
  if (!confirm('Delete all ' + segZones.length + ' segment(s)? This also removes them from the device.')) return;
  segZones = [];
  selectedSegId = null;
  renderSegCanvas();
  renderSegLayerList();
  syncSegProps();

  const ip = window.APP.ip;
  if (!ip) return;
  try {
    const res = await deviceFetch('http://' + ip + '/json/state');
    const count = ((await res.json()).seg || []).length;
    if (!count) return;
    // WLED deletes a segment when stop=0; segment 0 always remains, so reset it to the full matrix.
    const seg = [];
    for (let id = count - 1; id >= 1; id--) seg.push({
      id,
      stop: 0
    });
    seg.push({
      id: 0,
      start: 0,
      stop: window.APP.matrixW,
      startY: 0,
      stopY: window.APP.matrixH
    });
    await wledPost({
      seg
    });
  } catch (e) {
    showToast('✗ Cleared locally; device not reached — ' + e.message, 'error', 5000);
  }
});

document.getElementById('sp-json-btn').addEventListener('click', () => {
  const pre = document.getElementById('sp-json-pre');
  if (pre.style.display === 'none') {
    const seg = segZones.find(s => s.id === selectedSegId);
    if (seg) {
      const idx = segZones.indexOf(seg);
      pre.textContent = JSON.stringify({
        seg: [segZoneToWled(seg, idx)]
      }, null, 2);
    }
    pre.style.display = 'block';
  } else {
    pre.style.display = 'none';
  }
});

document.getElementById('seg-apply-btn').addEventListener('click', () => {
  if (segZones.length === 0) {
    showToast('⚠ No segments to push', 'warn');
    return;
  }
  const payload = {
    on: true,
    seg: segZones.filter(s => s.visible).map((s, i) => segZoneToWled(s, i))
  };
  wledPost(payload);
});

document.getElementById('seg-fetch-btn').addEventListener('click', async () => {
  const ip = window.APP.ip;
  if (!ip) {
    showToast('⚠ No device IP — connect first', 'warn');
    return;
  }
  showToast('Fetching segments from ' + ip + '...', 'info', 1500);
  try {
    const res = await deviceFetch('http://' + ip + '/json/state');
    if (!res.ok) {
      showToast('✗ Fetch failed: HTTP ' + res.status, 'error', 4000);
      return;
    }
    const data = await res.json();
    const segs = data.seg || [];
    if (segs.length === 0) {
      showToast('⚠ No segments found on device', 'warn');
      return;
    }
    const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#14b8a6'];
    segZones = segs.map((s, i) => {
      function rgbToHex(arr) {
        if (!arr || arr.length < 3) return '#ffffff';
        return '#' + arr.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
      }
      // WLED 2D: start/stop = X cols, startY/stopY = Y rows
      const mW = window.APP.matrixW,
        mH = window.APP.matrixH;
      const x1 = s.start != null ? s.start : 0;
      const x2 = s.stop != null ? s.stop : mW;
      const y1 = s.startY != null ? s.startY : 0;
      const y2 = s.stopY != null ? s.stopY : mH;
      return {
        id: 'seg-' + (segIdCounter++),
        name: s.n || ('Seg-' + i),
        color: colors[i % colors.length],
        x1,
        y1,
        x2,
        y2,
        visible: true,
        locked: false,
        fx: s.fx || 0,
        pal: s.pal || 0,
        bri: s.bri != null ? s.bri : 200,
        sx: s.sx != null ? s.sx : 128,
        ix: s.ix != null ? s.ix : 128,
        col1: rgbToHex(s.col ? s.col[0] : null),
        col2: rgbToHex(s.col ? s.col[1] : null),
        col3: rgbToHex(s.col ? s.col[2] : null),
        on: s.on !== false,
        rev: s.rev || false,
        mi: s.mi || 0
      };
    });
    selectedSegId = segZones.length ? segZones[0].id : null;
    renderSegCanvas();
    renderSegLayerList();
    syncSegProps();
    showToast('✓ Fetched ' + segs.length + ' segment' + (segs.length > 1 ? 's' : ''), 'success');
  } catch (e) {
    showToast('✗ Cannot reach ' + ip + ' — ' + e.message, 'error', 5000);
  }
});

document.getElementById('seg-reset-btn').addEventListener('click', () => {
  segZones = [];
  selectedSegId = null;
  segIdCounter = 1;
  renderSegCanvas();
  renderSegLayerList();
  syncSegProps();
});

function initApp() {
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  // Load devices and pre-fill
  const d = loadDevices();
  if (d.activeId) {
    const all = [...d.matrices, ...d.strings];
    const active = all.find(x => x.id === d.activeId);
    if (active) {
      window.APP.ip = active.ip;
      window.APP.matrixW = active.width || 1;
      window.APP.matrixH = active.height || active.n || 64;
      document.getElementById('ip-input-d1a2').value = active.ip;
    }
  }
  populateDeviceDropdown();
  renderOverlayCanvas();
  renderSegCanvas();
  renderSegLayerList();
  renderLayerList();
  syncPropsPanel();
  renderDevices();
  renderPlaylists();
  renderPlaylistEditor();
  showPage('dashboard');
}

initApp();