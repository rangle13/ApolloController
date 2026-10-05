window.APP = {
  ip: '',
  connected: false,
  activePage: 'dashboard',
  activeBox: null,
  matrixW: 64,
  matrixH: 64
};

// === TOAST ===
function showToast(msg, type = 'info', duration = 2500) {
  const colors = {
    info: '#334155',
    warn: '#92400e',
    success: '#14532d',
    error: '#7f1d1d'
  };
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '9999',
    background: colors[type] || colors.info,
    color: '#f1f5f9',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    transition: 'opacity 0.3s',
    maxWidth: '320px'
  });
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// === WLED POST ===
async function wledPost(payload, ipOverride) {
  const ip = ipOverride || window.APP.ip;
  if (!ip) {
    showToast('⚠ No device IP — connect first', 'warn');
    return false;
  }
  try {
    const res = await deviceFetch('http://' + ip + '/json/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    // Parse response body — WLED returns JSON with error info
    let body = null;
    try {
      body = await res.json();
    } catch (_) {}

    if (!res.ok) {
      const msg = body?.error || body?.message || 'HTTP ' + res.status;
      showToast('✗ Device error: ' + msg, 'error', 4000);
      console.error('[wledPost] HTTP ' + res.status, body, payload);
      return false;
    }
    // Check for WLED-level errors in a 200 response
    if (body && body.error) {
      showToast('✗ WLED error: ' + body.error, 'error', 4000);
      console.error('[wledPost] WLED error:', body.error, payload);
      return false;
    }
    showToast('✓ ' + ip + ' — OK', 'success', 1800);
    return true;
  } catch (e) {
    // Network error — device unreachable, wrong IP, or firewall
    const msg = e.message || String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS') || msg.includes('ERR_')) {
      showToast('✗ Cannot reach ' + ip + ' — check IP and that the device is on', 'error', 5000);
    } else {
      showToast('✗ Send failed: ' + msg, 'error', 5000);
    }
    console.error('[wledPost] Network error:', e, 'Payload:', payload);
    return false;
  }
}

// === NAVIGATION ===
const pages = ['dashboard', 'textdelay', 'overlay', 'devices', 'playlist', 'segments', 'log'];

function showPage(name) {
  window.APP.activePage = name;
  pages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) {
      el.classList.toggle('active', p === name);
    }
  });
  document.querySelectorAll('.nav-tab[data-nav]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.nav === name);
  });
  if (name === 'overlay') {
    renderOverlayCanvas();
  }
  if (name === 'devices') {
    renderDevices();
  }
  if (name === 'playlist') {
    renderPlaylists();
  }
  if (name === 'segments') {
    renderSegCanvas();
    renderSegLayerList();
    syncSegProps();
  }
}
document.querySelectorAll('.nav-tab[data-nav]').forEach(tab => {
  tab.addEventListener('click', () => showPage(tab.dataset.nav));
});

