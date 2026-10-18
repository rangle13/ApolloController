// ===========================
let segZones = [];
let segIdCounter = 1;
let selectedSegId = null;

const segCanvas = $('#seg-canvas')[0];

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
    x1: 0,
    y1: 0,
    x2: 16,
    y2: 16,
    visible: true,
    locked: false,
    mi: 0,
    fx: 0,
    pal: 5,
    bri: 200,
    sx: 128,
    ix: 128,
    col1: colors[segZones.length % colors.length],
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
  $(segCanvas).find('.seg-zone').remove();
  segCanvas.style.setProperty('--ar', window.APP.matrixW / window.APP.matrixH);
  const cw = segCellW(),
    ch = segCellH();
  segCanvas.style.backgroundImage = 'linear-gradient(#1a1d27 1px, transparent 1px), linear-gradient(90deg, #1a1d27 1px, transparent 1px)';
  segCanvas.style.backgroundSize = cw + 'px ' + ch + 'px';
  $('#seg-canvas-label').text(window.APP.matrixW + '×' + window.APP.matrixH);
  const sdt = $('#seg-device-title');
  if (sdt.length) sdt.text(window.APP.name || 'M1');

  segZones.forEach(seg => {
    if (!seg.visible) return;
    const div = $('<div>').addClass('seg-zone').attr('data-segid', seg.id);
    const isActive = seg.id === selectedSegId && !seg.locked;
    const left = seg.x1 * cw,
      top = seg.y1 * ch;
    const w = (seg.x2 - seg.x1) * cw,
      h = (seg.y2 - seg.y1) * ch;
    div.css({
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      width: w + 'px',
      height: h + 'px',
      background: seg.col1,
      border: (isActive ? '2' : '1') + 'px solid ' + seg.col1,
      outline: isActive ? '2px solid #f59e0b' : 'none',
      zIndex: isActive ? '10' : '1',
      opacity: isActive ? '1' : '0.6',
      cursor: isActive ? 'move' : 'default',
      pointerEvents: (seg.locked || !isActive) ? 'none' : 'auto',
      borderRadius: '2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    });
    const lbl = $('<span>').text((seg.locked ? '🔒 ' : '') + seg.name);
    lbl.css({
      color: '#fff',
      fontSize: '10px',
      pointerEvents: 'none',
      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
      textAlign: 'center'
    });
    div.append(lbl);
    const fxLbl = $('<span>').text('fx:' + seg.fx + ' pal:' + seg.pal);
    fxLbl.css({
      color: 'rgba(255,255,255,0.6)',
      fontSize: '9px',
      pointerEvents: 'none'
    });
    div.append(fxLbl);

    if (isActive) {
      div.css('pointer-events', 'auto');
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
        const hdl = $('<div>').addClass('box-handle').attr({ 'data-handle': h, 'data-segid': seg.id });
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
      div.on('mousedown', (e) => {
        if ($(e.target).hasClass('box-handle')) return;
        e.preventDefault();
        startSegDrag('move', seg.id, e.clientX, e.clientY);
      });
    }
    $(segCanvas).append(div);
  });

  $(segCanvas).find('.seg-zone .box-handle').on('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startSegDrag(this.dataset.handle, this.dataset.segid, e.clientX, e.clientY);
  });
  updateSegStatus();
}

