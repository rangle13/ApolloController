$('#connect-btn-c3d4').on('click', () => {
  const ip = $('#ip-input-d1a2').val().trim();
  if (!ip) {
    showToast('Enter an IP address', 'warn');
    return;
  }
  setActiveIp(ip);
  window.APP.connected = true;
  $('#conn-status-e5f6 .status-dot').css('background', 'var(--success)');
  $('#conn-label-g7h8').text('Connected');
  showToast('Connected to ' + ip, 'success');
});

// Power toggle
$('#power-toggle-i9j0').on('change', function () {
  wledPost({
    on: $(this).prop('checked')
  });
});

// Brightness
let briTimer = null;
$('#bri-slider-m3n4').on('input', function () {
  const brightness = $(this).val();
  $('#bri-val-o5p6').text(brightness);
  clearTimeout(briTimer);
  briTimer = setTimeout(() => wledPost({
    bri: parseInt(brightness)
  }), 400);
});

// All Off
$('#alloff-btn-q7r8').on('click', () => {
  wledPost({
    on: false,
    bri: 0
  });
  $('#power-toggle-i9j0').prop('checked', false);
  $('#bri-slider-m3n4').val(0);
  $('#bri-val-o5p6').text('0');
});

// Apply indicators: green = selection not yet applied, gray = already applied
let appliedPresetKey = null;
let appliedOverlayKey = null;

function refreshPresetApplyState() {
  const isApplied = $('#preset-sel-s9t0').val() === appliedPresetKey;
  $('#apply-preset-w3x4').toggleClass('applied', isApplied).toggleClass('pending', !isApplied);
}

function refreshOverlayApplyState() {
  const isApplied = $('#overlay-preset-sel-y5z6').val() === appliedOverlayKey;
  $('#apply-overlay-preset-c9d0').toggleClass('applied', isApplied).toggleClass('pending', !isApplied);
}

$('#preset-sel-s9t0').on('change', refreshPresetApplyState);
$('#overlay-preset-sel-y5z6').on('change', refreshOverlayApplyState);

// Apply Preset
$('#apply-preset-w3x4').on('click', () => {
  const presetKey = $('#preset-sel-s9t0').val();
  if (PRESETS[presetKey]) {
    wledPost(PRESETS[presetKey].payload);
    appliedPresetKey = presetKey;
    refreshPresetApplyState();
  }
});

// Apply Overlay Preset
$('#apply-overlay-preset-c9d0').on('click', () => {
  const presetKey = $('#overlay-preset-sel-y5z6').val();
  if (OVERLAY_PRESETS[presetKey]) {
    wledPost(OVERLAY_PRESETS[presetKey].payload);
    appliedOverlayKey = presetKey;
    refreshOverlayApplyState();
  }
});

refreshPresetApplyState();
refreshOverlayApplyState();

// Dashboard playlist controls
$('#dash-pl-play-g3h4').on('click', () => {
  const candidates = (typeof getPlaylistsForIp === 'function') ? getPlaylistsForIp(window.APP.ip) : loadPlaylists();
  if (candidates.length) {
    ENGINE.play(candidates[0]);
    showToast('Playing: ' + candidates[0].name, 'success');
    updateDashPlaylist();
  } else showToast('No playlists available for this device', 'warn');
});
$('#dash-pl-stop-i5j6').on('click', () => {
  ENGINE.stop();
  updateDashPlaylist();
});
$('#dash-pl-manage-k7l8').on('click', () => showPage('playlist'));

function updateDashPlaylist() {
  if (ENGINE.running && ENGINE.playlist) {
    $('#active-pl-label-e1f2').text('Playing: ' + ENGINE.playlist.name + ' — Step ' + (ENGINE.stepIdx + 1));
  } else {
    const candidates = (typeof getPlaylistsForIp === 'function') ? getPlaylistsForIp(window.APP.ip) : [];
    $('#active-pl-label-e1f2').text(candidates.length ? 'Ready: ' + candidates[0].name : 'No playlist playing');
  }
}

// Saved device dropdown
function populateDeviceDropdown() {
  const d = loadDevices();
  const all = [...d.matrices, ...d.strings];
  const select = $('#saved-device-dd-x1b3');
  select.empty().append($('<option>', { value: '', text: 'Or use saved device…' }));
  all.forEach(dev => {
    select.append($('<option>', {
      value: dev.ip,
      text: dev.name + ' (' + dev.ip + ')'
    }));
  });
}
$('#saved-device-dd-x1b3').on('change', function () {
  const ip = $(this).val();
  if (ip) {
    $('#ip-input-d1a2').val(ip);
    setActiveIp(ip);
  }
});

// === TEXT DELAY PAGE ===