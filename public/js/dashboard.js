document.getElementById('connect-btn-c3d4').addEventListener('click', () => {
  const ip = document.getElementById('ip-input-d1a2').value.trim();
  if (!ip) {
    showToast('Enter an IP address', 'warn');
    return;
  }
  setActiveIp(ip);
  window.APP.connected = true;
  const dot = document.querySelector('#conn-status-e5f6 .status-dot');
  dot.style.background = 'var(--success)';
  document.getElementById('conn-label-g7h8').textContent = 'Connected';
  showToast('Connected to ' + ip, 'success');
});

// Power toggle
document.getElementById('power-toggle-i9j0').addEventListener('change', function () {
  wledPost({
    on: this.checked
  });
});

// Brightness
let briTimer = null;
document.getElementById('bri-slider-m3n4').addEventListener('input', function () {
  document.getElementById('bri-val-o5p6').textContent = this.value;
  clearTimeout(briTimer);
  briTimer = setTimeout(() => wledPost({
    bri: parseInt(this.value)
  }), 400);
});

// All Off
document.getElementById('alloff-btn-q7r8').addEventListener('click', () => {
  wledPost({
    on: false,
    bri: 0
  });
  document.getElementById('power-toggle-i9j0').checked = false;
  document.getElementById('bri-slider-m3n4').value = 0;
  document.getElementById('bri-val-o5p6').textContent = '0';
});

// Apply indicators: green = selection not yet applied, gray = already applied
let appliedPresetKey = null;
let appliedOverlayKey = null;

function refreshPresetApplyState() {
  const sel = document.getElementById('preset-sel-s9t0');
  const btn = document.getElementById('apply-preset-w3x4');
  const isApplied = sel.value === appliedPresetKey;
  btn.classList.toggle('applied', isApplied);
  btn.classList.toggle('pending', !isApplied);
}

function refreshOverlayApplyState() {
  const sel = document.getElementById('overlay-preset-sel-y5z6');
  const btn = document.getElementById('apply-overlay-preset-c9d0');
  const isApplied = sel.value === appliedOverlayKey;
  btn.classList.toggle('applied', isApplied);
  btn.classList.toggle('pending', !isApplied);
}

document.getElementById('preset-sel-s9t0').addEventListener('change', refreshPresetApplyState);
document.getElementById('overlay-preset-sel-y5z6').addEventListener('change', refreshOverlayApplyState);

// Apply Preset
document.getElementById('apply-preset-w3x4').addEventListener('click', () => {
  const sel = document.getElementById('preset-sel-s9t0');
  if (PRESETS[sel.value]) {
    wledPost(PRESETS[sel.value].payload);
    appliedPresetKey = sel.value;
    refreshPresetApplyState();
  }
});

// Apply Overlay Preset
document.getElementById('apply-overlay-preset-c9d0').addEventListener('click', () => {
  const sel = document.getElementById('overlay-preset-sel-y5z6');
  if (OVERLAY_PRESETS[sel.value]) {
    wledPost(OVERLAY_PRESETS[sel.value].payload);
    appliedOverlayKey = sel.value;
    refreshOverlayApplyState();
  }
});

refreshPresetApplyState();
refreshOverlayApplyState();

// Dashboard playlist controls
document.getElementById('dash-pl-play-g3h4').addEventListener('click', () => {
  const candidates = (typeof getPlaylistsForIp === 'function') ? getPlaylistsForIp(window.APP.ip) : loadPlaylists();
  if (candidates.length) {
    ENGINE.play(candidates[0]);
    showToast('Playing: ' + candidates[0].name, 'success');
    updateDashPlaylist();
  } else showToast('No playlists available for this device', 'warn');
});
document.getElementById('dash-pl-stop-i5j6').addEventListener('click', () => {
  ENGINE.stop();
  updateDashPlaylist();
});
document.getElementById('dash-pl-manage-k7l8').addEventListener('click', () => showPage('playlist'));

function updateDashPlaylist() {
  const el = document.getElementById('active-pl-label-e1f2');
  if (ENGINE.running && ENGINE.playlist) {
    el.textContent = 'Playing: ' + ENGINE.playlist.name + ' — Step ' + (ENGINE.stepIdx + 1);
  } else {
    const candidates = (typeof getPlaylistsForIp === 'function') ? getPlaylistsForIp(window.APP.ip) : [];
    el.textContent = candidates.length ? 'Ready: ' + candidates[0].name : 'No playlist playing';
  }
}

// Saved device dropdown
function populateDeviceDropdown() {
  const sel = document.getElementById('saved-device-dd-x1b3');
  const d = loadDevices();
  const all = [...d.matrices, ...d.strings];
  sel.innerHTML = '<option value="">Or use saved device…</option>';
  all.forEach(dev => {
    const o = document.createElement('option');
    o.value = dev.ip;
    o.textContent = dev.name + ' (' + dev.ip + ')';
    sel.appendChild(o);
  });
}
document.getElementById('saved-device-dd-x1b3').addEventListener('change', function () {
  if (this.value) {
    document.getElementById('ip-input-d1a2').value = this.value;
    setActiveIp(this.value);
  }
});

// === TEXT DELAY PAGE ===