// Click canvas background to select a zone
$(segCanvas).on('mousedown', (e) => {
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

function clamp(v, mn, mx) {
  return Math.max(mn, Math.min(mx, v));
}

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

$(document).on('mousemove', (e) => {
  const pill = $('#seg-coord-pill');
  if (!pill.length) return;
  const rect = segCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left,
    my = e.clientY - rect.top;
  const cw = segCellW(),
    ch = segCellH();

  if (!segDrag.active) {
    if (window.APP.activePage === 'segments' && mx >= 0 && mx <= rect.width && my >= 0 && my <= rect.height) {
      pill.text('X: ' + Math.floor(mx / cw) + '  Y: ' + Math.floor(my / ch));
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
  if (segDrag.type === 'move') pill.text('X: ' + x1 + '  Y: ' + y1 + '  [move]');
  else pill.text('X: ' + x1 + '–' + x2 + '  Y: ' + y1 + '–' + y2 + '  [resize]');
  renderSegCanvas();
  syncSegProps();
});

$(document).on('mouseup', () => {
  segDrag.active = false;
});

function renderSegLayerList() {
  const list = $('#seg-layer-list');
  const empty = $('#seg-no-items');
  // Remove only dynamic rows, keep placeholder in DOM
  list.find('.seg-layer-row').remove();
  $('#seg-delete-all-btn').toggle(segZones.length > 0);
  if (segZones.length === 0) {
    empty.show();
    return;
  }
  empty.hide();
  segZones.forEach((seg, idx) => {
    const row = $('<div>').addClass('layer-row seg-layer-row' + (seg.id === selectedSegId ? ' selected' : ''));
    row.html(`
      <span style="width:12px;height:12px;border-radius:2px;background:${seg.col1};display:inline-block;flex-shrink:0;"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;font-size:12px;">${seg.name}</span>
      <button class="sl-vis" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px;" title="Toggle visibility">${seg.visible?'👁':'👁'}</button>
      <button class="sl-lock" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px;${seg.locked?'color:var(--amber);':''}" title="Toggle lock">🔒</button>
      <button class="sl-up" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;color:var(--muted);">↑</button>
      <button class="sl-down" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;color:var(--muted);">↓</button>
      <button class="sl-del" data-idx="${idx}" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px;color:#ef4444;font-weight:700;" title="Delete">✕</button>
    `);
    row.on('click', (e) => {
      if ($(e.target).closest('button').length) return;
      selectedSegId = seg.id;
      renderSegCanvas();
      renderSegLayerList();
      syncSegProps();
    });
    list.append(row);
  });
  list.find('.sl-vis').on('click', function (e) {
    e.stopPropagation();
    const s = segZones[+this.dataset.idx];
    s.visible = !s.visible;
    renderSegCanvas();
    renderSegLayerList();
  });
  list.find('.sl-lock').on('click', function (e) {
    e.stopPropagation();
    const s = segZones[+this.dataset.idx];
    s.locked = !s.locked;
    renderSegCanvas();
    renderSegLayerList();
    syncSegProps();
  });
  list.find('.sl-up').on('click', function (e) {
    e.stopPropagation();
    const i = +this.dataset.idx;
    if (i > 0) {
      [segZones[i - 1], segZones[i]] = [segZones[i], segZones[i - 1]];
      renderSegCanvas();
      renderSegLayerList();
    }
  });
  list.find('.sl-down').on('click', function (e) {
    e.stopPropagation();
    const i = +this.dataset.idx;
    if (i < segZones.length - 1) {
      [segZones[i + 1], segZones[i]] = [segZones[i], segZones[i + 1]];
      renderSegCanvas();
      renderSegLayerList();
    }
  });
  list.find('.sl-del').on('click', function (e) {
    e.stopPropagation();
    const s = segZones[+this.dataset.idx];
    segZones = segZones.filter(x => x.id !== s.id);
    if (selectedSegId === s.id) selectedSegId = segZones.length ? segZones[0].id : null;
    renderSegCanvas();
    renderSegLayerList();
    syncSegProps();
  });
}

function syncSegProps() {
  const empty = $('#seg-props-empty');
  const form = $('#seg-props-form');
  const seg = segZones.find(s => s.id === selectedSegId);
  if (!seg) {
    empty.show();
    form.hide();
    return;
  }
  empty.hide();
  form.show();
  $('#sp-name').val(seg.name);
  $('#sp-x1').val(seg.x1);
  $('#sp-x2').val(seg.x2);
  $('#sp-y1').val(seg.y1);
  $('#sp-y2').val(seg.y2);
  // Fetched effects/palettes may not be in the dropdown; add them so the value isn't lost (NaN -> null in JSON)
  ['#sp-fx', '#sp-pal'].forEach(sel => {
    const v = sel === '#sp-fx' ? seg.fx : seg.pal;
    if (!$(sel + ' option[value="' + v + '"]').length) $(sel).append(new Option(v + ' – (device)', v));
  });
  $('#sp-fx').val(seg.fx);
  $('#sp-pal').val(seg.pal);
  $('#sp-bri').val(seg.bri);
  $('#sp-bri-val').text(seg.bri);
  $('#sp-sx').val(seg.sx);
  $('#sp-sx-val').text(seg.sx);
  $('#sp-ix').val(seg.ix);
  $('#sp-ix-val').text(seg.ix);
  $('#sp-col1').val(seg.col1);
  $('#sp-col2').val(seg.col2);
  $('#sp-col3').val(seg.col3);
  $('#sp-on').prop('checked', seg.on);
  $('#sp-rev').prop('checked', seg.rev);
  const miEl = $('#sp-mi');
  if (miEl.length) miEl.val(seg.mi || 0);
  updateSegStatus();
}

function updateFromSegProps() {
  const seg = segZones.find(s => s.id === selectedSegId);
  if (!seg) return;
  seg.name = $('#sp-name').val();
  seg.x1 = parseInt($('#sp-x1').val()) || 0;
  seg.x2 = parseInt($('#sp-x2').val()) || 1;
  seg.y1 = parseInt($('#sp-y1').val()) || 0;
  seg.y2 = parseInt($('#sp-y2').val()) || 1;
  seg.fx = parseInt($('#sp-fx').val());
  seg.pal = parseInt($('#sp-pal').val());
  seg.bri = parseInt($('#sp-bri').val());
  $('#sp-bri-val').text(seg.bri);
  seg.sx = parseInt($('#sp-sx').val());
  $('#sp-sx-val').text(seg.sx);
  seg.ix = parseInt($('#sp-ix').val());
  $('#sp-ix-val').text(seg.ix);
  seg.col1 = $('#sp-col1').val();
  seg.col2 = $('#sp-col2').val();
  seg.col3 = $('#sp-col3').val();
  seg.on = $('#sp-on').prop('checked');
  seg.rev = $('#sp-rev').prop('checked');
  const miW = $('#sp-mi');
  if (miW.length) seg.mi = parseInt(miW.val()) || 0;
  renderSegCanvas();
  renderSegLayerList();
  updateSegStatus();
}

function segZoneToWled(seg, idx) {
  // WLED 2D API: start/stop = X column range, startY/stopY = Y row range
  return {
    id: idx,
    n: seg.name,
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
  const st = $('#seg-status-bar');
  if (!st.length) return;
  const seg = segZones.find(s => s.id === selectedSegId);
  if (!seg) {
    st.text('No segment selected — click a segment to select');
    return;
  }
  const w = seg.x2 - seg.x1,
    h = seg.y2 - seg.y1;
  const total = w * h;
  st.text('Selected: ' + seg.name + '  ·  X: ' + seg.x1 + '→' + seg.x2 + '  ·  Y: ' + seg.y1 + '→' + seg.y2 + '  ·  ' + w + '×' + h + ' = ' + total + ' LEDs  ·  fx:' + seg.fx + ' pal:' + seg.pal);
}

// Wire up all property inputs
['sp-name', 'sp-x1', 'sp-x2', 'sp-y1', 'sp-y2', 'sp-fx', 'sp-pal', 'sp-bri', 'sp-sx', 'sp-ix', 'sp-col1', 'sp-col2', 'sp-col3', 'sp-on', 'sp-rev', 'sp-mi'].forEach(id => {
  $('#' + id).on('input change', updateFromSegProps);
});

$('#seg-add-btn').on('click', addSegZone);

$('#seg-delete-all-btn').on('click', async () => {
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

$('#sp-json-btn').on('click', () => {
  const pre = $('#sp-json-pre');
  if (!pre.is(':visible')) {
    const seg = segZones.find(s => s.id === selectedSegId);
    if (seg) {
      const idx = segZones.indexOf(seg);
      pre.text(JSON.stringify({
        seg: [segZoneToWled(seg, idx)]
      }, null, 2));
    }
    pre.show();
  } else {
    pre.hide();
  }
});

$('#seg-add-preset-btn').on('click', () => {
  const pick = segZones.map((z, i) => ({ ...z, devId: i }));
  if (!pick.length) { showToast('⚠ No segments on the canvas', 'warn'); return; }
  const name = prompt('Preset name:', 'New Preset');
  if (name === null) return;
  prNew();
  prCur.name = name.trim() || 'New Preset';
  const n = prAddFromSegZones(pick);
  showPage('presets');
  showToast('✓ Preset "' + prCur.name + '" created with ' + n + ' segment(s)', 'success');
});

$('#seg-apply-btn').on('click', async () => {
  if (segZones.length === 0) {
    showToast('⚠ No segments to push', 'warn');
    return;
  }
  const payload = {
    on: true,
    seg: segZones.map((s, i) => {
      const w = segZoneToWled(s, i);
      if (!s.visible) w.on = false;
      return w;
    })
  };
  if (await wledPost(payload)) {
    // Read back so the Log page shows what the device actually holds
    try {
      await deviceFetch('http://' + window.APP.ip + '/json/state');
    } catch (_) {}
  }
});

$('#seg-fetch-btn').on('click', async () => {
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

$('#seg-reset-btn').on('click', () => {
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
      setActiveIp(active.ip);
      window.APP.matrixW = active.width || 1;
      window.APP.matrixH = active.height || active.n || 64;
      $('#ip-input-d1a2').val(active.ip);
    }
  }
  populateDeviceDropdown();
  renderSegCanvas();
  renderSegLayerList();
  renderDevices();
  renderPlaylists();
  renderPlaylistEditor();
  showPage('dashboard');
}

initApp();