// === PRESETS ===
const PRESETS = {
  'Solid Amber': {
    payload: {
      on: true,
      bri: 200,
      seg: [{
        id: 0,
        fx: 0,
        pal: 0,
        col: [
          [255, 160, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Steady warm amber across all LEDs'
  },
  'Ocean Wave': {
    payload: {
      on: true,
      bri: 200,
      seg: [{
        id: 0,
        fx: 65,
        pal: 9,
        sx: 100,
        ix: 150
      }]
    },
    desc: 'Flowing blue-green colorwave'
  },
  'Fire Storm': {
    payload: {
      on: true,
      bri: 220,
      seg: [{
        id: 0,
        fx: 66,
        pal: 35,
        sx: 80,
        ix: 180
      }]
    },
    desc: 'Intense fire simulation'
  },
  'Rainbow Cycle': {
    payload: {
      on: true,
      bri: 200,
      seg: [{
        id: 0,
        fx: 9,
        pal: 11,
        sx: 128
      }]
    },
    desc: 'Full spectrum rainbow rotation'
  },
  'Gentle Pulse': {
    payload: {
      on: true,
      bri: 150,
      seg: [{
        id: 0,
        fx: 2,
        pal: 0,
        sx: 60
      }]
    },
    desc: 'Slow gentle breathe effect'
  },
  'Party Mode': {
    payload: {
      on: true,
      bri: 255,
      seg: [{
        id: 0,
        fx: 7,
        pal: 6,
        sx: 200
      }]
    },
    desc: 'Fast dynamic party colors'
  },
  'Cool Breeze': {
    payload: {
      on: true,
      bri: 180,
      seg: [{
        id: 0,
        fx: 65,
        pal: 7,
        sx: 70
      }]
    },
    desc: 'Cool blue cloud drift'
  },
  'Sunrise Warm': {
    payload: {
      on: true,
      bri: 180,
      seg: [{
        id: 0,
        fx: 12,
        pal: 8,
        sx: 40
      }]
    },
    desc: 'Warm sunrise lava fade'
  },
  'Deep Space': {
    payload: {
      on: true,
      bri: 160,
      seg: [{
        id: 0,
        fx: 0,
        pal: 0,
        col: [
          [0, 0, 40, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Deep dark blue solid'
  },
  'Thunderstorm': {
    payload: {
      on: true,
      bri: 255,
      seg: [{
        id: 0,
        fx: 1,
        pal: 0,
        sx: 240,
        col: [
          [255, 255, 255, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Fast white strobe lightning'
  },
};

const OVERLAY_PRESETS = {
  'None': {
    payload: {
      seg: [{
        id: 0,
        on: false
      }]
    },
    desc: 'No overlay active'
  },
  'Soft Vignette': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 0,
        bri: 80,
        col: [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Dark edges fading inward'
  },
  'Color Splash': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 65,
        pal: 6,
        bri: 150,
        sx: 120
      }]
    },
    desc: 'Colorful overlay waves'
  },
  'Edge Highlight': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 0,
        bri: 100,
        col: [
          [255, 200, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Bright edge accent ring'
  },
  'Center Glow': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 2,
        bri: 120,
        sx: 40,
        col: [
          [255, 180, 60, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Pulsing center warm glow'
  },
  'Diagonal Sweep': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 12,
        pal: 9,
        bri: 140,
        sx: 80
      }]
    },
    desc: 'Sweeping diagonal gradient'
  },
  'Corner Burst': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 7,
        pal: 11,
        bri: 180,
        sx: 160
      }]
    },
    desc: 'Bursting colors from corners'
  },
  'Scanline': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 1,
        bri: 60,
        sx: 200,
        col: [
          [255, 255, 255, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Horizontal scanning line'
  },
  'Radial Fade': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 2,
        bri: 100,
        sx: 30,
        col: [
          [100, 0, 255, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Radial purple breathing fade'
  },
  'Neon Border': {
    payload: {
      seg: [{
        id: 0,
        on: true,
        fx: 0,
        bri: 200,
        col: [
          [0, 255, 100, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      }]
    },
    desc: 'Bright neon green border'
  },
};

// Populate preset selects
function populateSelect(selId, presetsObj) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '';
  Object.keys(presetsObj).forEach(k => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = k;
    sel.appendChild(o);
  });
}
populateSelect('preset-sel-s9t0', PRESETS);
populateSelect('overlay-preset-sel-y5z6', OVERLAY_PRESETS);

function updatePresetDesc() {
  const sel = document.getElementById('preset-sel-s9t0');
  const desc = document.getElementById('preset-desc-u1v2');
  if (sel && desc && PRESETS[sel.value]) desc.textContent = PRESETS[sel.value].desc;
}

function updateOverlayPresetDesc() {
  const sel = document.getElementById('overlay-preset-sel-y5z6');
  const desc = document.getElementById('overlay-preset-desc-a7b8');
  if (sel && desc && OVERLAY_PRESETS[sel.value]) desc.textContent = OVERLAY_PRESETS[sel.value].desc;
}
document.getElementById('preset-sel-s9t0').addEventListener('change', updatePresetDesc);
document.getElementById('overlay-preset-sel-y5z6').addEventListener('change', updateOverlayPresetDesc);
updatePresetDesc();
updateOverlayPresetDesc();

// === DASHBOARD EVENTS ===